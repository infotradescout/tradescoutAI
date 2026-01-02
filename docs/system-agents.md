# System Agents (Non-Human Identities)

System agents are non-human actors that exercise constrained, declared claims. They are **not users** and must never be treated like homeowners, contractors, or community members.

## Mental Model
- Agents declare claims, scopes, and type explicitly.
- Claims describe what they can do (e.g., `post`, `observe`, `seed`).
- Scope restricts where they can act (e.g., a specific business slug or global test surface).
- They never bypass Scout, Trust, CVS, or geographic rules.
- They produce signals; they are not participants.

## Required Environment (tests/.env)
```
BASE_URL=http://localhost:5000
AGENT_IDENTITY_EMAIL=agent@example.com
AGENT_IDENTITY_SECRET=secret
AGENT_TYPE=bot_operator
AGENT_CLAIMS=post,observe,seed
AGENT_SCOPE_SLUG=your-scope-slug
```

## Allowed Responsibilities
- Seed posts or listings for test surfaces.
- Simulate load and routing paths.
- Exercise suppression logic and Scout flows.
- Generate findings for Mission Control via `bot_ui_findings`.

## Forbidden Actions
- Messaging users directly.
- Bypassing intent → decision cards.
- Writing trust scores or altering CVS.
- Modifying county metrics directly.
- Acting as contractors, homeowners, or any human role.

## CI/CD Expectations
- GitHub secrets use `AGENT_IDENTITY_EMAIL`, `AGENT_IDENTITY_SECRET`, `AGENT_SCOPE_SLUG` (plus optional `AGENT_TYPE`, `AGENT_CLAIMS`).
- Agents run with `isTestRun=true` where applicable to prevent learning pipelines.
- Bot Army outputs are inputs for Mission Control; they do not change authority.

## Design Guardrail
System agents remain tools inside the authority plane. Treat every new automation this way to avoid accidental god-mode or human-role drift.
