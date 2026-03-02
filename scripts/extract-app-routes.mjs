import fs from "node:fs";
import path from "node:path";

function fail(message) {
  throw new Error(`[extract-app-routes] ${message}`);
}

function findUnique(haystack, needle) {
  const first = haystack.indexOf(needle);
  if (first < 0) return -1;
  const second = haystack.indexOf(needle, first + needle.length);
  if (second >= 0) fail(`Expected unique marker, found twice: ${needle}`);
  return first;
}

function sliceBetween(text, startMarker, endMarker, opts = {}) {
  const start = opts.uniqueStart ? findUnique(text, startMarker) : text.indexOf(startMarker);
  if (start < 0) fail(`Missing start marker: ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) fail(`Missing end marker after ${startMarker}: ${endMarker}`);
  return {
    start,
    end,
    content: text.slice(start + startMarker.length, end),
  };
}

function ensureEol(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

const repoRoot = process.cwd();
const appPath = path.join(repoRoot, "client", "src", "App.tsx");
const outPath = path.join(repoRoot, "client", "src", "AppRoutes.tsx");

const original = fs.readFileSync(appPath, "utf8");

const segment1Start = "function getPostLandingRoute";
const segment1End = "function isDefaultHomePage";
const s1StartIdx = original.indexOf(segment1Start);
if (s1StartIdx < 0) fail(`Missing marker: ${segment1Start}`);
const s1EndIdx = original.indexOf(segment1End, s1StartIdx);
if (s1EndIdx < 0) fail(`Missing marker after segment1: ${segment1End}`);
const segment1 = original.slice(s1StartIdx, s1EndIdx).trimEnd();

const rootLandingStart = "// Root landing router:";
const lazyLoadStart = "// Lazy load all pages by category for better code splitting";
const s2StartIdx = findUnique(original, rootLandingStart);
if (s2StartIdx < 0) fail(`Missing marker: ${rootLandingStart}`);
const s2EndIdx = original.indexOf(lazyLoadStart, s2StartIdx);
if (s2EndIdx < 0) fail(`Missing marker after RootLanding: ${lazyLoadStart}`);
const segment2 = original.slice(s2StartIdx, s2EndIdx).trimEnd();

const mainLayoutMarker = "// Main app layout component";
const s3StartIdx = original.indexOf(lazyLoadStart);
if (s3StartIdx < 0) fail(`Missing marker: ${lazyLoadStart}`);
const s3EndIdx = original.indexOf(mainLayoutMarker, s3StartIdx);
if (s3EndIdx < 0) fail(`Missing marker after lazy imports: ${mainLayoutMarker}`);
const segment3 = original.slice(s3StartIdx, s3EndIdx).trimEnd();

const errorBoundaryMarker = "<ErrorBoundary fallback={<PageLoader />}>";
const mainMarker = "<main className={mainClassName}>";
const mainIdx = findUnique(original, mainMarker);
if (mainIdx < 0) fail(`Missing marker: ${mainMarker}`);
const ebStartIdx = original.indexOf(errorBoundaryMarker, mainIdx);
if (ebStartIdx < 0) fail(`Missing marker after AppLayout main: ${errorBoundaryMarker}`);
const ebEndIdx = original.indexOf("</ErrorBoundary>", ebStartIdx);
if (ebEndIdx < 0) fail("Missing </ErrorBoundary> for AppLayout route block");
const routeInner = original
  .slice(ebStartIdx + errorBoundaryMarker.length, ebEndIdx)
  .trim();

const headerLines = [
  'import React, { lazy, memo, Suspense, useEffect } from "react";',
  'import { Route, Switch, useLocation } from "wouter";',
  'import { ErrorBoundary } from "./components/ui/error-boundary";',
  'import { ProtectedRoute } from "./components/ProtectedRoute";',
  'import { useAuth } from "./hooks/useAuth";',
  'import { AppShell } from "./components/layout/AppShell";',
  'import ScoutOS from "./scout";',
  'import SmartHome from "./SmartHome";',
  'import { PageLoadingSpinner } from "./components/LoadingSpinner";',
  "",
  "const PageLoader = memo(function PageLoader() {",
  '  return <PageLoadingSpinner message="Loading TradeScout..." />;',
  "});",
  "",
];

const routesFile = ensureEol(
  [
    ...headerLines,
    segment1,
    "",
    segment2,
    "",
    segment3,
    "",
    "export const AppRoutes = memo(function AppRoutes({",
    "  isLiteScoutRoute,",
    "  isLandingRoute,",
    "}: {",
    "  isLiteScoutRoute: boolean;",
    "  isLandingRoute: boolean;",
    "}) {",
    "  return (",
    "    <>",
    routeInner,
    "    </>",
    "  );",
    "});",
    "",
  ].join("\n")
);

fs.writeFileSync(outPath, routesFile, "utf8");

// Now modify App.tsx:
let next = original;

// Insert import for AppRoutes just after existing imports block (after last import line).
{
  const importBlockEnd = (() => {
    const lines = next.split("\n");
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImportLine = i;
    }
    if (lastImportLine < 0) fail("No imports found in App.tsx");
    return lines.slice(0, lastImportLine + 1).join("\n").length;
  })();

  // If already applied, don't double-insert.
  if (!next.includes('import { AppRoutes } from "./AppRoutes";')) {
    next =
      next.slice(0, importBlockEnd) +
      '\nimport { AppRoutes } from "./AppRoutes";' +
      next.slice(importBlockEnd);
  }
}

// Update wouter import: remove Route/Switch from App.tsx
next = next.replace(
  'import { Router, Route, Switch, useLocation } from "wouter";',
  'import { Router, useLocation } from "wouter";'
);

// Remove route-only imports that should now live in AppRoutes.tsx.
const routeOnlyImports = [
  'import { ProtectedRoute } from "./components/ProtectedRoute";\n',
  'import { AppShell } from "./components/layout/AppShell";\n',
  'import ScoutOS from "./scout";\n',
  'import SmartHome from "./SmartHome";\n',
];
for (const line of routeOnlyImports) {
  next = next.replace(line, "");
}

// Remove the extracted segments from App.tsx.
if (!next.includes(segment1)) fail("App.tsx does not contain segment1 for removal");
next = next.replace(segment1, "").trimStart();
if (!next.includes(segment2)) fail("App.tsx does not contain segment2 for removal");
next = next.replace(segment2, "").trimStart();
if (!next.includes(segment3)) fail("App.tsx does not contain segment3 for removal");
next = next.replace(segment3, "").trimStart();

// Replace the route JSX inside AppLayout's ErrorBoundary.
{
  const open = String.fromCharCode(60);
  const close = String.fromCharCode(62);
  const appRoutesLine =
    open + "AppRoutes isLiteScoutRoute={isLiteScoutRoute} isLandingRoute={isLandingRoute} /" + close;
  const mainIdxNext = next.indexOf(mainMarker);
  if (mainIdxNext < 0) fail("Updated App.tsx missing AppLayout <main> marker");
  const ebStartIdxNext = next.indexOf(errorBoundaryMarker, mainIdxNext);
  if (ebStartIdxNext < 0) fail("Updated App.tsx missing AppLayout ErrorBoundary marker");
  const ebEndIdxNext = next.indexOf("</ErrorBoundary>", ebStartIdxNext);
  if (ebEndIdxNext < 0) fail("Updated App.tsx missing AppLayout </ErrorBoundary>");

  next =
    next.slice(0, ebStartIdxNext) +
    errorBoundaryMarker +
    "\n            " +
    appRoutesLine +
    "\n          " +
    next.slice(ebEndIdxNext);
}

fs.writeFileSync(appPath, next, "utf8");

console.log("OK: wrote client/src/AppRoutes.tsx and updated client/src/App.tsx");
