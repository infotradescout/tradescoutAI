# JW Stone profile and inventory reconciliation — 2026-07-13

## Outcome

The JW Stone profile now uses one versioned catalog derived from the supplied Drive folder and the
existing optimized repository assets. The public catalog contains 110 named stones and 313 images.
Eighteen stones whose material evidence is absent or conflicts with the historical folder assignment
are shown under **Material to Confirm**. Ninety-three stones have no explicit finish evidence and show
**Finish: ask JW Stone** instead of an inferred finish.

The Drive snapshot contains 515 file records because it includes repeated files, close-ups, bundle
views, email copies, “Just Arrived” copies, video/DNG/HEIC originals, and loose root files. Those
records are preserved as evidence in
`docs/audits/data/jw-stone-drive-source-2026-07-13.json`; the customer-facing profile uses the
deduplicated, web-optimized image set.

## Evidence rules

- A source material folder supports a material grouping but does not prove a finish.
- A material explicitly stated in a filename is accepted as filename evidence.
- A finish is displayed only when words such as polished, honed, leathered, or brushed are explicit.
- “Backlit,” “reflected light,” “close-up,” “book,” and “dual finish” are photo/view or incomplete
  treatment evidence. They are not promoted to a specific finish by themselves.
- A loose or ambiguous source stays visible under Material to Confirm; it is not deleted or silently
  forced into the historical category.
- Slab counts and dimensions remain source evidence only. They are not advertised as live
  availability because multiple bundles and dates exist for several stones.

## Reconciled public catalog

| Category | Stones | Material evidence |
|---|---:|---|
| Granite | 25 | JW material folder or user-confirmed email set |
| Marble | 33 | JW material folder |
| Quartzite | 25 | JW material folder, explicit filename, or user-confirmed email set |
| Engineered Quartz | 6 | JW Quartz folder |
| Onyx | 1 | JW Onyx folder |
| Soapstone | 1 | JW Soapstone subfolder |
| Basalt | 1 | JW Basalt subfolder |
| Material to Confirm | 18 | Loose/root-only or conflicting historical assignment |

## Findings in the shared evidence model

| File and symbol | Route or surface | Audience and permitted roles | Canonical product object represented | User job supported | Current behavior | Competing or duplicate implementation | Direct Connect capability involved | Visual or terminology divergence | Severity | Evidence and confidence | Proposed disposition |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `client/src/data/jwStoneInventory.ts` — `JW_STONE_INVENTORY_CATEGORIES` | `/u/jw-stone` inventory | Public; logged-in and logged-out visitors | Inventory stone | Find a named material and inspect photos | Serves 110 stones / 313 images from a stable catalog | Older database `inventoryCatalog` seed can be incomplete or stale | “Ask about this stone” starts Express Direct Connect | Previously hidden catalog changes and horizontal-only browsing | blocker | Drive snapshot plus optimized asset tree; high confidence for file coverage | **keep** versioned catalog; **hide** stale JW database catalog on read |
| `ProfileSiteView.tsx` — JW catalog override | `/u/jw-stone` | Public; all roles | Business profile + inventory catalog | See the current reconciled JW profile | Replaces only JW Stone’s stored catalog block; other TradePartners remain data-driven | Stored `inventoryCatalog` block | Preserves per-business Express route regardless of auth state | Historical profile could silently render an older catalog | drift | Profile render path and source catalog; high confidence | **consolidate** JW public read path on the reconciled catalog |
| `jwStoneInventory.ts` — `TARGET_CATEGORY` | JW inventory filters | Public; all roles | Material classification | Browse without being misled by a guessed material | Moves explicit conflicts and loose-only entries out of misleading buckets | Historical asset directory names | Stone selection becomes request context | “Matrix Basalt” was under Granite; engineered Calacatta colors were under Marble | blocker | JW nested folders / explicit filenames; high for corrections, medium for unconfirmed queue | **migrate** supported classifications; **keep** uncertain stones visible under Material to Confirm |
| `jwStoneInventory.ts` — `EXPLICIT_FINISHES` | JW cards and lightbox | Public; all roles | Finish evidence | Know what finish is actually documented | Shows explicit finishes; otherwise asks the visitor to confirm with JW Stone | Filename-derived marketing labels in old folder names | Finish question can be sent in Express request | “Backlit” risked being treated like a finish; “dual finish” often omits one side | drift | Supplied filenames; high confidence for explicit words, no inference for omissions | **consolidate** on explicit finish vocabulary; **hide** unsupported finish claims |
| `WholesalerProfileTheme.tsx` — inventory search/grid/lightbox | `/u/jw-stone#collection` | Public; all roles | Inventory browsing surface | Search 110 names, inspect all photos, ask about one stone | Search spans all material groups; cards expose photo count and evidence-safe finish copy | Older horizontal card strip and multi-image stacked modal | Stone name is passed into Express Direct Connect | Old surface made large categories difficult to scan and did not expose uncertainty | cleanup | 110-item catalog size and UI implementation; high confidence | **migrate** to search/grid/lightbox |
| `ExpressDirectConnectPanel.tsx` and `tradepartner-express.ts` | CTA on `/u/jw-stone` | Logged-in and logged-out visitors; public call decision; phone required for request | Express connection/request | Call JW Stone or send a private request to its managed account | Same Express path for either auth state; call reveal is decision-gated; form requires phone but no SMS | Full `/direct-connect` portal remains the discovery path | Initiate call, submit targeted private request, create/onboard requester account | Previous CTA logic conflated profile entry with portal discovery | blocker | Focused contract tests and route implementation; high confidence | **keep** Express profile flow; **keep separate** from portal Direct Connect |

## Corrections and uncertainty queue

| Stone or group | Previous placement | Evidence-based placement | Reason |
|---|---|---|---|
| Matrix Basalt | Granite | Basalt | Dedicated `BASALAT (LAVA STONE)` source subfolder |
| Calacatta Andromeda / D'Or / Fumo / Gold | Marble | Engineered Quartz | Files are in the supplied Quartz collection |
| Calacatta Amala | Marble | Quartzite | Files are in the supplied Quartzite collection |
| Calacatta Vaguili | Marble | Quartzite | Loose filename explicitly says “quartzite” |
| Steel Gray and other root-only named stones | Quartzite or other historical folder | Material to Confirm | No authoritative source material folder; filename does not establish material |
| Emerald Pearl, Perlatus, White Silk, Versace, Valle Nevada | Historical category | Material to Confirm | Loose / Just Arrived evidence conflicts with or does not substantiate prior placement |
| Cristallo “backlit” and “reflected light” | Potential finish-like wording | Quartzite with documented Polished/Honed finishes only | Backlighting and reflected light describe the image/view |

## Dispositions

- **Keep:** all 313 optimized photos, including alternate views.
- **Consolidate:** JW Stone’s public inventory on the versioned catalog.
- **Migrate:** explicit material corrections and explicit finish labels.
- **Hide:** stale JW database catalog values, unsupported finish claims, and live slab-count claims.
- **Delete:** nothing from the supplied evidence set. Duplicates remain in the audit snapshot but are
  not repeated in the public gallery.

## Verification

- Catalog contract: 110 unique stones, 313 existing image paths, corrected conflict categories,
  and no “Backlit” finish.
- Express Direct Connect contract: profile/portal separation, call decision gate, phone-only request
  friction, managed-business targeting, and provisional-member onboarding.
- TypeScript check: pass.
- Production build: pass.
- Theme, blur, and user-facing error audits: pass.

## Remaining evidence gaps

- Eighteen stones still need owner confirmation of material.
- Ninety-three stones still need explicit finish confirmation.
- Current slab availability, dimensions, bundle numbers, and prices require a dated operational
  source before being shown as live inventory facts.
- UUID/IMG/PHOTO-named originals remain preserved but cannot be assigned to a stone without visual
  or owner confirmation.
