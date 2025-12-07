/**
 * Bridge Patch - Exposes app.js internals to window
 * This script must load AFTER app.js completes its bootstrap
 */

// Listen for when app.js completes its initial load
window.addEventListener("DOMContentLoaded", () => {
  console.log("🔌 Bridge patch waiting for app.js bootstrap...");

  // Poll for signs that app.js has loaded
  let pollAttempts = 0;
  const MAX_POLL = 100;

  const checkBootstrap = setInterval(() => {
    pollAttempts++;

    // Check if the legacy UI has been rendered
    const legacyTable = document.getElementById("gameTable");
    const legacyGrid = document.getElementById("gameGrid");
    const hasRendered =
      (legacyTable && legacyTable.querySelector("tr")) ||
      (legacyGrid && legacyGrid.children.length > 0);

    if (hasRendered || pollAttempts >= MAX_POLL) {
      clearInterval(checkBootstrap);

      if (hasRendered) {
        console.log("✅ app.js bootstrap detected, dispatching ready event");
        window.dispatchEvent(new CustomEvent("legacyAppReady"));
      } else {
        console.warn("⚠️ app.js bootstrap not detected, continuing anyway");
        window.dispatchEvent(new CustomEvent("legacyAppReady"));
      }
    }
  }, 50);
});
