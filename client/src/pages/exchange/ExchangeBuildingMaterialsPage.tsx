/** Read-only profile catalog spotlights; maintained profiles own material detail. */
import { ExchangeCategoryPage } from "./ExchangeCategoryPage";
import { CATEGORY_CONFIGS } from "./categoryConfigs";

export default function ExchangeBuildingMaterialsPage() {
  return <ExchangeCategoryPage config={CATEGORY_CONFIGS["building-materials"]} />;
}
