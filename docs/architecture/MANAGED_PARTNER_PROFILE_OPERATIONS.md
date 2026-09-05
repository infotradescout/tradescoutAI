# Managed Partner Profile Operations

## Operating law

Partner intake and platform development run at the same time.

No partner waits for a shared template to become perfect. No shared architecture waits for partner intake to slow down.

## Partner intake queue

The Partner Intake queue records a new relationship as soon as it arrives. It does not wait for the company-specific profile build, and it does not stop any existing partner profile.

The queue stages are:

- `incoming`
- `source_review`
- `profile_build`
- `routing_review`
- `ready_to_publish`
- `live`
- `blocked`
- `archived`

A new intake records the company name, proposed slug, public source links, profile lane, control mode, contact policy, exposure, request path, operating request recipient, verified relationship, priority, and known boundaries.

Unknown owner or contact facts remain pending. They are not replaced with invented information.

The company-specific profile build continues independently and concurrently. The queue does not create a generic public profile or force every company into the same presentation.

## Promotion to live operations

An intake may be promoted to live only after the production records prove that:

1. The canonical business exists and is active.
2. The canonical profile exists and is published.
3. The profile belongs to the business.
4. Business and profile ownership match.

Once promoted to live, the intake becomes a runtime managed-profile definition. It enters the same continuous health board as the permanent managed profiles without another checked-in registry edit.

If the live intake uses TradeScout-managed contact, the approved phone and inbox are normalized on the business record without changing profile ownership.

## What is shared

The shared system governs facts that must remain consistent across partners:

- Profile slug and company identity
- Ownership and stewardship mode
- Public, direct-only, or pending exposure
- Public contact policy
- Message notification inbox
- Primary request recipient
- Expected primary action
- Verified business relationship
- Health and release state

## What remains company-specific

The public experience must follow the actual company rather than a generic visual template. Company-specific work may include:

- Website-style presentation
- Product or inventory browsing
- Contractor portfolio and service areas
- Project consultation
- Quarry, source, or manufacturer storytelling
- Video, galleries, and source-backed company content

Reuse the operating system. Customize the company experience.

## Current control modes

### TradeScout-admin-controlled

TradeScout owns the profile record and manages publication. The underlying company remains independent.

### Temporary admin stewardship pending owner transfer

TradeScout keeps the profile operable until the confirmed owner account is attached. The temporary steward cannot become the public company identity.

### Narrow admin stewardship pending claim

The profile remains direct-only or limited while owner claim, contact, or release decisions are unresolved.

### Owner-controlled with TradeScout-managed contact

The business and profile remain owner-controlled. TradeScout manages the approved public response destination without changing ownership.

### Owner controlled

`owner_controlled` records company account control independently of contact handling. Pair it with `business_managed` when the company handles its own requests. Selecting the label does not transfer business or profile ownership, establish a claim, verify the account, or remove readiness blockers; the scoped ownership handoff and company account acceptance remain separate actions.

## Current contact modes

### TradeScout managed

The public response destination is:

- `(850) 543-0748`
- `contact@thetradescout.com`

### Business phone with TradeScout inbox

A verified public company phone remains the Call destination while messages and notifications use `contact@thetradescout.com`.

### Pending owner contact

No public contact is invented. The operations board marks the unresolved contact until the owner decision is available.

### Business managed

`business_managed` records that the business handles its own requests. The intake retains explicitly configured business email and notification inbox values. A phone is optional. Switching from another contact mode does not inherit its contact destinations, and this mode never supplies a TradeScout phone or inbox by default.

The business record uses `profileData.contactManagement = "business_managed"`; its email and notification inbox must match the intake, and the operating recipient must be the same business profile. A configured phone is checked when supplied. The admin editor derives this option from the shared contact-mode list.

Selecting this mode does not transfer ownership, establish verification, publish a profile, or grant contact access. The shared health check blocks business request readiness while claim or owner transfer is pending, the owner is a profile steward, the owner account is not confirmed by email, the expected business inbox is missing or mismatched, or the request path remains pending. An email alert links to the authenticated inbox; a staged mailbox alone does not establish that the business can open or reply to a request. Contact decisions and actual delivery still require the existing request workflow and its proof.

Migration `0130_business_managed_partner_contact.sql` adds `business_managed` and `owner_controlled` to the existing intake contact and control CHECKs while preserving every prior mode and leaving records unchanged. The schema guard expects the `0130:v1` marker on both constraints. Apply it through the normal migration process before storing these modes; no runtime fallback or startup contact normalization writes business-managed destinations.

## Request routing

The public company identity and the operating request recipient are separate fields.

Examples:

- R.E.D. Graniti presents R.E.D. Graniti. JW Stone handles verified first-cut requests.
- JW Stone presents and receives its own inventory requests.
- ISSA Build presents and receives its own project consultations.

A request recipient does not become the owner of the source company, profile, catalog, or inventory.

## Continuous health checks

The Managed Profiles board checks:

1. Business and profile records exist.
2. Business is active and profile is published.
3. Business, profile, and owner links agree.
4. Required admin custody is verified.
5. Public or direct-only discovery matches the registry.
6. Public phone, email, and notification inbox match the contact policy.
7. Claim or transfer status matches the stewardship mode.
8. Primary action wording matches the intended customer path.
9. The operating request recipient is available.

Profiles are shown as Ready, Needs Attention, or Blocked. An issue on one partner does not stop another partner from onboarding or remaining live.

## Startup and promotion normalization

Individual profile provisioners may create or restore company-specific records. The final managed-contact pass runs afterward and restores the approved shared contact to every permanent or intake-promoted profile whose contact mode is `tradescout_managed`.

Each contact update runs independently. A missing or malformed partner cannot roll back corrections already made for other partners.

When an intake is promoted to live from the admin portal, the same contact normalization is attempted immediately. Any unresolved result appears on the live health board rather than redirecting or blocking unrelated partners.
