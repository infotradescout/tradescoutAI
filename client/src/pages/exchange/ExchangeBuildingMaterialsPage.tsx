/**
 * ExchangeBuildingMaterialsPage.tsx
 *
 * Route: /exchange/building-materials
 * Read-only profile catalog spotlights. Material-level records remain on each
 * business profile so Exchange does not duplicate or overstate inventory.
 */
import { ExchangeCategoryPage } from "./ExchangeCategoryPage";
import { CATEGORY_CONFIGS } from "./categoryConfigs";

export default function ExchangeBuildingMaterialsPage() {
  return <ExchangeCategoryPage config={CATEGORY_CONFIGS["building-materials"]} />;
}
