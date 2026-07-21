import { PRIMARY_COLOR, SECONDARY_COLOR } from "./theme.js";
import logoIcon from "../../assets/logo-icon.png";
import { FEATURE_FLAGS, setFeatureFlag } from "../featureFlags.js";

const BUTTON_ID = "gt-settings-btn";
const PANEL_ID = "gt-settings-panel";
const STALE_INDICATOR_ID = "gt-stale-indicator";

const FLAG_LABELS = {
  message: "Display announcement",
  checkCityStaleness: "Check city staleness",
};

// TODO: hardcoded for now — make this configurable later.
const HARDCODED_MESSAGE = "Hello? Is this thing on?";

function buildPanel() {
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = [
    "position:fixed",
    "bottom:60px",
    "left:16px",
    "z-index:100001",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "border-radius:8px",
    "padding:12px 14px",
    "color:#fff",
    "font:13px sans-serif",
    "box-shadow:0 4px 16px rgba(0,0,0,0.5)",
    "min-width:220px",
  ].join(";");

  if (FEATURE_FLAGS.message) {
    const message = document.createElement("div");
    message.textContent = HARDCODED_MESSAGE;
    message.style.cssText = [
      "margin-bottom:10px",
      "padding:8px 10px",
      "background:transparent",
      `border:1px dashed ${SECONDARY_COLOR}`,
      "color:#fff",
      "font-weight:600",
      "border-radius:4px",
    ].join(";");
    panel.appendChild(message);
  }

  const title = document.createElement("div");
  title.textContent = "GT Magic Eye settings";
  title.style.cssText = "font-weight:600;margin-bottom:10px;";
  panel.appendChild(title);

  for (const [key, label] of Object.entries(FLAG_LABELS)) {
    const row = document.createElement("label");
    row.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!FEATURE_FLAGS[key];
    checkbox.addEventListener("change", () => {
      setFeatureFlag(key, checkbox.checked);
      window.location.reload();
    });

    const text = document.createElement("span");
    text.textContent = label;

    row.appendChild(checkbox);
    row.appendChild(text);
    panel.appendChild(row);
  }

  const note = document.createElement("div");
  note.textContent = "Changes reload the page.";
  note.style.cssText = "font-size:11px;color:#aaa;margin-top:4px;";
  panel.appendChild(note);

  return panel;
}

function togglePanel() {
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
    return;
  }
  document.body.appendChild(buildPanel());
}

// Deliberately not hooking into .gods_area — other mods (GrepoData, "Dio")
// place their own circle_button icons there with hardcoded static offsets,
// not any real coordinated/dynamic layout, so anything we do there risks
// getting overlapped by a mod that isn't accounting for us either. A fixed
// corner elsewhere on screen sidesteps that contested area entirely.
export function injectSettingsButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("div");
  btn.id = BUTTON_ID;
  btn.title = "GT Magic Eye settings";
  btn.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:16px",
    "z-index:100000",
    "width:36px",
    "height:36px",
    "border-radius:50%",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "cursor:pointer",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  const icon = document.createElement("img");
  icon.src = logoIcon;
  icon.alt = "Settings";
  icon.style.cssText = "display:block;width:22px;height:22px;";
  btn.appendChild(icon);

  btn.addEventListener("click", togglePanel);
  document.body.appendChild(btn);
}

// Sits to the right of the settings button, at the same height — since the
// panel opens upward from the button (bottom:60px), that spot stays clear
// whether or not the panel is open.
export function injectStaleIndicator() {
  if (document.getElementById(STALE_INDICATOR_ID)) return;

  const el = document.createElement("div");
  el.id = STALE_INDICATOR_ID;
  el.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:60px",
    "z-index:100000",
    "height:36px",
    "display:flex",
    "align-items:center",
    "padding:0 12px",
    "border-radius:18px",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "color:#fff",
    "font:12px sans-serif",
    "white-space:nowrap",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  document.body.appendChild(el);
  setStaleIndicatorCount(0);
}

export function setStaleIndicatorCount(count) {
  const el = document.getElementById(STALE_INDICATOR_ID);
  if (!el) return;

  el.textContent =
    count > 0
      ? `Detected ${count} stale ${count === 1 ? "city" : "cities"}`
      : "Up to date. Thanks!";
}
