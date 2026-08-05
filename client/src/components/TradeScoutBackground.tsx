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
      <div className="ts-bg__vignette" aria-hidden="true" />

      <div className="ts-bg__content">{children}</div>
    </div>
  );
}

const css = `
.ts-bg{
  position: relative;
  min-height: 100%;
  background: var(--ts-bg, #2b2b2b);
  /* Clip decorative bleed sideways only — overflow:hidden here creates a
     second scrollport and breaks hash/sticky landing (JW marketplace). */
  overflow-x: clip;
  overflow-y: visible;
  isolation: isolate;
}

.ts-bg__content{
  position: relative;
  z-index: 10;
  min-height: 100%;
}

.ts-bg__base,
.ts-bg__grid,
.ts-bg__topo,
.ts-bg__vignette{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* BASE: restrained charcoal field with one clear focal glow */
.ts-bg__base{
  z-index: 1;
  inset: -20%;
  background:
    radial-gradient(720px 420px at 18% 10%, color-mix(in oklab, var(--theme-accent-primary, #f97316) 12%, transparent), transparent 70%),
    radial-gradient(820px 520px at 82% 18%, rgba(255,255,255,.03), transparent 72%),
    linear-gradient(180deg, color-mix(in oklab, var(--ts-bg, #2b2b2b) 96%, #000 4%), var(--ts-bg, #2b2b2b) 58%, color-mix(in oklab, var(--ts-bg, #2b2b2b) 92%, #000 8%));
}

/* GRID: one calm blueprint grid instead of stacked drafting motifs */
.ts-bg__grid{
  z-index: 2;
  background-image:
    repeating-linear-gradient(0deg, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 55%, transparent) 0px, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 55%, transparent) 1px, transparent 1px, transparent 52px),
    repeating-linear-gradient(90deg, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 55%, transparent) 0px, color-mix(in oklab, var(--ts-border-subtle, rgba(255,255,255,.10)) 55%, transparent) 1px, transparent 1px, transparent 52px),
    repeating-linear-gradient(0deg, rgba(255,255,255,.03) 0px, rgba(255,255,255,.03) 1px, transparent 1px, transparent 13px),
    repeating-linear-gradient(90deg, rgba(255,255,255,.03) 0px, rgba(255,255,255,.03) 1px, transparent 1px, transparent 13px);
  opacity: 0.08;
  transform: translateZ(0);
}

/* TOPO: soft county-territory contour lines */
.ts-bg__topo{
  z-index: 3;
  inset: -8%;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='860' height='560' viewBox='0 0 860 560'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='1'%3E%3Cpath d='M-40 70 C 140 10, 260 140, 430 80 S 720 140, 910 90'/%3E%3Cpath d='M-40 130 C 130 60, 280 210, 430 150 S 740 220, 910 160'/%3E%3Cpath d='M-40 190 C 160 130, 260 250, 440 210 S 720 300, 910 240'/%3E%3Cpath d='M-40 250 C 120 220, 300 320, 460 290 S 740 390, 910 330'/%3E%3Cpath d='M-40 310 C 160 290, 280 390, 470 360 S 740 470, 910 410'/%3E%3Cpath d='M-40 370 C 140 360, 300 450, 470 430 S 720 540, 910 500'/%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 980px 640px;
  transform: translateZ(0);
}

/* VIGNETTE: keeps edges dark so content pops */
.ts-bg__vignette{
  z-index: 4;
  inset: -5%;
  background:
    radial-gradient(980px 620px at 50% 18%, transparent 52%, rgba(0,0,0,.34) 82%),
    radial-gradient(1200px 820px at 50% 88%, transparent 50%, rgba(0,0,0,.62) 92%);
}
`;
