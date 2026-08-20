from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "client/src/features/jw-stone/StoneCollection.tsx",
    '        id="current-inventory"\n',
    '        id="stone-collection"\n',
)
replace_once(
    "client/src/features/jw-stone/StoneCollection.tsx",
    '        title="Full inventory"\n',
    '        title="Stone collection"\n',
)
replace_once(
    "client/src/features/jw-stone/StoneCollection.tsx",
    '        <div className="flex flex-wrap items-end justify-between gap-3">\n',
    '''        <p className={`mb-4 max-w-3xl text-sm leading-6 ${jw.muted}`} data-testid="jw-inventory-truth">\n          Collection photos and named materials are references. Current physical inventory is confirmed only after JW Stone verifies the exact item, quantity, dimensions, finish, location, and availability.\n        </p>\n        <div className="flex flex-wrap items-end justify-between gap-3">\n''',
)
replace_once(
    "client/src/features/jw-stone/StoneCollection.tsx",
    '          aria-label="Stone inventory"\n',
    '          aria-label="Stone material collection"\n',
)

replace_once(
    "server/publicJwStoneMarketplaceHtml.ts",
    'const title = String(context.profile.headline || "Current stone selection").trim();',
    'const title = String(context.profile.headline || "Stone selection").trim();',
)
replace_once(
    "server/publicJwStoneMarketplaceHtml.ts",
    '<h2>Current Inventory</h2>',
    '<h2>Stone Collection</h2>',
)
replace_once(
    "server/publicJwStoneMarketplaceHtml.ts",
    '<p>Browse named slabs, dimensions, finishes, and current availability from the live JW Stone profile.</p>',
    '<p>Browse named materials and photo references. Ask JW Stone to confirm the exact physical item, quantity, dimensions, finish, location, and current availability.</p>',
)

print("STONE_INVENTORY_TRUTH_PATCH_READY")
