import { getCatalogItemById, getNamedCatalogItemByShareSlug } from "@/features/jw-stone/catalog";
import {
  createEmptySteelHomeProjectDraft,
  reconcileSteelHomeProjectDraft,
  type SteelHomeCountertopDesign,
} from "./projectModel";
import {
  buildStoneDesignerPhotoKey,
  isStoneDesignerPhotoKey,
  resolveStoneDesignerPhotoIndex,
} from "./stoneDesignerImages";

export const COUNTERTOP_STUDIO_SHARE_PARAM = "studio" as const;

type CountertopStudioSnapshotFields = {
  s: string;
  r: SteelHomeCountertopDesign["room"];
  l: SteelHomeCountertopDesign["layout"];
  a: number;
  b: number;
  c: number;
  d: number;
  i: boolean;
  il: number;
  iw: number;
  x: number;
  y: number;
  z: number;
  vr: SteelHomeCountertopDesign["veinRotation"];
  cp: SteelHomeCountertopDesign["cameraPreset"];
  fl: boolean;
  sm: boolean;
  wf: SteelHomeCountertopDesign["waterfall"];
  e: SteelHomeCountertopDesign["edge"];
  bs: SteelHomeCountertopDesign["backsplash"];
  si: SteelHomeCountertopDesign["sink"];
  sr: SteelHomeCountertopDesign["sinkRun"];
  sp: number | null;
  sf: number | null;
  co: SteelHomeCountertopDesign["cooktop"];
  cr: SteelHomeCountertopDesign["cooktopRun"];
  cpp: number | null;
  cf: number | null;
  oc: Array<{
    t: SteelHomeCountertopDesign["otherCutouts"][number]["type"];
    r: SteelHomeCountertopDesign["otherCutouts"][number]["run"];
    p: number | null;
    f: number | null;
    w: number | null;
    d: number | null;
  }>;
};

type CountertopStudioSnapshotV1 = CountertopStudioSnapshotFields & {
  v: 1;
  /** Legacy positional photo identity. */
  im: number;
};

export type CountertopStudioSnapshotV2 = CountertopStudioSnapshotFields & {
  v: 2;
  /** Stable opaque identity for the exact selected inventory photo. */
  pk: string;
};

type CountertopStudioSnapshot = CountertopStudioSnapshotV1 | CountertopStudioSnapshotV2;

function encodeSnapshot(snapshot: CountertopStudioSnapshot): string {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeSnapshot(value: string): unknown {
  if (!/^[A-Za-z0-9_-]{1,6000}$/.test(value)) return null;
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function buildCountertopStudioSnapshot(
  design: SteelHomeCountertopDesign
): CountertopStudioSnapshotV2 | null {
  const stone = getCatalogItemById(design.stoneId);
  if (!stone?.shareSlug || stone.anonymous) return null;
  const selectedImageHref = stone.images[design.textureImageIndex];
  const photoKey = selectedImageHref ? buildStoneDesignerPhotoKey(selectedImageHref) : null;
  if (!photoKey) return null;

  return {
    v: 2,
    s: stone.shareSlug,
    r: design.room,
    l: design.layout,
    a: design.wallAIn,
    b: design.wallBIn,
    c: design.wallCIn,
    d: design.wallDepthIn,
    i: design.island,
    il: design.islandLengthIn,
    iw: design.islandWidthIn,
    pk: photoKey,
    x: design.textureOffsetX,
    y: design.textureOffsetY,
    z: design.textureScale,
    vr: design.veinRotation,
    cp: design.cameraPreset,
    fl: design.floorStone,
    sm: design.showSeams,
    wf: design.waterfall,
    e: design.edge,
    bs: design.backsplash,
    si: design.sink,
    sr: design.sinkRun,
    sp: design.sinkPositionIn,
    sf: design.sinkFrontPositionIn,
    co: design.cooktop,
    cr: design.cooktopRun,
    cpp: design.cooktopPositionIn,
    cf: design.cooktopFrontPositionIn,
    oc: design.otherCutouts.map((cutout) => ({
      t: cutout.type,
      r: cutout.run,
      p: cutout.positionIn,
      f: cutout.frontPositionIn,
      w: cutout.widthIn,
      d: cutout.depthIn,
    })),
  };
}

export function buildCountertopStudioShareUrl(
  design: SteelHomeCountertopDesign,
  baseHref: string
): string | null {
  const snapshot = buildCountertopStudioSnapshot(design);
  if (!snapshot) return null;
  const current = new URL(baseHref, "https://tradescout.local");
  const share = new URL(current.pathname, current.origin);
  share.searchParams.set(COUNTERTOP_STUDIO_SHARE_PARAM, encodeSnapshot(snapshot));
  return share.toString();
}

export function parseCountertopStudioShareUrl(href: string): SteelHomeCountertopDesign | null {
  try {
    const url = new URL(href, "https://tradescout.local");
    const encoded = url.searchParams.get(COUNTERTOP_STUDIO_SHARE_PARAM);
    if (!encoded) return null;
    const value = decodeSnapshot(encoded);
    if (!value || typeof value !== "object") return null;
    const version = (value as { v?: unknown }).v;
    if (version !== 1 && version !== 2) return null;
    const snapshot = value as Partial<CountertopStudioSnapshot>;
    if (typeof snapshot.s !== "string") return null;
    const stone = getNamedCatalogItemByShareSlug(snapshot.s);
    if (!stone) return null;
    let textureImageIndex: number;
    let texturePhotoKey = "";
    if (version === 2) {
      const photoKey = (value as Partial<CountertopStudioSnapshotV2>).pk;
      if (!isStoneDesignerPhotoKey(photoKey)) return null;
      textureImageIndex = resolveStoneDesignerPhotoIndex(stone.images, photoKey);
      if (textureImageIndex < 0) return null;
      texturePhotoKey = photoKey;
    } else {
      const legacyIndex = (value as Partial<CountertopStudioSnapshotV1>).im;
      if (typeof legacyIndex !== "number" || !Number.isFinite(legacyIndex)) return null;
      textureImageIndex = legacyIndex;
    }

    const empty = createEmptySteelHomeProjectDraft();
    const otherCutouts = Array.isArray(snapshot.oc)
      ? snapshot.oc.slice(0, 6).map((cutout, index) => ({
          id: `shared-${index + 1}`,
          type: cutout?.t,
          label: "",
          run: cutout?.r,
          positionIn: cutout?.p,
          frontPositionIn: cutout?.f,
          widthIn: cutout?.w,
          depthIn: cutout?.d,
        }))
      : [];
    return reconcileSteelHomeProjectDraft({
      countertops: {
        ...empty.countertops,
        room: snapshot.r,
        layout: snapshot.l,
        wallAIn: snapshot.a,
        wallBIn: snapshot.b,
        wallCIn: snapshot.c,
        wallDepthIn: snapshot.d,
        island: snapshot.i,
        islandLengthIn: snapshot.il,
        islandWidthIn: snapshot.iw,
        stoneId: stone.id,
        textureImageIndex,
        texturePhotoKey,
        textureOffsetX: snapshot.x,
        textureOffsetY: snapshot.y,
        textureScale: snapshot.z,
        veinRotation: snapshot.vr,
        cameraPreset: snapshot.cp,
        floorStone: snapshot.fl,
        showSeams: snapshot.sm,
        waterfall: snapshot.wf,
        edge: snapshot.e,
        backsplash: snapshot.bs,
        sink: snapshot.si,
        sinkRun: snapshot.sr,
        sinkPositionIn: snapshot.sp,
        sinkFrontPositionIn: snapshot.sf,
        cooktop: snapshot.co,
        cooktopRun: snapshot.cr,
        cooktopPositionIn: snapshot.cpp,
        cooktopFrontPositionIn: snapshot.cf,
        otherCutouts,
      },
    }).countertops;
  } catch {
    return null;
  }
}
