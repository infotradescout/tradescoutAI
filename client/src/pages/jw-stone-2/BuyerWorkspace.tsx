import type { JwStone2BuyerType } from "@/features/jw-stone-2/types";
import { FabricatorDesk } from "./FabricatorDesk";
import { BuilderProjectRoom } from "./BuilderProjectRoom";
import { DesignerSelectionBoard } from "./DesignerSelectionBoard";
import { HomeownerStoneFinder } from "./HomeownerStoneFinder";
import type { StoneWorkspaceProps } from "./workspaceTypes";

export function BuyerWorkspace({
  buyer,
  ...props
}: StoneWorkspaceProps & { buyer: JwStone2BuyerType }) {
  if (buyer === "fabricator") return <FabricatorDesk {...props} />;
  if (buyer === "builder") return <BuilderProjectRoom {...props} />;
  if (buyer === "designer") return <DesignerSelectionBoard {...props} />;
  return <HomeownerStoneFinder {...props} />;
}
