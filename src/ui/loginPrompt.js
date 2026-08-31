import { SECONDARY_COLOR, PRIMARY_COLOR } from "./theme.js";
import logoVertical from "../../assets/logo-vertical.png";

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
    "min-width:240px",
    "max-width:320px",
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
  link.textContent = "Log in to GT Magic Eye";
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

  const logo = document.createElement("img");
  logo.alt = "Grass Touchers";
  logo.src = logoVertical;
  logo.style.cssText =
    "display:block;width:110px;height:auto;margin:0 auto 14px;";
  box.appendChild(logo);

  box.appendChild(message);
  box.appendChild(link);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

export function hideLoginLink() {
  document.getElementById(OVERLAY_ID)?.remove();
}
