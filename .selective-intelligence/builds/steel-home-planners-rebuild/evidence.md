# Build Evidence: steel-home-planners-rebuild

Verdict: Implementation in progress
Source branch: `codex/steel-home-planners-rebuild`
Observed: `2026-08-15`

## Recovery baseline

- Production and `main` still contain flat SVG cabinet/metal planners and false early-price ranges.
- Pull request 332 is the only durable recovery checkpoint. It contributes the real JW Stone Three.js countertop studio but not the cabinet or metal rebuild.
- The lost local three-planner working tree was never committed and is not treated as evidence.

## Proof ledger

### Dated metal-building catalog baseline

Observed from first-party public pages on 2026-08-15. These sources establish planning vocabulary and published ranges only. They are not a live inventory, engineering, availability, freight, installation, or price feed; every public choice remains `Quote required` and professionally reviewable.

| Source ID | First-party source | Encoded planning evidence |
| --- | --- | --- |
| `kit-capabilities` | https://www.worldwidesteelbuildings.com/steel-building-kits/ | Custom dimensions; wall/roof colors; windows, skylights, doors, cupolas; residential, garage/workshop, agricultural, commercial and other custom-kit use families. |
| `frame-systems` | https://www.worldwidesteelbuildings.com/construction/details/rigid-frame-steel-building/ | Open-web, tapered clearspan, modular, straight-column and lean-to frame vocabulary. Open-web packages are published at 12–100 ft clearspan and 8–20 ft sidewall, with other sizes by request. |
| `building-accessories` | https://www.worldwidesteelbuildings.com/construction/accessories/ | Windows, sliders, hangar/overhead/Dutch/walk/roll-up doors, louvers, overhangs, stalls, I-beams, bar joists, insulation, wainscot, skylights, lights, stucco/concrete finishes, gutters/downspouts, ridge vents and soffits. |
| `roof-families` | https://www.worldwidesteelbuildings.com/blog/barn-roof-styles/ | Gable, gambrel, monitor and hip roof-family vocabulary; the source supports names and planning intent, not invented specialty-roof dimensions. |
| `additions` | https://www.worldwidesteelbuildings.com/blog/uses-and-add-ons-for-steel-buildings/ | Additions, eave extensions, covered outdoor areas and asymmetrical/custom planning intent. Vertical attachment geometry remains unresolved until entered. |
| `hangar-openings` | https://www.worldwidesteelbuildings.com/construction/accessories/hangar-doors/ | Bifold and hydraulic hangar-door mechanisms; first-party hangar guidance also distinguishes stack-door intent. Exact product clearances require review. |
| `hybrid-system` | https://www.worldwidesteelbuildings.com/projects/hybrid/ | Steel web-truss structure with wood secondary-framing intent. |
| `tube-leg-guide` | https://www.worldwidesteelbuildings.com/wp-content/uploads/2023/08/Information-Guide_-Tube-Leg-Homes-Barndos-v3.1-1.pdf | Rigid, light-gauge, open-web, tube-leg and hybrid home-frame vocabulary. Tube-leg planning range recorded as 12–60 ft wide and 1:12–12:12 pitch, with porches/extensions/connected-building and finish choices subject to quote/review. |

Runtime catalog entries carry only these neutral source IDs. Company names and source URLs stay out of the customer bundle and request payload.

Implementation checkpoints, automated gates, browser captures, and release status will continue to be recorded here. No final release or browser proof is currently claimed.
