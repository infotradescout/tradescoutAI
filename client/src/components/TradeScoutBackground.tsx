import React, { type ReactNode, useMemo } from "react";

type TradeScoutBackgroundProps = {
  children: ReactNode;
};

type SketchDef = {
  id: string;
  viewBox: string;
  path: string;
};

type SketchInstance = SketchDef & {
  x: number;
  y: number;
  size: number;
  delay: number;
};

const SKETCHES: SketchDef[] = [
  {
    id: "hammer",
    viewBox: "0 0 48 48",
    path: "M8 30l12-12 6 6-12 12-6-6zM20 18l6-6 10 10-6 6-10-10zM32 8l8 8",
  },
  {
    id: "wrench",
    viewBox: "0 0 48 48",
    path: "M30 10a8 8 0 0 0-9 9l-11 11 7 7 11-11a8 8 0 0 0 9-9l-5 5-5-5 5-7z",
  },
  {
    id: "house",
    viewBox: "0 0 48 48",
    path: "M8 24l16-14 16 14M14 22v16h20V22M20 38v-8h8v8",
  },
  {
    id: "cup",
    viewBox: "0 0 48 48",
    path: "M14 16h18v12a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8V16zM32 18h4a6 6 0 0 1 0 12h-4M16 40h18",
  },
  {
    id: "chair",
    viewBox: "0 0 48 48",
    path: "M14 20h20v10H14zM16 30v10M32 30v10M18 20v-6h12v6",
  },
  {
    id: "lamp",
    viewBox: "0 0 48 48",
    path: "M12 20l12-10 12 10M18 20h12l-2 8h-8l-2-8zM22 28v8M16 36h16",
  },
  {
    id: "book",
    viewBox: "0 0 48 48",
    path: "M10 12h16a6 6 0 0 1 6 6v20H16a6 6 0 0 0-6 6V12zM26 12h12v26a6 6 0 0 0-6-6H26",
  },
  {
    id: "scissors",
    viewBox: "0 0 48 48",
    path: "M14 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM14 26a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM18 20l20-12M18 28l20 12",
  },
  {
    id: "phone",
    viewBox: "0 0 48 48",
    path: "M18 8h12a2 2 0 0 1 2 2v28a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2zM22 34h4",
  },
  {
    id: "key",
    viewBox: "0 0 48 48",
    path: "M22 22a6 6 0 1 0-6-6 6 6 0 0 0 6 6zM22 16h20l-4 4 4 4-4 4-4-4H22",
  },
  {
    id: "plant",
    viewBox: "0 0 48 48",
    path: "M24 30v10M16 20c0-6 8-10 8-10s8 4 8 10c0 4-3 8-8 8s-8-4-8-8zM14 40h20",
  },
  {
    id: "bicycle",
    viewBox: "0 0 48 48",
    path: "M12 34a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM36 34a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 34l8-14h8l6 14M20 20l-4-8h8",
  },
];

function seedFromDate() {
  const date = new Date();
  const day = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) {
    hash = (hash << 5) - hash + day.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  let t = seed + 0x6d2b79f5;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSketches(): SketchInstance[] {
  const seed = seedFromDate();
  const rand = mulberry32(seed);
  const count = 10;
  const picks: SketchInstance[] = [];
  for (let i = 0; i < count; i += 1) {
    const def = SKETCHES[Math.floor(rand() * SKETCHES.length)];
    picks.push({
      ...def,
      x: 6 + rand() * 88,
      y: 6 + rand() * 80,
      size: 28 + rand() * 40,
      delay: Math.round(rand() * 18),
    });
  }
  return picks;
}

export default function TradeScoutBackground({ children }: TradeScoutBackgroundProps) {
  const sketches = useMemo(() => buildSketches(), []);

  return (
    <div className="ts-bg">
      <style>{css}</style>

      <div className="ts-bg__base" aria-hidden="true" />
      <div className="ts-bg__grid" aria-hidden="true" />
      <div className="ts-bg__topo" aria-hidden="true" />
      <div className="ts-bg__signals" aria-hidden="true" />
      <div className="ts-bg__flow" aria-hidden="true" />
      <div className="ts-bg__sketches" aria-hidden="true">
        {sketches.map((sketch) => (
          <svg
            key={sketch.id + sketch.x}
            className="ts-bg__sketch"
            viewBox={sketch.viewBox}
            style={{
              left: `${sketch.x}%`,
              top: `${sketch.y}%`,
              width: `${sketch.size}px`,
              height: `${sketch.size}px`,
              animationDelay: `${sketch.delay}s`,
            }}
          >
            <path d={sketch.path} />
          </svg>
        ))}
      </div>
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
.ts-bg__flow,
.ts-bg__sketches,
.ts-bg__vignette{
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* BASE: deep charcoal gradient */
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
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='860' height='560' viewBox='0 0 860 560'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='1'%3E%3Cpath d='M-40 70 C 140 10, 260 140, 430 80 S 720 140, 910 90'/%3E%3Cpath d='M-40 130 C 130 60, 280 210, 430 150 S 740 220, 910 160'/%3E%3Cpath d='M-40 190 C 160 130, 260 250, 440 210 S 720 300, 910 240'/%3E%3Cpath d='M-40 250 C 120 220, 300 320, 460 290 S 740 390, 910 330'/%3E%3Cpath d='M-40 310 C 160 290, 280 390, 470 360 S 740 470, 910 410'/%3E%3Cpath d='M-40 370 C 140 360, 300 450, 470 430 S 720 540, 910 500'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
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
    radial-gradient(circle at 26px 22px, color-mix(in oklab, var(--ts-text, #E6EDF6) 30%, transparent) 0 1px, transparent 2px),
    radial-gradient(circle at 120px 78px, rgba(255,255,255,.18) 0 1px, transparent 2px),
    radial-gradient(circle at 210px 150px, rgba(255,255,255,.16) 0 1px, transparent 2px),
    radial-gradient(circle at 58px 190px, rgba(255,255,255,.14) 0 1px, transparent 2px),
    radial-gradient(circle at 190px 30px, rgba(255,255,255,.12) 0 1px, transparent 2px),
    radial-gradient(circle at 20px 140px, rgba(255,255,255,.12) 0 1px, transparent 2px);
  background-size: 260px 220px;
  background-repeat: repeat;
  animation: tsSignalFloat 18s ease-in-out infinite;
  transform: translateZ(0);
}

/* FLOW: animated linework sweep */
.ts-bg__flow{
  z-index: 4;
  opacity: 0.12;
  background-image:
    repeating-linear-gradient(120deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 120px),
    repeating-linear-gradient(120deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 60px);
  background-size: 220px 220px;
  animation: tsFlowDrift 36s linear infinite;
  mix-blend-mode: screen;
}

/* SKETCHES: subtle everyday doodles that drift and redraw */
.ts-bg__sketches{
  z-index: 4;
  opacity: 0.18;
}

.ts-bg__sketch{
  position: absolute;
  stroke: color-mix(in oklab, var(--ts-text, #E6EDF6) 35%, transparent);
  stroke-width: 1.6;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: blur(0.1px);
  opacity: 0;
  stroke-dasharray: 140;
  stroke-dashoffset: 140;
  animation: tsSketchDraw 18s ease-in-out infinite;
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

@keyframes tsFlowDrift{
  0%{ background-position: 0px 0px; }
  100%{ background-position: 320px 240px; }
}

@keyframes tsSketchDraw{
  0%{ opacity: 0; stroke-dashoffset: 140; transform: translateY(6px); }
  12%{ opacity: 0.6; }
  35%{ opacity: 0.6; stroke-dashoffset: 0; }
  55%{ opacity: 0.35; }
  80%{ opacity: 0; transform: translateY(-6px); }
  100%{ opacity: 0; stroke-dashoffset: -140; }
}

@media (prefers-reduced-motion: reduce){
  .ts-bg__topo, .ts-bg__signals, .ts-bg__flow, .ts-bg__sketch{ animation: none !important; }
}
`;
