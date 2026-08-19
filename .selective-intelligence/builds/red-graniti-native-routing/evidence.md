# R.E.D. Graniti native routing — evidence

## Reported failure

The website recreation looked like R.E.D. Graniti, but its recovery layer redirected failed clicks into generic TradeScout destinations. The owner correctly rejected that behavior: a company website clone cannot make ordinary company controls act like links back to the platform shell.

## Correct outcome

The R.E.D. Graniti profile remains a TradeScout-hosted website recreation, but the customer journey stays inside the R.E.D. experience unless the visitor deliberately chooses an external destination.

### Local company navigation

These controls scroll inside the R.E.D. profile:

- Home
- Products
- Projects
- Contact
- Our World
- Start a Request
- Request a Quote

They do not open the TradeScout home page, HomeID, the generic Direct Connect page, or another dashboard.

### Official R.E.D. destinations

These controls open exact official R.E.D. Graniti resources:

- R.E.D. Group
- R.E.D. in the World
- Quarry directory
- Official quarry videos
- Individual featured project pages
- Complete project directory

### Managed contact

Call is a direct native telephone action to the approved managed number:

- `(850) 543-0748`

Email is a direct native mail action to:

- `contact@thetradescout.com`

Neither action opens a platform landing page.

### Request handling

The quotation form now lives directly inside the R.E.D. page. The visitor enters contact and first-cut project details, submits without leaving the page, and receives an inline success or error state.

The backend assignment still reaches the verified JW Stone first-cut operating profile, but that routing is invisible to the visitor. A successful request does not navigate to Direct Connect, HomeID, the TradeScout dashboard, or another profile.

## Deliberate TradeScout links

Only two explicit destinations leave the company experience for TradeScout:

1. `View JW Stone`, inside the clearly labeled exclusive first-cut relationship.
2. `Powered by TradeScout`, in the footer.

Generic trust actions, generic share controls, the generic profile handoff component, the interaction fallback router, and the old modal contact renderer are removed from the R.E.D. experience.

## Preserved boundaries

- R.E.D. Graniti remains TradeScout-admin-controlled.
- The managed phone and email remain unchanged.
- JW Stone remains the exclusive first-cut operating relationship.
- R.E.D. source materials do not become JW Stone inventory.
- No physical assets, availability, pricing, territory, ownership, ISSA Build, or Stone Core records are changed.

## Release proof required

Completion requires:

- Production build success.
- Production deployment live on the exact revision.
- No compiled reference to the removed R.E.D. interaction boundary or modal router.
- Call anchors resolve to the managed `tel:` destination.
- Request and quote anchors resolve to the in-page quotation section.
- The inline form submits to the JW Stone express-request endpoint and stays on the R.E.D. page.
- Official content controls use exact R.E.D. Graniti URLs.
- Only the explicit JW Stone relationship and Powered by TradeScout footer navigate into TradeScout.
