import { memo, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SEOHelmet } from "@/components/SEOHelmet";
import { AboutExplainerContent } from "@/pages/about-explainer-content";

const About = memo(function About() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setShadowRoot(host.shadowRoot ?? host.attachShadow({ mode: "open" }));
  }, []);

  return (
    <>
      <SEOHelmet
        title="About TradeScout | Connection Without Compromise"
        description="A complete plain-language explanation of TradeScout for requesters, businesses, property owners, communities, and Exchange participants."
        canonical="https://www.thetradescout.com/about"
      />
      <div
        ref={hostRef}
        className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950"
        aria-label="About TradeScout — complete system explainer"
      >
        {shadowRoot
          ? createPortal(
              <>
                <link rel="stylesheet" href="/about-explainer.css" />
                <AboutExplainerContent />
              </>,
              shadowRoot
            )
          : null}
      </div>
    </>
  );
});

export default About;
