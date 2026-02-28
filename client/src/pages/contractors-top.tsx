import { memo } from "react";
import FindContractors from "./find-contractors";
import { SEOHelmet } from "@/components/SEOHelmet";

/**
 * /contractors/top - Top contractors ranked by CVS in selected area
 *
 * Psychology Intent:
 * - Target belief: "Top contractors are ranked by trust, not payment."
 * - Target behavior: select county + trade and proceed via Scout to a trusted pro.
 * - Principle(s): authority/credibility, transparency.
 * - Risk prevented: pay-to-play perception.
 */

const ContractorsTop = memo(function ContractorsTop() {
  return (
    <>
      <SEOHelmet
        title="Top Contractors by Trust | TradeScout"
        description="Find the highest-trust contractors in your area, ranked by Community Verification Score (CVS) - not payment. Trust-first matching."
        canonical="https://www.thetradescout.com/contractors/top"
      />
      <FindContractors title="Top Contractors by Trust" />
    </>
  );
});

export default ContractorsTop;
