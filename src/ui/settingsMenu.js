import {
  PRIMARY_COLOR,
  SECONDARY_COLOR,
  WARNING_YELLOW,
  WARNING_RED,
  DANGER_TEXT_COLOR,
} from "./theme.js";
import logoIcon from "../../assets/logo-icon.png";
import { FEATURE_FLAGS, setFeatureFlag } from "../featureFlags.js";
import { getStoredToken } from "../auth.js";
import { decodeJwtPayload } from "../jwt.js";
import {
  grantConsent,
  revokeConsent,
  setDeclinedConsentThisSession,
} from "../consentApi.js";
import { showRevokeConsentWarning } from "./consentPrompt.js";

const BUTTON_ID = "gt-settings-btn";
const PANEL_ID = "gt-settings-panel";
const CITY_REPORT_BUTTON_ID = "gt-city-report-btn";
const AUTH_WARNING_ID = "gt-auth-warning-btn";
const STALE_INDICATOR_ID = "gt-stale-indicator";
const TOOLBAR_ID = "gt-toolbar";

const FLAG_LABELS = {
  message: "Display announcement",
  checkCityStaleness: "Check city staleness",
  showTownIcon: "Display GT icon next to city name",
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
    row.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "margin-bottom:8px",
      "cursor:pointer",
    ].join(";");

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

  const consentToken = getStoredToken();
  const consented = !!decodeJwtPayload(consentToken)?.consentedAt;

  const consentRow = document.createElement("label");
  consentRow.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "margin-bottom:4px",
    consentToken ? "cursor:pointer" : "cursor:not-allowed",
  ].join(";");
  if (!consentToken) consentRow.title = "Log in first to manage consent";

  const consentCheckbox = document.createElement("input");
  consentCheckbox.type = "checkbox";
  consentCheckbox.checked = consented;
  consentCheckbox.disabled = !consentToken;

  const consentLabel = document.createElement("span");
  consentLabel.textContent = "Consent to privacy policy";

  consentRow.appendChild(consentCheckbox);
  consentRow.appendChild(consentLabel);
  panel.appendChild(consentRow);

  consentCheckbox.addEventListener("change", async () => {
    const token = getStoredToken();
    if (!token) {
      consentCheckbox.checked = false;
      return;
    }

    if (consentCheckbox.checked) {
      // Granting: the checkbox itself is the explicit opt-in action, no
      // extra confirmation needed.
      consentCheckbox.disabled = true;
      const newToken = await grantConsent(token);
      consentCheckbox.disabled = false;
      if (!newToken) {
        consentCheckbox.checked = false;
        return;
      }
      // Granting consent here is also how a session-scoped decline (see
      // ensureConsentInFlight/authenticatedFetch in index.js) gets undone
      // without waiting for a new session.
      setDeclinedConsentThisSession(false);
      window.location.reload();
      return;
    }

    // Unchecking withdraws consent, which breaks the tool's core
    // functionality — confirm first, and put the box back if they back out.
    consentCheckbox.disabled = true;
    const confirmed = await showRevokeConsentWarning();
    if (!confirmed) {
      consentCheckbox.checked = true;
      consentCheckbox.disabled = false;
      return;
    }

    const newToken = await revokeConsent(token);
    consentCheckbox.disabled = false;
    if (!newToken) {
      consentCheckbox.checked = true;
      return;
    }
    window.location.reload();
  });

  const privacyLink = document.createElement("a");
  privacyLink.textContent = "Privacy policy";
  privacyLink.href = `${__API_BASE__}/privacy`;
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

// Opens (never closes) the panel — used as the click handler for the
// toolbar warning indicator when it's showing for a declined-consent reason,
// so clicking it takes the user straight to the "Consent to privacy policy"
// checkbox rather than toggling a panel they may not already have open.
export function openSettingsPanel() {
  if (!document.getElementById(PANEL_ID)) {
    document.body.appendChild(buildPanel());
  }
}

// Deliberately not hooking into .gods_area — other mods (GrepoData, "Dio")
// place their own circle_button icons there with hardcoded static offsets,
// not any real coordinated/dynamic layout, so anything we do there risks
// getting overlapped by a mod that isn't accounting for us either. A fixed
// corner elsewhere on screen sidesteps that contested area entirely.
//
// All the toolbar pieces (settings button, city-report button, auth
// warning, stale indicator) are flex children of this one fixed-positioned
// row instead of each being independently position:fixed with a hardcoded
// left offset — that way an item that's hidden (e.g. the auth warning while
// logged in) actually collapses its space instead of leaving a permanent
// gap, and everything after it shifts left to fill in, same as it would
// shift right when the item reappears.
function ensureToolbar() {
  let toolbar = document.getElementById(TOOLBAR_ID);
  if (toolbar) return toolbar;

  toolbar = document.createElement("div");
  toolbar.id = TOOLBAR_ID;
  toolbar.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "left:16px",
    "z-index:100000",
    "display:flex",
    "align-items:center",
    "gap:8px",
  ].join(";");
  document.body.appendChild(toolbar);
  return toolbar;
}

export function injectSettingsButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const btn = document.createElement("div");
  btn.id = BUTTON_ID;
  btn.title = "GT Magic Eye settings";
  btn.style.cssText = [
    "width:36px",
    "height:36px",
    "border-radius:50%",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "cursor:pointer",
    "flex-shrink:0",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  const icon = document.createElement("img");
  icon.src = logoIcon;
  icon.alt = "Settings";
  icon.style.cssText = "display:block;width:22px;height:22px;";
  btn.appendChild(icon);

  btn.addEventListener("click", togglePanel);
  ensureToolbar().appendChild(btn);
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
    "width:36px",
    "height:36px",
    "border-radius:50%",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "cursor:pointer",
    "flex-shrink:0",
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
  ensureToolbar().appendChild(btn);
}

// Sits to the right of the city report button. Injected (and takes up flex
// space) only while relevant — index.js's refreshAuthWarningIndicator shows
// it when there's no stored token (or consent was declined this session)
// and removes it once that's resolved, rather than leaving a permanently-
// reserved, display:none gap in the toolbar. The same "!" marker is reused
// for both reasons — title/onClick are what tell them apart.
export function injectAuthWarningIndicator(
  onClick,
  title = "Not logged in — click to log in",
) {
  if (document.getElementById(AUTH_WARNING_ID)) return;

  const btn = document.createElement("div");
  btn.id = AUTH_WARNING_ID;
  btn.title = title;
  btn.style.cssText = [
    "width:36px",
    "height:36px",
    "border-radius:50%",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${WARNING_RED}`,
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "cursor:pointer",
    "flex-shrink:0",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  const icon = document.createElement("span");
  icon.textContent = "!";
  icon.style.cssText = [
    `color:${WARNING_RED}`,
    "font:700 18px sans-serif",
    "line-height:1",
    "pointer-events:none",
  ].join(";");
  btn.appendChild(icon);
  btn.addEventListener("click", onClick);

  // Inserted right after the city-report button rather than just appended,
  // since this can be added back in later (e.g. after a login attempt is
  // abandoned) once the stale indicator already occupies the toolbar's tail
  // — appending would then land it after the stale indicator instead of
  // between the two buttons it's meant to sit between.
  const toolbar = ensureToolbar();
  const cityReportBtn = document.getElementById(CITY_REPORT_BUTTON_ID);
  if (cityReportBtn) {
    cityReportBtn.after(btn);
  } else {
    toolbar.appendChild(btn);
  }
}

// Adds/removes the element itself (rather than toggling display) so a
// hidden warning collapses its flex space in the toolbar instead of
// leaving a gap — see ensureToolbar's comment. onClick/title are only
// applied when (re-)injecting: if the indicator is already showing for one
// reason, a call for a different reason is a no-op until the first one
// clears it (visible=false) — the two reasons are mutually exclusive in
// practice (consent can't be declined without a token to have logged in
// with), so this hasn't needed to change mid-display.
export function setAuthWarningVisible(visible, onClick, title) {
  const existing = document.getElementById(AUTH_WARNING_ID);
  if (visible) {
    if (!existing) injectAuthWarningIndicator(onClick, title);
  } else if (existing) {
    existing.remove();
  }
}

// Sits to the right of the auth-warning slot (when present), at the same
// height — since the panel opens upward from the settings button
// (bottom:60px), that spot stays clear whether or not the panel is open.
export function injectStaleIndicator() {
  if (document.getElementById(STALE_INDICATOR_ID)) return;

  const el = document.createElement("div");
  el.id = STALE_INDICATOR_ID;
  el.style.cssText = [
    "height:36px",
    "display:flex",
    "align-items:center",
    "padding:0 12px",
    "border-radius:18px",
    `background:${PRIMARY_COLOR}`,
    "flex-shrink:0",
    "border:1px solid", // color set by setStaleIndicatorState below
    "color:#fff",
    "font:12px sans-serif",
    "white-space:nowrap",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  ensureToolbar().appendChild(el);
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
