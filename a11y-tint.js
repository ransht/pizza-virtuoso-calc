// Match the accessibility widget's accent color to the real brand red/gold, the
// same way pizzavirtuoso.co.il itself does. The widget renders into a Shadow
// DOM, so a page-level stylesheet can't reach it — this has to run after the
// widget mounts and inject the override inside its shadow root.
function tintAccessibilityWidget() {
  const host = [...document.body.children].find((el) => el.shadowRoot?.querySelector(".anid-trigger"));
  if (!host?.shadowRoot) return false;
  const style = document.createElement("style");
  style.textContent = `
    .anid-trigger,
    .anid-trigger[aria-expanded="true"],
    .anid-panel-header,
    .anid-toggle input:checked + .anid-toggle-slider,
    .anid-btn.anid-active {
      background: #9f261c !important;
      border-color: #9f261c !important;
    }
    .anid-slider::-webkit-slider-thumb,
    .anid-slider::-moz-range-thumb {
      background: #9f261c !important;
    }
    .anid-trigger:focus-visible,
    .anid-slider:focus-visible,
    .anid-toggle input:focus-visible + .anid-toggle-slider {
      outline-color: #b69a58 !important;
    }
  `;
  host.shadowRoot.append(style);
  return true;
}
function waitForWidget(attemptsLeft) {
  if (tintAccessibilityWidget() || attemptsLeft <= 0) return;
  setTimeout(() => waitForWidget(attemptsLeft - 1), 200);
}
waitForWidget(25); // ~5s of polling, generous for a deferred third-party mount
