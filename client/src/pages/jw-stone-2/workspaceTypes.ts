import type { JwStone2InventoryItem } from "@/features/jw-stone-2/types";

export type StoneWorkspaceProps = {
  items: readonly JwStone2InventoryItem[];
  savedIds: ReadonlySet<string>;
  onToggleSave: (item: JwStone2InventoryItem) => void;
  onOpenDetails: (item: JwStone2InventoryItem) => void;
  onAsk: (item: JwStone2InventoryItem) => void;
};

export type NamedStoneActionsProps = {
  item: JwStone2InventoryItem;
  isSaved: boolean;
  onToggleSave: (item: JwStone2InventoryItem) => void;
  onOpenDetails: (item: JwStone2InventoryItem) => void;
  onAsk: (item: JwStone2InventoryItem) => void;
  compact?: boolean;
};
