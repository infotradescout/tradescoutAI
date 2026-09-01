// Canonical plain-language TradeScout explainer. Tutorial and help copy should stay
// consistent with these user-facing claims, action names, boundaries, and status notes.
const productUrl = "https://www.thetradescout.com";

const routes = {
  scout: `${productUrl}/scout`,
  community: `${productUrl}/community-feed`,
  maps: `${productUrl}/maps`,
  leaderboard: `${productUrl}/leaderboard`,
  exchange: `${productUrl}/exchange`,
  directConnect: `${productUrl}/direct-connect`,
  messages: `${productUrl}/messages`,
  connections: `${productUrl}/connections`,
  notes: `${productUrl}/notes`,
  crm: `${productUrl}/crm`,
  businesses: `${productUrl}/for-businesses`,
  claimBusiness: `${productUrl}/claim-my-business`,
  createBusiness: `${productUrl}/businesses/apply`,
  verification: `${productUrl}/verification`,
  trust: `${productUrl}/trust-model`,
  howItWorks: `${productUrl}/how-it-works`,
  businessDirectory: `${productUrl}/find-local-businesses`,
  advancedSearch: `${productUrl}/advanced-search`,
  discoverPeople: `${productUrl}/discover-people`,
  recommendations: `${productUrl}/recommendations`,
  homeId: `${productUrl}/homeowner-dashboard`,
  finances: `${productUrl}/finances`,
  invoices: `${productUrl}/finances/invoices`,
  wallet: `${productUrl}/wallet`,
  supplyRun: `${productUrl}/utilities/supply-run`,
  scoutFitters: `${productUrl}/marketing/scoutfitters`,
  socialIntegration: `${productUrl}/social-integration`,
  notifications: `${productUrl}/notifications`,
  backgroundCheck: `${productUrl}/background-check`,
  businessRequests: `${productUrl}/direct-connect/inbox`,
  commercialDirectory: `${productUrl}/commercial-directory`,
  storyGenerator: `${productUrl}/story-generator`,
  privacyRequest: `${productUrl}/privacy-request`,
  mobileNotary: `${productUrl}/services/mobile-notary`,
  install: `${productUrl}/install`,
  affiliate: `${productUrl}/affiliate`,
  pricing: `${productUrl}/pricing`,
};

const featureGroups = [
  {
    number: "01",
    title: "Discover and decide",
    features: [
      {
        action: "Ask what to do next",
        name: "Scout",
        copy: "Describe a need, search, compare options, and get a useful next step.",
        href: routes.scout,
      },
      {
        action: "Check safety, codes, permits, and inspection steps",
        name: "Scout safety and code guidance",
        copy: "Scout can explain general safety concerns, identify locally sourced requirements when available, flag what still needs confirmation, and prepare the next step. It does not issue permits, replace official code text, or act as the inspector.",
        href: routes.scout,
      },
      {
        action: "See who people support or warn against",
        name: "Recommendations",
        copy: "Read positive and negative experiences with comments, context, and moderation.",
        href: routes.recommendations,
      },
      {
        action: "Follow what is happening nearby",
        name: "Community",
        copy: "See questions, updates, organizations, events, and business activity around you.",
        href: routes.community,
      },
      {
        action: "Turn information into a next step",
        name: "Decision Cards",
        copy: "See the recommended action, why it fits, and what should be checked first.",
        href: routes.scout,
      },
      {
        action: "Compare the business behind the offer",
        name: "Business profiles",
        copy: "See what it offers, where it operates, who controls it, and what proof is available.",
        href: routes.businessDirectory,
      },
      {
        action: "Understand why an account appears",
        name: "Community Verification Score (CVS)",
        copy: "See trust eligibility shaped by verification, responsiveness, outcomes, recommendations, marketplace history, and risk.",
        href: routes.trust,
      },
      {
        action: "See activity and service coverage",
        name: "Maps",
        copy: "Explore businesses, listings, offers, and local activity by place instead of searching disconnected sources.",
        href: routes.maps,
      },
      {
        action: "See who is contributing locally",
        name: "Leaderboard",
        copy: "Compare participation and trust momentum without letting payment buy the position.",
        href: routes.leaderboard,
      },
      {
        action: "Browse organized local results",
        name: "Local directories",
        copy: "Move through businesses, places, categories, and recent activity without losing the location that makes the result relevant.",
        href: routes.businessDirectory,
      },
      {
        action: "Search local help with more filters",
        name: "Advanced search",
        copy: "Narrow local providers by place, service, and available profile evidence when the ordinary directory is too broad.",
        href: routes.advancedSearch,
      },
      {
        action: "Find verified people nearby",
        name: "People discovery",
        copy: "Search verified people by place, open a profile, request a connection, or move into a controlled Direct Connect conversation.",
        href: routes.discoverPeople,
      },
      {
        action: "Follow people and keep local relationships",
        name: "Social connections",
        copy: "Follow or unfollow people, review existing connections, and keep social participation distinct from permission to receive a business request.",
        href: routes.discoverPeople,
      },
      {
        action: "Compare common cost factors",
        name: "Decision calculators",
        copy: "Use available mortgage, vehicle-payment, pricing, affordability, and project-cost tools as inputs to a decision without treating an estimate as an approval or final price.",
        href: routes.finances,
      },
      {
        action: "Find urgent local help",
        name: "Emergency directory",
        copy: "Narrow the business directory to services intended for time-sensitive local needs.",
        href: routes.businessDirectory,
      },
      {
        action: "Find partner offers for active needs",
        name: "TradeDeals",
        copy: "See relevant supplier and partner offers when they can help with a project or purchase.",
        href: routes.exchange,
      },
      {
        action: "Buy, sell, or rent locally",
        name: "Exchange",
        copy: "Browse property, vehicles, equipment, tools, food, business items, and other local listings.",
        href: routes.exchange,
      },
      {
        action: "Install TradeScout on the device",
        name: "Installable app",
        copy: "Add TradeScout to a supported phone, tablet, or computer home screen while keeping the same account and connected work.",
        href: routes.install,
      },
    ],
  },
  {
    number: "02",
    title: "Connect and act",
    features: [
      {
        action: "Turn a need into a trackable request",
        name: "Requests",
        copy: "Keep the description, recipients, decisions, and progress attached to one need.",
        href: routes.directConnect,
      },
      {
        action: "Send it only to businesses you choose",
        name: "Direct Connect",
        copy: "Selected businesses review the request; contact opens only after acceptance.",
        href: routes.directConnect,
      },
      {
        action: "Keep the conversation with the request",
        name: "Messages and quotes",
        copy: "Carry questions, replies, quotes, and follow-ups beside the work they concern.",
        href: routes.messages,
      },
      {
        action: "Search prior conversations",
        name: "Conversation search",
        copy: "Find the person, business, request, or message thread without opening every conversation one at a time.",
        href: routes.messages,
      },
      {
        action: "See what changed without checking every tool",
        name: "Notifications",
        copy: "Review request activity, conversation requests, replies, status changes, and the next action from one notification center.",
        href: routes.notifications,
      },
      {
        action: "Return to people who approved contact",
        name: "Connections",
        copy: "Keep agreed direct contacts separate from followers and strangers.",
        href: routes.connections,
      },
      {
        action: "Check identity and business proof",
        name: "Verification",
        copy: "Use the checks that fit the person, business, claim, or action instead of one badge for everything.",
        href: routes.verification,
      },
      {
        action: "Complete extra screening when the role requires it",
        name: "Background screening and Screen Pass",
        copy: "A background-check intake exists as an additional verification path. Screen Pass is the planned portable result: show that the required screen was completed without exposing the private report. The portable pass and end-to-end partner completion are not finished yet.",
        href: routes.backgroundCheck,
      },
      {
        action: "Establish who controls something",
        name: "Claims",
        copy: "Claim a business, profile, property, or asset before taking actions that require authority.",
        href: routes.claimBusiness,
      },
      {
        action: "Sell a defined service or item",
        name: "Fixed-price offers",
        copy: "Publish a clear offer so the customer can understand the scope and begin a guided request or purchase.",
        href: routes.createBusiness,
      },
      {
        action: "Let customers request a time",
        name: "Bookings",
        copy: "Show availability, accept free booking requests, and optionally require a disclosed deposit.",
        href: routes.createBusiness,
      },
      {
        action: "Complete a disclosed payment",
        name: "Checkout and payment history",
        copy: "Pay for an eligible purchase, booking, or work step and keep the result in the account history.",
        href: routes.wallet,
      },
      {
        action: "Post a job or a resume",
        name: "Employment Board",
        copy: "Businesses can post openings and review applicants; people can post resumes and apply. A complete applicant-tracking workspace is still being built and should not be treated as finished.",
        href: routes.directConnect,
      },
      {
        action: "Find help for ordinary work",
        name: "Helpers",
        copy: "Connect people who do odd jobs, gig work, non-licensed labor, cleanup, moving, yard work, and crew support with people who need those skills.",
        href: routes.directConnect,
      },
      {
        action: "Coordinate a shared place",
        name: "Groups and HOA tools",
        copy: "Organize members, requests, vendors, finances, votes, documents, and neighborhood activity around one community.",
        href: routes.community,
      },
      {
        action: "Publish and follow a local event",
        name: "Events",
        copy: "Create community activity that people can discover beside the businesses, groups, and places involved.",
        href: routes.community,
      },
      {
        action: "Report harmful or misleading activity",
        name: "Community moderation",
        copy: "Use reports, moderation review, content limits, and account restrictions to protect participation without turning popularity or payment into authority.",
        href: routes.community,
      },
      {
        action: "Request a mobile or remote notarization",
        name: "Notary services",
        copy: "Start a mobile or remote notary request with the service details and legal limits kept distinct from ordinary service work.",
        href: routes.mobileNotary,
      },
    ],
  },
  {
    number: "03",
    title: "Keep the useful record",
    features: [
      {
        action: "Track the assets you care for",
        name: "Asset Management",
        copy: "Keep inspections, maintenance, upgrades, documents, and project history together with a home-first focus.",
        href: routes.homeId,
      },
      {
        action: "Preserve a property history",
        name: "HomeID",
        copy: "Carry components, service, completed work, ownership context, and supporting records forward.",
        href: routes.homeId,
      },
      {
        action: "Publish or follow a property listing",
        name: "HomeScout and Exchange property listings",
        copy: "Keep property discovery, listing details, decisions, inspections, and later ownership records connected.",
        href: routes.exchange,
      },
      {
        action: "Capture a guided property inspection",
        name: "Zero Base Fee inspection tools",
        copy: "Eligible roles can document a property with guided capture, then keep the report available for repair and ownership decisions.",
        href: routes.homeId,
      },
      {
        action: "Order and track materials",
        name: "Supply Run",
        copy: "Build a materials order, send it for fulfillment, follow status, and keep proof with the run.",
        href: routes.supplyRun,
      },
      {
        action: "Save something for later",
        name: "Saved items",
        copy: "Keep useful listings, offers, projects, and ideas available without starting the search over.",
        href: routes.exchange,
      },
      {
        action: "Write down what matters",
        name: "Notes",
        copy: "Keep working notes close to the people, jobs, purchases, and decisions they support.",
        href: routes.notes,
      },
      {
        action: "Request access to or deletion of account data",
        name: "Privacy requests",
        copy: "Submit a privacy request without treating a public profile, transaction record, or legally retained record as the same kind of data.",
        href: routes.privacyRequest,
      },
      {
        action: "Review the rules that govern an action",
        name: "Policies and compliance",
        copy: "Keep privacy, terms, verification, professional requirements, marketplace rules, and action-specific limits available beside the work they govern.",
        href: routes.howItWorks,
      },
    ],
  },
  {
    number: "04",
    title: "Run and grow the business",
    features: [
      {
        action: "Publish one business home",
        name: "Business profile",
        copy: "Show the offer, service area, proof, recommendations, requests, and next actions in one place.",
        href: routes.createBusiness,
      },
      {
        action: "Point your existing domain to it",
        name: "Custom domain",
        copy: "Keep the domain customers already know while the TradeScout profile becomes the working business home.",
        href: routes.claimBusiness,
      },
      {
        action: "Carry over useful outside evidence",
        name: "Selective Inheritance",
        copy: "Bring supported facts, media, records, and certifications with the source and observation date attached.",
        href: routes.claimBusiness,
      },
      {
        action: "Use tools built for the business category",
        name: "Category-specific tools",
        copy: "Add workflows that fit how the business actually operates as new category tools roll out.",
        href: routes.createBusiness,
      },
      {
        action: "Work from a role-specific workspace",
        name: "Professional tools",
        copy: "Realtors, vehicle sellers, property managers, service providers, and other approved roles can use tools built around their work.",
        href: routes.createBusiness,
      },
      {
        action: "Manage clients, jobs, and financial records",
        name: "Business finances",
        copy: "Keep clients, jobs, expenses, materials, vendors, payroll, reports, and records together.",
        href: routes.finances,
      },
      {
        action: "Keep an accounting trail",
        name: "Ledger and reporting",
        copy: "Record revenue, expenses, transaction history, and financial categories so the business can review what happened without treating TradeScout as a replacement for required accounting or tax advice.",
        href: routes.finances,
      },
      {
        action: "Create estimates and invoices",
        name: "Invoicing",
        copy: "Prepare customer documents and keep payment progress connected to the work.",
        href: routes.invoices,
      },
      {
        action: "Manage relationships and follow-ups",
        name: "CRM",
        copy: "Keep contacts, opportunities, conversations, and next steps attached to the business relationship.",
        href: routes.crm,
      },
      {
        action: "Review work that fits before accepting it",
        name: "Business request board",
        copy: "See eligible Direct Connect requests, review the supplied context, and accept or decline before private contact is released.",
        href: routes.businessRequests,
      },
      {
        action: "Find and bid on commercial work",
        name: "Commercial directory",
        copy: "Verified businesses can review commercial projects, open supporting documents, submit a bid, and keep the project and verification requirements together.",
        href: routes.commercialDirectory,
      },
      {
        action: "Understand business performance",
        name: "Analytics",
        copy: "Review requests, profile attention, project value, outcomes, and revenue trends in one place.",
        href: routes.finances,
      },
      {
        action: "Operate a vehicle-sales workflow",
        name: "Vehicle sales tools",
        copy: "Keep vehicle listings, VIN information, customer follow-up, financing factors, payment estimates, trade-in context, appointments, and buyer conversations together where those tools are available.",
        href: routes.exchange,
      },
      {
        action: "Operate a property-sales workflow",
        name: "Real-estate professional tools",
        copy: "Keep listings, clients, market analysis, comparative market analysis, mortgage factors, appointments, contacts, inspection follow-up, and property history connected where the role is approved.",
        href: routes.homeId,
      },
      {
        action: "Build local discovery from maintained information",
        name: "Local reach and shareable profiles",
        copy: "Use the maintained business identity, categories, service area, location, offers, proof, and public activity as the source for local discovery instead of rewriting the same information for every channel.",
        href: routes.businesses,
      },
      {
        action: "Learn a tool before depending on it",
        name: "Resource and training areas",
        copy: "Read available guidance and training material for platform and business workflows. Coverage varies by tool, and a visible resource page does not mean every lesson, partner, or program is finished.",
        href: routes.howItWorks,
      },
      {
        action: "Apply for business support when a program is open",
        name: "Accelerator and support programs",
        copy: "Use published application areas for growth or support programs when TradeScout has named the terms, availability, and selection process. A program page alone is not a promise of funding or acceptance.",
        href: routes.businesses,
      },
      {
        action: "Write and save the business story",
        name: "Story Generator",
        copy: "Create, save, copy, publish, or remove a professional business story without rebuilding the company background for every channel.",
        href: routes.storyGenerator,
      },
      {
        action: "Publish an offer without buying trust",
        name: "Promotions",
        copy: "Create a business promotion while keeping paid visibility separate from CVS, recommendations, and organic trust ordering.",
        href: routes.createBusiness,
      },
      {
        action: "Publish once and extend it outside TradeScout",
        name: "Social publishing and external auto-sharing",
        copy: "Use connected accounts, post templates, content choices, and destination choices to share approved project completions, recommendations, offers, community posts, achievements, and referral milestones beyond TradeScout. Each external account must be connected and authorized first. The management area exists, but dependable end-to-end automatic publishing is still expanding by platform.",
        href: routes.socialIntegration,
      },
      {
        action: "Track money moving through the account",
        name: "Wallet",
        copy: "See the account balance and payment history tied to activity in TradeScout.",
        href: routes.wallet,
      },
      {
        action: "Share without losing referral credit",
        name: "Share Hub and affiliate system",
        copy: "Signed-in sharing keeps attribution attached and pays only after qualifying TradeScout revenue occurs.",
        href: routes.affiliate,
      },
      {
        action: "Have TradeScout build the branded profile",
        name: "Express Profile",
        copy: "Pay for optional hands-on profile design and setup without buying trust, ranking, requests, or contact access.",
        href: routes.claimBusiness,
      },
      {
        action: "Order branded products or marketing help",
        name: "ScoutFitters",
        copy: "Create branded workwear or request cards, custom products, marketing services, and social plans.",
        href: routes.scoutFitters,
      },
    ],
  },
];

export function AboutExplainerContent() {
  return (
    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> TradeScout for requesters and local businesses
          </div>
          <h1 id="hero-title">Connection Without Compromise.</h1>
          <p className="hero-principle">Local recommendations should lead somewhere.</p>
          <p className="hero-lede">
            Recommendations drive TradeScout. Local experience helps a requester choose, send one
            protected request, connect only after both sides agree, and record the outcome for the
            next requester—without selling the lead, ranking, trust, or contact information.
          </p>
          <div className="plain-promises" aria-label="TradeScout product rules">
            <span>Payment cannot buy recommendations</span>
            <span>The requester chooses who receives a request</span>
            <span>Both sides choose before contact opens</span>
          </div>
        </div>
      </section>

      <div className="explainer-stack-list">
        <details className="explainer-stack" open>
          <summary>
            <span className="stack-number">01</span>
            <span className="stack-label">
              <strong>Scout</strong>
              <small>Understand a need, compare options, and prepare the next action.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="scout-split-section" id="scout" aria-labelledby="scout-title">
              <div className="scout-split-heading">
                <div>
                  <span className="section-kicker">The Scout page</span>
                  <h2 id="scout-title">One question can create value for both sides.</h2>
                </div>
                <p>
                  Scout helps a requester understand a need and choose a next step. It also helps a
                  business use TradeScout, be considered for work that fits, and receive a clearer
                  request when the requester chooses to send one. Scout recommends and prepares;
                  both sides still approve the action.
                </p>
              </div>

              <div
                className="scout-split-table"
                role="table"
                aria-label="Scout benefits for requesters and businesses"
              >
                <div className="scout-split-head" role="row">
                  <div role="columnheader">
                    <span>For the requester</span>
                    <strong>Understand and choose</strong>
                  </div>
                  <div role="columnheader">
                    <span>For the business</span>
                    <strong>Fit and respond</strong>
                  </div>
                </div>

                <details className="content-section" open>
                  <summary>
                    <strong>Understand the need</strong>
                    <small>Clarify the request and compare reasonable paths.</small>
                  </summary>
                  <div className="scout-stage-group">
                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>01</span>
                        <strong>Clarify the need</strong>
                      </div>
                      <article role="cell">
                        <h3>Start in ordinary language.</h3>
                        <p>
                          Describe the problem, goal, product, property, event, job, or decision
                          without knowing the correct category first. Scout asks for the missing
                          details that would materially change the answer.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Receive a need that is easier to judge.</h3>
                        <p>
                          When the requester proceeds, the business can receive clearer work,
                          timing, location, budget, urgency, and fit information instead of a vague
                          call or empty contact form.
                        </p>
                      </article>
                    </div>

                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>02</span>
                        <strong>Compare the paths</strong>
                      </div>
                      <article role="cell">
                        <h3>See more than one reasonable answer.</h3>
                        <p>
                          Compare hiring, doing it yourself, buying, renting, booking, posting,
                          requesting, or waiting when those are valid choices. Scout can put the
                          strongest path first without hiding the alternatives.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Compete on fit instead of purchased position.</h3>
                        <p>
                          A business can be considered because its offer, location, availability,
                          verification, recommendations, and outcome history fit the need—not
                          because it bought a higher rank.
                        </p>
                      </article>
                    </div>
                  </div>
                </details>

                <details className="content-section">
                  <summary>
                    <strong>Explain the recommendation and keep control</strong>
                    <small>See why something fits before approving the next action.</small>
                  </summary>
                  <div className="scout-stage-group">
                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>03</span>
                        <strong>Explain the recommendation</strong>
                      </div>
                      <article role="cell">
                        <h3>Understand why an option fits.</h3>
                        <p>
                          See the useful evidence, local context, tradeoffs, missing information,
                          and checks that matter before acting. A recommendation is a supported
                          starting point, not an unexplained command.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Let the maintained business record speak.</h3>
                        <p>
                          The profile, offers, service area, current availability, verified proof,
                          recommendations, response history, and completed outcomes can help explain
                          why the business belongs in the answer.
                        </p>
                      </article>
                    </div>

                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>04</span>
                        <strong>Keep control</strong>
                      </div>
                      <article role="cell">
                        <h3>Review before anything is sent.</h3>
                        <p>
                          Scout can prepare a request, listing draft, post, or other next step, but
                          the requester reviews it and chooses whether to continue, who should
                          receive it, and what information is included.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>A recommendation is not permission to interrupt.</h3>
                        <p>
                          Being shown by Scout does not expose private contact information or create
                          a blind call. A selected business reviews a submitted request before
                          direct contact opens.
                        </p>
                      </article>
                    </div>

                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>05</span>
                        <strong>Move into action</strong>
                      </div>
                      <article role="cell">
                        <h3>Carry the answer into the next tool.</h3>
                        <p>
                          Useful context can become a prepared Direct Connect request, Exchange
                          listing draft, HomeID action, community post, saved comparison, or another
                          reviewable next step without starting over.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Receive context, not a resold name.</h3>
                        <p>
                          The chosen business gets a structured opportunity tied to the original
                          need. TradeScout does not charge the business for the lead or broadcast
                          the same private contact to a crowd.
                        </p>
                      </article>
                    </div>
                  </div>
                </details>

                <details className="content-section">
                  <summary>
                    <strong>Carry the answer forward</strong>
                    <small>Start the next tool with the useful context already attached.</small>
                  </summary>
                  <div className="scout-stage-group">
                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>06</span>
                        <strong>Prepare the next action</strong>
                      </div>
                      <article role="cell">
                        <h3>Start the next tool with the answer already attached.</h3>
                        <p>
                          Review a prepared request, listing draft, HomeID action, community post,
                          saved comparison, booking step, or purchase path without describing the
                          same need again.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Receive the context the requester approved.</h3>
                        <p>
                          If the requester chooses the business, the prepared action can carry the
                          relevant scope, timing, location, evidence, and constraints forward
                          instead of becoming an empty lead.
                        </p>
                      </article>
                    </div>

                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>07</span>
                        <strong>Use connected context</strong>
                      </div>
                      <article role="cell">
                        <h3>Bring the relevant history forward.</h3>
                        <p>
                          Scout can use selected HomeID context, prior conversation, saved work,
                          nearby activity, recommendations, listings, events, and current proof when
                          that information belongs in the decision.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Keep business information useful everywhere.</h3>
                        <p>
                          Updating the profile, offer, service area, availability, verification, or
                          completed work improves the source Scout can use instead of forcing the
                          business to maintain a separate answer for every search.
                        </p>
                      </article>
                    </div>
                  </div>
                </details>

                <details className="content-section">
                  <summary>
                    <strong>Operate and promote through Scout</strong>
                    <small>
                      Use Scout for daily decisions and show relevant offers at the right moment.
                    </small>
                  </summary>
                  <div className="scout-stage-group">
                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>08</span>
                        <strong>Use Scout as a business tool</strong>
                      </div>
                      <article role="cell">
                        <h3>Ask for help across daily decisions.</h3>
                        <p>
                          A requester can use Scout for local help, products, property, projects,
                          employment, community activity, events, trust checks, price factors, and
                          what to do next.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Ask what the business should do next.</h3>
                        <p>
                          A business owner can use Scout to review profile gaps, verification needs,
                          offers, customer requests, materials, local demand signals, property work,
                          finances, and the next available operating step.
                        </p>
                      </article>
                    </div>

                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>09</span>
                        <strong>Match promotion to the need</strong>
                      </div>
                      <article role="cell">
                        <h3>See useful options at the useful moment.</h3>
                        <p>
                          When the need calls for a product, service, material, booking, or local
                          offer, Scout can include a relevant option in the decision instead of
                          filling the page with promotions unrelated to the question.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Put the offer where it can actually help.</h3>
                        <p>
                          A business can describe what it sells, where it applies, who it fits, and
                          when it is available. Scout can bring that offer forward when the active
                          need matches it. Any paid, sponsored, or affiliate placement stays
                          identified and cannot buy a recommendation, CVS, or false fit.
                        </p>
                      </article>
                    </div>
                  </div>
                </details>

                <details className="content-section">
                  <summary>
                    <strong>Improve the next result</strong>
                    <small>
                      Let verified participation make future recommendations more useful.
                    </small>
                  </summary>
                  <div className="scout-stage-group">
                    <div className="scout-benefit-row" role="row">
                      <div className="scout-benefit-moment">
                        <span>10</span>
                        <strong>Improve the next result</strong>
                      </div>
                      <article role="cell">
                        <h3>Leave useful evidence for the next requester.</h3>
                        <p>
                          The recommendation, request, response, completed outcome, and later
                          positive or negative recommendation can make the next answer more
                          informed.
                        </p>
                      </article>
                      <article role="cell">
                        <h3>Earn stronger discovery through participation.</h3>
                        <p>
                          Timely responses, completed work, verified purchases, recommendations,
                          current proof, and resolved problems can improve future trust and fit.
                          Payment cannot manufacture that history.
                        </p>
                      </article>
                    </div>
                  </div>
                </details>
              </div>

              <div className="scout-boundary">
                <strong>Scout does not make the final decision for either side.</strong>
                <p>
                  It cannot guarantee price, quality, availability, legality, safety, or fit. It
                  does not silently contact, hire, publish, submit, or pay. The requester and
                  business remain responsible for reviewing the information and approving the action
                  that affects them.
                </p>
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">02</span>
            <span className="stack-label">
              <strong>Direct Connect</strong>
              <small>Control the request, preview, acceptance, contact, and outcome.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="connect-section" id="connect" aria-labelledby="connect-title">
              <div className="connect-heading">
                <span className="section-kicker">Direct Connect</span>
                <h2 id="connect-title">
                  A request becomes contact only after both sides choose it.
                </h2>
                <p>
                  Direct Connect owns the request, preview, acceptance, contact, and outcome. It is
                  not a lead list, an open contact form, or permission to interrupt someone because
                  Scout mentioned a business.
                </p>
              </div>
              <details className="content-section" open>
                <summary>
                  <strong>Prepare the request</strong>
                  <small>Both sides begin with a defined need, not a sold name.</small>
                </summary>
                <div className="connection-stage">
                  <div className="connection-stage-label">
                    <span>01</span>
                    <strong>Requester and business view</strong>
                  </div>
                  <article>
                    <span>Requester</span>
                    <h3>Define the need before sending it.</h3>
                    <p>
                      Review the outcome, scope, place, timing, urgency, budget information, photos,
                      documents, property context, and anything else the recipient needs to judge
                      the request.
                    </p>
                  </article>
                  <article>
                    <span>Business</span>
                    <h3>Nothing arrives while the request is still a draft.</h3>
                    <p>
                      A search, comparison, or recommendation does not create a lead. The business
                      receives nothing until the requester approves the request and chooses where it
                      should go.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>Choose recipients</strong>
                  <small>
                    The requester chooses who may review it; payment cannot buy inclusion.
                  </small>
                </summary>
                <div className="connection-stage">
                  <div className="connection-stage-label">
                    <span>02</span>
                    <strong>Requester and business view</strong>
                  </div>
                  <article>
                    <span>Requester</span>
                    <h3>Choose who may review the request.</h3>
                    <p>
                      Use recommendations, profile evidence, service area, availability, CVS,
                      credentials, and fit to choose a business. Sending to more than one business
                      remains an explicit requester choice, not an automatic broadcast.
                    </p>
                  </article>
                  <article>
                    <span>Business</span>
                    <h3>Appear because the request fits.</h3>
                    <p>
                      Eligibility can depend on the offer, location, availability, current proof,
                      category requirements, recommendations, outcomes, and CVS. Payment cannot buy
                      inclusion or priority.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>Preview before contact</strong>
                  <small>Each side sees the useful context before private contact opens.</small>
                </summary>
                <div className="connection-stage">
                  <div className="connection-stage-label">
                    <span>03</span>
                    <strong>Requester and business view</strong>
                  </div>
                  <article>
                    <span>Requester</span>
                    <h3>See what will be shared before it leaves.</h3>
                    <p>
                      The requester reviews the recipient and the information packet. Unrelated Home
                      Vault records, private documents, and contact details stay out unless the
                      requester deliberately includes or authorizes them.
                    </p>
                  </article>
                  <article>
                    <span>Business</span>
                    <h3>Judge the opportunity before exposing direct contact.</h3>
                    <p>
                      The business can review the supplied scope, timing, location context,
                      evidence, and constraints before accepting. This reduces blind calls, vague
                      inquiries, poor-fit work, and time spent chasing a resold name.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>Accept or decline</strong>
                  <small>
                    The business chooses whether the work fits before direct contact is released.
                  </small>
                </summary>
                <div className="connection-stage">
                  <div className="connection-stage-label">
                    <span>04</span>
                    <strong>Requester and business view</strong>
                  </div>
                  <article>
                    <span>Requester</span>
                    <h3>Receive a decision instead of losing control of the request.</h3>
                    <p>
                      If a business declines or does not fit, the requester can keep the request,
                      revise it, or choose another recipient. A decline does not release private
                      contact information.
                    </p>
                  </article>
                  <article>
                    <span>Business</span>
                    <h3>Accept suitable work or decline it without buying the lead.</h3>
                    <p>
                      The response becomes part of the request history. Timely accepts and declines
                      can support responsiveness signals; silence and repeated poor handling can
                      affect future eligibility.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>Work and outcome</strong>
                  <small>Keep the conversation, records, payment steps, and result attached.</small>
                </summary>
                <div className="connection-stage">
                  <div className="connection-stage-label">
                    <span>05</span>
                    <strong>Requester and business view</strong>
                  </div>
                  <article>
                    <span>Requester</span>
                    <h3>Keep the conversation, decision, payment, and result with the need.</h3>
                    <p>
                      Messages, quotes, bookings, purchases, work steps, payment records, completion
                      evidence, disputes, and the final recommendation can stay attached instead of
                      being rebuilt across disconnected services.
                    </p>
                  </article>
                  <article>
                    <span>Business</span>
                    <h3>Turn an accepted request into an operating record.</h3>
                    <p>
                      Clients, jobs, materials, estimates, invoices, receipts, follow-ups, delivery
                      proof, and completed outcomes can improve the business record and future
                      recommendations when the evidence supports them.
                    </p>
                  </article>
                </div>
              </details>
              <div className="connect-boundary">
                Direct Connect does not create a contract, guarantee payment or performance, replace
                emergency services, or remove licensing, insurance, inspection, safety, disclosure,
                or legal responsibilities.
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">03</span>
            <span className="stack-label">
              <strong>Business home</strong>
              <small>Replace the website stack and use tools built for the business type.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="business-section" id="businesses" aria-labelledby="business-title">
              <div className="unique-intro">
                <div>
                  <span className="section-kicker">What is different about TradeScout</span>
                  <h2 id="business-title">
                    A working business home, not another page on the internet.
                  </h2>
                </div>
                <div>
                  <p>
                    TradeScout is for the full small-business economy—not only contractors. A
                    restaurant, retailer, service company, shop, practice, maker, or professional
                    can be found, checked, chosen, contacted, and paid through one connected system.
                  </p>
                </div>
              </div>
              <details className="content-section" open>
                <summary>
                  <strong>Tools for each kind of business</strong>
                  <small>See how TradeScout supports different operating models.</small>
                </summary>
                <div className="content-section-body">
                  <div
                    className="category-rollout subchapter-active"
                    data-subchapter-group="business"
                    data-subchapter="rollout"
                  >
                    <strong>Business-category tools are rolling out every day.</strong>
                    <p>
                      TradeScout adds tools around how each kind of business actually operates, so
                      each profile can replace more of the separate software that kind of business
                      pays for today.
                    </p>
                  </div>

                  <div
                    className="category-capabilities"
                    aria-label="Business category capabilities"
                  >
                    <article data-subchapter-group="business" data-subchapter="service">
                      <span>Service businesses</span>
                      <h3>Move from request to completed work.</h3>
                      <p>
                        Profile offers, service areas, proof, Direct Connect requests, estimates,
                        jobs, materials, invoices, payment records, licensing, insurance, and
                        completed-work history.
                      </p>
                    </article>
                    <article data-subchapter-group="business" data-subchapter="shops">
                      <span>Restaurants, retail, makers, and sellers</span>
                      <h3>Turn discovery into an order or visit.</h3>
                      <p>
                        Profiles, hours, locations, recommendations, fixed-price items or services,
                        bookings, purchases, promotions, and Exchange categories including local
                        food and handmade goods.
                      </p>
                    </article>
                    <article data-subchapter-group="business" data-subchapter="property">
                      <span>Realtors and property professionals</span>
                      <h3>Connect the listing to the property record.</h3>
                      <p>
                        Property listings, clients, market analysis, comparative market analysis,
                        appointments, contacts, inspections, repair decisions, and the history that
                        follows the asset.
                      </p>
                    </article>
                    <article data-subchapter-group="business" data-subchapter="vehicles">
                      <span>Vehicle sellers</span>
                      <h3>Manage more than the listing.</h3>
                      <p>
                        Vehicle listings, customer follow-up, financing steps, trade-in information,
                        VIN lookup, appointments, and the conversations that move a buyer toward a
                        decision.
                      </p>
                    </article>
                    <article data-subchapter-group="business" data-subchapter="groups">
                      <span>Property managers, HOAs, and groups</span>
                      <h3>Keep shared responsibilities visible.</h3>
                      <p>
                        Residents, members, maintenance requests, violations, documents, vendors,
                        votes, finances, community posts, and the decisions tied to a shared place.
                      </p>
                    </article>
                    <article data-subchapter-group="business" data-subchapter="employment">
                      <span>Employers, workers, and helpers</span>
                      <h3>Connect available work with available people.</h3>
                      <p>
                        Job posts, resume posts, pay ranges, applications, shortlists, helper
                        profiles, odd jobs, crew needs, job-site support, and direct replies after
                        the right checks.
                      </p>
                    </article>
                  </div>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Replace the website stack</strong>
                  <small>
                    Keep the existing domain while TradeScout becomes the working business home.
                  </small>
                </summary>
                <div className="content-section-body">
                  <div data-subchapter-group="business" data-subchapter="replace-stack">
                    <div className="inheritance-panel" aria-labelledby="inheritance-title">
                      <div className="inheritance-intro">
                        <span className="section-kicker">Selective Inheritance</span>
                        <h3 id="inheritance-title">
                          Keep your domain. Replace the website and the pile of services behind it.
                        </h3>
                        <p>
                          Your existing domain should point directly to your TradeScout business
                          profile. That profile becomes your public business home inside the same
                          system people use to find you, check your proof, contact you, send a
                          request, choose what happens next, and handle payment-related steps.
                        </p>
                      </div>
                      <div className="inheritance-compare">
                        <article>
                          <span>The stack businesses pay for now</span>
                          <ul>
                            <li>
                              A website, hosting, forms, listings, messaging, lead services, and
                              payment add-ons
                            </li>
                            <li>The same business information maintained in several places</li>
                            <li>Separate bills for disconnected pieces of one customer journey</li>
                            <li>
                              A domain that sends people to a page with no connection to the rest of
                              the process
                            </li>
                          </ul>
                        </article>
                        <article className="inheritance-tradescout">
                          <span>TradeScout as the business home</span>
                          <ul>
                            <li>Your existing domain points straight to one maintained profile</li>
                            <li>
                              One profile supports discovery, proof, contact, requests, decisions,
                              and payments
                            </li>
                            <li>
                              Useful facts and media can move over with their source and check date
                              attached
                            </li>
                            <li>
                              Stop paying another vendor for any job TradeScout already provides
                            </li>
                          </ul>
                        </article>
                      </div>
                      <div className="inheritance-bottom">
                        <p>
                          Selective Inheritance brings supported facts, photos, records, and
                          certifications into TradeScout with their source and date attached.
                          Unsupported claims stay out. Outside reviews and scores remain outside
                          evidence; they do not become TradeScout work history. When the source is
                          confirmed, CVS may use a limited starting signal or small adjustment, but
                          outside evidence never replaces verification or completed TradeScout work.
                          Keep an outside service only while it still does something TradeScout
                          cannot.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">04</span>
            <span className="stack-label">
              <strong>Home &amp; property</strong>
              <small>Keep HomeID, HomeScout, work, inspections, and selling connected.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="property-section" id="property" aria-labelledby="property-title">
              <div className="property-heading">
                <span className="section-kicker">HomeID, HomeScout, and 1 Tap Sale</span>
                <h2 id="property-title">
                  The property keeps its history. The owner controls what happens next.
                </h2>
                <p>
                  HomeID is the durable property record. HomeScout is the discovery, listing, and
                  action side. Direct Connect turns a property need into work, then verified results
                  can improve the HomeID. 1 Tap Sale begins the selling path from information the
                  owner has already kept.
                </p>
              </div>
              <details className="content-section" open>
                <summary>
                  <strong>HomeID and the private property record</strong>
                  <small>Identity, Home Vault, authority, and the physical NFC card.</small>
                </summary>
                <div className="property-grid">
                  <article
                    className="subchapter-active"
                    data-subchapter-group="property"
                    data-subchapter="record"
                  >
                    <span>HomeID</span>
                    <h3>Give the property an identity that lasts longer than one owner.</h3>
                    <p>
                      HomeID belongs to the property identity, not to a username. Owners and other
                      authorized people receive time-scoped authority over it. When ownership
                      changes, the identity and allowed history can continue while the prior
                      owner&apos;s private information stays private. A property manager can receive
                      only the authority needed to maintain the property without being treated as
                      the owner.
                    </p>
                  </article>
                  <article
                    className="subchapter-active"
                    data-subchapter-group="property"
                    data-subchapter="record"
                  >
                    <span>The private Home Vault</span>
                    <h3>Keep the details that are expensive to reconstruct later.</h3>
                    <p>
                      An owner can keep property details, systems and appliances, models and serial
                      numbers, maintenance, upgrades, inspections, costs, warranties, documents,
                      photos, evidence, maintenance schedules, projects, build milestones, and a
                      completed-work timeline. An authorized realtor can start with what the seller
                      has already organized instead of rebuilding the property story from scattered
                      files and memory. A property manager can keep recurring maintenance, vendor
                      work, costs, and property documents in the same history.
                    </p>
                  </article>
                  <article
                    className="subchapter-active"
                    data-subchapter-group="property"
                    data-subchapter="record"
                  >
                    <span>Physical HomeID NFC card</span>
                    <h3>
                      Carry a tap-to-open HomeID access point when the property record is needed on
                      the go.
                    </h3>
                    <p>
                      An owner can get a physical HomeID NFC card and use it to open the HomeID
                      sharing flow from a compatible phone. It is useful when meeting a business,
                      inspector, buyer, realtor, property manager, or other authorized participant
                      at the property. During a listing appointment, walkthrough, inspection,
                      maintenance visit, or vendor handoff, the card can open the owner-approved
                      information without hunting through email. The tap does not make the entire
                      private Home Vault public; the owner still decides which view, details, or
                      prepared packet to share.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>Requests, completed work, and inspections</strong>
                  <small>
                    Move selected property context into action and return verified results to the
                    record.
                  </small>
                </summary>
                <div className="property-grid">
                  <article data-subchapter-group="property" data-subchapter="work">
                    <span>From record to request</span>
                    <h3>Use the property history to ask for the right work.</h3>
                    <p>
                      The owner chooses which HomeID details belong in a request, previews the
                      packet, and creates a Direct Connect draft. Nothing is sent just because the
                      record exists. After review and submission, the chosen business sees the
                      useful context without receiving unrelated private property information. A
                      seller and authorized realtor can use the same process for inspection
                      findings, repairs, cleanup, staging support, or other sale preparation. A
                      property manager can prepare a vendor request from the known component, prior
                      work, and maintenance schedule without exposing unrelated owner records.
                    </p>
                  </article>
                  <article data-subchapter-group="property" data-subchapter="work">
                    <span>From completed work back to HomeID</span>
                    <h3>Let verified work improve the property memory.</h3>
                    <p>
                      Estimates, invoices, receipts, inspections, maintenance, upgrades, completion
                      evidence, and other approved records can be linked to the property. A
                      completed job can propose a HomeID event, but evidence and verification rules
                      decide what becomes part of the timeline. That gives a property manager a
                      continuing maintenance record instead of a new folder for every vendor visit.
                    </p>
                  </article>
                  <article data-subchapter-group="property" data-subchapter="work">
                    <span>Inspection intelligence and expedited follow-up</span>
                    <h3>
                      Reduce the time between a question, usable evidence, and the right inspection
                      follow-up.
                    </h3>
                    <p>
                      TradeScout is building guided, evidence-linked workflows for permit
                      inspections, home inspections, insurance claims, pre-sale review, item
                      valuation, and equipment condition. The work can organize photo capture, keep
                      the source and freshness of requirements visible, reuse supported findings,
                      and prepare the next Direct Connect action. The inspection case and supporting
                      infrastructure exist, but broader access and official-system integration are
                      still expanding. TradeScout cannot approve a permit, guarantee a faster
                      appointment, replace an official inspection, or turn general safety guidance
                      into local authority.
                    </p>
                  </article>
                </div>
              </details>
              <details className="content-section">
                <summary>
                  <strong>HomeScout, 1 Tap Sale, and transfer</strong>
                  <small>
                    Start a listing from the property record without making the private vault
                    public.
                  </small>
                </summary>
                <div className="property-grid">
                  <article data-subchapter-group="property" data-subchapter="sale">
                    <span>HomeScout</span>
                    <h3>Turn property information into discovery and action.</h3>
                    <p>
                      HomeScout connects property listings with Exchange discovery, inspection and
                      repair decisions, Direct Connect work, and the HomeID that should survive the
                      transaction. A HomeID can exist without a public listing; a listing is an
                      action taken from the record, not the record itself. Realtors benefit because
                      the listing can begin with owner-approved property context and stay connected
                      to the work needed to make the property ready. An owner can also use the
                      listing path directly without being required to hire a realtor.
                    </p>
                  </article>
                  <article data-subchapter-group="property" data-subchapter="sale">
                    <span>1 Tap Sale</span>
                    <h3>Start the sale without rebuilding the property from scratch.</h3>
                    <p>
                      1 Tap Sale uses saved HomeID and Home Vault information to start a HomeScout
                      listing draft. It does not complete a property sale in one tap. The owner
                      still reviews the listing, chooses what becomes public, supplies anything
                      missing, and controls submission and later transfer steps. An authorized
                      realtor can help review the draft, fill listing gaps, prepare the market
                      presentation, and coordinate the next steps without re-entering every known
                      fact; that help is optional, not a requirement to begin the sale path.
                    </p>
                  </article>
                  <article data-subchapter-group="property" data-subchapter="sale">
                    <span>Transfer without oversharing</span>
                    <h3>
                      Carry the useful property record forward, not the prior owner&apos;s private
                      life.
                    </h3>
                    <p>
                      A sale or other approved handoff closes the old authority window and opens the
                      new one. The transfer packet is explicit and filtered by visibility rules.
                      Private owner data does not automatically transfer with the home. That gives
                      the realtor a clearer closing handoff: useful property history can continue
                      while seller-only information remains protected.
                    </p>
                  </article>
                  <article data-subchapter-group="property" data-subchapter="sale">
                    <span>AssetID direction</span>
                    <h3>Use HomeID as the first durable asset record.</h3>
                    <p>
                      The larger design is an AssetID pattern for records that can outlast
                      individual owners. HomeID is the implemented starting point. The page does not
                      imply that every future asset type already has the same depth of history,
                      authority, evidence, and transfer support.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Benefits for realtors</strong>
                  <small>
                    Use the owner-approved record to prepare, represent, and close more efficiently.
                  </small>
                </summary>
                <div
                  className="realtor-benefits"
                  data-subchapter-group="property"
                  data-subchapter="realtor"
                  aria-labelledby="realtor-benefits-title"
                >
                  <div>
                    <span className="section-kicker">What this changes for a realtor</span>
                    <h3 id="realtor-benefits-title">
                      Spend less time reconstructing the property and more time representing the
                      client.
                    </h3>
                    <p>
                      HomeID does not replace the realtor. It gives an authorized realtor a cleaner
                      starting point, better-supported answers, and a connected way to move from
                      listing preparation to closing without taking control away from the owner.
                    </p>
                  </div>
                  <div className="realtor-benefit-grid">
                    <article>
                      <strong>Prepare the listing faster</strong>
                      <p>
                        Use owner-approved property facts, systems, upgrades, documents, and
                        completed work instead of asking the seller to rebuild everything from
                        memory.
                      </p>
                    </article>
                    <article>
                      <strong>See what needs attention before launch</strong>
                      <p>
                        Review missing details, inspection findings, maintenance history, and items
                        that need verification before they become buyer questions.
                      </p>
                    </article>
                    <article>
                      <strong>Coordinate sale preparation</strong>
                      <p>
                        Turn repairs, cleanup, staging support, photos, or inspection follow-up into
                        controlled Direct Connect requests with the right property context attached.
                      </p>
                    </article>
                    <article>
                      <strong>Share better information during the appointment</strong>
                      <p>
                        Use the physical HomeID NFC card or an owner-approved packet during a
                        listing meeting, walkthrough, inspection, or buyer conversation.
                      </p>
                    </article>
                    <article>
                      <strong>Support claims with dated evidence</strong>
                      <p>
                        Separate documented systems, maintenance, upgrades, and completed work from
                        unsupported marketing language.
                      </p>
                    </article>
                    <article>
                      <strong>Carry the property through closing</strong>
                      <p>
                        Prepare an explicit transfer packet so useful history can follow the home
                        while private seller information stays out of the buyer handoff.
                      </p>
                    </article>
                    <article>
                      <strong>Keep the client relationship connected</strong>
                      <p>
                        Use realtor clients, market analysis, comparative market analysis,
                        appointments, contacts, connections, and follow-up beside the property
                        workflow.
                      </p>
                    </article>
                    <article>
                      <strong>Explain what 1 Tap Sale actually saves</strong>
                      <p>
                        It saves the first round of duplicate entry by starting a listing draft from
                        HomeID; professional review, pricing, presentation, disclosure, and
                        submission still matter.
                      </p>
                    </article>
                  </div>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Benefits for property managers</strong>
                  <small>
                    Manage from the property history with scoped authority and cleaner vendor
                    handoffs.
                  </small>
                </summary>
                <div
                  className="property-manager-benefits"
                  data-subchapter-group="property"
                  data-subchapter="manager"
                  aria-labelledby="property-manager-benefits-title"
                >
                  <div>
                    <span className="section-kicker">What this changes for a property manager</span>
                    <h3 id="property-manager-benefits-title">
                      Manage the property from its history instead of a pile of disconnected work
                      orders.
                    </h3>
                    <p>
                      A property manager can receive scoped authority to maintain the asset,
                      coordinate vendors, and keep records current without becoming the owner or
                      receiving every private owner record.
                    </p>
                  </div>
                  <div className="realtor-benefit-grid">
                    <article>
                      <strong>Keep each property separate and durable</strong>
                      <p>
                        Store systems, appliances, documents, inspections, completed work, and
                        schedules with the property they belong to.
                      </p>
                    </article>
                    <article>
                      <strong>Give vendors useful context</strong>
                      <p>
                        Share the component, issue, prior work, access details, and selected
                        evidence needed for the job without opening the entire owner vault.
                      </p>
                    </article>
                    <article>
                      <strong>Turn maintenance into a controlled request</strong>
                      <p>
                        Create and review a Direct Connect request from the property record, then
                        choose who receives it and when contact opens.
                      </p>
                    </article>
                    <article>
                      <strong>Use the NFC card during field work</strong>
                      <p>
                        Tap the physical HomeID card at the property to reach an approved view or
                        packet during inspection, maintenance, turnover, or vendor access.
                      </p>
                    </article>
                    <article>
                      <strong>Track recurring work and costs</strong>
                      <p>
                        Keep maintenance schedules, project planning, invoices, receipts, costs,
                        warranties, and completion evidence attached to the asset.
                      </p>
                    </article>
                    <article>
                      <strong>Coordinate HOA and shared-property work</strong>
                      <p>
                        Connect residents, maintenance requests, violations, documents, approved
                        vendors, votes, and finances where a managed community is involved.
                      </p>
                    </article>
                    <article>
                      <strong>Prepare for sale or owner review</strong>
                      <p>
                        Use the property history to explain condition, recent work, open items, and
                        sale preparation without reconstructing years of management activity.
                      </p>
                    </article>
                    <article>
                      <strong>Hand off management cleanly</strong>
                      <p>
                        Close the prior manager&apos;s authority and open the next one while the
                        allowed property history stays with the asset.
                      </p>
                    </article>
                  </div>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Owner-led selling</strong>
                  <small>Start and lead the sale without being required to hire a realtor.</small>
                </summary>
                <div
                  className="owner-sale-benefits"
                  data-subchapter-group="property"
                  data-subchapter="owner"
                  aria-labelledby="owner-sale-benefits-title"
                >
                  <div>
                    <span className="section-kicker">When an owner does not want a realtor</span>
                    <h3 id="owner-sale-benefits-title">
                      Use the same property history to lead the sale directly.
                    </h3>
                    <p>
                      TradeScout does not require a realtor to start a HomeScout listing. The owner
                      can choose an owner-led path, use 1 Tap Sale to begin from HomeID, and bring
                      in only the professional help they decide they need.
                    </p>
                  </div>
                  <div className="realtor-benefit-grid">
                    <article>
                      <strong>Start without re-entering the property</strong>
                      <p>
                        Use saved property facts, systems, upgrades, documents, photos, and
                        completed work to prepare the first listing draft.
                      </p>
                    </article>
                    <article>
                      <strong>Choose what buyers can see</strong>
                      <p>
                        Publish selected listing information and share approved HomeID evidence
                        without making the private Home Vault public.
                      </p>
                    </article>
                    <article>
                      <strong>Prepare the property through Direct Connect</strong>
                      <p>
                        Request inspection follow-up, repairs, cleanup, photography, moving help, or
                        other sale preparation from selected businesses and helpers.
                      </p>
                    </article>
                    <article>
                      <strong>Answer property questions with history</strong>
                      <p>
                        Use dated maintenance, systems, appliances, documents, and completed-work
                        records instead of relying only on memory or sales language.
                      </p>
                    </article>
                    <article>
                      <strong>Share on site with the NFC card</strong>
                      <p>
                        Open an owner-approved HomeID view or packet during a showing, walkthrough,
                        inspection, or buyer conversation.
                      </p>
                    </article>
                    <article>
                      <strong>Keep the choice to add representation later</strong>
                      <p>
                        An owner can invite an authorized realtor or other professional when that
                        help becomes valuable without abandoning the existing record or listing
                        work.
                      </p>
                    </article>
                    <article>
                      <strong>Avoid paying for representation the owner does not want</strong>
                      <p>
                        An owner-led path can avoid a representation fee that was never chosen.
                        Other transaction, inspection, repair, title, closing, tax, or legal costs
                        may still apply.
                      </p>
                    </article>
                    <article>
                      <strong>Know what TradeScout does not replace</strong>
                      <p>
                        TradeScout does not provide the owner&apos;s pricing judgment, required
                        disclosures, negotiation, contract review, title work, closing services,
                        inspections, or legal advice.
                      </p>
                    </article>
                  </div>
                </div>
              </details>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">05</span>
            <span className="stack-label">
              <strong>Exchange</strong>
              <small>Browse, list, request, buy, sell, rent, promote, and track the outcome.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="exchange-section" id="exchange" aria-labelledby="exchange-title">
              <div className="section-heading exchange-heading">
                <span className="section-kicker">TradeScout Exchange</span>
                <h2 id="exchange-title">
                  The marketplace keeps the listing, decision, conversation, and outcome connected.
                </h2>
                <p>
                  Exchange is not one endless classifieds feed. It separates browsing,
                  category-specific listing requirements, rentals, promotions, buyer requests,
                  seller work, and the post-sale record while using Scout, Direct Connect,
                  verification, CVS, and location context where they fit.
                </p>
              </div>

              <details className="content-section" open>
                <summary>
                  <strong>Browse and narrow the market</strong>
                  <small>Start local, expand when needed, and filter for an actual fit.</small>
                </summary>
                <div className="exchange-grid">
                  <article>
                    <span>Place</span>
                    <h3>Choose local, state, or nationwide scope.</h3>
                    <p>
                      Local discovery stays available, but Exchange can broaden when the item,
                      buyer, seller, or shipping option makes a wider search useful.
                    </p>
                  </article>
                  <article>
                    <span>Fit</span>
                    <h3>Search by category, price, condition, and relevance.</h3>
                    <p>
                      People can search, sort, narrow the price range, review condition, save
                      listings, and return to the items they are seriously considering.
                    </p>
                  </article>
                  <article>
                    <span>Context</span>
                    <h3>See the seller and the listing together.</h3>
                    <p>
                      Price, photos, description, location, pickup or shipping information, seller
                      identity, verification signals, views, favorites, and category details stay
                      with the listing.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Use the right category or dedicated portal</strong>
                  <small>
                    Different assets need different information, proof, and handoff rules.
                  </small>
                </summary>
                <div className="exchange-category-list" aria-label="Exchange categories">
                  <span>Businesses</span>
                  <span>HomeScout real estate</span>
                  <span>Vehicles</span>
                  <span>Construction equipment</span>
                  <span>Tools &amp; hardware</span>
                  <span>Furniture &amp; home</span>
                  <span>Farm equipment</span>
                  <span>Business equipment</span>
                  <span>Electronics</span>
                  <span>Sports &amp; recreation</span>
                  <span>Art &amp; collectibles</span>
                  <span>Jewelry &amp; luxury</span>
                  <span>Physical metals</span>
                  <span>Local food &amp; artisan goods</span>
                  <span>Other high-value items</span>
                </div>
                <div className="exchange-grid compact-grid">
                  <article>
                    <span>HomeScout</span>
                    <h3>For property being sold.</h3>
                    <p>
                      Homes, land, and commercial property move through the property-first HomeScout
                      path so the listing can stay connected to HomeID, inspections, repairs, and
                      ownership transfer.
                    </p>
                  </article>
                  <article>
                    <span>Rental property</span>
                    <h3>For residential or commercial leases.</h3>
                    <p>
                      Rental property stays separate from a HomeScout sale listing and carries
                      property use, property type, lease term, and availability.
                    </p>
                  </article>
                  <article>
                    <span>Rental equipment</span>
                    <h3>For short- or long-term equipment use.</h3>
                    <p>
                      Rental equipment can state cadence, availability, delivery or pickup, and
                      whether an operator or other terms are included.
                    </p>
                  </article>
                  <article>
                    <span>Metals Exchange</span>
                    <h3>For physical metals.</h3>
                    <p>
                      Physical gold, silver, and related items use weight, purity, form, USD
                      pricing, and a secure handoff instead of being treated like an ordinary
                      household listing.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Prepare and publish a listing</strong>
                  <small>
                    Scout can prepare a draft; the seller reviews and confirms the listing.
                  </small>
                </summary>
                <div className="exchange-grid">
                  <article>
                    <span>Start</span>
                    <h3>Describe what is being offered.</h3>
                    <p>
                      Choose the category, title, price or rental rate, description, place,
                      condition, photos, pickup or shipping terms, and the specifications that
                      belong to that asset.
                    </p>
                  </article>
                  <article>
                    <span>Category proof</span>
                    <h3>Supply the details that make the offer judgeable.</h3>
                    <p>
                      Vehicles can include VIN and mileage; equipment can include serials, hours,
                      service records, and inspection availability; electronics confirm operation;
                      collectibles carry provenance; jewelry carries material and handoff details.
                    </p>
                  </article>
                  <article>
                    <span>Boundaries</span>
                    <h3>Some listings require more than ordinary copy.</h3>
                    <p>
                      Photo minimums, required fields, prohibited-item checks, proof requirements,
                      and local-food rules can block publication until the listing supplies what
                      that category requires.
                    </p>
                  </article>
                  <article>
                    <span>Seller control</span>
                    <h3>Nothing publishes only because Scout suggested it.</h3>
                    <p>
                      Scout may prepare a listing proposal from the conversation, but the seller
                      must review the destination, fill the category requirements, and explicitly
                      confirm publication.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Request, compare, and connect</strong>
                  <small>
                    Interest becomes a protected request instead of exposing private contact
                    immediately.
                  </small>
                </summary>
                <div className="exchange-grid">
                  <article>
                    <span>Buyer or requester</span>
                    <h3>Ask about the specific listing.</h3>
                    <p>
                      The request can carry the listing, message, offer amount when relevant, and
                      the information the seller needs to decide whether to continue.
                    </p>
                  </article>
                  <article>
                    <span>Seller or business</span>
                    <h3>Review the item-specific request first.</h3>
                    <p>
                      The seller can see which listing prompted the inquiry and respond inside the
                      connected conversation instead of receiving an unexplained call or resold
                      lead.
                    </p>
                  </article>
                  <article>
                    <span>Trust</span>
                    <h3>Keep verification and marketplace history near the decision.</h3>
                    <p>
                      Seller identity, verification, CVS eligibility, listing evidence,
                      recommendations, response behavior, and prior outcomes can inform the decision
                      without pretending to guarantee the item or transaction.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Complete and track the outcome</strong>
                  <small>Keep sale, fulfillment, and payout progress with the listing.</small>
                </summary>
                <div className="exchange-grid">
                  <article>
                    <span>Local handoff</span>
                    <h3>Use pickup or local delivery when that fits.</h3>
                    <p>
                      The listing can make location and handoff expectations clear before the buyer
                      and seller commit to the exchange.
                    </p>
                  </article>
                  <article>
                    <span>Shipping</span>
                    <h3>Carry the fulfillment steps forward.</h3>
                    <p>
                      Eligible sold orders can retain the shipping quote, label, tracking number,
                      in-transit status, delivery status, and payout reconciliation.
                    </p>
                  </article>
                  <article>
                    <span>Record</span>
                    <h3>Close the listing without erasing what happened.</h3>
                    <p>
                      The seller can mark the listing sold, follow the order lifecycle, and keep the
                      conversation and outcome available for marketplace history and later support.
                    </p>
                  </article>
                </div>
              </details>

              <details className="content-section">
                <summary>
                  <strong>Manage listings, inquiries, promotions, and orders</strong>
                  <small>
                    Give sellers one operating view instead of separate marketplace tools.
                  </small>
                </summary>
                <div className="exchange-grid">
                  <article>
                    <span>Listings</span>
                    <h3>See active and pending inventory.</h3>
                    <p>
                      Create a listing, review its status, edit the offer where supported, and mark
                      it sold when the exchange is complete.
                    </p>
                  </article>
                  <article>
                    <span>Inquiries and messages</span>
                    <h3>Keep buyer interest tied to the item.</h3>
                    <p>
                      New inquiries, Exchange conversations, unread activity, and follow-up remain
                      attached to the listing that caused them.
                    </p>
                  </article>
                  <article>
                    <span>Promotions and TradeDeals</span>
                    <h3>Separate offers from organic trust.</h3>
                    <p>
                      Business promotions and partner offers can appear in Exchange with their
                      terms, dates, codes, and sponsorship or affiliate context identified. Payment
                      cannot buy CVS or manufacture a recommendation.
                    </p>
                  </article>
                  <article>
                    <span>Orders</span>
                    <h3>Follow open sold-item work.</h3>
                    <p>
                      The seller dashboard can separate listings, inquiries, messages, and open
                      orders so each part of the transaction has a clear next action.
                    </p>
                  </article>
                </div>
              </details>

              <div className="exchange-boundary">
                <strong>
                  Exchange helps organize the decision and transaction; it does not certify every
                  item.
                </strong>
                <p>
                  Buyers and sellers still confirm condition, authenticity, title or ownership,
                  legality, safety, delivery, taxes, disclosures, and any category-specific
                  professional or government requirements.
                </p>
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">06</span>
            <span className="stack-label">
              <strong>Money</strong>
              <small>
                See what stays free, how revenue works, and what businesses may choose to buy.
              </small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="trust-section" id="money" aria-labelledby="money-title">
              <div className="trust-copy">
                <span className="section-kicker">How money works</span>
                <h2 id="money-title">
                  TradeScout earns money without selling leads, trust, ranking, or contact
                  information.
                </h2>
                <p>
                  Core access, standard profiles, requests, and connections are free. TradeScout
                  earns through disclosed transaction fees, qualifying partner revenue, optional
                  profile and marketing services, branded product sales, and labeled sponsorships.
                </p>
              </div>
              <div className="trust-cards">
                <article
                  className="subchapter-active"
                  data-subchapter-group="money"
                  data-subchapter="affiliate"
                >
                  <span>For every account</span>
                  <h3>Affiliate attribution is automatic.</h3>
                  <p>
                    When a signed-in account shares a TradeScout link, its referral code is
                    attached. If someone joins through that link and later generates qualifying
                    TradeScout revenue, the program attributes 5% to the referrer, 5% to community
                    vaults, and 5% to trade and culinary scholarships.
                  </p>
                  <div>
                    <i>No signup fee</i>
                    <i>No fee to share</i>
                    <i>Revenue event required</i>
                  </div>
                </article>
                <article data-subchapter-group="money" data-subchapter="revenue">
                  <span>For TradeScout</span>
                  <h3>The platform earns at specific money events.</h3>
                  <p>
                    The current purchase rule is a flat $1 TradeScout fee on an on-platform
                    purchase. TradeScout can also earn commission from qualifying partner offers and
                    revenue from approved, clearly labeled sponsor or advertising relationships.
                    None of those payments can buy CVS, organic ranking, request routing, or contact
                    information.
                  </p>
                  <div>
                    <i>$1 purchase fee</i>
                    <i>Partner commission</i>
                    <i>Labeled sponsorship</i>
                  </div>
                </article>
                <article
                  className="express-profile-card"
                  data-subchapter-group="money"
                  data-subchapter="business-spend"
                >
                  <span>For businesses — optional paid service</span>
                  <h3>Express Profile is an optional done-for-you service.</h3>
                  <p>
                    A business can still claim, create, and operate its standard TradeScout profile
                    for free. Express Profile pays for hands-on design, setup, and publishing of a
                    more customized branded presentation. The charge pays for that work—not CVS,
                    recommendations, organic ranking, request routing, leads, or access to contact
                    information.
                  </p>
                  <p>
                    Today the scope and price are agreed with the business before work begins.
                    Express Profile is not available through self-serve checkout yet.
                  </p>
                  <div>
                    <i>Optional</i>
                    <i>Scope and price disclosed first</i>
                    <i>No trust advantage</i>
                  </div>
                </article>
                <article
                  className="caveat-card business-affiliate-card"
                  data-subchapter-group="money"
                  data-subchapter="business-spend"
                >
                  <span>For businesses — planned, not active</span>
                  <h3>A business will be able to pay only for an agreed result.</h3>
                  <p>
                    A business would choose whether to participate and agree to the event that
                    creates a charge. That could be a defined click, redemption, signup, purchase,
                    or another measured outcome. The event types, rates, billing, and settlement
                    rules have not been set up yet, so TradeScout is not charging businesses through
                    this model today.
                  </p>
                  <div>
                    <i>Business chooses</i>
                    <i>Cost event agreed first</i>
                    <i>No paid ranking</i>
                  </div>
                </article>
                <article
                  className="scoutfitters-card"
                  data-subchapter-group="money"
                  data-subchapter="scoutfitters"
                >
                  <div>
                    <span>ScoutFitters — products and services</span>
                    <h3>Brand purchases help subsidize the TradeScout ecosystem.</h3>
                    <p>
                      ScoutFitters sells useful brand products and marketing services instead of
                      charging people for TradeScout access. Its current self-serve tool lets a
                      business upload a logo, preview placement, and order configured branded
                      workwear.
                    </p>
                  </div>
                  <div className="scoutfitters-offers">
                    <strong>Also available by request</strong>
                    <ul>
                      <li>Metal business cards and NFC business cards</li>
                      <li>Engraved, printed, and other custom-branded products</li>
                      <li>Marketing services, social marketing plans, and related brand support</li>
                    </ul>
                    <p>
                      The product or service, scope, and price are disclosed before purchase.
                      Revenue helps fund the wider ecosystem; buying from ScoutFitters cannot
                      improve CVS, recommendations, ranking, routing, or contact access.
                    </p>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">07</span>
            <span className="stack-label">
              <strong>Community</strong>
              <small>
                Follow vaults, scholarships, jobs, helpers, veterans, and local reinvestment.
              </small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="impact-section" id="impact" aria-labelledby="impact-title">
              <div className="impact-heading">
                <span className="section-kicker">Community reinvestment and opportunity</span>
                <h2 id="impact-title">Local activity should create more than a transaction.</h2>
                <p>
                  TradeScout is designed to keep useful work, money, evidence, and opportunity
                  circulating through the communities that created them. The current product, stated
                  initiatives, and planned programs are separated below so support for the mission
                  is never mistaken for a guarantee that a program has already launched.
                </p>
              </div>
              <div className="impact-grid">
                <article
                  className="subchapter-active"
                  data-subchapter-group="community"
                  data-subchapter="vaults"
                >
                  <span>Community vaults and Community Builders</span>
                  <h3>Show what came in and help decide where it can do local good.</h3>
                  <p>
                    Community vaults keep local contributions visible and connected to local
                    efforts. Community Builders can review needs, propose or support efforts, and
                    help direct funding. The broader cause structure includes education, health,
                    housing, food access, youth and elder support, environmental work, public
                    spaces, emergency relief, and veteran support.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="education">
                  <span>Trade and culinary scholarships</span>
                  <h3>Help more people afford training, tools, and a path into skilled work.</h3>
                  <p>
                    Scholarship funding is intended to reduce the cost of education and training in
                    the skilled trades and culinary fields. The longer-term pathway includes school
                    and apprenticeship relationships, tools and training materials, mentors, and
                    connections from training into job opportunities. A school partner, recipient,
                    award, or distribution process should not be treated as confirmed until
                    TradeScout names it publicly.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="education">
                  <span>Trade-Up For Trade Schools</span>
                  <h3>
                    Trade one carpenter&apos;s pencil toward $250,000 in trade-school scholarships.
                  </h3>
                  <p>
                    Trade-Up For Trade Schools is a TradeScout-run video and content series. It
                    starts with one TradeScout carpenter&apos;s pencil and follows consecutive
                    accepted swaps toward a $250,000 scholarship goal. The pencil is the current
                    starting item; verified updates are added as trades occur. It is an independent
                    TradeScout initiative and does not imply a school endorsement, selected
                    recipient, or finished distribution process.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="work">
                  <span>Hiring and employment</span>
                  <h3>Let employers post work and let people show that they are available.</h3>
                  <p>
                    The Employment Board supports job posts and resume posts. Employers can include
                    the work, place, trade, and pay range, then review applicants and shortlist or
                    decline them. People can browse openings, apply with a message, post a resume,
                    and withdraw. A complete applicant-tracking workspace is not finished yet.
                    Identity and address checks protect actions that require verified participation.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="work">
                  <span>Helpers and odd jobs</span>
                  <h3>
                    Treat useful people as first-class participants, even when the work is not a
                    licensed trade.
                  </h3>
                  <p>
                    Helpers are people with skills and availability for odd jobs, gig work,
                    non-licensed labor, cleanup, moving, yard work, furniture assembly, seasonal
                    tasks, job-site support, and crew overflow. They can respond through the same
                    request and outcome system instead of being pushed into an unrelated lead
                    marketplace. Work that legally requires a license still requires it.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="veterans">
                  <span>Veteran work and training</span>
                  <h3>
                    Build paths from service into local work, retraining, and business ownership.
                  </h3>
                  <p>
                    TradeScout&apos;s stated community direction includes veteran job opportunities,
                    tools, retraining, job placement support, and connections into skilled work.
                    Veterans can use the current Employment Board, helper work, business profiles,
                    and Direct Connect paths. Dedicated veteran training partners, program terms,
                    and guaranteed placements are not published as an active standalone program yet.
                  </p>
                </article>
                <article data-subchapter-group="community" data-subchapter="loop">
                  <span>The intended loop</span>
                  <h3>
                    Work creates history; history creates trust; revenue helps create the next
                    opportunity.
                  </h3>
                  <p>
                    A requester finds help, both sides choose the connection, the outcome improves
                    future recommendations, the business keeps more of what it earns, and qualifying
                    revenue can support referrers, local efforts, education, training, and future
                    workers. That is the community purpose behind connecting the tools instead of
                    selling isolated leads.
                  </p>
                </article>
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">08</span>
            <span className="stack-label">
              <strong>CVS</strong>
              <small>Understand what affects Community Verification Score and eligibility.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="cvs-section" id="trust" aria-labelledby="trust-title">
              <div className="section-heading cvs-heading">
                <span className="section-kicker">Community Verification Score (CVS)</span>
                <h2 id="trust-title">Trust affects where an account appears and what it can do.</h2>
                <p>
                  Community Verification Score is not a star rating or a payment tier. It uses
                  verification, responsiveness, completed outcomes, recommendations, marketplace
                  history, and risk signals to decide where an account can appear and which actions
                  it is eligible to take.
                </p>
              </div>
              <div className="cvs-summary-grid">
                <article
                  className="subchapter-active"
                  data-subchapter-group="cvs"
                  data-subchapter="overview"
                >
                  <span>What it changes</span>
                  <h3>Who can appear, where they appear, and what they can do.</h3>
                  <p>
                    CVS can affect Scout ordering, Direct Connect eligibility, Exchange visibility,
                    Community standing, maps, directories, and other places where verified trust
                    matters.
                  </p>
                </article>
                <article
                  className="subchapter-active"
                  data-subchapter-group="cvs"
                  data-subchapter="overview"
                >
                  <span>The four outcomes</span>
                  <h3>Eligible, limited, restricted, or blocked.</h3>
                  <p>
                    A strong score in one area cannot erase a missing required credential, a
                    suspended verification, or an active risk condition in another.
                  </p>
                </article>
                <article
                  className="subchapter-active"
                  data-subchapter-group="cvs"
                  data-subchapter="overview"
                >
                  <span>What it does not promise</span>
                  <h3>Evidence improves the decision; it does not guarantee the outcome.</h3>
                  <p>
                    CVS cannot promise price, quality, availability, or fit. The requester and
                    business still make those decisions.
                  </p>
                </article>
              </div>

              <div className="cvs-rules">
                <article
                  className="cvs-rule-card positive-rule"
                  data-subchapter-group="cvs"
                  data-subchapter="activity"
                >
                  <span>What can raise the current score</span>
                  <h3>Verified activity earns points.</h3>
                  <ul>
                    <li>Completed jobs: +2 each, up to +12</li>
                    <li>People helped: +1 each, up to +5</li>
                    <li>Active weeks: +1 to +4; recent activity: +1 or +2</li>
                    <li>Timely request responses, including accepts or declines: +1 to +3</li>
                    <li>Approved public positive recommendations: +2 each, up to +10</li>
                    <li>
                      Delivered orders: up to +5; verified-purchase positive reviews: up to +5
                    </li>
                  </ul>
                </article>
                <article
                  className="cvs-rule-card negative-rule"
                  data-subchapter-group="cvs"
                  data-subchapter="activity"
                >
                  <span>What can lower the current score</span>
                  <h3>Problems remain attached to the history.</h3>
                  <ul>
                    <li>Approved public negative recommendations: −5 each, up to −20</li>
                    <li>Verified-purchase negative reviews: −3 each, up to −12</li>
                    <li>Active disputes: −4 each, up to −12</li>
                    <li>Activity older than a year after prior participation: −2</li>
                    <li>Confirmed low external reputation can apply a small −3 or −6 adjustment</li>
                  </ul>
                </article>
                <article
                  className="cvs-rule-card gate-rule"
                  data-subchapter-group="cvs"
                  data-subchapter="proof"
                >
                  <span>What can cap or stop eligibility</span>
                  <h3>
                    Missing required proof can stop access, even when other signals are strong.
                  </h3>
                  <ul>
                    <li>Rejected or suspended verification sets the score to 0</li>
                    <li>An unverified address normally sets the score to 0</li>
                    <li>
                      A service provider missing required approved license or insurance evidence
                      scores 0
                    </li>
                    <li>A profile that is not fully approved is capped below 50</li>
                    <li>
                      Expired credentials create risk flags and can stop new request eligibility
                    </li>
                  </ul>
                </article>
              </div>

              <div className="cvs-boundaries">
                <article data-subchapter-group="cvs" data-subchapter="outside">
                  <span>Outside evidence</span>
                  <h3>Useful, labeled, and limited.</h3>
                  <p>
                    For a non-service business, a confirmed public listing and enough outside
                    history can provide a limited starting score. Confirmed external ratings can
                    currently adjust performance by +1, +3, or +5—or −3 or −6. They never become
                    TradeScout work history and never replace required identity, address, license,
                    or insurance proof.
                  </p>
                </article>
                <article data-subchapter-group="cvs" data-subchapter="outside">
                  <span>Temporary points for verified launch evidence</span>
                  <h3>Audited and never purchased.</h3>
                  <p>
                    Current policy can temporarily add +10 for a fully verified profile launch, +5
                    for a named operator who confirms the business firsthand, or +5 for at least
                    five attributable portfolio examples. Each grant records its evidence and
                    expires after 90 or 180 days.
                  </p>
                </article>
                <article
                  className="no-money-card"
                  data-subchapter-group="cvs"
                  data-subchapter="money"
                >
                  <span>What never affects CVS</span>
                  <h3>Money cannot buy trust.</h3>
                  <p>
                    Subscriptions, advertising, sponsorship, affiliate participation, transaction
                    fees, and paid promotion cannot improve CVS, organic ordering, request routing,
                    or contact access. Profile display choices also stay separate from CVS scoring.
                  </p>
                </article>
              </div>
            </section>
          </div>
        </details>

        <details className="explainer-stack">
          <summary>
            <span className="stack-number">09</span>
            <span className="stack-label">
              <strong>Every feature</strong>
              <small>Open the complete action-based feature inventory.</small>
            </span>
          </summary>
          <div className="explainer-stack-body">
            <section className="system-section" id="system" aria-labelledby="system-title">
              <div className="section-heading system-heading">
                <span className="section-kicker">Feature inventory</span>
                <h2 id="system-title">Everything TradeScout helps you do.</h2>
              </div>
              {featureGroups.map((group) => (
                <div
                  className={`tool-group${group.number === "01" ? " subchapter-active" : ""}`}
                  data-subchapter-group="features"
                  data-subchapter={group.number}
                  key={group.number}
                >
                  <div className="tool-group-title">
                    <span>{group.number}</span>
                    <strong>{group.title}</strong>
                  </div>
                  <div className="public-tool-grid">
                    {group.features.map((feature, index) => {
                      const promiseId = `${group.number}.${String(index + 1).padStart(2, "0")}`;
                      return (
                        <article key={promiseId} data-about-promise-id={promiseId}>
                          <details>
                            <summary>
                              <span className="tool-number">
                                {group.number}.{String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="tool-action">{feature.action}</span>
                              <strong>{feature.name}</strong>
                            </summary>
                            <p>{feature.copy}</p>
                            <a href={feature.href} data-about-action-link={promiseId}>
                              Open {feature.name}
                            </a>
                          </details>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </details>
      </div>

      <footer>
        <div className="brand">
          <span className="brand-mark">TS</span>
          <span className="brand-name">
            Trade<strong>Scout</strong>
          </span>
        </div>
        <p>Connection Without Compromise</p>
      </footer>
    </main>
  );
}
