# TradeScout App Surface Law

Status: policy_target
Owner: Product/UX
Scope: Core authenticated and app workflow surfaces, especially Community, Inbox, Direct Connect, and Scout.

## Core Law

Every core TradeScout app surface must look and behave like a finished consumer app first. AI should make the product smarter behind the scenes, not turn the screen into a system explanation.

## Surface Rules

1. App surfaces are not doctrine surfaces.
   - Users should not have to read platform law, routing theory, trust architecture, or AI implementation logic to complete an ordinary task.
   - Doctrine belongs in tests, internal docs, admin tools, help pages, confirmations, or expandable details when the user asks for it.

2. App surfaces are not AI explanation surfaces.
   - AI may improve the result, draft, summary, ranking, default value, next action, or routing.
   - AI must not become the visible page structure through assistant framing, system-state panels, routing dumps, confidence dashboards, or paragraph walls.

3. App surfaces are not marketing pages unless they are public marketing routes.
   - Public SEO and landing routes may use hero storytelling.
   - Transactional workflows must start with the job and action, not a hero, manifesto, or repeated brand promise.

4. Each surface exposes one primary job and one dominant action.
   - Secondary actions may exist, but they must be visually quieter and subordinate to the surface job.
   - Navigation, filters, status chips, banners, and optional panels must not compete with the primary action.

5. Hero sections are forbidden inside transactional workflows.
   - Direct Connect request creation, Inbox review, Community posting, and Scout workspaces should not use app-hero patterns.
   - Workflow headers should be compact, contextual, and action-oriented.

6. Long explanations belong outside the default viewport.
   - Use help, docs, admin, confirmation screens, expandable details, or short inline helper text.
   - The mobile first viewport must show useful action early.

7. Trust is preserved by behavior, not by making the UI heavy.
   - Direct Connect contact gating remains enforced.
   - HomeID remains optional and helpful.
   - Scout remains Search + Control, not chatbot/helper/assistant branding.
   - Brand boundaries remain TradeScout-only.
   - No pay-to-play, lead-selling, or fake certainty language is allowed.

## Surface Target Models

### Community

Community should be a local hub, feed, and discovery surface:

- Clean local cards for posts, questions, resources, events, and requests where supported.
- Browse, search, post, and start request CTAs.
- Local/global state should be understandable without global action leakage.
- No community assistant identity and no AI explainer copy as page structure.

### Inbox

Inbox should be an action center:

- Concise cards with unread, action-required, and status filters.
- The next action appears first.
- Contact request review remains gated and clear.
- No AI/system routing dump, thread doctrine, or status-noise layout.

### Direct Connect

Direct Connect should be a premium request, review, and send flow:

- Short form sections with calm hierarchy.
- Compact beta/status notice only when needed.
- Optional HomeID support, never required.
- Contact gating preserved but not over-explained in the default viewport.
- Request photos, review, and submission remain intact.

### Scout

Scout should be a Search + Control workspace:

- Natural input.
- Structured output blocks.
- View/action controls for opening the right app surface.
- Local summaries and next steps, not chatbot branding.
- No "Ask Scout", "Search with Scout", chatbot/helper/assistant branding, AI doctrine, or paragraph walls as the default experience.

## Implementation Standard

For every core surface change, reviewers should ask:

- What is the one primary job?
- What is the dominant action?
- What AI/system/doctrine detail can be hidden, collapsed, moved to admin/docs, or expressed as a better default?
- Does the first mobile viewport show action early?
- Does the change preserve Direct Connect gating, HomeID optionality, Scout Search + Control doctrine, brand separation, routing semantics, auth, analytics contracts, and user trust?
