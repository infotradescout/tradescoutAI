import { useEffect, useRef, type ReactNode } from "react";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { RED_GRANITI_MANAGED_CONTACT } from "@shared/redGranitiProfile";
import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";

export type RedGranitiFallbackAction = {
  kind: "call" | "request";
  href: string;
};

const CALL_TEST_IDS = new Set([
  "red-graniti-primary-call",
  "red-graniti-mobile-call",
]);

const REQUEST_TEST_IDS = new Set([
  "red-graniti-primary-request",
  "red-graniti-mobile-request",
]);

function normalizedText(element: Element): string {
  return String(element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function buildRedGranitiRequestFallbackHref(
  platformBaseHref = ""
): string {
  const params = new URLSearchParams({
    profile: JW_STONE_PROFILE_SLUG,
    targetName: JW_STONE_PUBLIC_IDENTITY.brandName,
    source: "red_graniti_profile",
    title: "R.E.D. Graniti first-cut request",
    description: [
      "R.E.D. material or stone need:",
      "Needed format — rough block, slab, or first cut:",
      "Quantity or dimensions:",
      "Delivery destination:",
      "Needed timing:",
      "Project details:",
    ].join("\n"),
    intent: "request_material",
  });

  return qualifyPublicProfileItemDestination(
    `/direct-connect?${params.toString()}`,
    platformBaseHref
  );
}

export function resolveRedGranitiFallbackAction(
  element: Element,
  platformBaseHref = ""
): RedGranitiFallbackAction | null {
  const testId = String(element.getAttribute("data-testid") || "").trim();
  const text = normalizedText(element);

  if (CALL_TEST_IDS.has(testId)) {
    return {
      kind: "call",
      href: `tel:${RED_GRANITI_MANAGED_CONTACT.tel}`,
    };
  }

  if (
    REQUEST_TEST_IDS.has(testId) ||
    text.includes("START A REQUEST") ||
    text.includes("REQUEST A QUOTE") ||
    text.includes("GET A QUOTATION NOW")
  ) {
    return {
      kind: "request",
      href: buildRedGranitiRequestFallbackHref(platformBaseHref),
    };
  }

  return null;
}

function hasOpenModal(): boolean {
  return Boolean(
    document.querySelector('[role="dialog"][aria-modal="true"]')
  );
}

/**
 * Clears stale interaction locks left behind by an interrupted dialog or
 * route transition. The recovery never runs while a real modal is open.
 */
export function restoreRedGranitiInteractivity(root: HTMLElement): void {
  if (hasOpenModal()) return;

  const unlock = (element: HTMLElement) => {
    if (element.style.pointerEvents === "none") {
      element.style.removeProperty("pointer-events");
    }
    element.classList.remove("pointer-events-none");
    element.removeAttribute("inert");
  };

  unlock(document.documentElement);
  unlock(document.body);
  unlock(root);
  root.style.setProperty("pointer-events", "auto", "important");

  root.querySelectorAll<HTMLElement>("a, button, input, select, textarea").forEach((element) => {
    element.style.setProperty("pointer-events", "auto", "important");
    element.removeAttribute("inert");
  });
}

type Props = {
  children: ReactNode;
  platformBaseHref?: string;
};

/**
 * Progressive-enhancement boundary for the R.E.D. website recreation.
 *
 * React still owns the protected Call panel and the detailed first-cut form.
 * If a stale document interaction lock or a failed synthetic click prevents
 * those handlers from opening, the same control falls back to a native tel:
 * action or a fully prefilled Direct Connect route.
 */
export default function RedGranitiInteractionBoundary({
  children,
  platformBaseHref = "",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const restore = () => restoreRedGranitiInteractivity(root);
    restore();

    const observer = new MutationObserver(restore);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "inert"],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "inert"],
    });

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest("button, a");
      if (!interactive || !root.contains(interactive)) return;

      const action = resolveRedGranitiFallbackAction(
        interactive,
        platformBaseHref
      );
      if (!action) return;

      // Give the existing React handler time to open the dedicated contact
      // panel. Only use the native route when that expected state never appears.
      window.setTimeout(() => {
        const contactPanelOpen = Boolean(
          document.getElementById("red-graniti-contact-title")
        );
        if (contactPanelOpen) return;

        if (action.kind === "call") {
          window.location.href = action.href;
          return;
        }
        window.location.assign(action.href);
      }, 180);
    };

    root.addEventListener("click", handleClick, true);
    root.addEventListener("pointerdown", restore, true);
    root.addEventListener("keydown", restore, true);

    return () => {
      observer.disconnect();
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("pointerdown", restore, true);
      root.removeEventListener("keydown", restore, true);
    };
  }, [platformBaseHref]);

  return (
    <div
      ref={rootRef}
      className="relative z-0 pointer-events-auto"
      data-testid="red-graniti-interaction-boundary"
      style={{ pointerEvents: "auto", touchAction: "manipulation" }}
    >
      {children}
    </div>
  );
}
