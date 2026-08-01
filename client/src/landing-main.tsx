import ReactDOM from "react-dom/client";
import TradeScoutLandingPage from "./pages/TradeScoutLandingPage";
import { getPostLandingRoute } from "./lib/postOnboardingRoute";

const APP_READY_ATTR = "data-app-mounted";

function showLandingFailure() {
  const fallback = document.getElementById("ts-landing-fallback");
  fallback?.removeAttribute("hidden");
}

async function redirectAuthenticatedVisitor() {
  try {
    const response = await fetch("/api/auth/user", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return;

    const payload = (await response.json().catch(() => null)) as
      | { authenticated?: boolean; user?: unknown }
      | Record<string, unknown>
      | null;
    if (!payload || typeof payload !== "object") return;

    const user =
      "authenticated" in payload ? (payload.authenticated === true ? payload.user : null) : payload;
    if (!user) return;

    window.location.replace(getPostLandingRoute(user));
  } catch {
    // The public landing remains usable when the optional auth check is unavailable.
  }
}

const container = document.getElementById("root");
if (!container) {
  showLandingFailure();
} else {
  try {
    ReactDOM.createRoot(container).render(<TradeScoutLandingPage />);
    document.body.setAttribute(APP_READY_ATTR, "true");
    void redirectAuthenticatedVisitor();
  } catch (error) {
    console.error("[landing] failed to render", error);
    showLandingFailure();
  }
}
