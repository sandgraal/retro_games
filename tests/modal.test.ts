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
});
