import {
  PRIMARY_COLOR,
  SECONDARY_COLOR,
  WARNING_YELLOW,
  WARNING_RED,
  DANGER_TEXT_COLOR,
} from "./theme.js";
import logoIcon from "../../assets/logo-icon.png";
import {
  FEATURE_FLAGS,
  setFeatureFlag,
  CUSTOM_BACKEND_DISABLED_FLAGS,
  snapshotFlagsForCustomBackend,
  restoreFlagsFromCustomBackendSnapshot,
} from "../featureFlags.js";
import {
  getApiBase,
  getBackendUrlOverride,
  setBackendUrlOverride,
  isUsingCustomBackend,
} from "../backendConfig.js";
import { clearStoredToken } from "../auth.js";

const BUTTON_ID = "gt-settings-btn";
const PANEL_ID = "gt-settings-panel";
const CITY_REPORT_BUTTON_ID = "gt-city-report-btn";
const STALE_INDICATOR_ID = "gt-stale-indicator";

const FLAG_LABELS = {
  message: "Display announcement",
  checkCityStaleness: "Check city staleness",
  showTownIcon: "Display GT icon next to city name",
};

// TODO: hardcoded for now — make this configurable later.
const HARDCODED_MESSAGE = "Hello? Is this thing on?";

const CUSTOM_BACKEND_TOOLTIP =
  "This feature isn't available with custom backends";

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

  const customBackendActive = isUsingCustomBackend();

  for (const [key, label] of Object.entries(FLAG_LABELS)) {
    const disabledByCustomBackend =
      customBackendActive && CUSTOM_BACKEND_DISABLED_FLAGS.includes(key);

    const row = document.createElement("label");
    row.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "margin-bottom:8px",
      disabledByCustomBackend ? "cursor:not-allowed" : "cursor:pointer",
      disabledByCustomBackend ? "opacity:0.5" : "",
    ].join(";");
    if (disabledByCustomBackend) row.title = CUSTOM_BACKEND_TOOLTIP;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!FEATURE_FLAGS[key];
    checkbox.disabled = disabledByCustomBackend;
    // Chrome suppresses hover/mouseover on disabled form controls, which
    // would otherwise stop the parent label's title tooltip from showing
    // when hovering directly over the checkbox — let events pass through
    // to the label instead.
    if (disabledByCustomBackend) checkbox.style.pointerEvents = "none";
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

  const dangerZoneTitle = document.createElement("div");
  dangerZoneTitle.textContent = "Danger zone";
  dangerZoneTitle.style.cssText = [
    "margin-top:12px",
    "text-align:left",
    "font-weight:600",
    `color:${DANGER_TEXT_COLOR}`,
  ].join(";");
  panel.appendChild(dangerZoneTitle);

  const dangerZoneSubtitle = document.createElement("div");
  dangerZoneSubtitle.textContent =
    "These settings can break the application. Only proceed if you know what you're doing.";
  dangerZoneSubtitle.style.cssText = [
    "font-size:11px",
    "color:#aaa",
    "margin-top:10px",
    "padding-top:10px",
    `border-top:1px solid ${DANGER_TEXT_COLOR}`,
    "margin-bottom:10px",
  ].join(";");
  panel.appendChild(dangerZoneSubtitle);

  const backendOverride = getBackendUrlOverride();

  const backendRow = document.createElement("label");
  backendRow.style.cssText =
    "display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;";

  const backendCheckbox = document.createElement("input");
  backendCheckbox.type = "checkbox";
  backendCheckbox.checked = !!backendOverride.enabled;

  const backendLabel = document.createElement("span");
  backendLabel.textContent = "Custom backend URL";

  backendRow.appendChild(backendCheckbox);
  backendRow.appendChild(backendLabel);
  panel.appendChild(backendRow);

  // Prefilled from the override URL if one was already saved, otherwise
  // from whatever's currently in effect (the config.cjs default) — so
  // checking the box always starts the field at the URL actually in use.
  const backendInput = document.createElement("input");
  backendInput.type = "text";
  backendInput.value = backendOverride.url || getApiBase();
  backendInput.style.cssText = [
    "display:block",
    "width:100%",
    "box-sizing:border-box",
    "margin-bottom:8px",
    "padding:4px 6px",
    "border-radius:4px",
    `border:1px solid ${SECONDARY_COLOR}`,
    `background:${PRIMARY_COLOR}`,
    "color:#fff",
    "font:12px sans-serif",
  ].join(";");
  backendInput.style.display = backendOverride.enabled ? "block" : "none";
  panel.appendChild(backendInput);

  backendCheckbox.addEventListener("change", () => {
    backendInput.style.display = backendCheckbox.checked ? "block" : "none";

    if (backendCheckbox.checked) {
      // Capture the disabled flags' current values before they get forced
      // off, so disabling the custom backend later can put them back.
      snapshotFlagsForCustomBackend();
      // The token was issued by (and scoped to) the default backend — clear
      // it on enabling so it's never sent as an Authorization header to
      // whatever custom backend the user points at.
      clearStoredToken();
    } else {
      restoreFlagsFromCustomBackendSnapshot();
    }

    setBackendUrlOverride(backendCheckbox.checked, backendInput.value.trim());
    window.location.reload();
  });

  // Fires on blur (and Enter, via the blur() below) rather than on every
  // keystroke — an in-progress edit shouldn't reload the page out from
  // under the user.
  backendInput.addEventListener("change", () => {
    setBackendUrlOverride(backendCheckbox.checked, backendInput.value.trim());
    window.location.reload();
  });
  backendInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") backendInput.blur();
  });

  const note = document.createElement("div");
  note.textContent = "Changes reload the page.";
  note.style.cssText = "font-size:11px;color:#aaa;margin-top:4px;";
  panel.appendChild(note);

  const privacyLink = document.createElement("a");
  privacyLink.textContent = "Privacy policy";
  privacyLink.href = `${getApiBase()}/privacy`;
  privacyLink.target = "_blank";
  privacyLink.rel = "noopener noreferrer";
  privacyLink.style.cssText = [
    "display:block",
    "margin-top:10px",
    "padding-top:10px",
    `border-top:1px solid ${SECONDARY_COLOR}`,
    "font-size:11px",
    `color:${SECONDARY_COLOR}`,
  ].join(";");
  panel.appendChild(privacyLink);

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

// Sits to the right of the settings button, same height, same reasoning as
// injectStaleIndicator below: opens on click, doesn't need a panel of its
// own to stay clear of.
export function injectCityReportButton(onClick) {
  if (document.getElementById(CITY_REPORT_BUTTON_ID)) return;

  const btn = document.createElement("div");
  btn.id = CITY_REPORT_BUTTON_ID;
  btn.title = "Last index";
  btn.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:60px",
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

  btn.innerHTML = [
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${SECONDARY_COLOR}"`,
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>',
    '<circle cx="12" cy="12" r="3"/>',
    "</svg>",
  ].join(" ");

  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
}

// Sits to the right of the city report button, at the same height — since
// the panel opens upward from the settings button (bottom:60px), that spot
// stays clear whether or not the panel is open.
export function injectStaleIndicator() {
  if (document.getElementById(STALE_INDICATOR_ID)) return;

  const el = document.createElement("div");
  el.id = STALE_INDICATOR_ID;
  el.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:104px",
    "z-index:100000",
    "height:36px",
    "display:flex",
    "align-items:center",
    "padding:0 12px",
    "border-radius:18px",
    `background:${PRIMARY_COLOR}`,
    "border:1px solid", // color set by setStaleIndicatorState below
    "color:#fff",
    "font:12px sans-serif",
    "white-space:nowrap",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  document.body.appendChild(el);
  setStaleIndicatorState(0, 0);
}

// Three states: nothing checked yet this session (yellow, prompts the user
// to go look at cities), everything checked so far is fresh (green), or at
// least one checked city is stale (red) — checkedCount is what tells "no
// data yet" apart from "checked and all clear", since both would otherwise
// look like staleCount === 0.
export function setStaleIndicatorState(checkedCount, staleCount) {
  const el = document.getElementById(STALE_INDICATOR_ID);
  if (!el) return;

  if (checkedCount === 0) {
    el.style.borderColor = WARNING_YELLOW;
    el.textContent = "Click through cities to detect staleness";
  } else if (staleCount > 0) {
    el.style.borderColor = WARNING_RED;
    el.textContent = `Detected ${staleCount} stale ${staleCount === 1 ? "city" : "cities"}`;
  } else {
    el.style.borderColor = SECONDARY_COLOR;
    el.textContent = "Up to date. Thanks!";
  }
}
