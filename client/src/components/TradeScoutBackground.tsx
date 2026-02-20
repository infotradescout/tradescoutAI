import React, { type ReactNode } from "react";

type TradeScoutBackgroundProps = {
  children: ReactNode;
};

export default function TradeScoutBackground({ children }: TradeScoutBackgroundProps) {
  return (
    <div className="ts-bg">
      <style>{css}</style>

      {/* Continuous blueprint canvas */}
      <div className="ts-bg__blueprint ts-bg__blueprint--base" aria-hidden="true" />
      {/* Slow cross-drift for depth */}
      <div className="ts-bg__blueprint ts-bg__blueprint--drift" aria-hidden="true" />
      {/* Very light moving highlight to keep it alive */}
      <div className="ts-bg__blueprint-shimmer" aria-hidden="true" />
      {/* Blur-only separation; no dark vignette */}
      <div className="ts-bg__soften" aria-hidden="true" />

      <div className="ts-bg__content">{children}</div>
    </div>
  );
}

const css = `
.ts-bg{
  position: relative;
  min-height: 100%;
  background: #0b0f14;
  overflow: hidden;
  isolation: isolate;
}

.ts-bg__content{
  position: relative;
  z-index: 10;
  min-height: 100%;
}

.ts-bg__blueprint,
.ts-bg__blueprint-shimmer,
.ts-bg__soften{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ts-bg__blueprint{
  z-index: 1;
  background-image: url("/landing/blueprint-continuous.svg");
  background-repeat: repeat-y;
  background-position: center top;
  background-size: 1280px auto;
  filter: blur(0.45px);
  transform: scale(1.004);
  transform-origin: center top;
  opacity: 0.95;
}

.ts-bg__blueprint--base{
  z-index: 2;
  animation: tsBlueprintPanY 78s linear infinite;
}

.ts-bg__blueprint--drift{
  z-index: 3;
  opacity: 0.22;
  background-position: calc(50% + 24px) -80px;
  animation: tsBlueprintCrossDrift 112s ease-in-out infinite;
}

.ts-bg__blueprint-shimmer{
  z-index: 4;
  opacity: 0.18;
  background:
    linear-gradient(
      105deg,
      transparent 0%,
      rgba(180, 215, 255, 0.03) 36%,
      rgba(180, 215, 255, 0.05) 50%,
      rgba(180, 215, 255, 0.03) 64%,
      transparent 100%
    );
  background-size: 180% 100%;
  animation: tsBlueprintShimmer 28s linear infinite;
}

.ts-bg__soften{
  z-index: 5;
  backdrop-filter: blur(1.8px);
  -webkit-backdrop-filter: blur(1.8px);
}

@keyframes tsBlueprintPanY {
  0% { background-position: center 0; }
  100% { background-position: center -170px; }
}

@keyframes tsBlueprintCrossDrift {
  0%, 100% { background-position: calc(50% + 24px) -80px; }
  50% { background-position: calc(50% - 28px) 40px; }
}

@keyframes tsBlueprintShimmer {
  0% { background-position: 180% 0; }
  100% { background-position: -80% 0; }
}

@media (max-width: 768px){
  .ts-bg__blueprint{
    background-size: 1040px auto;
    filter: blur(0.62px);
    opacity: 0.93;
  }

  .ts-bg__blueprint--drift{
    opacity: 0.2;
  }

  .ts-bg__blueprint-shimmer{
    opacity: 0.14;
    animation-duration: 32s;
  }

  .ts-bg__soften{
    backdrop-filter: blur(2.2px);
    -webkit-backdrop-filter: blur(2.2px);
  }
}

@media (prefers-reduced-motion: reduce){
  .ts-bg__blueprint--base,
  .ts-bg__blueprint--drift,
  .ts-bg__blueprint-shimmer{
    animation: none;
  }
}
`;
