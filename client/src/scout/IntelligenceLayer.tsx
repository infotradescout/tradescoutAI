import React from "react";
import { Sparkles, Shield } from "lucide-react";

/* ----------------------------------------------------------
   IntelligenceLayer — Morphic OS v2
   @reusable: scout-intelligence-card

   The full-width card that appears after every Scout response.
   Shows Scout's reasoning in plain language before the adaptive
   modules are assembled below it.

   Visual elements:
   - Orange gradient accent line at top (1px)
   - "INTELLIGENCE LAYER" section label with sparkle icon
   - Large bold white heading (Scout's summary sentence)
   - Secondary subtext line
   - Abstract particle/globe SVG graphic (right side, decorative)
   - "Verified & Community-Powered" footer badge

   Props:
   - heading: string — the main Scout summary (large bold text)
   - subtext?: string — optional secondary line below heading
   - context?: string — optional "Context: X · Location: Y" meta line
   - isStreaming?: boolean — shows a pulsing dot while streaming
   ---------------------------------------------------------- */

interface IntelligenceLayerProps {
  /** @deprecated use heading instead */
  summary?: string;
  heading?: string;
  subtext?: string;
  context?: string;
  isStreaming?: boolean;
}

export const IntelligenceLayer: React.FC<IntelligenceLayerProps> = ({
  summary,
  heading,
  subtext,
  context,
  isStreaming = false,
}) => {
  const mainText = heading || summary || "";

  return (
    /* @reusable: scout-intelligence-card — full Intelligence Layer card */
    <div
      className="relative overflow-hidden rounded-2xl mb-4"
      style={{
        background: "#111111",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Orange gradient accent line — @reusable: scout-intelligence-card__accent-line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, #f97316 0%, rgba(249,115,22,0.4) 60%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      {/* Abstract particle/globe graphic — decorative, right side */}
      {/* @reusable: scout-intelligence-card__particle-graphic */}
      <div
        className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none select-none"
        aria-hidden="true"
        style={{ opacity: 0.55 }}
      >
        <svg
          viewBox="0 0 120 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          preserveAspectRatio="xMaxYMid meet"
        >
          {/* Outer ellipse */}
          <ellipse cx="80" cy="100" rx="55" ry="90" stroke="#f97316" strokeWidth="0.8" strokeOpacity="0.5" />
          {/* Middle ellipse */}
          <ellipse cx="80" cy="100" rx="38" ry="65" stroke="#f97316" strokeWidth="0.6" strokeOpacity="0.4" />
          {/* Inner ellipse */}
          <ellipse cx="80" cy="100" rx="20" ry="38" stroke="#f97316" strokeWidth="0.5" strokeOpacity="0.35" />
          {/* Horizontal cross line */}
          <line x1="25" y1="100" x2="135" y2="100" stroke="#f97316" strokeWidth="0.5" strokeOpacity="0.3" />
          {/* Vertical axis */}
          <line x1="80" y1="10" x2="80" y2="190" stroke="#f97316" strokeWidth="0.5" strokeOpacity="0.25" />
          {/* Accent dot */}
          <circle cx="80" cy="100" r="3" fill="#f97316" fillOpacity="0.7" />
          {/* Scattered dots */}
          <circle cx="55" cy="68" r="1.2" fill="#f97316" fillOpacity="0.5" />
          <circle cx="108" cy="82" r="1" fill="#f97316" fillOpacity="0.4" />
          <circle cx="95" cy="130" r="1.5" fill="#f97316" fillOpacity="0.45" />
          <circle cx="62" cy="145" r="1" fill="#f97316" fillOpacity="0.35" />
          <circle cx="115" cy="115" r="0.8" fill="#f97316" fillOpacity="0.3" />
        </svg>
      </div>

      {/* Card content */}
      <div className="relative z-10 p-5 pr-28">
        {/* Section label — @reusable: scout-section-label */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={13} style={{ color: "#f97316", flexShrink: 0 }} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "#f97316" }}
          >
            Intelligence Layer
          </span>
          {/* Streaming indicator */}
          {isStreaming && (
            <span
              className="w-1.5 h-1.5 rounded-full ml-1"
              style={{
                background: "#f97316",
                animation: "scout-pulse 0.9s ease-in-out infinite",
              }}
              aria-label="Processing"
            />
          )}
        </div>

        {/* Main heading — @reusable: scout-intelligence-card__heading */}
        {mainText && (
          <h2
            className="font-black leading-[1.15] mb-2"
            style={{
              color: "#fafafa",
              fontSize: "clamp(17px, 4vw, 22px)",
              fontFamily: "'Sora', 'Inter', sans-serif",
            }}
          >
            {mainText}
          </h2>
        )}

        {/* Subtext — @reusable: scout-intelligence-card__subtext */}
        {subtext && (
          <p
            className="text-[13px] leading-relaxed mb-3"
            style={{ color: "rgba(250,250,250,0.65)" }}
          >
            {subtext}
          </p>
        )}

        {/* Context meta line — @reusable: scout-intelligence-card__context */}
        {context && (
          <p
            className="text-[11px] font-medium mb-3"
            style={{ color: "rgba(250,250,250,0.4)" }}
          >
            {context}
          </p>
        )}

        {/* Footer badge — @reusable: scout-trust-footer */}
        <div
          className="flex items-center gap-1.5 mt-4 pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Shield size={11} style={{ color: "rgba(250,250,250,0.35)", flexShrink: 0 }} />
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "rgba(250,250,250,0.35)" }}
          >
            Verified &amp; Community-Powered
          </span>
        </div>
      </div>
    </div>
  );
};
