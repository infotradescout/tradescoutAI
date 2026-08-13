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

  const prepareHref = (anchor: HTMLAnchorElement, refresh = false) => {
    if (!refresh && new URL(anchor.href, window.location.href).searchParams.has("staged")) return;
    anchor.href = stageDirectConnectEntryContext(context, destinationHref);
  };

  return (
    <a
      href={fallbackHref}
      onFocus={(event) => prepareHref(event.currentTarget)}
      onPointerDown={(event) => prepareHref(event.currentTarget, true)}
      onClick={(event) => prepareHref(event.currentTarget, event.detail === 0)}
      data-testid={testId}
      className={`${baseClassName} bg-[#a94f2e] text-white shadow-[0_16px_45px_rgba(84,35,18,0.2)] hover:bg-[#8f3f25] focus-visible:ring-[#a94f2e]`}
    >
      <Send className="h-4 w-4" aria-hidden="true" />
      {label}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}
