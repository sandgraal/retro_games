/**
 * Import Modal Component
 * UI for importing games from Steam and third-party services
 */

import {
  ImportSource,
  ImportResult,
  ImportMatch,
  IMPORT_SOURCES,
  parseSteamId,
  fetchSteamLibrary,
  autoDetectAndParse,
} from "../features/platform-import";
import { setGameStatus, setGameNotes } from "../state/store";
import type { CollectionStatus } from "../core/types";

// Modal state
let isOpen = false;
let currentStep: "select" | "input" | "review" | "complete" = "select";
let selectedSource: ImportSource | null = null;
let importResult: ImportResult | null = null;
let selectedMatches: Set<string> = new Set();
let isLoading = false;

// === Modal Container ===

function getOrCreateModal(): HTMLElement {
  let modal = document.getElementById("import-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "import-modal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content import-modal-content">
        <button class="modal-close" aria-label="Close import modal">&times;</button>
        <div id="import-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close handlers
    modal.querySelector(".modal-close")?.addEventListener("click", closeImportModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeImportModal();
    });

    // Escape key handler
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closeImportModal();
    });
  }
  return modal;
}

export function openImportModal(): void {
  const modal = getOrCreateModal();
  isOpen = true;
  currentStep = "select";
  selectedSource = null;
  importResult = null;
  selectedMatches.clear();
  isLoading = false;

  renderCurrentStep();
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

export function closeImportModal(): void {
  const modal = document.getElementById("import-modal");
  if (modal) {
    modal.classList.remove("active");
    isOpen = false;
    document.body.style.overflow = "";
  }
}

// === Step Renderers ===

function renderCurrentStep(): void {
  const body = document.getElementById("import-modal-body");
  if (!body) return;

  switch (currentStep) {
    case "select":
      renderSourceSelection(body);
      break;
    case "input":
      renderInputStep(body);
      break;
    case "review":
      renderReviewStep(body);
      break;
    case "complete":
      renderCompleteStep(body);
      break;
  }
}

function renderSourceSelection(container: HTMLElement): void {
  container.innerHTML = `
    <div class="import-step">
      <h2>📥 Import Your Game Library</h2>
      <p class="import-description">
        Import your existing game collections from gaming platforms and tracking services.
        Select a source below to get started.
      </p>
      
      <div class="import-source-grid">
        ${IMPORT_SOURCES.map(
          (source) => `
          <button class="import-source-card" data-source="${source.id}">
            <span class="import-source-icon">${getSourceIcon(source.id)}</span>
            <span class="import-source-name">${source.name}</span>
            <span class="import-source-desc">${source.description}</span>
          </button>
        `
        ).join("")}
      </div>
    </div>
  `;

  // Add click handlers
  container.querySelectorAll(".import-source-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedSource = card.getAttribute("data-source") as ImportSource;
      currentStep = "input";
      renderCurrentStep();
    });
  });
}

function renderInputStep(container: HTMLElement): void {
  if (!selectedSource) return;

  const source = IMPORT_SOURCES.find((s) => s.id === selectedSource);
  if (!source) return;

  const isSteam = selectedSource === "steam";

  container.innerHTML = `
    <div class="import-step">
      <button class="import-back-btn" id="back-to-select">← Back</button>
      <h2>${getSourceIcon(selectedSource)} Import from ${source.name}</h2>
      
      ${
        isSteam
          ? `
        <div class="import-input-section">
          <label for="steam-id-input">Enter your Steam ID or Profile URL</label>
          <input 
            type="text" 
            id="steam-id-input" 
            class="import-text-input"
            placeholder="e.g., 76561198012345678 or vanity name"
          />
          <p class="import-help">
            Your Steam profile must be <strong>public</strong> for this to work.
            <a href="https://steamcommunity.com/my/edit/settings" target="_blank" rel="noopener">Check privacy settings</a>
          </p>
          <div class="import-steam-formats">
            <strong>Accepted formats:</strong>
            <ul>
              <li>64-bit Steam ID: <code>76561198012345678</code></li>
              <li>Profile URL: <code>steamcommunity.com/profiles/76561198012345678</code></li>
              <li>Vanity URL: <code>steamcommunity.com/id/myname</code></li>
              <li>Vanity name: <code>myname</code></li>
            </ul>
          </div>
        </div>
      `
          : `
        <div class="import-input-section">
          ${
            source.exportUrl
              ? `
            <p class="import-export-link">
              First, export your data from 
              <a href="${source.exportUrl}" target="_blank" rel="noopener">${source.name}</a>
            </p>
          `
              : ""
          }
          
          <div class="import-dropzone" id="import-dropzone">
            <span class="dropzone-icon">📄</span>
            <span class="dropzone-text">Drop your export file here</span>
            <span class="dropzone-subtext">or click to browse</span>
            <input type="file" id="import-file-input" accept=".csv,.json,.txt" hidden />
          </div>
          
          <p class="import-help">
            Supports CSV and JSON formats. The file will be auto-detected based on content.
          </p>
        </div>
      `
      }
      
      <div class="import-actions">
        <button class="btn btn-secondary" id="cancel-import">Cancel</button>
        <button class="btn btn-primary" id="start-import" ${isSteam ? "" : "disabled"}>
          ${isSteam ? "Import Library" : "Process File"}
        </button>
      </div>
      
      ${isLoading ? '<div class="import-loading"><span class="spinner"></span> Processing...</div>' : ""}
      
      <div id="import-error" class="import-error" hidden></div>
    </div>
  `;

  // Event handlers
  container.querySelector("#back-to-select")?.addEventListener("click", () => {
    currentStep = "select";
    renderCurrentStep();
  });

  container.querySelector("#cancel-import")?.addEventListener("click", closeImportModal);

  if (isSteam) {
    const steamInput = container.querySelector("#steam-id-input") as HTMLInputElement;
    const startBtn = container.querySelector("#start-import") as HTMLButtonElement;

    steamInput?.addEventListener("input", () => {
      const steamId = parseSteamId(steamInput.value);
      startBtn.disabled = !steamId;
    });

    startBtn?.addEventListener("click", async () => {
      const steamId = parseSteamId(steamInput.value);
      if (!steamId) return;

      isLoading = true;
      renderCurrentStep();

      try {
        // Use Supabase Edge Function as proxy
        // @ts-expect-error Vite env types
        const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
        const proxyUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined;

        importResult = await fetchSteamLibrary(steamId, proxyUrl);

        if (importResult.errors.length > 0) {
          showError(importResult.errors.join("\n"));
        } else {
          currentStep = "review";
        }
      } catch (error) {
        showError(
          error instanceof Error ? error.message : "Failed to import Steam library"
        );
      } finally {
        isLoading = false;
        renderCurrentStep();
      }
    });
  } else {
    // File upload handling
    const dropzone = container.querySelector("#import-dropzone") as HTMLElement;
    const fileInput = container.querySelector("#import-file-input") as HTMLInputElement;
    const startBtn = container.querySelector("#start-import") as HTMLButtonElement;

    dropzone?.addEventListener("click", () => fileInput?.click());

    dropzone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone?.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone?.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const files = (e as DragEvent).dataTransfer?.files;
      if (files?.[0]) {
        handleFileSelect(files[0], startBtn);
      }
    });

    fileInput?.addEventListener("change", () => {
      if (fileInput.files?.[0]) {
        handleFileSelect(fileInput.files[0], startBtn);
      }
    });
  }
}

let pendingFileContent: string | null = null;
let pendingFilename: string | null = null;

function handleFileSelect(file: File, startBtn: HTMLButtonElement): void {
  const reader = new FileReader();

  reader.onload = (e) => {
    pendingFileContent = e.target?.result as string;
    pendingFilename = file.name;

    const dropzone = document.querySelector("#import-dropzone");
    if (dropzone) {
      dropzone.innerHTML = `
        <span class="dropzone-icon">✅</span>
        <span class="dropzone-text">${file.name}</span>
        <span class="dropzone-subtext">${formatFileSize(file.size)}</span>
      `;
    }

    startBtn.disabled = false;
    startBtn.onclick = processUploadedFile;
  };

  reader.readAsText(file);
}

async function processUploadedFile(): Promise<void> {
  if (!pendingFileContent) return;

  isLoading = true;
  renderCurrentStep();

  try {
    importResult = autoDetectAndParse(pendingFileContent, pendingFilename || undefined);

    if (importResult.errors.length > 0 && importResult.total === 0) {
      showError(importResult.errors.join("\n"));
    } else {
      currentStep = "review";
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : "Failed to process file");
  } finally {
    isLoading = false;
    pendingFileContent = null;
    pendingFilename = null;
    renderCurrentStep();
  }
}

function renderReviewStep(container: HTMLElement): void {
  if (!importResult) return;

  // Pre-select all high-confidence matches
  if (selectedMatches.size === 0) {
    importResult.matches.forEach((match, index) => {
      if (match.matched && match.confidence >= 0.8) {
        selectedMatches.add(String(index));
      }
    });
  }

  const matchedGames = importResult.matches.filter((m) => m.matched);
  const unmatchedGames = importResult.matches.filter((m) => !m.matched);

  container.innerHTML = `
    <div class="import-step import-review">
      <button class="import-back-btn" id="back-to-input">← Back</button>
      <h2>📋 Review Import</h2>
      
      <div class="import-stats">
        <div class="import-stat">
          <span class="stat-value">${importResult.total}</span>
          <span class="stat-label">Games Found</span>
        </div>
        <div class="import-stat import-stat-success">
          <span class="stat-value">${importResult.matched}</span>
          <span class="stat-label">Matched</span>
        </div>
        <div class="import-stat import-stat-warning">
          <span class="stat-value">${importResult.unmatched}</span>
          <span class="stat-label">Unmatched</span>
        </div>
      </div>
      
      ${
        importResult.errors.length > 0
          ? `
        <div class="import-warnings">
          <strong>⚠️ Warnings:</strong>
          <ul>${importResult.errors.map((e) => `<li>${e}</li>`).join("")}</ul>
        </div>
      `
          : ""
      }
      
      <div class="import-selection-controls">
        <button class="btn btn-sm" id="select-all-matched">Select All Matched</button>
        <button class="btn btn-sm" id="deselect-all">Deselect All</button>
        <span class="selection-count">${selectedMatches.size} selected</span>
      </div>
      
      <div class="import-status-selector">
        <label>Import as:</label>
        <select id="import-status">
          <option value="owned">Owned</option>
          <option value="backlog">Backlog</option>
          <option value="wishlist">Wishlist</option>
        </select>
      </div>
      
      <div class="import-matches-container">
        ${
          matchedGames.length > 0
            ? `
          <div class="import-matches-section">
            <h3>✅ Matched Games (${matchedGames.length})</h3>
            <div class="import-matches-list">
              ${matchedGames
                .map((match) => {
                  const originalIdx = importResult!.matches.indexOf(match);
                  return renderMatchRow(match, originalIdx);
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }
        
        ${
          unmatchedGames.length > 0
            ? `
          <div class="import-matches-section import-unmatched">
            <h3>❓ Unmatched Games (${unmatchedGames.length})</h3>
            <p class="import-unmatched-note">
              These games weren't found in our catalog. They may be using different names or 
              aren't in our database yet.
            </p>
            <div class="import-matches-list">
              ${unmatchedGames.map((match) => renderUnmatchedRow(match)).join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>
      
      <div class="import-actions">
        <button class="btn btn-secondary" id="cancel-review">Cancel</button>
        <button class="btn btn-primary" id="confirm-import" ${selectedMatches.size === 0 ? "disabled" : ""}>
          Import ${selectedMatches.size} Games
        </button>
      </div>
    </div>
  `;

  // Event handlers
  container.querySelector("#back-to-input")?.addEventListener("click", () => {
    currentStep = "input";
    renderCurrentStep();
  });

  container.querySelector("#cancel-review")?.addEventListener("click", closeImportModal);

  container.querySelector("#select-all-matched")?.addEventListener("click", () => {
    importResult!.matches.forEach((match, idx) => {
      if (match.matched) {
        selectedMatches.add(String(idx));
      }
    });
    renderCurrentStep();
  });

  container.querySelector("#deselect-all")?.addEventListener("click", () => {
    selectedMatches.clear();
    renderCurrentStep();
  });

  // Match checkboxes
  container.querySelectorAll(".import-match-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", (e) => {
      const idx = (e.target as HTMLInputElement).dataset.index!;
      if ((e.target as HTMLInputElement).checked) {
        selectedMatches.add(idx);
      } else {
        selectedMatches.delete(idx);
      }
      updateImportButton();
    });
  });

  // Alternative match selection
  container.querySelectorAll(".alternative-match-select").forEach((select) => {
    select.addEventListener("change", (e) => {
      const idx = (e.target as HTMLSelectElement).dataset.index!;
      const newKey = (e.target as HTMLSelectElement).value;
      // Update the match in place
      const match = importResult!.matches[parseInt(idx)];
      const alternative = match.alternativeMatches?.find((m) => m.key === newKey);
      if (alternative) {
        match.matched = alternative;
        match.confidence = 0.7; // Manual selection
        renderCurrentStep();
      }
    });
  });

  // Confirm import
  container.querySelector("#confirm-import")?.addEventListener("click", performImport);
}

function renderMatchRow(match: ImportMatch, index: number): string {
  const isSelected = selectedMatches.has(String(index));
  const confidenceClass =
    match.confidence >= 0.9 ? "high" : match.confidence >= 0.7 ? "medium" : "low";

  return `
    <div class="import-match-row ${isSelected ? "selected" : ""}">
      <label class="import-match-label">
        <input 
          type="checkbox" 
          class="import-match-checkbox"
          data-index="${index}"
          ${isSelected ? "checked" : ""}
        />
        <div class="import-match-info">
          <div class="import-match-source">
            <span class="source-name">${match.imported.name}</span>
            <span class="source-platform">${match.imported.platform}</span>
          </div>
          <div class="import-match-arrow">→</div>
          <div class="import-match-catalog">
            <span class="catalog-name">${match.matched?.game_name}</span>
            <span class="catalog-platform">${match.matched?.platform}</span>
          </div>
          <span class="import-confidence confidence-${confidenceClass}">
            ${Math.round(match.confidence * 100)}%
          </span>
        </div>
      </label>
      ${
        match.alternativeMatches && match.alternativeMatches.length > 0
          ? `
        <select class="alternative-match-select" data-index="${index}">
          <option value="">Other matches...</option>
          ${match.alternativeMatches
            .map(
              (alt) =>
                `<option value="${alt.key}">${alt.game_name} (${alt.platform})</option>`
            )
            .join("")}
        </select>
      `
          : ""
      }
    </div>
  `;
}

function renderUnmatchedRow(match: ImportMatch): string {
  return `
    <div class="import-match-row unmatched">
      <div class="import-match-info">
        <div class="import-match-source">
          <span class="source-name">${match.imported.name}</span>
          <span class="source-platform">${match.imported.platform}</span>
        </div>
        <span class="import-no-match">No match found</span>
      </div>
    </div>
  `;
}

function updateImportButton(): void {
  const btn = document.querySelector("#confirm-import") as HTMLButtonElement;
  const count = document.querySelector(".selection-count");

  if (btn) {
    btn.disabled = selectedMatches.size === 0;
    btn.textContent = `Import ${selectedMatches.size} Games`;
  }
  if (count) {
    count.textContent = `${selectedMatches.size} selected`;
  }
}

function performImport(): void {
  if (!importResult || selectedMatches.size === 0) return;

  const statusSelect = document.querySelector("#import-status") as HTMLSelectElement;
  const status = (statusSelect?.value || "owned") as CollectionStatus;

  let imported = 0;
  let failed = 0;

  selectedMatches.forEach((indexStr) => {
    const index = parseInt(indexStr);
    const match = importResult!.matches[index];

    if (match.matched) {
      try {
        // Use the status from the import or the selected default
        const gameStatus = match.imported.status || status;
        setGameStatus(match.matched.key, gameStatus);

        // Add import note
        const importNote = `Imported from ${match.imported.source}`;
        const playtimeNote = match.imported.playtime
          ? ` (${Math.round(match.imported.playtime / 60)}h played)`
          : "";
        setGameNotes(match.matched.key, importNote + playtimeNote);

        imported++;
      } catch {
        failed++;
      }
    }
  });

  // Show completion
  currentStep = "complete";
  importResult = {
    ...importResult,
    matched: imported,
    unmatched: failed,
  };
  renderCurrentStep();
}

function renderCompleteStep(container: HTMLElement): void {
  const matched = importResult?.matched || 0;

  container.innerHTML = `
    <div class="import-step import-complete">
      <div class="import-success-icon">✅</div>
      <h2>Import Complete!</h2>
      <p class="import-success-message">
        Successfully imported <strong>${matched}</strong> games to your collection.
      </p>
      
      <div class="import-actions">
        <button class="btn btn-secondary" id="import-more">Import More</button>
        <button class="btn btn-primary" id="close-import">View Collection</button>
      </div>
    </div>
  `;

  container.querySelector("#import-more")?.addEventListener("click", () => {
    currentStep = "select";
    importResult = null;
    selectedMatches.clear();
    renderCurrentStep();
  });

  container.querySelector("#close-import")?.addEventListener("click", closeImportModal);
}

// === Utility Functions ===

function showError(message: string): void {
  const errorDiv = document.querySelector("#import-error") as HTMLElement;
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.hidden = false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceIcon(source: ImportSource): string {
  const icons: Record<ImportSource, string> = {
    steam: "🎮",
    xbox: "🟢",
    playstation: "🔵",
    nintendo: "🔴",
    backloggd: "📚",
    ggdeals: "💰",
    howlongtobeat: "⏱️",
    exophase: "🏆",
    grouvee: "📖",
    rawg: "🎲",
    csv: "📄",
  };
  return icons[source] || "📁";
}

// === Styles ===

export function injectImportStyles(): void {
  if (document.getElementById("import-modal-styles")) return;

  const styles = document.createElement("style");
  styles.id = "import-modal-styles";
  styles.textContent = `
    .import-modal-content {
      max-width: 800px;
      max-height: 90vh;
      overflow-y: auto;
    }
    
    .import-step {
      padding: 1.5rem;
    }
    
    .import-step h2 {
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }
    
    .import-description {
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    
    .import-back-btn {
      background: none;
      border: none;
      color: var(--accent);
      cursor: pointer;
      padding: 0.5rem 0;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    
    .import-back-btn:hover {
      text-decoration: underline;
    }
    
    .import-source-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .import-source-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.25rem;
      background: var(--surface);
      border: 2px solid var(--border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }
    
    .import-source-card:hover {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
    
    .import-source-icon {
      font-size: 2rem;
    }
    
    .import-source-name {
      font-weight: 600;
      color: var(--text-primary);
    }
    
    .import-source-desc {
      font-size: 0.75rem;
      color: var(--text-secondary);
      line-height: 1.3;
    }
    
    .import-input-section {
      margin: 1.5rem 0;
    }
    
    .import-input-section label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }
    
    .import-text-input {
      width: 100%;
      padding: 0.75rem;
      font-size: 1rem;
      border: 2px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-primary);
    }
    
    .import-text-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    
    .import-help {
      margin-top: 0.75rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    
    .import-help a {
      color: var(--accent);
    }
    
    .import-steam-formats {
      margin-top: 1rem;
      padding: 1rem;
      background: var(--surface);
      border-radius: 8px;
      font-size: 0.85rem;
    }
    
    .import-steam-formats ul {
      margin: 0.5rem 0 0 1.5rem;
      padding: 0;
    }
    
    .import-steam-formats code {
      background: var(--background);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.8rem;
    }
    
    .import-dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 2rem;
      border: 2px dashed var(--border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: var(--surface);
    }
    
    .import-dropzone:hover,
    .import-dropzone.dragover {
      border-color: var(--accent);
      background: rgba(var(--accent-rgb), 0.05);
    }
    
    .dropzone-icon {
      font-size: 3rem;
    }
    
    .dropzone-text {
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--text-primary);
    }
    
    .dropzone-subtext {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    
    .import-export-link {
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: rgba(var(--accent-rgb), 0.1);
      border-radius: 8px;
    }
    
    .import-export-link a {
      color: var(--accent);
      font-weight: 500;
    }
    
    .import-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    
    .import-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem;
      color: var(--text-secondary);
    }
    
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .import-error {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: rgba(220, 53, 69, 0.1);
      border: 1px solid rgba(220, 53, 69, 0.3);
      border-radius: 8px;
      color: #dc3545;
      font-size: 0.9rem;
    }
    
    /* Review Step */
    .import-stats {
      display: flex;
      gap: 1.5rem;
      margin: 1.5rem 0;
    }
    
    .import-stat {
      text-align: center;
      padding: 1rem 1.5rem;
      background: var(--surface);
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    
    .import-stat-success {
      border-color: #28a745;
      background: rgba(40, 167, 69, 0.1);
    }
    
    .import-stat-warning {
      border-color: #ffc107;
      background: rgba(255, 193, 7, 0.1);
    }
    
    .stat-value {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .stat-label {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    
    .import-warnings {
      margin: 1rem 0;
      padding: 0.75rem 1rem;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 8px;
      font-size: 0.9rem;
    }
    
    .import-warnings ul {
      margin: 0.5rem 0 0 1.5rem;
      padding: 0;
    }
    
    .import-selection-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .selection-count {
      margin-left: auto;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    
    .import-status-selector {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1rem 0;
    }
    
    .import-status-selector select {
      padding: 0.5rem 1rem;
      border: 2px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      color: var(--text-primary);
      font-size: 0.9rem;
    }
    
    .import-matches-container {
      max-height: 400px;
      overflow-y: auto;
      margin: 1rem 0;
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    
    .import-matches-section {
      padding: 1rem;
    }
    
    .import-matches-section h3 {
      margin: 0 0 1rem;
      font-size: 1rem;
      color: var(--text-primary);
    }
    
    .import-unmatched {
      background: rgba(108, 117, 125, 0.05);
      border-top: 1px solid var(--border);
    }
    
    .import-unmatched-note {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 1rem;
    }
    
    .import-matches-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    .import-match-row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      transition: all 0.2s ease;
    }
    
    .import-match-row.selected {
      border-color: var(--accent);
      background: rgba(var(--accent-rgb), 0.05);
    }
    
    .import-match-row.unmatched {
      opacity: 0.6;
    }
    
    .import-match-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      width: 100%;
    }
    
    .import-match-checkbox {
      width: 18px;
      height: 18px;
      accent-color: var(--accent);
    }
    
    .import-match-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex: 1;
      min-width: 0;
    }
    
    .import-match-source,
    .import-match-catalog {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    
    .source-name,
    .catalog-name {
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .source-platform,
    .catalog-platform {
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    
    .import-match-arrow {
      color: var(--text-secondary);
      flex-shrink: 0;
    }
    
    .import-confidence {
      margin-left: auto;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    
    .confidence-high {
      background: rgba(40, 167, 69, 0.15);
      color: #28a745;
    }
    
    .confidence-medium {
      background: rgba(255, 193, 7, 0.15);
      color: #856404;
    }
    
    .confidence-low {
      background: rgba(220, 53, 69, 0.15);
      color: #dc3545;
    }
    
    .import-no-match {
      margin-left: auto;
      color: var(--text-secondary);
      font-size: 0.85rem;
      font-style: italic;
    }
    
    .alternative-match-select {
      margin-left: 2rem;
      padding: 0.35rem 0.75rem;
      font-size: 0.8rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: var(--background);
      color: var(--text-secondary);
    }
    
    /* Complete Step */
    .import-complete {
      text-align: center;
      padding: 3rem 2rem;
    }
    
    .import-success-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    
    .import-success-message {
      font-size: 1.1rem;
      color: var(--text-secondary);
      margin-bottom: 2rem;
    }
    
    .import-complete .import-actions {
      justify-content: center;
      border-top: none;
    }
    
    /* Button styles */
    .btn {
      padding: 0.6rem 1.25rem;
      font-size: 0.95rem;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .btn-primary {
      background: var(--accent);
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      opacity: 0.9;
    }
    
    .btn-secondary {
      background: var(--surface);
      color: var(--text-primary);
      border: 1px solid var(--border);
    }
    
    .btn-secondary:hover:not(:disabled) {
      background: var(--background);
    }
    
    .btn-sm {
      padding: 0.4rem 0.75rem;
      font-size: 0.8rem;
    }
    
    /* Responsive */
    @media (max-width: 640px) {
      .import-source-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .import-stats {
        flex-direction: column;
        gap: 0.75rem;
      }
      
      .import-match-info {
        flex-wrap: wrap;
      }
      
      .import-match-arrow {
        display: none;
      }
    }
  `;
  document.head.appendChild(styles);
}
