import { beforeEach, describe, expect, it } from "vitest";
import { mountModal } from "../src/ui/modal";
import {
  closeGameModal,
  openGameModal,
  setPriceMeta,
  setPrices,
} from "../src/state";

const game = {
  game_name: "Sample Adventure",
  platform: "NES",
  genre: "Action",
  rating: "9.1",
  release_year: "1989",
  external_links: {
    wiki: "https://example.com/wiki",
    store: "https://example.com/store",
    community: "https://example.com/community",
  },
  key: "Sample Adventure___NES",
};

function renderModal(): void {
  document.body.innerHTML = `
    <div
      class="modal-backdrop"
      id="gameModalBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameModalTitle"
      aria-hidden="true"
      hidden
    >
      <div class="modal" id="gameModal">
        <header class="modal-header">
          <h2 class="modal-title" id="gameModalTitle">Game Details</h2>
          <button type="button" class="modal-close" id="gameModalClose" aria-label="Close modal">
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div class="modal-content">
          <div class="modal-cover" id="gameModalCover">
            <div class="modal-cover-image">
              <img src="" alt="" id="gameModalCoverImage" />
            </div>
            <div class="modal-cover-actions" id="gameModalActions"></div>
          </div>
          <div class="modal-info">
            <div class="modal-details" id="gameModalDetails"></div>
            <div class="modal-guides" id="gameModalGuides"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  mountModal("#gameModalBackdrop");
}

describe("modal component", () => {
  beforeEach(() => {
    setPrices({});
    setPriceMeta({ source: "none" });
    closeGameModal();
    renderModal();
  });

  it("renders external link chips with aria labels", () => {
    openGameModal(game as any);
    const chips = document.querySelectorAll<HTMLElement>(".modal-link-chip");

    expect(chips.length).toBe(3);
    expect(chips[0].getAttribute("aria-label")).toContain("wiki");
    expect(chips[1].getAttribute("aria-label")).toContain("store");
    expect(chips[2].getAttribute("aria-label")).toContain("community");
  });

  it("traps focus between the first and last focusable elements", () => {
    openGameModal(game as any);
    const backdrop = document.querySelector<HTMLElement>("#gameModalBackdrop")!;
    const focusable = backdrop.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    expect(document.activeElement).toBe(focusable[0]);

    const last = focusable[focusable.length - 1];
    last.focus();
    backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));

    expect(document.activeElement).toBe(focusable[0]);
  });

  it("shows a friendly pricing fallback message when no data exists", () => {
    setPriceMeta({ source: "none", reason: "No sources" });
    openGameModal({ ...game, key: "NoPrice___NES" } as any);
    const pricingFallback = document.querySelector(".modal-pricing__empty");

    expect(pricingFallback?.textContent).toContain("Pricing data isn't available");
  });

  it("renders pricing section with actual price data", () => {
    const gameWithPricing = { ...game, key: "Sample Adventure___NES" };
    setPrices({
      "Sample Adventure___NES": {
        loose: 1599,
        cib: 2999,
        new: 5999,
        currency: "USD",
        source: "pricecharting",
        lastUpdated: "2024-01-15T10:00:00Z",
      },
    });
    setPriceMeta({ source: "live", lastUpdated: "2024-01-15T10:00:00Z" });

    openGameModal(gameWithPricing as any);

    const priceLabels = document.querySelectorAll(".price-label");
    const priceValues = document.querySelectorAll(".price-value");

    expect(priceLabels.length).toBe(3);
    expect(priceLabels[0].textContent).toBe("Loose");
    expect(priceLabels[1].textContent).toBe("Complete");
    expect(priceLabels[2].textContent).toBe("New");

    // formatCurrency with fromCents and no precision rounds to whole dollars
    expect(priceValues[0].textContent).toContain("$16");
    expect(priceValues[1].textContent).toContain("$30");
    expect(priceValues[2].textContent).toContain("$60");
  });

  it("renders regional offers display", () => {
    const gameWithOffers = { ...game, key: "Sample Adventure___NES" };
    setPrices({
      "Sample Adventure___NES": {
        loose: 1599,
        currency: "USD",
        source: "aggregate",
        offers: {
          "North America": [
            {
              amountCents: 2499,
              currency: "USD",
              label: "Buy It Now",
              retailer: "eBay",
              url: "https://ebay.com/item/123",
              lastUpdated: "2024-01-15T10:00:00Z",
            },
          ],
          Europe: [
            {
              amountCents: 2999,
              currency: "EUR",
              label: "Used",
              retailer: "Amazon",
            },
          ],
        },
      },
    });

    openGameModal(gameWithOffers as any);

    const offerRows = document.querySelectorAll(".modal-offers__row");
    expect(offerRows.length).toBe(2);

    const firstOffer = offerRows[0];
    expect(firstOffer.querySelector(".modal-offers__region")?.textContent).toBe("North America");
    expect(firstOffer.querySelector(".modal-offers__label")?.textContent).toContain("Buy It Now");
    expect(firstOffer.querySelector(".modal-offers__label")?.textContent).toContain("eBay");
    expect(firstOffer.querySelector(".modal-offers__price")?.textContent).toContain("$25");
    expect(firstOffer.querySelector(".modal-offers__cta")).not.toBeNull();

    const secondOffer = offerRows[1];
    expect(secondOffer.querySelector(".modal-offers__region")?.textContent).toBe("Europe");
    expect(secondOffer.querySelector(".modal-offers__label")?.textContent).toContain("Used");
    // formatCurrency always outputs USD format (formatters hardcoded to USD currency)
    expect(secondOffer.querySelector(".modal-offers__price")?.textContent).toContain("$30");
  });

  it("renders extended metadata panel with developer, publisher, and ESRB", () => {
    const gameWithMetadata = {
      ...game,
      key: "Sample Adventure___NES",
      developer: "Awesome Studios",
      publisher: "Big Publisher Inc.",
      esrb_rating: "E - Everyone",
      metacritic_score: 85,
      description: "An epic adventure game",
    };

    openGameModal(gameWithMetadata as any);

    const metadataPanel = document.querySelector(".modal-metadata");
    expect(metadataPanel).not.toBeNull();

    const summary = document.querySelector(".modal-metadata__summary");
    expect(summary?.textContent).toContain("Extended metadata");

    // Open the details element to check content
    const details = metadataPanel as HTMLDetailsElement;
    details.open = true;

    const description = document.querySelector(".modal-metadata__description");
    expect(description?.textContent).toBe("An epic adventure game");

    const metadataRows = document.querySelectorAll(".modal-metadata__row");
    expect(metadataRows.length).toBeGreaterThan(0);

    const rowTexts = Array.from(metadataRows).map((row) => row.textContent);
    expect(rowTexts.some((text) => text?.includes("Developer") && text?.includes("Awesome Studios"))).toBe(true);
    expect(rowTexts.some((text) => text?.includes("Publisher") && text?.includes("Big Publisher Inc."))).toBe(true);
    expect(rowTexts.some((text) => text?.includes("ESRB") && text?.includes("E - Everyone"))).toBe(true);
    expect(rowTexts.some((text) => text?.includes("Metacritic") && text?.includes("85"))).toBe(true);
  });

  it("renders multiple external links of same type (store and community arrays)", () => {
    const gameWithMultipleLinks = {
      ...game,
      key: "Sample Adventure___NES",
      external_links: {
        wiki: "https://wikipedia.org/wiki/SampleGame",
        store: [
          "https://store1.com/game",
          "https://store2.com/game",
          "https://store3.com/game",
        ],
        community: [
          "https://reddit.com/r/samplegame",
          "https://discord.gg/samplegame",
        ],
      },
    };

    openGameModal(gameWithMultipleLinks as any);

    const linkChips = document.querySelectorAll(".modal-link-chip");

    // 1 wiki + 3 store + 2 community = 6 total
    expect(linkChips.length).toBe(6);

    // Check that we have store links
    const storeLinks = Array.from(linkChips).filter((chip) =>
      chip.getAttribute("aria-label")?.includes("store")
    );
    expect(storeLinks.length).toBe(3);

    // Check that we have community links
    const communityLinks = Array.from(linkChips).filter((chip) =>
      chip.getAttribute("aria-label")?.includes("community")
    );
    expect(communityLinks.length).toBe(2);
  });

  it("extracts link labels from URLs via buildLinkLabel function", () => {
    const gameWithVariedLinks = {
      ...game,
      key: "Sample Adventure___NES",
      external_links: {
        wiki: "https://www.wikipedia.org/wiki/SampleGame",
        store: [
          "https://www.ebay.com/item/123",
          "https://amazon.com/dp/456",
        ],
        community: "https://www.reddit.com/r/samplegame",
      },
    };

    openGameModal(gameWithVariedLinks as any);

    const linkChips = document.querySelectorAll<HTMLElement>(".modal-link-chip");
    const labels = Array.from(linkChips).map((chip) =>
      chip.querySelector(".modal-link-chip__label")?.textContent?.trim()
    );

    // Check that www. is stripped and domains are extracted
    expect(labels).toContain("wikipedia.org");
    expect(labels).toContain("ebay.com");
    expect(labels).toContain("amazon.com");
    expect(labels).toContain("reddit.com");
  });
});
