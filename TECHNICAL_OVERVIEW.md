# TradeScout — Technical Overview

**A community-governed authority platform for local work**

Last Updated: January 13, 2026

---

## Executive Summary

TradeScout is a full-stack TypeScript application that reimagines how communities connect with service providers. Built on a foundation of **trust-first authority**, it operates as an AI-assisted community operating system where awareness never grants automatic access, and all interactions flow through verified decision pathways.

**Core Philosophy**: Awareness ≠ Authority. Scout (the AI assistant) is the primary system controller, and UI surfaces are tools Scout orchestrates.

---

## What Users Can Do

### For Homeowners & Property Owners

**Discovery & Search**
- Browse county-specific contractor listings and service providers
- Search by category (HVAC, roofing, plumbing, electrical, landscaping, etc.)
- View verified contractor profiles with CVS scores
- See community recommendations and outcome-based reviews
- Get AI-powered contractor matches from Scout based on needs and location

**Scout AI Assistant**
- Ask home improvement questions ("What should I know before replacing my roof?")
- Get cost estimates specific to your county/region
- Receive project planning advice and timeline guidance
- Learn about local building codes and permit requirements
- Get seasonal maintenance recommendations
- Understand contractor qualifications and what to ask

**Project Management**
- Post project requests with descriptions and requirements
- Receive and compare estimates from multiple contractors
- Track project status and milestones
- Upload project photos and documents
- Manage communication with hired contractors
- Leave outcome-based reviews after project completion

**Contact & Messaging**
- Initiate contact with contractors through decision-based intents:
  - **Hire**: "I want to hire this contractor for a job"
  - **Collaborate**: "I want to work with this professional"
  - **Advise**: "I need consultation/advice"
  - **Reconnect**: "Follow up on previous conversation"
- All contact requires address verification (both parties)
- Rate-limited to prevent spam (3/day, 10/week)
- Scout recommends best matches with confidence scores

**Community Participation**
- View neighborhood/county activity feeds
- See local projects and success stories
- Participate in community discussions
- Join HOA groups (if applicable)
- Share home improvement experiences
- Vote on community content moderation

**Profile & Verification**
- Create and manage personal profile
- Verify physical address (required within 14 days)
- Add multiple properties
- Manage privacy settings
- Track home improvement history
- Earn badges for participation and outcomes

---

### For Contractors & Service Providers

**Business Profile**
- Create comprehensive contractor profile
- List services, specialties, and service areas
- Upload licenses, insurance certificates, and credentials
- Add portfolio photos and project examples
- Set availability and response times
- Manage business hours and contact preferences

**Verification & Trust Building**
- Complete multi-level verification:
  - Identity verification (government ID)
  - Business registration (LLC, sole proprietor, etc.)
  - License verification (state/local requirements)
  - Insurance verification (liability, workers' comp)
  - Address verification (physical business location)
- Build Community Verification Score (CVS) 0-100:
  - Verified identity (20 pts)
  - License & insurance (25 pts)
  - Work history & outcomes (25 pts)
  - Community recommendations (20 pts)
  - Responsiveness (10 pts)

**Marketplace & Visibility**
- List services in marketplace by category
- Create promotional deals (optional paid visibility boost)
- Appear in Scout recommendations based on CVS + relevance
- Rank higher with better trust scores (payment cannot override CVS)
- Get matched to relevant project requests
- Respond to homeowner inquiries

**Lead Management**
- Receive project requests matching your services
- View homeowner project details and requirements
- Submit estimates and proposals
- Manage quote pipeline
- Track conversion rates
- Set automatic responses

**Client Communication**
- Respond to verified contact requests
- Manage ongoing client conversations
- Share project updates and photos
- Send estimates and invoices
- Request reviews after project completion
- Build client relationship history

**Business Intelligence**
- View profile analytics and engagement
- Track estimate acceptance rates
- Monitor CVS score and trust signals
- See search visibility metrics
- Understand seasonal demand patterns
- County-specific market insights from Scout

**Claims & Capabilities**
- Declare multiple service claims (e.g., "I install HVAC", "I do electrical work")
- Each claim can be independently verified
- Adaptive verification based on claim type (e.g., electrical requires license)
- Update capabilities as business grows

---

### For Business Owners & Commercial Property

**Commercial Services**
- List commercial properties
- Find B2B service providers (facility maintenance, commercial HVAC, etc.)
- Post large-scale project requests
- Manage multiple locations
- Track vendor relationships
- Bulk estimate requests

**Vendor Management**
- Maintain approved vendor lists
- Track service history across properties
- Manage contracts and agreements
- Schedule recurring maintenance
- Multi-property coordination

---

### For HOAs & Community Builders

**Community Management**
- Create and manage HOA groups
- Post community announcements
- Organize neighborhood projects
- Manage shared spaces and facilities
- Coordinate community funding
- Transparent decision-making tools

**Vendor Coordination**
- Maintain approved contractor lists for community
- Negotiate community rates
- Track community-wide projects
- Manage shared service agreements
- Coordinate bulk services (landscaping, snow removal, etc.)

**Governance Tools**
- Community voting on projects
- Budget transparency
- Shared fund management
- Project approval workflows
- Community decision records

---

### For Real Estate Professionals

**Client Services**
- Recommend trusted contractors to clients
- Provide home improvement guidance
- Access local market data
- Share property preparation resources
- Connect buyers/sellers with service providers

**Market Intelligence**
- County-level home improvement trends
- Contractor availability and pricing
- Seasonal market patterns
- Property value impact data

---

### For Admins & Platform Staff

**Admin OS (Authority Plane)**
- Manage user accounts and roles
- Review and process verifications
- Handle content moderation
- Configure county-specific settings
- Manage geographic intelligence data
- Monitor platform health and metrics
- Configure trust/CVS parameters
- Review authority gate decisions

**Content Management**
- Update system knowledge base
- Curate local guides (county/state-specific)
- Manage Scout's manual cache (highest priority knowledge)
- Configure automated responses
- Set promotional visibility rules

**Analytics & Intelligence**
- Platform-wide metrics dashboard
- Geographic performance data
- Trust score distribution
- Verification completion rates
- Contact success rates
- Scout recommendation accuracy
- Revenue and payment tracking

**Moderation & Safety**
- Review flagged content
- Investigate trust violations
- Manage user reports
- Ban/suspend accounts when needed
- Configure community voting thresholds
- Track abuse patterns

---

## Core Features Available to All Users

### Scout AI Chat Interface
- Always-available AI assistant
- Context-aware responses based on user location and role
- Maintains conversation history
- Provides actionable next steps with explicit links
- Can execute tools on behalf of users
- Learns from outcomes and improves recommendations

### Universal Search
- Keyword search across contractors, services, projects
- Category filtering (30+ service categories)
- Geographic filtering (county, state, radius)
- Sort by CVS score, distance, availability
- Advanced filters (verified only, licensed, insured, etc.)

### Notifications
- Real-time alerts for:
  - New messages
  - Project updates
  - Estimate submissions
  - Verification status changes
  - Scout recommendations
  - Community activity
- Email and in-app delivery
- Configurable notification preferences

### File Management
- Upload photos, documents, contracts
- Secure cloud storage (Google Cloud Storage + AWS S3)
- Organized by project/conversation
- PDF generation for invoices and estimates
- Document versioning and history

### Payment & Transactions (via Stripe)**
- Secure payment processing
- Platform fees for marketplace transactions
- Deal promotion payments
- Community builder subscriptions
- Transparent pricing
- Payment history and receipts

### Affiliate Program
- Every user is automatically an affiliate
- Earn 10% commission on promotions/ads generated from your referrals
- Track earnings and payouts
- No separate signup needed

### Location-Based Intelligence
- Automatic county detection
- County-specific content and recommendations
- Local building codes and requirements
- Regional cost estimates
- Climate-appropriate advice (e.g., HVAC for Arizona, roofing for Houston)
- Local contractor availability

---

## Key User Workflows

### Homeowner Hiring a Contractor

1. **Discovery**: Ask Scout "I need a new roof" or browse marketplace
2. **Recommendations**: Scout provides confidence-scored matches based on:
   - Expertise match (30%)
   - Location match (25%)
   - Trust signals (25%)
   - Past success (15%)
   - Availability (5%)
3. **Review**: View contractor profiles, CVS scores, past work, reviews
4. **Decision**: Scout presents decision card with recommendation
5. **Contact**: Click "Hire" (intent is pre-selected as "hire")
6. **Verification Gate**: System verifies both parties have verified addresses
7. **Conversation Created**: Direct messaging unlocked for this specific intent
8. **Estimate**: Request and receive quotes
9. **Hire**: Accept estimate and proceed
10. **Completion**: Leave outcome-based review, affecting contractor's CVS

### Contractor Getting Leads

1. **Profile Setup**: Complete business profile with verifications
2. **Claims**: Declare service capabilities (e.g., "roofing", "insurance work")
3. **Verification**: Submit licenses, insurance, business registration
4. **CVS Building**: Complete verifications to increase score (0-100)
5. **Marketplace Listing**: List services, optional deal promotions
6. **Scout Matching**: Algorithm surfaces profile to relevant homeowners
7. **Lead Notification**: Receive alerts for project requests in your area
8. **Respond**: Submit estimates or contact homeowner (if they initiated)
9. **Win Work**: Accept projects, complete work
10. **Review Collection**: Request reviews to boost CVS further

### Community HOA Project

1. **Group Creation**: HOA admin creates community group
2. **Project Proposal**: Post shared project (e.g., new community playground)
3. **Voting**: Members vote on approval
4. **Funding**: Transparent budget allocation
5. **Contractor Selection**: Use Scout to find qualified vendors
6. **Community Rate**: Negotiate group pricing
7. **Execution**: Track progress with community visibility
8. **Completion**: Shared outcome record and photos

---

## What Users CANNOT Do (By Design)

### Forbidden Actions (Trust/Authority Protection)

- **Cannot bypass contact intent**: No "just say hi" messaging - must declare purpose
- **Cannot contact without verification**: Both parties must have verified addresses
- **Cannot spam**: Rate-limited to 3 contacts/day, 10/week
- **Cannot fake reviews**: All reviews tied to verified project outcomes
- **Cannot buy ranking**: CVS (trust) always determines visibility, not payment
- **Cannot see social graph**: No "friend discovery" or browsing contact lists
- **Cannot change conversation intent**: Locked at creation (hire, collaborate, etc.)
- **Cannot sign up "as contractor"**: Must declare claims first, role assigned later
- **Cannot skip verification**: 14-day grace period, then account restrictions
- **Contractors cannot message homeowners first** (unless homeowner initiated)
- **Low CVS + paid boost ≠ high visibility**: Trust threshold cannot be overridden

---

## Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript (strict mode)
- **Build Tool**: Vite (fast HMR, optimized production builds)
- **Routing**: React Router v6
- **State Management**: React Query (@tanstack/react-query) for server state
- **UI Components**: Radix UI primitives + custom theme system
- **Styling**: Tailwind CSS with custom design tokens
- **Forms**: React Hook Form + Zod validation
- **Drag & Drop**: @hello-pangea/dnd
- **File Uploads**: Uppy.js with AWS S3 integration
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM with type-safe schema
- **Authentication**: Passport.js (local, Facebook, Google OAuth)
- **Session Management**: PostgreSQL-backed sessions (connect-pg-simple)
- **File Storage**: Google Cloud Storage + AWS S3
- **Email**: SendGrid
- **Payments**: Stripe
- **AI**: Anthropic Claude (Scout AI), Google Gemini, OpenAI
- **Error Tracking**: Sentry
- **Job Scheduling**: node-cron

### Infrastructure
- **Deployment**: Render (primary), Replit-compatible
- **Database**: Neon PostgreSQL (serverless)
- **CDN**: Static assets served via Vite build
- **SSL**: Automatic HTTPS
- **Containers**: Docker + Docker Compose support
- **Orchestration**: Kubernetes manifests available

### Testing
- **Unit/Integration**: Vitest
- **E2E**: Playwright
- **Bot Army**: Custom 28-test suite for authority enforcement
- **Coverage**: Database-backed tests, UI verification scripts

### Developer Tools
- **Linting**: ESLint
- **Type Checking**: TypeScript strict mode
- **Git Hooks**: Husky
- **Code Formatting**: Prettier
- **Schema Migrations**: Drizzle Kit

---

## System Architecture

### 1. **Authority-First Architecture**

TradeScout operates on a **governed multi-model AI workflow**:

```
┌─────────────────────────────────────────────┐
│         Scout (AI Decision Engine)          │
│  - Primary system controller                │
│  - Routes decisions through authority gates │
│  - Never allows bypass paths                │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┼────────┐
        │        │        │
    ┌───▼──┐ ┌──▼───┐ ┌─▼────┐
    │ Web  │ │ Chat │ │ Admin│
    │  UI  │ │  UI  │ │  OS  │
    └──────┘ └──────┘ └──────┘
       │        │        │
       └────────┼────────┘
                │
    ┌───────────▼─────────────┐
    │   Trust / CVS Engine    │
    │  - Verification gates   │
    │  - Authority validation │
    │  - Rate limiting        │
    └───────────┬─────────────┘
                │
    ┌───────────▼─────────────┐
    │  Geographic Intelligence│
    │  - County-centric data  │
    │  - Pre-routed facts     │
    │  - No live inference    │
    └─────────────────────────┘
```

### 2. **Core Subsystems**

#### **Scout (AI Assistant)**
- **Location**: `/server/scout/`
- **Governor**: Decision engine with role-based responses (Interpreter, Authority, Safeguard, Executor)
- **Tool Discovery**: Institutional learning layer that detects missing capabilities
- **Recommendation Engine**: Confidence-scored contractor matching
- **Models**: Claude (primary), Gemini (analysis), OpenAI (fallback)
- **Knowledge Hierarchy**:
  1. Admin manual cache (highest priority)
  2. Website data (auto-cache + DB)
  3. Internet search (attribution required)
  4. Honest "I don't know" (final fallback)

#### **Admin OS (Authority Plane)**
- **Location**: `/client/src/admin/`
- Config-driven navigation
- Snapshot-aware permissions
- Zero structural UI refactors allowed (extends patterns only)

#### **Geographic Intelligence**
- **Counties as operational containers** (not compute units)
- Pre-routed into:
  - `county_metrics` — facts only
  - `county_entities` — assignments
  - `county_notes` — human interpretation
- **No UI joins, no live inference**

#### **Trust / CVS (Community Verification Score)**
- **Calculation**: 0-100 composite score from:
  - Verified identity (20 pts)
  - License & insurance (25 pts)
  - Work history (25 pts)
  - Community recommendations (20 pts)
  - Responsiveness (10 pts)
- **Exposure governed by behavior** (not payment)
- **Revenue never overrides trust constraints**

#### **Messaging Authority System**
- **Single checkpoint**: All contact flows through `POST /api/conversations/start`
- **Intent immutability**: Selected before conversation creation, never after
- **Verification required**: Both parties must be address-verified
- **Authority gates**: `decision_card` > `scout_recommendation` > `user_search`
- **No bypass paths**: Social graph disabled (410 Gone)

#### **Signup Law (Claims-First)**
- **Identity first** (user provides basic info)
- **Claims second** (multi-select capabilities, e.g., "I can install HVAC", "I own a home")
- **Roles derived later** (capabilities, not assigned upfront)
- **No "sign up as contractor"** — users declare claims, system assigns roles

---

## Database Schema

**ORM**: Drizzle with `/shared/schema.ts` (7,618 lines, single source of truth)

### Key Tables

#### **Users & Identity**
- `users` — Core user accounts
- `profiles` — Extended user profiles
- `user_roles` — 27 comprehensive role types (homeowner, contractor, business_owner, etc.)
- `claims` — User capabilities (multi-select, verification-backed)

#### **Geographic**
- `counties` — FIPS-coded county data
- `states` — State-level metadata
- `county_metrics` — Pre-computed facts
- `county_entities` — Geographic assignments
- `county_notes` — Human interpretation layer

#### **Trust & Verification**
- `verifications` — Identity, license, insurance checks
- `reviews` — Outcome-based feedback
- `cvs_scores` — Community Verification Score tracking
- `trust_signals` — Behavioral trust indicators

#### **Messaging**
- `conversations` — All contact records
- `messages` — Individual messages
- `conversation_metadata` — Immutable intent/authority records
- `direct_connect_requests` — Contact initiation records

#### **Marketplace**
- `marketplace_categories` — Service categories
- `marketplace_listings` — Contractor offerings
- `projects` — Job postings
- `estimates` — Quote management

#### **Scout Intelligence**
- `scout_interactions` — Conversation history
- `scout_tool_discovery` — Institutional learning
- `scout_recommendations` — AI-generated matches
- `outcome_graphs` — Decision tree tracking

#### **Platform**
- `sessions` — PostgreSQL-backed session storage
- `notifications` — User alerts
- `badges` — Achievement/verification badges
- `admin_snapshots` — Permission versioning

---

## API Architecture

### Routing Structure

```
/api/
├─ auth/                  # Authentication (local, OAuth)
├─ users/                 # User management
├─ profiles/              # Profile CRUD
├─ conversations/         # Messaging (authority-gated)
├─ marketplace/           # Contractor listings
├─ projects/              # Job postings
├─ estimates/             # Quote system
├─ scout/                 # AI assistant endpoints
├─ admin/                 # Admin OS operations
├─ counties/              # Geographic data
├─ trust/                 # CVS & verification
├─ notifications/         # Alert system
├─ payments/              # Stripe integration
└─ storage/               # File upload/download
```

### Key Endpoints

#### **Scout**
- `POST /api/scout/chat` — Main AI conversation
- `POST /api/scout/recommendations` — Get contractor matches
- `GET /api/scout/tools` — Available capabilities

#### **Messaging (Authority-Gated)**
- `POST /api/conversations/start` — Single entry point (requires intent + verification)
- `GET /api/conversations/:id` — Thread retrieval
- `POST /api/messages` — Send message (requires pre-authorized conversation)

#### **Trust**
- `GET /api/trust/cvs/:userId` — Get CVS score
- `POST /api/trust/verify` — Submit verification
- `GET /api/trust/signals/:userId` — Trust indicators

---

## Development Workflow

### Local Setup

```powershell
# Install dependencies
npm install

# Environment setup
Copy-Item .env.example .env
# Edit .env with DATABASE_URL, SESSION_SECRET, etc.

# Database migrations
npm run db:push

# Start dev server (Vite + Express with HMR)
npm run dev
```

Server runs on port 5000 (configurable via `PORT` env var).

### Key Scripts

```json
{
  "dev": "Run dev server with hot reload",
  "build": "Vite build + server compilation",
  "start": "Production server",
  "check": "TypeScript type checking",
  "test": "Vitest unit tests",
  "test:e2e": "Playwright E2E suite",
  "db:push": "Apply schema changes",
  "verify": "Full verification suite (types, tests, audits)"
}
```

### Verification Gates

Before deployment, all code must pass:

1. **TypeScript compilation** (`npm run check`)
2. **Unit tests** (`npm run test:run`)
3. **Theme lock audit** (no unauthorized color/styling changes)
4. **Blur ancestor audit** (accessibility compliance)
5. **Legacy guard** (no deprecated patterns)
6. **Scout purity** (AI decision integrity)
7. **Shell architecture** (component hierarchy)
8. **E2E tests** (Bot Army - 28 tests)

---

## Security & Compliance

### Authentication
- **Passport.js** with local + OAuth strategies
- **Session-based** (PostgreSQL storage, httpOnly cookies)
- **CSRF protection** (trusted proxy)
- **Rate limiting** (express-rate-limit)
- **Device authentication** for admins

### Authorization
- **Role-based access control** (27 user roles)
- **Claims-based capabilities** (multi-select, verified)
- **Authority gates** (decision cards, Scout recommendations)
- **Verification requirements** (address, license, insurance)

### Data Protection
- **Environment variables** for secrets
- **No credentials in logs**
- **Sensitive data stripped from cache**
- **Encrypted sessions**
- **Secure file uploads** (presigned URLs)

### Trust Enforcement
- **CVS scoring** (0-100, multi-factor)
- **Verification-on-action** (gates triggered at decision points)
- **No pay-to-play** (revenue never overrides trust)
- **Audit trails** (immutable conversation metadata)

---

## Deployment

### Production Checklist

1. **Environment Variables**:
   - `DATABASE_URL` (Neon PostgreSQL)
   - `SESSION_SECRET` (secure random string)
   - `GOOGLE_CLOUD_KEY_BASE64` (GCS credentials)
   - `AWS_*` (S3 credentials)
   - `SENDGRID_API_KEY` (email)
   - `STRIPE_SECRET_KEY` (payments)
   - `ANTHROPIC_API_KEY` (Scout AI)
   - `SENTRY_DSN` (error tracking)

2. **Database**:
   - Run migrations: `npm run db:push`
   - Seed initial data (states, counties)

3. **Build**:
   - `npm run build` (generates `/dist/` with client + server)

4. **Start**:
   - `npm start` (runs production Express server)

5. **Health Checks**:
   - `GET /health` endpoint
   - Database connection validation
   - Session store connectivity

### Docker Deployment

```bash
docker-compose up -d
```

Includes:
- App container (Node.js)
- PostgreSQL (optional, can use Neon)
- nginx reverse proxy

### Kubernetes

Manifests available in `k8s-deployment.yaml`:
- Deployment config
- Service definitions
- ConfigMaps
- Secrets management

---

## Key Design Decisions

### 1. **Scout as Primary Controller**
UI surfaces (web, mobile, admin) are **tools** that Scout orchestrates, not independent interfaces. This ensures consistent authority enforcement.

### 2. **County-Centric Design**
All data is organized by county (FIPS codes). Counties are **operational containers** that receive pre-routed facts, never compute.

### 3. **No Role Assignment at Signup**
Users declare **claims** (capabilities), and the system derives roles dynamically. Prevents premature categorization.

### 4. **Immutable Contact Intent**
Intent is selected **before** conversation creation and locked permanently. Prevents post-hoc reframing of contact reasons.

### 5. **Trust > Revenue**
CVS (Community Verification Score) determines visibility. Paid promotions cannot override low trust scores.

### 6. **Zero Bypass Paths**
All contact flows through `POST /api/conversations/start`. Social graph disabled. No "friend discovery" paths.

### 7. **Global View is Read-Only**
Community feed is visible globally, but awareness never grants contact. Scout remains the only bridge from discovery to action.

---

## Testing Strategy

### Unit/Integration (Vitest)
- **Location**: `/test/`
- **Coverage**: Database queries, business logic, utilities
- **Run**: `npm run test`

### E2E (Playwright)
- **Location**: `/tests/`
- **Suites**:
  - Authentication buttons (7 tests)
  - Contact loop enforcement (7 tests)
  - Copy assist injection (6 tests)
  - Anonymous business profiles (5 tests)
  - Model-based flow runner (3 tests)
- **Total**: 28 tests ("Bot Army")
- **Run**: `npm run test:e2e`

### Authority Enforcement Tests
- **50+ test cases** validating:
  - No bypass paths
  - Intent immutability
  - Verification requirements
  - Rate limiting
  - Role validation
  - Audit trail completeness

### Verification Scripts
- **Theme lock** (`audit:theme`)
- **Blur ancestors** (`audit:blur`)
- **Scout purity** (`verify:scout-purity`)
- **Legacy guard** (`verify:legacy-guard`)
- **Shell architecture** (`verify:shells`)

---

## AI Integration

### Scout (Primary AI Assistant)

**Models**:
- **Anthropic Claude** (primary execution, law-aware decisions)
- **Google Gemini** (read-only analysis, summaries)
- **OpenAI** (fallback, specialized tasks)

**Capabilities**:
- Contractor recommendations (confidence-scored)
- Intent classification (hire, collaborate, advise, reconnect)
- Risk assessment (financial, trust, temporal)
- Tool discovery (detects missing capabilities)
- Outcome tracking (learns from decisions)

**Knowledge Hierarchy** (strict, no violations):
1. **Admin manual cache** (highest priority, human-curated)
2. **Website data** (auto-cache + DB, verified)
3. **Internet search** (attribution required, fallback)
4. **Honest "I don't know"** (final fallback, never fabricate)

**Governance**:
- **No hallucination**: Zero tolerance for invented data
- **Hyperlocal focus**: County-specific responses
- **Source transparency**: Always cite data sources
- **Role-based behavior**: Adjusts tone/advice based on user role

### Tool Discovery System

**Location**: `/server/scout/toolDiscovery.ts`

Scout detects repeated patterns and missing capabilities:
- Tracks workarounds (ad-hoc solutions)
- Identifies capability gaps
- Emits blueprints for new tools
- Learns from outcomes

**Principle**: Scout invents capabilities. Humans decide which become permanent tools.

---

## Performance Optimizations

- **React Query caching** (server state deduplication)
- **Memoization** (expensive computations cached)
- **Lazy loading** (code splitting via React Router)
- **Optimized bundle** (Vite tree shaking)
- **Database indexing** (Drizzle with custom indexes)
- **CDN static assets** (Vite build output)
- **Connection pooling** (PostgreSQL via pg-pool)

---

## Monitoring & Observability

- **Error Tracking**: Sentry (request/tracing handlers)
- **Metrics**: `/server/observability/metrics.ts`
- **Logs**: Structured console logging (timestamp, source, level)
- **Health Checks**: `/health` endpoint
- **Performance**: Sentry performance monitoring

---

## Governance & Philosophy

### Operating Law (2026-01)

TradeScout operates under a **governed multi-model AI workflow**:

1. **Architecture decisions** made outside Copilot (by humans)
2. **Copilot executes** only explicitly approved tasks
3. **Escalation protocol** for authority, trust, routing, or identity changes
4. **No silent drift**: All changes document impact + verification

### Forbidden Patterns

- **Dark patterns** (artificial urgency, false scarcity)
- **Vanity metrics** (follower counts, popularity rankings)
- **Pay-to-play** (revenue overriding trust)
- **Role-first signup** (must be claims-first)
- **Casual browsing** (contact requires intent)
- **Anonymous reviews** (all feedback tied to verified identity)

### Psychology Requirement

All system decisions (UI, UX, copy, colors, flows) must be **psychologically intentional**:
- **Target belief**: What user should believe
- **Target behavior**: What user should do
- **Psychological principle**: Why this works
- **Risk prevented**: What this protects against

Cosmetic-only reasoning is invalid.

---

## Future Roadmap

### Phase D (In Progress)
- Decision Card contact integration
- Scout recommendation improvements
- Enhanced confidence scoring

### Planned Features
- Mobile app (React Native)
- Offline support (service workers)
- Advanced analytics dashboard
- Community governance tools
- Multi-language support

### Infrastructure
- GraphQL API layer (optional)
- Redis caching (optional)
- WebSocket real-time updates (partial implementation exists)
- Edge computing (Cloudflare Workers)

---

## Resources

- **Codebase**: `/` (7,618-line schema, 500+ routes, 28 E2E tests)
- **Docs**: `/docs/` (architecture, deployment, integration guides)
- **Scripts**: `/scripts/` (verification, seeding, audits)
- **Tests**: `/tests/` (Playwright E2E suite)
- **Agent Runtime**: `/agent-runtime/` (automated bot operations)

---

## Contact & Support

For technical questions or contributions:
- **Issue**: Where does authority flow? → Scout → Trust/CVS → Action
- **Impact**: What changes with this? → State what is **not** affected
- **Options**: Present A/B/C → Ask, don't assume
- **Escalate**: When unsure → Stop and ask Thomas

**Final Rule**: When in doubt → Ask, implement narrowly, verify explicitly, preserve reversibility.

---

## License

MIT (as specified in package.json)

---

**TradeScout**: Where community trust governs local work, and AI assists rather than replaces human judgment.
