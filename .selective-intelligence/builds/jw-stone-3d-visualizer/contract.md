# Build Contract: jw-stone-3d-visualizer

Verdict: Definition locked; build implemented locally; release blocked pending exact-revision browser and owner proof
Base revision: `31225f09b58531e83f7c787110aa964a99145fd7`
Lock version: `1.4.0`

## Included requirements

`JW-3D-SCENES`, `JW-3D-MATERIAL-TRUTH`, `JW-3D-FABRICATION`, `JW-3D-INVENTORY-TRUTH`, `JW-3D-SAVE-SHARE`, `JW-3D-HANDOFF`, `JW-3D-ACCESS-RECOVERY`, and `JW-3D-PROOF`.

## Claimed canonical owners and dependencies

The build claims `jw-stone-3d-scene`, `jw-stone-3d-material`, `jw-stone-planner-model`, `jw-stone-catalog`, `jw-stone-planner-request`, `jw-stone-3d-studio-ui`, and `jw-stone-3d-build`. It reuses the canonical JW catalog, slab-dimension parser, existing planner shell/model, local persistence, and request drawer. It introduces no server, database, inventory, pricing, routing, or deployment owner.

The prior `jw-stone-marketplace` build remains interrupted. Its owner-voided guidance/learning behavior is not a dependency and must not return. Existing `/jw-stone`, `/u/jw-stone`, custom-domain, and non-JW planner behavior is protected unchanged.

## Proof contract

Positive proof covers three navigable scenes, actual JW texture identity, crop/vein/scale persistence, optional geometry, measured summaries, local save, safe share, and deliberate handoff. Negative proof covers default no openings, no live-availability inference, no second inventory mutation path, no prices/private data, no contact on save/share/open, invalid-state isolation, texture failure, WebGL recovery, keyboard/touch, reduced motion, and GPU cleanup. Rollback is local branch closure before release or an application commit revert after separately authorized release.

Implementation and local proof are recorded separately in `evidence.md`. No PR, push, merge, deployment, production mutation, owner visual approval, or live claim is authorized or recorded by this contract.
