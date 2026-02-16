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
