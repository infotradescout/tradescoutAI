TradeScout master plan
North Star

TradeScout becomes the default local operating system for finding, hiring, selling, buying, verifying, coordinating, and paying trusted local people and businesses.

Not a directory. Not a lead broker. Not a review site. Not a marketplace alone.

A trust-governed local economy platform.

Core product promise

For homeowners:

“Tell Scout what you need. TradeScout finds the right local path, keeps your contact protected, and helps you move from request to outcome.”

For contractors/local businesses:

“No spam leads. No race to the bottom. Get matched to real local work, prove your credibility, and manage the outcome.”

For sellers:

“List at a fair value, show real condition, handle bundles/shipping cleanly, and move through a real post-sale lifecycle.”

For communities/counties:

“Local economic activity becomes organized, searchable, and accountable.”

The real enemy map

Angi was just one example. TradeScout should eventually compete across these categories:

Category	Incumbents	Weakness	TradeScout advantage
Contractor leads	Angi, HomeAdvisor, Thumbtack	Spam leads, paid ranking, trust gaps	Direct Connect, verified routing, contact unlock
Reviews/search	Yelp, Google reviews	Fake reviews, low accountability	outcome-based reputation, verified interactions
Local social	Nextdoor, Facebook Groups	Noise, drama, poor transaction flow	Scout-driven local action routing
Local commerce	Facebook Marketplace, Craigslist, OfferUp	Pricing chaos, scams, weak shipping flow	fair value guidance, rarity, lifecycle, trust
Home services workflow	ServiceTitan, Jobber, Housecall Pro	Pro-side only, not homeowner-native	two-sided request + outcome trail
Real estate/home ownership	Zillow, Redfin, Realtor.com	Property search, not local work ops	home lifecycle + trusted local network
Small business local discovery	Google Business Profile, Yelp	SEO/ad-driven, not outcome-driven	business profiles tied to verified activity
Local hiring/odd jobs	Indeed, Craigslist, Taskrabbit	Detached from local trust graph	worker/helper Direct Connect
Procurement/materials	Big-box stores, supplier portals	Not local workflow-aware	Supply Run + jobs + materials memory
Community commerce	Facebook Groups	Unstructured, unsafe, impossible to govern	county-aware moderated local exchange

The strategic target is not one company. It is the fragmented local economy stack.

Operating model

TradeScout needs five core loops.

1. Request loop

User says what they need → Scout interprets → Direct Connect creates request → verified provider routing → structured response → conversation → outcome → reputation.

This is the Angi/Thumbtack killer loop.

2. Listing loop

Seller lists item → fair value guidance → condition/rarity/bundle/shipping truth → buyer inquiry/checkout → post-sale lifecycle → seller reputation.

This is the Facebook Marketplace/Craigslist/OfferUp killer loop.

3. Trust loop

Every action produces evidence: verification, response quality, completed work, delivery, dispute outcome, community recommendation, payment completion.

This is the Yelp/Google Reviews killer loop.

4. Local graph loop

County, city, trade, business, worker, seller, buyer, listing, request, group, property, supplier, and recommendation data all connect.

This is the moat.

5. Scout control loop

Scout becomes the user’s operating interface. Instead of users learning every surface, they ask Scout, and Scout routes to the right action.

This is the AI-native advantage.

Current foundation

You now have meaningful foundations in place:

Direct Connect can persist drafts through auth, preventing request loss during sign-in.

Scout prompt/metadata safety was cleaned up so client-safe metadata no longer asks the model to expose reasoning traces.

Share-token semantics were corrected so creation uses POST and GET remains read-only.

Onboarding copy now better matches Direct Connect-style routing.

Marketplace now supports value guidance, native bundle fields, rarity tags, shipping quote/package details, and order lifecycle schema.

Seller dashboard now exposes sold-order lifecycle states.

That is a serious base. The next job is turning the foundation into a coherent platform engine.

System-by-system plan
System 1: Scout OS
Role

Scout is the central controller. It should eventually replace most menu-based navigation.

Current job

Scout should understand user intent and route to:

Direct Connect request creation
Exchange listing creation
seller dashboard
provider inbox
onboarding
verification
local directory
HomeScout
Supply Run
messages
profile/business setup
support/disputes
Future state

Scout becomes:

local concierge
routing engine
trust explainer
listing assistant
project coordinator
seller assistant
buyer assistant
contractor assistant
admin analyst
growth operator
Required functions

Scout needs these functional modules:

Intent router
Home repair
Emergency work
Find a provider
Sell item
Buy item
Hire worker
Offer services
Manage order
Track project
Verify business
Start property workflow
Ask local question
Compare options
Action router
Navigate
Create draft
Save draft
Submit request
Generate listing draft
Ask follow-up
Open dashboard
Advance lifecycle
Start verification
Contact support
Escalate dispute
Memory layer
User role
county/city
active requests
saved listings
open orders
provider status
marketplace preferences
last actions
business ownership
trust state
Safety layer
No hidden reasoning exposure
no external redirect abuse
no unsafe marketplace items
no fake reviews
no contact leakage before unlock
no unverified regulated work routing
Revenue layer
when to show upgrade
when to show verification offer
when to suggest boost/promotion
when to suggest paid label
when to suggest buyer protection
when to suggest business tools
KPI

Scout must improve:

first-action completion rate
request created per active user
listing created per active seller
successful route rate
onboarding completion
task-to-outcome conversion
support deflection
Next build

Create a Scout Command Registry.

Every command should have:

commandId
surface
requiredAuth
requiredRole
requiredTrustLevel
requiredFields
riskLevel
allowedActions
confirmationRequired
successEvent
failureEvent

This prevents Scout from becoming a pile of special cases.

System 2: User onboarding
Role

Onboarding must classify the user fast and route them into the correct economic loop.

Current state

You have auth setup, profile basics, intent selection, Scout defaulting, and recent cleanup around profile/location commitment.

Future state

Onboarding should resolve:

who are you?
where are you active?
what are you trying to do first?
are you personal, business, contractor, seller, buyer, worker, admin, HOA, property owner?
what is the fastest first action?
Required onboarding tracks
Homeowner / personal
County/city
first need
Direct Connect request
saved provider/listing recommendations
Contractor / service provider
trade/category
service counties
license/insurance/EIN as needed
business profile
Direct Connect inbox
verification CTA
Local business
business profile
service/product categories
offers/promotions
Exchange listings
Direct Connect routing eligibility
Seller
location
payout setup
listing category
value guidance
shipping preferences
Buyer
location
watchlist
inquiry/checkout setup
buyer protection
Worker/helper
skills
county
availability
verification
Direct Connect opportunities
HOA/property/community operator
property/community profile
residents/vendors
maintenance requests
approved vendor routing
KPI
signup → first meaningful action
onboarding completion
profile location commit rate
first Direct Connect request
first listing
provider verification completion
buyer inquiry
Next build

Slice 94 continuation: Scout Local Snapshot Surface v1. Scout should be the primary local action, search, and activity surface before Direct Connect becomes the daily request product.

Create onboarding state as a single product state machine:

auth_started
account_created
location_committed
intent_selected
profile_role_resolved
first_action_started
first_action_completed
onboarding_completed

Do not let each surface invent onboarding state.

System 3: Direct Connect
Role

Direct Connect is the request-to-outcome engine.

Current state

You have a strong request lifecycle: draft, post, route, replies, inbox, structured accept, conversation, status movement, contact gating, share links, and provider routing.

Future state

Direct Connect should become the daily product for local request completion after Scout shows the local snapshot, suggested next actions, and safe request entry points.

Required functions
Request composer
service category
urgency
location
photos
budget
preferred provider
auto-route or direct-pick
draft persistence
Scout-generated drafts
Routing engine
county fit
trade fit
verification requirements
availability
response history
outcome history
distance
trust score
capacity
price band
no spam cap
Provider response
availability
scope note
price band
confidence
estimated next step
accept/decline
reason tracking
Conversation
only after accepted path or governed state
request context attached
photos/files
quote docs
appointment scheduling
outcome confirmation
Outcome trail
request opened
routed
provider accepted
conversation started
scheduled
completed
paid
reviewed
dispute if needed
Trust feedback
on-time?
price matched?
scope handled?
communication?
would use again?
verified outcome only
Direct Connect moat

Do not sell raw leads. Sell governed opportunities.

Provider-side value:

fewer junk leads
better fit
local credibility
no anonymous spam
higher conversion
structured intake
outcome reputation

Homeowner-side value:

no blast spam
no random phone calls
clear next step
provider accountability
contact protection
KPI
request started
request submitted
routed within target window
provider response rate
accepted response rate
conversation unlock rate
completed outcome rate
repeat request rate
provider retention
Next build

Build Direct Connect Score v1:

providerFitScore =
  countyMatch
  + tradeMatch
  + verificationScore
  + responseRate
  + completionRate
  + recentActivity
  + recommendationTrust
  - disputePenalty
  - overCapacityPenalty

Make the score explainable to both sides.

System 4: Exchange marketplace
Role

Exchange is the local commerce engine.

Current state

You now have value guidance, bundle support, rarity fields, shipping quote/package fields, and seller order lifecycle.

Future state

Exchange should become trusted local commerce where condition, price, rarity, shipping, and seller credibility are structured.

Required functions
Create listing
category
condition
price
fair value guidance
rarity tags
package/shipping
photos
bundle items
prohibited item gate
approval/moderation
Value guidance
recent comps
condition adjustment
location adjustment
rarity confidence
undercut warning
sell-time estimate
limited-sample warning
Bundles
single item
bundle
collection
must buy all
seller allows split
per-item fallback value
per-item condition
per-item rarity
per-item photo
Buyer flow
inquiry
offer
checkout
buyer-paid shipping
seller-paid/free shipping
buyer protection option
saved listing
quote request
Seller flow
listing dashboard
inquiries
mark sold
order lifecycle
shipping label
payout reconciliation
dispute handling
Post-sale
item sold
payment received
label pending
label purchased
in transit
delivered
payout reconciled
KPI
listing started
value guidance viewed
listing submitted
approval rate
inquiry rate
offer rate
sold rate
order completion
payout reconciliation
dispute rate
repeat seller rate
Next build

Harden order lifecycle:

forward-only status transitions
tracking input
label URL input
seller cannot skip payout state
admin override only
buyer-visible status page
System 5: Trust and verification
Role

Trust is the platform moat.

Current problem in market

Most platforms rely on reviews, stars, paid ranking, profile claims, and stale verification. That is weak.

TradeScout trust model

Trust should be based on verified participation and outcomes, not generic reviews.

Required trust signals
Identity
email
phone
address
business ownership
worker identity
admin/staff verification
Business verification
license
insurance
EIN
service areas
trade requirements
county registration where applicable
Outcome reputation
completed requests
accepted work
response speed
cancellation rate
dispute history
repeat clients
verified sale/order delivery
Community credibility
recommendations
local participation
verified referrals
not anonymous review spam
Marketplace seller trust
delivered orders
accurate condition
refund/dispute history
shipping reliability
value guidance compliance
Buyer trust
completed purchases
payment reliability
dispute rate
pickup no-show rate
Trust score outputs

Do not show a mysterious black-box number alone. Show:

Verified local profile
Served this county
Licensed/insured where required
Responds quickly
Completed X verified outcomes
Low dispute rate
Trusted by repeat users
KPI
verification completion
trust profile completeness
fake review/report rate
dispute rate
contact unlock abuse
moderation actions
verified outcome ratio
Next build

Create Trust Ledger v1:

Every trust-impacting event becomes ledgered:

trust_event_id
actor_user_id
entity_type
entity_id
event_type
source_surface
verification_level
confidence
created_at
metadata

This becomes the future score, ranking, and compliance backbone.

System 6: Business profiles
Role

Business profiles become the public identity layer for providers, local sellers, and companies.

Required functions
business name
slug
logo/photos
categories
counties served
verification status
Direct Connect eligibility
Exchange listings
promotions
reviews/recommendations
completed outcomes
service areas
contact rules
public profile page
owner dashboard
KPI
profile created
profile completed
verification started/completed
first listing/request response
profile views
conversion to inquiry/request
Next build

Create Business Profile Completeness Score:

basic_info
service_area
category
verification
photos
description
first_listing_or_service
first_response

Then Scout should push providers to complete the missing next step.

System 7: Contractor/provider operating system
Role

This is how TradeScout keeps providers, not just acquires them.

Required surfaces
Provider inbox
new opportunities
filtered by fit
accept/decline
structured response
Jobs/work dashboard
active conversations
upcoming scheduled work
quotes
completed outcomes
Business profile
verification
service areas
categories
proof docs
Reputation
completed work
response quality
trust status
recommendations
CRM lite
customers
conversations
requests
repeat work
Finances
estimates
invoices
expenses
materials
payouts
Growth
promotions
local visibility
direct profile links
referral invites
KPI
provider activation
provider response rate
provider accepted work
provider weekly active rate
revenue per provider
provider churn
complaint rate
Next build

Create Provider Home:

One page:

New opportunities
Active jobs
verification checklist
reputation summary
next best action from Scout
System 8: Homeowner/home operating system
Role

Own the lifecycle of a home, not just one request.

Required functions
home profile
project history
maintenance reminders
trusted providers
documents/photos
property condition notes
recurring maintenance
emergency contacts
Direct Connect requests
Exchange purchases/sales
local recommendations
KPI
homes created
repeat requests per home
maintenance reminders acted on
saved providers
recurring service setup
annual retention
Next build

Create Home Vault v1:

address/county
home notes
photos
past requests
saved providers
suggested maintenance

Scout becomes: “What should I do next for this home?”

System 9: County/city/local graph
Role

This is the data moat.

Required entities
state
county
city
trade
business
provider
worker
listing
request
order
home
property
HOA
supplier
group
recommendation
event
Required surfaces
county hub
city pages
trade county pages
best trade pages
recent activity
local requests board
local Exchange inventory
local promotions
local providers
local trust stats
KPI
county pages indexed
county active users
county listings
county requests
provider density
buyer/seller density
local conversion
Next build

Pick 3 launch counties and force density. Do not scale nationwide too early.

For each county, track:

active providers by trade
active homeowners
open requests
Exchange listings
active businesses
completed outcomes
repeat users
System 10: Marketplace payments and shipping
Role

This turns Exchange from classified board into transaction platform.

Required functions
Checkout
buyer pays
seller payout pending
platform fee
taxes where applicable
payment status
Shipping
package details
shipping quote
buyer-paid or seller-paid
platform label or seller label
tracking number
label URL
delivery confirmation
Payouts
gross sale
shipping paid by buyer
label deduction
platform fee
net payout
payout status
Disputes
item not shipped
item not as described
damaged in transit
no-show pickup
refund/hold
KPI
checkout conversion
payment success
label purchase rate
delivery confirmation
payout completion
dispute rate
refund rate
Next build

Add buyer-visible order page:

order status
seller contact rules
shipping/tracking
delivery confirmation
dispute button
System 11: Admin and operations
Role

Admin must see platform health, trust risk, and revenue movement.

Required admin surfaces
User ops
users
roles
bans
verification status
suspicious activity
Provider ops
verification queue
license/insurance review
county service area review
complaints
Marketplace ops
listing approval
prohibited item detection
value guidance outliers
order disputes
shipping exceptions
Direct Connect ops
routing failures
unresponded requests
provider no-shows
contact unlock disputes
Scout ops
failed intents
wrong routes
low-confidence answers
model fallback
unsafe output
Growth ops
county activation
provider density
listing density
top referrers
conversion funnels
Revenue ops
subscriptions
transaction fees
boosts
promotions
payouts
refunds
KPI
support tickets per transaction
review backlog
verification SLA
dispute resolution time
routing failure rate
model failure rate
moderation response time
Next build

Create Ops Command Center with 7 cards:

Requests needing routing
Providers needing verification
Listings needing approval
Orders stuck in lifecycle
Disputes open
Scout failures
County launch health
System 12: Monetization
Revenue streams

Do not over-monetize early. Trust first.

Provider subscription
verification/profile/tools
better dashboard
more service counties
CRM/finance tools
Transaction fee
Exchange checkout
shipping label margin
buyer protection
seller payout processing
Direct Connect success fee
only when accepted/converted
avoid spam lead pricing
Promotions
business promotions
local offers
featured but transparent
no hidden ranking manipulation
Verification services
license/insurance/EIN checks
background/identity where appropriate
SaaS tools
contractor CRM
estimates/invoices
supply run
financial tools
property/HOA management
Data products
market signal reports
county activity
trade demand insights
do this only with privacy guardrails
Rule

Never let monetization corrupt trust ranking. Paid visibility must be labeled and separated from trust fit.

KPI
revenue per active provider
transaction take rate
gross merchandise volume
direct connect conversion revenue
paid promotion conversion
subscription retention
System 13: Growth engine
Growth cannot be generic

You do not win by launching nationwide. You win by becoming unavoidable in selected local markets.

Launch strategy

Pick counties, not the whole country.

For each county:

seed contractors
seed local businesses
seed Exchange inventory
create county hub pages
join/partner with local groups
activate homeowners
create first requests
manually ensure responses
collect verified outcomes
publish local proof
Trade Scout county launch score
county_launch_score =
  providers_verified
  + active_homeowners
  + active_listings
  + completed_requests
  + completed_orders
  + repeat_users
  + local_content_pages_indexed
  - unresolved_disputes
Growth channels
SEO county/trade pages
Facebook group territory campaigns
contractor invite/referral
local business partnerships
county/community pages
seller marketplace activation
direct mail/doorhanger in pilot counties
local radio/media partnerships
HOA/property manager partnerships
supplier partnerships
KPI
county activation score
CAC by channel
provider acquisition
homeowner acquisition
listing supply
request demand
first outcome
repeat usage
Platform surfaces
Public surfaces
Landing page
County pages
City pages
Trade pages
Business directory
Provider profiles
Exchange marketplace
Listing detail
Direct Connect share pages
HomeScout property pages
Promotions pages
Help/trust pages
Compare pages
Logged-in user surfaces
Direct Connect
Scout
Home dashboard
Exchange seller dashboard
Order dashboard
Messages
Saved listings/providers
Profile/settings
Verification
Notifications
Wallet/payments
Provider surfaces
Provider home
Direct Connect inbox
Jobs/work dashboard
Business profile editor
Verification
Service areas
Recommendations
Promotions
CRM
Finances
Supply Run
Seller surfaces
Create listing
Value guidance
Bundle editor
Listing manager
Inquiries
Orders
Shipping
Payouts
Disputes
Seller reputation
Buyer surfaces
Search/browse
Saved listings
Inquiries/offers
Checkout
Order tracking
Delivery confirmation
Dispute/refund
Buyer trust profile
Admin surfaces
User admin
Provider verification
Listing moderation
Marketplace orders
Direct Connect routing
Disputes
Scout observability
Revenue ops
County launch ops
Trust ledger
Audit logs
Data architecture
Must-have core tables/entities

You already have many of these, but the complete platform model needs:

Identity
users
roles
sessions
profiles
business_profiles
workers
contractors
verification_documents
trust_events
Geography
states
counties
cities
service_areas
territory_assignments
Direct Connect
work_requests
work_request_assignments
work_request_events
request_attachments
conversations
messages
outcome_events
Marketplace
marketplace_categories
marketplace_listings
marketplace_listing_items
marketplace_orders
marketplace_order_events
marketplace_inquiries
marketplace_favorites
shipping_quotes
package_details
value_guidance_snapshots
rarity_signals
Reputation
recommendations
reviews
completed_outcomes
disputes
trust_ledger
moderation_actions
Payments
transactions
payouts
fees
refunds
seller_accounts
buyer_payment_methods
Scout
scout_conversations
scout_actions
scout_failures
scout_preferences
scout_memory
intent_events
action_registry
Growth
invites
referrals
campaigns
promotions
county_launch_metrics
analytics_events
Technical architecture
Frontend

Current React app can continue, but split monoliths.

Priority extractions
ScoutOS → command registry, thread persistence, local intent handling, action execution
DirectConnectShell → composer, dispatch, inbox, requests, board
Exchange → browse, sell form, value guidance, bundle editor, order lifecycle
SellerDashboard → listings, inquiries, orders, payouts
shared UI for lifecycle rails and status cards
Backend
Required services
directConnectRoutingService
directConnectEligibilityService
trustLedgerService
marketplaceValueGuidanceService
marketplaceOrderService
shippingQuoteService
payoutService
verificationService
scoutCommandService
countyLaunchService
notificationService
moderationService
AI

AI should not own truth. AI routes, summarizes, drafts, explains, and recommends.

Hard rule:

Database state decides permissions, status, payout, trust, and routing eligibility. Scout only proposes actions unless a governed command permits execution.

Milestone plan
Phase 1: Stabilize core loops

Timeline: now to 30 days.

Build
Direct Connect draft/auth QA
forward-only marketplace order lifecycle
tracking/label input
buyer-visible order status
value guidance validation
onboarding state cleanup
Scout command registry v1
KPI
first action completion
request submission
listing submission
order lifecycle progression
zero critical routing bugs
Phase 2: County launch engine

Timeline: 30 to 90 days.

Build
county launch dashboard
provider density tracker
local request board quality
local Exchange inventory tracker
county SEO pages
manual ops queue
referral/invite flows
Go-to-market
launch 1–3 counties
recruit providers by trade
seed listings
manually push first outcomes
collect verified proof
KPI
active providers per county
active homeowners per county
first 100 requests
first 100 listings
first 25 completed outcomes
Phase 3: Trust moat

Timeline: 90 to 180 days.

Build
trust ledger
verified outcome reputation
dispute system
review/recommendation compliance
business profile trust cards
fake review prevention
KPI
verified outcome ratio
dispute rate
provider trust completion
repeat request rate
fake/spam action rate
Phase 4: Marketplace transaction layer

Timeline: 180 to 270 days.

Build
checkout
payments
shipping labels
payout reconciliation
buyer order page
seller payout page
refund/dispute handling
KPI
gross merchandise volume
checkout conversion
sold listing rate
delivery completion
payout completion
dispute rate
Phase 5: Provider OS

Timeline: 270 to 365 days.

Build
provider home
CRM lite
estimates/invoices
recurring jobs
profile growth tools
verification upsells
Supply Run integration
KPI
provider weekly active rate
paid provider conversion
provider retention
completed jobs per provider
revenue per provider
Phase 6: Expansion machine

Timeline: year 2.

Build
repeatable county playbook
territory manager tools
partner dashboards
supplier integrations
HOA/property workflows
franchised/community operator model
KPI
activated counties
provider density per county
request density per county
marketplace GMV per county
revenue per county
county profitability
Moat strategy

TradeScout’s moat is not one thing. It is the combination of:

local graph
verified identity
outcome-based trust
governed contact unlock
Direct Connect workflow
Exchange transaction lifecycle
Scout-controlled routing
county-level launch density
provider operating tools
marketplace value/rarity/shipping intelligence

Any competitor can copy a listing page. Few can copy a county-level trust graph tied to verified outcomes and AI-guided actions.

What to build next
Immediate next sprint
Sprint name

Lifecycle Hardening + Command Registry

Scope
Enforce forward-only marketplace order transitions.
Add label URL/tracking number input in seller dashboard.
Add buyer-visible order status page.
Add Scout Command Registry v1.
Add Trust Ledger v1 schema and event writer.
Add Direct Connect provider fit score v1.
Why this sprint

It strengthens the two core economic loops:

Direct Connect request → provider outcome
Exchange listing → sold order lifecycle

And it gives Scout a governed action foundation.

12-month KPI stack

Do not chase vanity metrics. Track these:

Activation
signup → first action
first request created
first listing created
provider verification started
first provider response
Liquidity
request response rate
listing inquiry rate
provider density by county/trade
listing density by county/category
median time to first response
Trust
verified outcome ratio
dispute rate
cancellation rate
fake/spam report rate
contact unlock abuse
Revenue
paid providers
marketplace GMV
transaction fees
promotion revenue
verification revenue
revenue per active county
Retention
repeat request rate
repeat seller rate
repeat buyer rate
provider weekly active rate
county active user retention
The platform rulebook

These are non-negotiable.

1. No spam lead economy

If TradeScout becomes another pay-per-lead broker, it loses.

2. Trust must beat ads

Paid placement can exist, but trust fit must be separate and explainable.

3. Scout cannot bypass governance

AI can recommend. State machines decide.

4. County density beats national shallowness

Win counties one by one.

5. Every transaction creates trust data

Requests, replies, orders, shipments, payouts, disputes — all feed the trust graph.

6. Every surface must have a next action

No dead dashboards. Every page should answer: “What should I do next?”

Final operating thesis

TradeScout becomes massive by owning the local trust transaction layer.

Not just contractors. Not just marketplace. Not just reviews. No mention of AI.

The winning system is:

Scout interprets intent → TradeScout routes action → Direct Connect/Exchange executes transaction → Trust Ledger records outcome → local graph improves → next match gets smarter.

That is the compounding loop.

Your current build is now past prototype. The job is to stop thinking in isolated features and start running this as a platform with three primary engines:

Direct Connect: local work request engine
Exchange: local commerce engine
Scout: local operating system
Community: local opinions
Everything else should feed one of those engines or make them safer, faster, and more trustworthy.
