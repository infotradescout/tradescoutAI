import { useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import type { DirectConnectEntryContext } from "@/pages/direct-connect/directConnectEntryContext";
import {
  getDirectConnectEntryFallbackHref,
  stageDirectConnectEntryContext,
} from "@/pages/direct-connect/stagedDirectConnectEntryContext";

type Props = {
  ready: boolean;
  context: DirectConnectEntryContext;
  destinationHref: string;
  label?: string;
  testId: string;
};

export default function SteelHomeRequestAction({
  ready,
  context,
  destinationHref,
  label = "Start a Request",
  testId,
}: Props) {
  const [stageFailed, setStageFailed] = useState(false);
  const fallbackHref = getDirectConnectEntryFallbackHref(destinationHref);
  const baseClassName =
    "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  if (!ready) {
    return (
      <span
        aria-disabled="true"
        data-testid={testId}
        className={`${baseClassName} cursor-not-allowed bg-[#d9ddd5] text-[#596762]`}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {label}
      </span>
    );
  }

  const prepareHref = (anchor: HTMLAnchorElement, refresh = false): boolean => {
    if (!refresh && new URL(anchor.href, window.location.href).searchParams.has("staged")) {
      return true;
    }

    const href = stageDirectConnectEntryContext(context, destinationHref);
    const staged = new URL(href, window.location.href).searchParams.has("staged");
    anchor.href = href;
    setStageFailed(!staged);
    return staged;
  };

  return (
    <div className="space-y-3">
      <a
        href={fallbackHref}
        onFocus={(event) => prepareHref(event.currentTarget)}
        onPointerDown={(event) => prepareHref(event.currentTarget, true)}
        onClick={(event) => {
          if (!prepareHref(event.currentTarget)) event.preventDefault();
        }}
        data-testid={testId}
        className={`${baseClassName} bg-[#a94f2e] text-white shadow-[0_16px_45px_rgba(84,35,18,0.2)] hover:bg-[#8f3f25] focus-visible:ring-[#a94f2e]`}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {label}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
      {stageFailed ? (
        <div
          role="alert"
          className="rounded-2xl border border-[#a94f2e]/30 bg-[#fff4ef] p-4 text-xs leading-5 text-[#63301f]"
          data-testid={`${testId}-stage-failure`}
        >
          <p className="font-black">The planner summary was not attached. Nothing was sent.</p>
          <p className="mt-1">
            Keep this page open and retry after allowing same-site browser storage, or copy the
            summary below before using the clearly marked fallback.
          </p>
          <textarea
            readOnly
            value={[context.title, context.description].filter(Boolean).join("\n\n")}
            aria-label="Planner summary to copy manually"
            className="mt-3 min-h-28 w-full resize-y rounded-xl border border-[#a94f2e]/20 bg-white p-3 font-mono text-[0.7rem] leading-5 text-[#18312f]"
          />
          <a
            href={fallbackHref}
            className="mt-3 inline-flex font-black underline underline-offset-4"
            data-testid={`${testId}-unstaged-fallback`}
          >
            Continue without the attached planner summary
          </a>
        </div>
      ) : null}
    </div>
  );
}
