import { JwStoneLoadingStatus } from "./JwStoneLoadingStatus";
import type { ComponentProps } from "react";
import {
  createJwStoneComponentLoader,
  useJwStoneDeferredComponent,
} from "./deferredJwStoneComponent";
import type { WishlistPanel as SavedPanel } from "./WishlistPanel";
import { JW_STONE_BRAND_STYLE } from "./brand";

type PanelProps = ComponentProps<typeof SavedPanel>;
const loadPanel = createJwStoneComponentLoader<PanelProps>(() =>
  import("./WishlistPanel").then((module) => module.WishlistPanel)
);

/** Favorites live in their existing stores; load the panel on the first open. */
export function WishlistPanel(props: PanelProps) {
  const { Component: Panel, failed, retry } = useJwStoneDeferredComponent(loadPanel, props.open);

  // The panel owns a quote handoff that remains open after its sheet closes.
  // Preserve that component lifetime once loaded, matching its original owner.
  if (Panel) return <Panel {...props} />;
  if (!props.open) return null;
  return (
    <aside
      role="region"
      aria-label="Saved stones loading"
      style={JW_STONE_BRAND_STYLE}
      className="fixed bottom-4 right-4 z-[71] w-[calc(100%-2rem)] max-w-sm border border-[var(--jw-border)] bg-[var(--jw-surface)] p-5 text-[var(--jw-ink)] shadow-xl"
    >
      <JwStoneLoadingStatus
        subject="saved stones"
        failed={failed}
        retry={retry}
        onClose={() => props.onOpenChange(false)}
      />
    </aside>
  );
}
