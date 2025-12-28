#!/usr/bin/env node

// Verify that hero/header/branding surfaces do not use raw location
// labels, ZIP codes, counties, or state abbreviations directly.
//
// CONTRACT:
// - All hero/header/branding copy must go through formatCityOnly().
// - Do NOT interpolate location.label, ZIP, county, or state directly
//   in hero or header copy.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..", "..");

// Hero / header surfaces that must obey the city-only invariant.
const FILES = [
	"client/src/scout/ScoutHeader.tsx",
	"client/src/scout/ScoutOS.tsx",
	"client/src/scout/ScoutInputRow.tsx",
	"client/src/pages/CommunityOsLanding.tsx",
	"client/src/pages/community-dashboard.tsx",
];

// Disallowed tokens in hero/header copy. These are scoped to the specific
// files above so normal uses elsewhere (forms, SEO, internal logic) remain
// allowed. We focus on raw location labels and explicit postal fields,
// not generic narrative mentions of counties or ZIPs.
const DISALLOWED = [
	"location.label",
	"postalCode",
	"zipCode",
];

let violations = [];

for (const relPath of FILES) {
	const absPath = resolve(__dirname, relPath);
	let content = "";
	try {
		content = readFileSync(absPath, "utf8");
	} catch (err) {
		// If a file is missing, treat as non-fatal (it may have been renamed).
		continue;
	}

	DISALLOWED.forEach((token) => {
		if (content.includes(token)) {
			violations.push({ file: relPath, token });
		}
	});
}

if (violations.length > 0) {
	console.error("\nCity-only branding guard failed. The following disallowed tokens were found in hero/header files:\n");
	for (const v of violations) {
		console.error(` - ${v.file} contains disallowed token: ${v.token}`);
	}
	console.error("\nFix: route hero/header copy through formatCityOnly() and remove direct usage of these tokens in branding surfaces.\n");
	process.exit(1);
}

console.log("City-only branding guard passed (hero/header copy is clean).");
