import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import UltraMinimalApp from "./ultra-minimal-app";
import "./index.css";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <UltraMinimalApp />
    </StrictMode>
  );
} else {
  console.error("Root element not found");
}
