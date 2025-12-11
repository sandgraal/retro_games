import type { SuggestionRecord } from "../core/types";
import { getAuthSession } from "../data/auth";
import {
  decideSuggestion,
  fetchSuggestionsForModeration,
} from "../data/suggestions";
import { el, mount } from "./components";

function renderDiffRow(key: string, before: unknown, after: unknown): HTMLElement {
  return el.div(
    { class: "moderation-diff", role: "listitem" },
    el.span({ class: "moderation-diff__key" }, key),
    el.span({ class: "moderation-diff__before" }, before === undefined ? "—" : String(before)),
    el.span({ class: "moderation-diff__after" }, after === undefined ? "—" : String(after))
  );
}

function renderSuggestionCard(
  suggestion: SuggestionRecord,
  onDecision: (status: "approved" | "rejected", notes?: string) => Promise<void>
): HTMLElement {
  const card = el.div({ class: "moderation-card", role: "listitem" });
  const meta = el.div({ class: "moderation-card__meta" });
  meta.append(
    el.span({ class: "badge" }, suggestion.type === "new" ? "New game" : "Patch"),
    el.span({ class: "badge badge--status" }, suggestion.status),
    el.span({}, `Submitted ${new Date(suggestion.submittedAt).toLocaleString()}`)
  );

  const title = suggestion.delta.title || suggestion.delta.game_name || suggestion.targetId;
  const titleEl = document.createElement("h3");
  titleEl.className = "moderation-card__title";
  titleEl.textContent = String(title ?? "Suggestion");
  card.append(titleEl);
  card.append(meta);

  const diffList = el.div({ class: "moderation-diff-list", role: "list" });
  const canonical = suggestion.canonical || {};
  const keys = Object.keys(suggestion.delta || {});
  keys.forEach((key) => {
    diffList.append(renderDiffRow(key, (canonical as Record<string, unknown>)[key], suggestion.delta[key]));
  });
  if (!keys.length) {
    diffList.append(el.div({ class: "moderation-empty" }, "No fields provided"));
  }
  card.append(diffList);

  if (suggestion.notes) {
    card.append(el.div({ class: "moderation-note" }, `Submitter note: ${suggestion.notes}`));
  }

  const actionBar = el.div({ class: "moderation-actions" });
  const notesInput = el.input({
    type: "text",
    placeholder: "Add moderation note",
    class: "moderation-note-input",
    value: suggestion.moderationNotes || "",
  });
  const approveBtn = el.button({ class: "btn btn-primary" }, "Approve & merge");
  const rejectBtn = el.button({ class: "btn" }, "Reject");

  approveBtn.addEventListener("click", () => onDecision("approved", notesInput.value));
  rejectBtn.addEventListener("click", () => onDecision("rejected", notesInput.value));

  actionBar.append(notesInput, approveBtn, rejectBtn);
  card.append(actionBar);

  return card;
}

export function mountModerationPanel(selector: string): () => void {
  return mount(selector, (ctx) => {
    const { element } = ctx;
    element.innerHTML = "";
    element.classList.add("moderation-panel");

    const headerTitle = document.createElement("h2");
    headerTitle.textContent = "Moderation queue";
    const header = el.div(
      { class: "moderation-panel__header" },
      headerTitle,
      el.span(
        { class: "moderation-panel__subtitle" },
        "Review community submissions and merge approved patches."
      )
    );
    element.append(header);

    const list = el.div({ class: "moderation-list", role: "list" });
    element.append(list);

    const statusEl = el.div({ class: "moderation-status", role: "status" });
    element.append(statusEl);

    async function loadSuggestions() {
      const session = await getAuthSession();
      if (!["moderator", "admin"].includes(session.role)) {
        element.hidden = true;
        return;
      }
      element.hidden = false;
      statusEl.textContent = "Loading suggestions...";
      try {
        const suggestions = await fetchSuggestionsForModeration();
        list.innerHTML = "";
        if (!suggestions.length) {
          list.append(el.div({ class: "moderation-empty" }, "No pending submissions"));
          statusEl.textContent = "All caught up.";
          return;
        }
        suggestions.forEach((suggestion) => {
          const card = renderSuggestionCard(suggestion, async (status, notes) => {
            statusEl.textContent = "Submitting decision...";
            await decideSuggestion(suggestion.id, status, notes);
            await loadSuggestions();
          });
          list.append(card);
        });
        statusEl.textContent = "";
      } catch (error) {
        statusEl.textContent = error instanceof Error ? error.message : "Failed to load suggestions";
      }
    }

    loadSuggestions();
  });
}
