import React, { type ReactNode, useMemo } from "react";

type TradeScoutBackgroundProps = {
  children: ReactNode;
};

type SketchDef = {
  id: string;
  viewBox: string;
  paths: string[];
};

type SketchInstance = SketchDef & {
  x: number;
  y: number;
  width: number;
  height: number;
  delay: number;
  duration: number;
};

const SKETCHES: SketchDef[] = [
  {
    id: "house-plan-detailed",
    viewBox: "0 0 220 150",
    paths: [
      "M8 10h204v130H8z",
      "M14 16h192v118H14z",
      "M82 16v118",
      "M140 16v118",
      "M14 54h68",
      "M82 44h58",
      "M140 70h66",
      "M24 24h20v16H24z",
      "M50 24h20v16H50z",
      "M92 24h18v14H92z",
      "M116 24h18v14h-18z",
      "M150 24h20v16h-20z",
      "M176 24h20v16h-20z",
      "M20 78h24v30H20z",
      "M94 62h36v44H94z",
      "M152 86h34v40h-34z",
      "M60 118h20",
      "M154 10v-6h44v6",
      "M14 146h58",
      "M86 146h44",
    ],
  },
  {
    id: "toaster-blueprint",
    viewBox: "0 0 210 130",
    paths: [
      "M20 44h170a14 14 0 0 1 14 14v24a20 20 0 0 1-20 20H26A20 20 0 0 1 6 82V58a14 14 0 0 1 14-14z",
      "M42 18h34v26H42z",
      "M128 18h34v26h-34z",
      "M28 72h150",
      "M176 36v-14h16",
      "M154 102v12",
      "M34 102v12",
      "M68 44v-8h74v8",
      "M18 112h174",
    ],
  },
  {
    id: "car-blueprint-large",
    viewBox: "0 0 260 140",
    paths: [
      "M20 88h220l-16-34H70z",
      "M44 88v18h170V88",
      "M52 106a18 18 0 1 0 0-36 18 18 0 0 0 0 36z",
      "M204 106a18 18 0 1 0 0-36 18 18 0 0 0 0 36z",
      "M84 58h96",
      "M96 44h70",
      "M24 92h16",
      "M218 92h16",
      "M118 30h26",
      "M84 116h88",
      "M10 116h240",
    ],
  },
  {
    id: "pipe-fitting-network",
    viewBox: "0 0 220 180",
    paths: [
      "M22 24h66v30h38v30H88v30H58V84H20V54h38z",
      "M58 24v-12h30v12",
      "M126 54h12v30h-12",
      "M58 114v12h30v-12",
      "M20 54H8v30h12",
      "M126 84h48v28h-48z",
      "M174 96h14",
      "M174 64h14",
      "M164 112v20",
      "M148 132h34",
    ],
  },
  {
    id: "roof-truss-assembly",
    viewBox: "0 0 260 140",
    paths: [
      "M16 120h228",
      "M16 120l114-78 114 78",
      "M44 120l86-58 86 58",
      "M30 108l14-10",
      "M60 108l70-46 70 46",
      "M130 42v78",
      "M86 84h88",
      "M102 72l28-18 28 18",
      "M10 128h240",
    ],
  },
  {
    id: "landscape-master-plan",
    viewBox: "0 0 260 170",
    paths: [
      "M8 8h244v154H8z",
      "M24 24c18-14 42-14 60 0 14 10 30 10 44 0 18-14 42-14 60 0",
      "M24 74c14-10 34-10 48 0 10 8 22 8 32 0 14-10 34-10 48 0",
      "M24 132h192",
      "M42 46a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
      "M218 98a10 10 0 1 0 0 20 10 10 0 0 0 0-20z",
      "M88 100h82",
      "M118 24v38",
      "M174 24v30",
    ],
  },
  {
    id: "deck-framing-plan",
    viewBox: "0 0 240 150",
    paths: [
      "M12 14h216v122H12z",
      "M12 36h216",
      "M12 58h216",
      "M12 80h216",
      "M12 102h216",
      "M46 14v122",
      "M82 14v122",
      "M118 14v122",
      "M154 14v122",
      "M190 14v122",
      "M96 136v12h48v-12",
    ],
  },
  {
    id: "stairs-section",
    viewBox: "0 0 200 140",
    paths: [
      "M18 122h164",
      "M18 122v-20h28V82h28V62h28V42h28V22h28",
      "M46 102h28",
      "M74 82h28",
      "M102 62h28",
      "M130 42h28",
      "M18 12h164",
      "M18 12v110",
    ],
  },
  {
    id: "site-plan-grading",
    viewBox: "0 0 250 170",
    paths: [
      "M10 10h230v150H10z",
      "M28 98h64v44H28z",
      "M128 70h62v50h-62z",
      "M30 28h48v34H30z",
      "M20 82h210",
      "M92 28l20 20-20 20-20-20z",
      "M192 20v18",
      "M182 30h20",
      "M124 128h84",
      "M26 150h198",
    ],
  },
  {
    id: "plumbing-riser",
    viewBox: "0 0 180 240",
    paths: [
      "M84 10h12v200H84z",
      "M96 36h54v10H96z",
      "M96 86h46v10H96z",
      "M96 136h58v10H96z",
      "M96 186h40v10H96z",
      "M42 36h42v10H42z",
      "M34 30v22h8",
      "M150 30v22h8",
      "M150 80v22h8",
      "M154 132v18h12",
      "M28 206h124",
      "M58 216h64",
    ],
  },
  {
    id: "electrical-layout",
    viewBox: "0 0 230 170",
    paths: [
      "M12 10h206v150H12z",
      "M32 32h68v44H32z",
      "M122 30h76v38h-76z",
      "M34 92h70v50H34z",
      "M126 86h72v56h-72z",
      "M66 76v16",
      "M160 68v18",
      "M66 92h94",
      "M160 86v56",
      "M66 120h60",
      "M78 120a6 6 0 1 0 0 12 6 6 0 0 0 0-12z",
      "M144 92a6 6 0 1 0 0 12 6 6 0 0 0 0-12z",
    ],
  },
  {
    id: "garage-elevation",
    viewBox: "0 0 250 160",
    paths: [
      "M12 136h226",
      "M20 136V52l32-28h146l32 28v84",
      "M34 64h182",
      "M54 92h58v44H54z",
      "M138 82h70v54h-70z",
      "M164 44v20",
      "M96 64v16",
      "M126 64v16",
      "M204 64v16",
      "M42 148h166",
    ],
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
  const count = 8;
  const anchors = [
    { x: 6, y: 6 },
    { x: 36, y: 5 },
    { x: 66, y: 6 },
    { x: 12, y: 36 },
    { x: 46, y: 34 },
    { x: 76, y: 35 },
    { x: 24, y: 66 },
    { x: 58, y: 67 },
  ];
  const picks: SketchInstance[] = [];
  for (let i = 0; i < count; i += 1) {
    const def = SKETCHES[Math.floor(rand() * SKETCHES.length)];
    const view = def.viewBox.split(/\s+/).map((v) => Number(v));
    const vbW = view[2] || 200;
    const vbH = view[3] || 120;
    const aspect = vbW / vbH;
    const baseHeight = 124 + rand() * 72;
    const height = baseHeight;
    const width = baseHeight * aspect;
    const anchor = anchors[i % anchors.length];
    const jitterX = -2 + rand() * 4;
    const jitterY = -2 + rand() * 4;
    picks.push({
      ...def,
      x: anchor.x + jitterX,
      y: anchor.y + jitterY,
      width,
      height,
      delay: Number((i * 4.2 + rand() * 0.9).toFixed(2)),
      duration: 34 + (i % 3) * 4,
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
      <div className="ts-bg__community" aria-hidden="true" />
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
              width: `${sketch.width}px`,
              height: `${sketch.height}px`,
              animationDelay: `${sketch.delay}s`,
              animationDuration: `${sketch.duration}s`,
            }}
          >
            {sketch.paths.map((path, index) => (
              <path key={`${sketch.id}-${index}`} d={path} />
            ))}
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
.ts-bg__community,
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

/* COMMUNITY PLAN: parcels + corridors + nodes = "community as blueprint" */
.ts-bg__community{
  z-index: 3;
  opacity: 0.2;
  inset: -8%;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='760' viewBox='0 0 1200 760'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.22)' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath stroke-width='1.5' d='M40 120h1120M40 380h1120M40 640h1120M160 40v680M420 40v680M780 40v680M1040 40v680'/%3E%3Cpath stroke-width='1.2' d='M160 120h260v260H160zM420 120h360v260H420zM780 120h260v260H780zM160 380h260v260H160zM420 380h360v260H420zM780 380h260v260H780z'/%3E%3Cpath stroke-width='1' d='M220 180h140v60H220zM840 440h140v100H840zM500 460h200v120H500zM860 180h120v70H860zM220 460h160v120H220zM500 180h200v130H500z'/%3E%3Cpath stroke-width='1.8' d='M160 250h880M600 120v520M420 510h360M420 250h360'/%3E%3Ccircle cx='160' cy='250' r='8'/%3E%3Ccircle cx='420' cy='250' r='8'/%3E%3Ccircle cx='780' cy='250' r='8'/%3E%3Ccircle cx='1040' cy='250' r='8'/%3E%3Ccircle cx='160' cy='510' r='8'/%3E%3Ccircle cx='420' cy='510' r='8'/%3E%3Ccircle cx='780' cy='510' r='8'/%3E%3Ccircle cx='1040' cy='510' r='8'/%3E%3Cpath stroke-width='1.3' d='M160 250L420 510M420 250L780 510M780 250L1040 510M160 510L420 250M420 510L780 250'/%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 1200px 760px;
  animation: tsCommunityPlanDrift 42s linear infinite;
  transform: translateZ(0);
}

/* TOPO: territory contours (SVG tiled) */
.ts-bg__topo{
  z-index: 4;
  inset: -10%;
  opacity: 0.1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='860' height='560' viewBox='0 0 860 560'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.18)' stroke-width='1'%3E%3Cpath d='M-40 70 C 140 10, 260 140, 430 80 S 720 140, 910 90'/%3E%3Cpath d='M-40 130 C 130 60, 280 210, 430 150 S 740 220, 910 160'/%3E%3Cpath d='M-40 190 C 160 130, 260 250, 440 210 S 720 300, 910 240'/%3E%3Cpath d='M-40 250 C 120 220, 300 320, 460 290 S 740 390, 910 330'/%3E%3Cpath d='M-40 310 C 160 290, 280 390, 470 360 S 740 470, 910 410'/%3E%3Cpath d='M-40 370 C 140 360, 300 450, 470 430 S 720 540, 910 500'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 860px 560px;
  animation: tsTopoDrift 28s linear infinite;
  transform: translateZ(0);
}

/* SIGNALS: trust nodes + tiny “check-in” points */
.ts-bg__signals{
  z-index: 5;
  opacity: 0.2;
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
  z-index: 6;
  opacity: 0.08;
  background-image:
    repeating-linear-gradient(120deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 120px),
    repeating-linear-gradient(120deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 60px);
  background-size: 220px 220px;
  animation: tsFlowDrift 36s linear infinite;
  mix-blend-mode: normal;
}

/* SKETCHES: larger technical blueprint sheets that drift and redraw */
.ts-bg__sketches{
  z-index: 7;
  opacity: 0.24;
}

.ts-bg__sketch{
  position: absolute;
  stroke: color-mix(in oklab, var(--ts-text, #E6EDF6) 52%, transparent);
  stroke-width: 1.1;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: blur(0.1px);
  opacity: 0;
  stroke-dasharray: 520;
  stroke-dashoffset: 520;
  animation: tsSketchDraw 34s ease-in-out infinite;
}

/* VIGNETTE: keeps edges dark so content pops */
.ts-bg__vignette{
  z-index: 8;
  inset: -5%;
  background:
    radial-gradient(900px 520px at 50% 25%, transparent 55%, rgba(0,0,0,.45) 85%),
    radial-gradient(1200px 760px at 50% 80%, transparent 55%, rgba(0,0,0,.62) 90%);
}

@keyframes tsTopoDrift{
  0%{ background-position: 0px 0px; }
  100%{ background-position: 520px 240px; }
}

@keyframes tsCommunityPlanDrift{
  0%{ background-position: 0px 0px; }
  100%{ background-position: 360px 180px; }
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
  0%{ opacity: 0; stroke-dashoffset: 520; transform: translateY(6px); }
  10%{ opacity: 0; }
  22%{ opacity: 0.66; stroke-dashoffset: 220; }
  34%{ opacity: 0.66; stroke-dashoffset: 0; transform: translateY(0); }
  46%{ opacity: 0.28; }
  56%{ opacity: 0; transform: translateY(-4px); }
  100%{ opacity: 0; stroke-dashoffset: -520; }
}

@media (prefers-reduced-motion: reduce){
  .ts-bg__community, .ts-bg__topo, .ts-bg__signals, .ts-bg__flow, .ts-bg__sketch{ animation: none !important; }
}
`;
