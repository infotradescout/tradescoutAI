import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

function setViewportVars() {
  // Facebook/Messenger in-app browsers and mobile Safari often misreport `100vh` when
  // the URL bar shows/hides. Use visualViewport when available.
  const height = window.visualViewport?.height ?? window.innerHeight;
  const vh = height * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

function applyImageTitleFallback(root: ParentNode = document) {
  const images = root.querySelectorAll("img:not([title])");
  images.forEach((img) => {
    const alt = img.getAttribute("alt");
    if (typeof alt === "string" && alt.trim().length > 0) {
      img.setAttribute("title", alt.trim());
    }
  });
}

// Global error handling (keep this)
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

setViewportVars();
window.addEventListener("resize", setViewportVars);
window.addEventListener("orientationchange", setViewportVars);
window.visualViewport?.addEventListener("resize", setViewportVars);
applyImageTitleFallback();

const imageTitleObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.tagName.toLowerCase() === "img") {
        applyImageTitleFallback(node.parentNode || document);
        return;
      }
      applyImageTitleFallback(node);
    });
  }
});

imageTitleObserver.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

const root = ReactDOM.createRoot(container);

// IMPORTANT:
// Do NOT wrap App in React.StrictMode here.
// StrictMode intentionally double-mounts in dev,
// which was breaking Scout, animations, and OAuth.
root.render(<App />);
