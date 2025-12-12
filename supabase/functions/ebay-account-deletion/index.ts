/**
 * eBay Marketplace Account Deletion Notification Endpoint
 *
 * This Supabase Edge Function handles eBay's Marketplace Account Deletion/Closure
 * notifications as required by eBay's compliance requirements.
 *
 * Supports:
 * - GET: Endpoint verification via challenge_code
 * - POST: Account deletion/closure notification handling
 *
 * @see https://developer.ebay.com/marketplace-account-deletion
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";

/**
 * CORS headers - restrictive since this is a server-to-server callback endpoint.
 * eBay servers do not require CORS, but we keep minimal headers for debugging.
 * In production, consider removing CORS entirely or scoping to specific origins.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST",
};

/**
 * Expected notification types from eBay
 */
type EbayNotificationType =
  | "MARKETPLACE_ACCOUNT_DELETION"
  | "MARKETPLACE_ACCOUNT_CLOSURE";

/**
 * Allowed notification types for validation
 */
const ALLOWED_NOTIFICATION_TYPES: readonly EbayNotificationType[] = [
  "MARKETPLACE_ACCOUNT_DELETION",
  "MARKETPLACE_ACCOUNT_CLOSURE",
] as const;

/**
 * eBay notification payload structure
 * @see https://developer.ebay.com/marketplace-account-deletion
 */
interface EbayAccountDeletionPayload {
  metadata: {
    topic: string;
    schemaVersion: string;
    deprecated?: boolean;
  };
  notification: {
    notificationId: string;
    eventDate: string;
    publishDate: string;
    publishAttemptCount: number;
    data: {
      username: string;
      userId: string;
      eiasToken: string;
    };
  };
}

/**
 * Validates the eBay notification payload structure
 */
function validatePayload(payload: unknown): payload is EbayAccountDeletionPayload {
  if (!payload || typeof payload !== "object") return false;

  const p = payload as Record<string, unknown>;

  // Check metadata
  if (!p.metadata || typeof p.metadata !== "object") return false;
  const meta = p.metadata as Record<string, unknown>;
  if (typeof meta.topic !== "string") return false;
  if (typeof meta.schemaVersion !== "string") return false;

  // Check notification
  if (!p.notification || typeof p.notification !== "object") return false;
  const notif = p.notification as Record<string, unknown>;
  if (typeof notif.notificationId !== "string") return false;
  if (typeof notif.eventDate !== "string") return false;

  // Validate topic against allowed notification types
  if (!ALLOWED_NOTIFICATION_TYPES.includes(meta.topic as EbayNotificationType)) {
    return false;
  }

  // Check notification data
  if (!notif.data || typeof notif.data !== "object") return false;
  const data = notif.data as Record<string, unknown>;
  if (typeof data.username !== "string") return false;
  if (typeof data.userId !== "string") return false;
  if (typeof data.eiasToken !== "string") return false;

  return true;
}

/**
 * Compute SHA256 hash of the challenge response
 * Formula: SHA256(challenge_code + verification_token + endpoint_url)
 */
async function computeChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string
): Promise<string> {
  const input = `${challengeCode}${verificationToken}${endpointUrl}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(new Uint8Array(hashBuffer));
}

/**
 * Log notification in a structured format for audit purposes
 */
function logNotification(
  type: "received" | "processed" | "error",
  payload: EbayAccountDeletionPayload | null,
  details?: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service: "ebay-account-deletion",
    type,
    notificationId: payload?.notification?.notificationId ?? null,
    userId: payload?.notification?.data?.userId ?? null,
    username: payload?.notification?.data?.username ?? null,
    topic: payload?.metadata?.topic ?? null,
    eventDate: payload?.notification?.eventDate ?? null,
    ...details,
  };
  console.log(JSON.stringify(logEntry));
}

/**
 * Handle data deletion/anonymization for an eBay user
 *
 * TODO: Implement actual data deletion logic based on your data model.
 * This stub demonstrates the expected interface and logging.
 *
 * Suggested implementation:
 * 1. Look up user by eBay userId or username in your database
 * 2. Delete or anonymize personal data (emails, names, addresses)
 * 3. Optionally retain anonymized transaction history for legal compliance
 * 4. Log the deletion for audit purposes
 * 5. Consider queuing the deletion for async processing if it's expensive
 *
 * @param userId - The eBay user ID to delete
 * @param username - The eBay username to delete
 * @param eiasToken - The eBay EIAS token for the user
 * @returns Promise resolving to deletion result
 */
async function handleAccountDeletion(
  userId: string,
  username: string,
  eiasToken: string
): Promise<{ success: boolean; message: string }> {
  // Get Supabase client for database operations
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stubMode = Deno.env.get("EBAY_DELETION_STUB_MODE") === "true";

  if (!supabaseUrl || !serviceKey) {
    if (stubMode) {
      // Explicit stub mode: log and acknowledge without actual deletion
      console.warn("EBAY_DELETION_STUB_MODE enabled - deletion is a no-op stub");
      return {
        success: true,
        message: `Deletion request logged for user ${userId} (stub mode - no database configured)`,
      };
    }
    // Production: missing credentials is a configuration error
    console.error(
      "Supabase credentials not configured and EBAY_DELETION_STUB_MODE is not enabled"
    );
    return {
      success: false,
      message: `Server configuration error: unable to process deletion for user ${userId}`,
    };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // TODO: Implement your actual deletion logic here
  // Example queries you might run:
  //
  // // Delete user's price subscriptions
  // await supabase.from('user_price_alerts').delete().eq('ebay_user_id', userId);
  //
  // // Anonymize user data in transaction logs
  // await supabase.from('ebay_transactions')
  //   .update({ ebay_username: '[deleted]', ebay_user_id: '[deleted]' })
  //   .eq('ebay_user_id', userId);
  //
  // // Delete user sessions
  // await supabase.from('ebay_sessions').delete().eq('ebay_user_id', userId);

  // For now, log the deletion request
  console.log(
    JSON.stringify({
      action: "account_deletion_requested",
      userId,
      username,
      eiasToken: eiasToken.substring(0, 10) + "...", // Log partial token for debugging
      timestamp: new Date().toISOString(),
      status: "stub_acknowledged",
    })
  );

  return {
    success: true,
    message: `Deletion request acknowledged for eBay user ${userId}`,
  };
}

/**
 * Handle GET request - eBay endpoint verification
 */
async function handleVerificationChallenge(url: URL): Promise<Response> {
  const challengeCode = url.searchParams.get("challenge_code");

  if (!challengeCode) {
    return new Response(JSON.stringify({ error: "Missing challenge_code parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const verificationToken = Deno.env.get("EBAY_MARKETPLACE_VERIFICATION_TOKEN");
  const endpointUrl = Deno.env.get("EBAY_MARKETPLACE_ENDPOINT_URL");

  if (!verificationToken || !endpointUrl) {
    console.error(
      "Missing required environment variables: EBAY_MARKETPLACE_VERIFICATION_TOKEN and/or EBAY_MARKETPLACE_ENDPOINT_URL"
    );
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const challengeResponse = await computeChallengeResponse(
      challengeCode,
      verificationToken,
      endpointUrl
    );

    console.log(
      JSON.stringify({
        action: "verification_challenge",
        timestamp: new Date().toISOString(),
        status: "success",
      })
    );

    return new Response(JSON.stringify({ challengeResponse }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to compute challenge response:", error);
    return new Response(JSON.stringify({ error: "Failed to process challenge" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle POST request - Account deletion notification
 */
async function handleDeletionNotification(req: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    logNotification("error", null, { reason: "Invalid JSON body" });
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!validatePayload(payload)) {
    logNotification("error", null, {
      reason: "Invalid payload structure",
      received: JSON.stringify(payload).substring(0, 200),
    });
    return new Response(JSON.stringify({ error: "Invalid payload structure" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Log received notification
  logNotification("received", payload);

  const { userId, username, eiasToken } = payload.notification.data;

  try {
    const result = await handleAccountDeletion(userId, username, eiasToken);

    logNotification("processed", payload, {
      deletionResult: result,
    });

    // eBay expects a 200 OK response to acknowledge receipt
    return new Response(
      JSON.stringify({
        status: "acknowledged",
        notificationId: payload.notification.notificationId,
        message: result.message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logNotification("error", payload, {
      reason: "Deletion processing failed",
      error: errorMessage,
    });

    // Return 500 so eBay will retry the notification
    return new Response(
      JSON.stringify({
        error: "Failed to process deletion",
        notificationId: payload.notification.notificationId,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  // GET: Verification challenge from eBay
  if (req.method === "GET") {
    return handleVerificationChallenge(url);
  }

  // POST: Account deletion notification
  if (req.method === "POST") {
    return handleDeletionNotification(req);
  }

  // Method not allowed
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
