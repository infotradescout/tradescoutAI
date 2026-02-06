import React, { type ReactNode } from "react";

type TradeScoutBackgroundProps = {
  children: ReactNode;
};

export default function TradeScoutBackground({ children }: TradeScoutBackgroundProps) {
  return (
    <div className="ts-bg">
      <style>{css}</style>

      <div className="ts-bg__base" aria-hidden="true" />
      <div className="ts-bg__grid" aria-hidden="true" />
      <div className="ts-bg__topo" aria-hidden="true" />
      <div className="ts-bg__signals" aria-hidden="true" />
      <div className="ts-bg__vignette" aria-hidden="true" />

      <div className="ts-bg__content">{children}</div>
    </div>
  );
}

const css = `
.ts-bg{
  position: relative;
  min-height: 100vh;
  background: var(--ts-bg, #0B0F14);
  overflow: hidden;
  isolation: isolate;
}

.ts-bg__content{
  position: relative;
  z-index: 10;
  min-height: 100vh;
}

.ts-bg__base,
.ts-bg__grid,
.ts-bg__topo,
.ts-bg__signals,
.ts-bg__vignette{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* BASE: deep gradient + subtle “authority glow” */
.ts-bg__base{
  z-index: 1;
  inset: -20%;
  background:
    radial-gradient(720px 520px at 20% 12%, rgba(255,255,255,.03), transparent 60%),
    radial-gradient(620px 460px at 80% 30%, rgba(255,255,255,.02), transparent 62%),
    linear-gradient(180deg, color-mix(in oklab, var(--ts-bg, #0B0F14) 94%, #000 6%), var(--ts-bg, #0B0F14) 55%, color-mix(in oklab, var(--ts-bg, #0B0F14) 94%, #000 6%));
  filter: saturate(1);
}

/* GRID: blueprint / measurement feel (subtle) */
.ts-bg__grid{
  z-index: 2;
  background-image:
    repeating-linear-gradient(0deg, var(--ts-border-subtle, rgba(255,255,255,.10)) 0px, var(--ts-border-subtle, rgba(255,255,255,.10)) 1px, transparent 1px, transparent 44px),
    repeating-linear-gradient(90deg, var(--ts-border-subtle, rgba(255,255,255,.10)) 0px, var(--ts-border-subtle, rgba(255,255,255,.10)) 1px, transparent 1px, transparent 44px),
    repeating-linear-gradient(0deg, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 45%, transparent) 0px, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 45%, transparent) 1px, transparent 1px, transparent 11px),
    repeating-linear-gradient(90deg, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 45%, transparent) 0px, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 45%, transparent) 1px, transparent 1px, transparent 11px),
    repeating-linear-gradient(135deg, rgba(255,255,255,.02) 0px, rgba(255,255,255,.02) 1px, transparent 1px, transparent 110px);
  opacity: 0.22;
  transform: translateZ(0);
}

/* TOPO: territory contours (SVG tiled) */
.ts-bg__topo{
  z-index: 3;
  inset: -10%;
  opacity: 0.12;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='860' height='560' viewBox='0 0 860 560'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='1'%3E%3Cpath d='M-40 70 C 140 10, 260 140, 430 80 S 720 140, 910 90'/%3E%3Cpath d='M-40 130 C 130 60, 280 210, 430 150 S 740 220, 910 160'/%3E%3Cpath d='M-40 190 C 160 130, 260 250, 440 210 S 720 300, 910 240'/%3E%3Cpath d='M-40 250 C 120 220, 300 320, 460 290 S 740 390, 910 330'/%3E%3Cpath d='M-40 310 C 160 290, 280 390, 470 360 S 740 470, 910 410'/%3E%3Cpath d='M-40 370 C 140 360, 300 450, 470 430 S 720 540, 910 500'/%3E%3C/g%3E%3Cg fill='none' stroke='rgba(255,106,0,0.18)' stroke-width='1'%3E%3Cpath d='M-40 110 C 140 50, 260 170, 430 120 S 720 190, 910 130'/%3E%3Cpath d='M-40 290 C 120 260, 300 360, 460 330 S 740 430, 910 370'/%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 860px 560px;
  animation: tsTopoDrift 28s linear infinite;
  transform: translateZ(0);
}

/* SIGNALS: trust nodes + tiny “check-in” points */
.ts-bg__signals{
  z-index: 4;
  opacity: 0.18;
  background-image:
    radial-gradient(circle at 26px 22px, color-mix(in oklab, var(--ts-accent, #FF6A00) 50%, white 50%) 0 1px, transparent 2px),
    radial-gradient(circle at 120px 78px, rgba(255,106,0,.28) 0 1px, transparent 2px),
    radial-gradient(circle at 210px 150px, rgba(255,255,255,.22) 0 1px, transparent 2px),
    radial-gradient(circle at 58px 190px, rgba(255,255,255,.18) 0 1px, transparent 2px),
    radial-gradient(circle at 190px 30px, rgba(255,255,255,.16) 0 1px, transparent 2px),
    radial-gradient(circle at 20px 140px, rgba(255,255,255,.14) 0 1px, transparent 2px);
  background-size: 260px 220px;
  background-repeat: repeat;
  animation: tsSignalFloat 16s ease-in-out infinite;
  transform: translateZ(0);
}

/* VIGNETTE: keeps edges dark so content pops */
.ts-bg__vignette{
  z-index: 5;
  inset: -5%;
  background:
    radial-gradient(900px 520px at 50% 25%, transparent 55%, rgba(0,0,0,.45) 85%),
    radial-gradient(1200px 760px at 50% 80%, transparent 55%, rgba(0,0,0,.62) 90%);
}

@keyframes tsTopoDrift{
  0%{ background-position: 0px 0px; }
  100%{ background-position: 520px 240px; }
}

@keyframes tsSignalFloat{
  0%,100%{ background-position: 0px 0px; filter: blur(0px); }
  50%{ background-position: 80px -40px; filter: blur(.15px); }
}

@media (prefers-reduced-motion: reduce){
  .ts-bg__topo, .ts-bg__signals{ animation: none !important; }
}
`;
