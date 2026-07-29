import { SECONDARY_COLOR, PRIMARY_COLOR, DANGER_TEXT_COLOR } from "./theme.js";
import logoVertical from "../../assets/logo-vertical.png";
import { isUsingCustomBackend, getApiBase } from "../backendConfig.js";

const OVERLAY_ID = "gt-login-overlay";

export function showLoginLink(url) {
  if (document.getElementById(OVERLAY_ID)) return;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:100000",
    "background:rgba(0,0,0,0.5)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
  ].join(";");

  // Branding (the GT logo, "GT Magic Eye" wording) implies this is the
  // official backend — misleading if the user's actually pointed at some
  // other server, so a custom backend gets a generic, unbranded prompt
  // instead, naming the backend it's actually logging into.
  const customBackend = isUsingCustomBackend();

  const box = document.createElement("div");
  box.style.cssText = [
    "position:relative",
    `background:${PRIMARY_COLOR}`,
    "color:#fff",
    "font:14px sans-serif",
    "padding:24px 28px",
    "border-radius:8px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.5)",
    "text-align:center",
    // The custom-backend warning + acknowledgment text need more room to
    // read comfortably than the plain "Log in to GT Magic Eye" case does.
    customBackend ? "min-width:360px" : "min-width:240px",
    customBackend ? "max-width:480px" : "max-width:320px",
    "box-sizing:border-box",
  ].join(";");

  const closeBtn = document.createElement("div");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = [
    "position:absolute",
    "top:4px",
    "right:10px",
    "cursor:pointer",
    "font-size:20px",
    "line-height:1",
    "color:#aaa",
  ].join(";");
  closeBtn.addEventListener("click", hideLoginLink);

  const message = document.createElement("div");
  message.textContent = "Authentication required.";
  message.style.cssText = "margin-bottom:14px;";

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.textContent = customBackend
    ? `Log in to ${getApiBase()}`
    : "Log in to GT Magic Eye";
  link.style.cssText = [
    "display:block",
    "width:100%",
    "box-sizing:border-box",
    "padding:8px 16px",
    `background:${PRIMARY_COLOR}`,
    `color:${SECONDARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "font-weight:600",
    "text-decoration:none",
    "border-radius:4px",
    "white-space:normal",
    "overflow-wrap:break-word",
    "word-break:break-word",
  ].join(";");

  box.appendChild(closeBtn);

  if (!customBackend) {
    const logo = document.createElement("img");
    logo.alt = "Grass Touchers";
    logo.src = logoVertical;
    logo.style.cssText =
      "display:block;width:110px;height:auto;margin:0 auto 14px;";
    box.appendChild(logo);
  }

  box.appendChild(message);

  // A custom backend is, from the script's perspective, an arbitrary
  // third-party server — the login link posts your credentials to it, so
  // the link stays disabled (both visually and functionally, in case
  // pointer-events:none is ever bypassed e.g. via keyboard activation)
  // until the user explicitly acknowledges the risk.
  if (customBackend) {
    const warning = document.createElement("div");
    warning.textContent =
      "This is a third-party server, not the official GT Magic Eye backend. Only enter your credentials if you fully trust whoever operates it.";
    warning.style.cssText = [
      "margin-bottom:12px",
      "padding:8px 10px",
      `border:1px solid ${DANGER_TEXT_COLOR}`,
      `color:${DANGER_TEXT_COLOR}`,
      "font-size:12px",
      "text-align:left",
      "border-radius:4px",
      "overflow-wrap:break-word",
    ].join(";");
    box.appendChild(warning);

    const ackRow = document.createElement("label");
    ackRow.style.cssText = [
      "display:flex",
      "align-items:flex-start",
      "gap:6px",
      "margin-bottom:14px",
      "text-align:left",
      "font-size:12px",
      "color:#ccc",
      "cursor:pointer",
    ].join(";");

    const ackCheckbox = document.createElement("input");
    ackCheckbox.type = "checkbox";
    ackCheckbox.style.cssText = "margin-top:2px;flex-shrink:0;";

    // min-width:0 overrides the flex item default of min-width:auto, which
    // would otherwise size this to its unwrapped content and push it past
    // the box's max-width instead of wrapping.
    const ackText = document.createElement("span");
    ackText.style.cssText = "flex:1;min-width:0;overflow-wrap:break-word;";
    ackText.textContent =
      "I understand the risk and trust this server with my credentials.";

    ackRow.appendChild(ackCheckbox);
    ackRow.appendChild(ackText);
    box.appendChild(ackRow);

    const setLinkEnabled = (enabled) => {
      link.style.pointerEvents = enabled ? "auto" : "none";
      link.style.opacity = enabled ? "1" : "0.5";
      link.style.cursor = enabled ? "pointer" : "not-allowed";
    };
    setLinkEnabled(false);

    ackCheckbox.addEventListener("change", () => {
      setLinkEnabled(ackCheckbox.checked);
    });

    link.addEventListener("click", (e) => {
      if (!ackCheckbox.checked) e.preventDefault();
    });
  }

  box.appendChild(link);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function hideLoginLink() {
  document.getElementById(OVERLAY_ID)?.remove();
}
