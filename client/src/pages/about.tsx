import { memo } from "react";
import { SEOHelmet } from "@/components/SEOHelmet";

const EXPLAINER_URL = "https://tradescout.mrplatypus4777.chatgpt.site/";

const About = memo(function About() {
  return (
    <>
      <SEOHelmet
        title="About TradeScout | Connection Without Compromise"
        description="A complete plain-language explanation of TradeScout for requesters, businesses, property owners, communities, and Exchange participants."
        canonical="https://www.thetradescout.com/about"
      />
      <div className="fixed inset-0 z-[9999] bg-[#0a1016]">
        <iframe
          className="h-full w-full border-0 bg-[#0a1016]"
          src={EXPLAINER_URL}
          title="About TradeScout — complete system explainer"
        />
      </div>
    </>
  );
});

export default About;
