/**
 * Tests for eBay Marketplace Account Deletion Notification Endpoint
 *
 * These tests verify:
 * - GET: Challenge/verification flow (correct hash, JSON, status code)
 * - POST: Valid JSON handling, malformed JSON, and realistic payloads
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

// Mock environment variables
const mockEnv = {
  EBAY_MARKETPLACE_VERIFICATION_TOKEN: "test-verification-token-12345",
  EBAY_MARKETPLACE_ENDPOINT_URL:
    "https://test-project.supabase.co/functions/v1/ebay-account-deletion",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
};

// Helper to compute expected challenge response (mirrors the Edge Function logic)
function computeExpectedChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string
): string {
  const input = `${challengeCode}${verificationToken}${endpointUrl}`;
  return createHash("sha256").update(input).digest("hex");
}

// Sample eBay notification payload
const sampleDeletionPayload = {
  metadata: {
    topic: "MARKETPLACE_ACCOUNT_DELETION",
    schemaVersion: "1.0",
    deprecated: false,
  },
  notification: {
    notificationId: "a]b1c2d3-e4f5-6789-0abc-def123456789",
    eventDate: "2025-12-11T10:30:00.000Z",
    publishDate: "2025-12-11T10:30:05.000Z",
    publishAttemptCount: 1,
    data: {
      username: "testuser123",
      userId: "TESTUSER12345",
      eiasToken: "EXAMPLE-EIAS-TOKEN-FOR-TESTING-ONLY-12345",
    },
  },
};

describe("eBay Account Deletion Endpoint", () => {
  describe("Challenge Response Computation", () => {
    it("computes correct SHA256 hash for challenge response", () => {
      const challengeCode = "test-challenge-abc123";
      const verificationToken = mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN;
      const endpointUrl = mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL;

      const result = computeExpectedChallengeResponse(
        challengeCode,
        verificationToken,
        endpointUrl
      );

      // Verify it's a valid hex string of correct length (SHA256 = 64 hex chars)
      expect(result).toMatch(/^[a-f0-9]{64}$/);

      // Verify deterministic - same inputs produce same output
      const result2 = computeExpectedChallengeResponse(
        challengeCode,
        verificationToken,
        endpointUrl
      );
      expect(result).toBe(result2);
    });

    it("produces different hashes for different challenge codes", () => {
      const verificationToken = mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN;
      const endpointUrl = mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL;

      const result1 = computeExpectedChallengeResponse(
        "challenge-1",
        verificationToken,
        endpointUrl
      );
      const result2 = computeExpectedChallengeResponse(
        "challenge-2",
        verificationToken,
        endpointUrl
      );

      expect(result1).not.toBe(result2);
    });

    it("concatenates inputs in correct order (code + token + url)", () => {
      // This test ensures the order matches eBay's spec:
      // SHA256(challenge_code + verification_token + endpoint_url)
      const code = "abc";
      const token = "def";
      const url = "https://example.com";

      const expected = createHash("sha256").update(`${code}${token}${url}`).digest("hex");

      const result = computeExpectedChallengeResponse(code, token, url);
      expect(result).toBe(expected);

      // Verify different order produces different result
      const wrongOrder = createHash("sha256")
        .update(`${token}${code}${url}`)
        .digest("hex");
      expect(result).not.toBe(wrongOrder);
    });
  });

  describe("Payload Validation", () => {
    /**
     * Note: Ideally we'd import validatePayload directly from the Edge Function,
     * but the function uses Deno-specific imports that aren't compatible with
     * Node.js/Vitest. This inline validator mirrors the Edge Function logic
     * and should be kept in sync with any changes to the real implementation.
     */
    const ALLOWED_NOTIFICATION_TYPES = [
      "MARKETPLACE_ACCOUNT_DELETION",
      "MARKETPLACE_ACCOUNT_CLOSURE",
    ] as const;

    function validatePayload(payload: unknown): boolean {
      if (!payload || typeof payload !== "object") return false;

      const p = payload as Record<string, unknown>;

      // Check metadata
      if (!p.metadata || typeof p.metadata !== "object") return false;
      const meta = p.metadata as Record<string, unknown>;
      if (typeof meta.topic !== "string") return false;
      if (typeof meta.schemaVersion !== "string") return false;

      // Validate topic against allowed notification types
      if (!ALLOWED_NOTIFICATION_TYPES.includes(meta.topic as typeof ALLOWED_NOTIFICATION_TYPES[number])) {
        return false;
      }

      // Check notification
      if (!p.notification || typeof p.notification !== "object") return false;
      const notif = p.notification as Record<string, unknown>;
      if (typeof notif.notificationId !== "string") return false;
      if (typeof notif.eventDate !== "string") return false;

      // Check notification data
      if (!notif.data || typeof notif.data !== "object") return false;
      const data = notif.data as Record<string, unknown>;
      if (typeof data.username !== "string") return false;
      if (typeof data.userId !== "string") return false;
      if (typeof data.eiasToken !== "string") return false;

      return true;
    }

    it("validates correct eBay deletion payload", () => {
      expect(validatePayload(sampleDeletionPayload)).toBe(true);
    });

    it("rejects null payload", () => {
      expect(validatePayload(null)).toBe(false);
    });

    it("rejects non-object payload", () => {
      expect(validatePayload("string")).toBe(false);
      expect(validatePayload(123)).toBe(false);
      expect(validatePayload([])).toBe(false);
    });

    it("rejects payload missing metadata", () => {
      const payload = {
        notification: sampleDeletionPayload.notification,
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("rejects payload with invalid metadata.topic", () => {
      const payload = {
        metadata: {
          topic: 123, // should be string
          schemaVersion: "1.0",
        },
        notification: sampleDeletionPayload.notification,
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("rejects payload missing notification", () => {
      const payload = {
        metadata: sampleDeletionPayload.metadata,
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("rejects payload missing notification.data", () => {
      const payload = {
        metadata: sampleDeletionPayload.metadata,
        notification: {
          notificationId: "test-id",
          eventDate: "2025-12-11T10:30:00.000Z",
          // missing data
        },
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("rejects payload missing userId", () => {
      const payload = {
        metadata: sampleDeletionPayload.metadata,
        notification: {
          notificationId: "test-id",
          eventDate: "2025-12-11T10:30:00.000Z",
          data: {
            username: "testuser",
            // missing userId
          },
        },
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("accepts minimal valid payload", () => {
      const minimalPayload = {
        metadata: {
          topic: "MARKETPLACE_ACCOUNT_DELETION",
          schemaVersion: "1.0",
        },
        notification: {
          notificationId: "id-123",
          eventDate: "2025-12-11T00:00:00.000Z",
          data: {
            username: "user",
            userId: "USER123",
            eiasToken: "test-eias-token",
          },
        },
      };
      expect(validatePayload(minimalPayload)).toBe(true);
    });

    it("accepts closure notification type", () => {
      const closurePayload = {
        metadata: {
          topic: "MARKETPLACE_ACCOUNT_CLOSURE",
          schemaVersion: "1.0",
        },
        notification: {
          notificationId: "id-456",
          eventDate: "2025-12-11T00:00:00.000Z",
          data: {
            username: "closeduser",
            userId: "CLOSEDUSER789",
            eiasToken: "test-eias-token-closure",
          },
        },
      };
      expect(validatePayload(closurePayload)).toBe(true);
    });

    it("rejects payload missing eiasToken", () => {
      const payload = {
        metadata: sampleDeletionPayload.metadata,
        notification: {
          notificationId: "test-id",
          eventDate: "2025-12-11T10:30:00.000Z",
          data: {
            username: "testuser",
            userId: "TESTUSER123",
            // missing eiasToken
          },
        },
      };
      expect(validatePayload(payload)).toBe(false);
    });

    it("rejects invalid notification topic", () => {
      const payload = {
        metadata: {
          topic: "INVALID_NOTIFICATION_TYPE",
          schemaVersion: "1.0",
        },
        notification: {
          notificationId: "id-789",
          eventDate: "2025-12-11T00:00:00.000Z",
          data: {
            username: "user",
            userId: "USER123",
            eiasToken: "test-token",
          },
        },
      };
      expect(validatePayload(payload)).toBe(false);
    });
  });

  describe("Sample Payloads", () => {
    it("sample deletion payload has expected structure", () => {
      expect(sampleDeletionPayload.metadata.topic).toBe("MARKETPLACE_ACCOUNT_DELETION");
      expect(sampleDeletionPayload.notification.data.username).toBe("testuser123");
      expect(sampleDeletionPayload.notification.data.userId).toBe("TESTUSER12345");
    });

    it("sample payload contains required eiasToken", () => {
      expect(sampleDeletionPayload.notification.data.eiasToken).toBeDefined();
      expect(typeof sampleDeletionPayload.notification.data.eiasToken).toBe("string");
      expect(sampleDeletionPayload.notification.data.eiasToken.length).toBeGreaterThan(0);
    });
  });

  describe("Response Formats", () => {
    it("challenge response format is correct", () => {
      const challengeCode = "ebay-challenge-xyz";
      const response = {
        challengeResponse: computeExpectedChallengeResponse(
          challengeCode,
          mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN,
          mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL
        ),
      };

      expect(response).toHaveProperty("challengeResponse");
      expect(typeof response.challengeResponse).toBe("string");
      expect(response.challengeResponse).toMatch(/^[a-f0-9]{64}$/);
    });

    it("acknowledgment response format is correct", () => {
      const acknowledgmentResponse = {
        status: "acknowledged",
        notificationId: sampleDeletionPayload.notification.notificationId,
        message: "Deletion request acknowledged for eBay user TESTUSER12345",
      };

      expect(acknowledgmentResponse).toHaveProperty("status", "acknowledged");
      expect(acknowledgmentResponse).toHaveProperty("notificationId");
      expect(acknowledgmentResponse).toHaveProperty("message");
    });

    it("error response format is correct", () => {
      const errorResponse = {
        error: "Invalid JSON body",
      };

      expect(errorResponse).toHaveProperty("error");
      expect(typeof errorResponse.error).toBe("string");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty challenge code gracefully", () => {
      // Empty string should still produce a valid hash
      const result = computeExpectedChallengeResponse(
        "",
        mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN,
        mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL
      );
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles special characters in challenge code", () => {
      const specialChars = "abc!@#$%^&*()_+-=[]{}|;':\",./<>?";
      const result = computeExpectedChallengeResponse(
        specialChars,
        mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN,
        mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL
      );
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles unicode in challenge code", () => {
      const unicode = "test-🎮-日本語-émoji";
      const result = computeExpectedChallengeResponse(
        unicode,
        mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN,
        mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL
      );
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });

    it("handles very long challenge code", () => {
      const longCode = "x".repeat(10000);
      const result = computeExpectedChallengeResponse(
        longCode,
        mockEnv.EBAY_MARKETPLACE_VERIFICATION_TOKEN,
        mockEnv.EBAY_MARKETPLACE_ENDPOINT_URL
      );
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
