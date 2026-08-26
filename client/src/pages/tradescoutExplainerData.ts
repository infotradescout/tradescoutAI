export type ExplainerCard = {
  eyebrow?: string;
  title: string;
  body?: string;
  bullets?: readonly string[];
  chips?: readonly string[];
  tone?: "positive" | "warning" | "gated" | "accent";
};

export type ExplainerMoment = {
  number: string;
  title: string;
  requester: ExplainerCard;
  business: ExplainerCard;
};

export type ExplainerFeature = {
  number: string;
  action: string;
  name: string;
  description: string;
};

export type ExplainerTopic = {
  id: string;
  label: string;
  intro?: ExplainerCard;
  cards?: readonly ExplainerCard[];
  moments?: readonly ExplainerMoment[];
  features?: readonly ExplainerFeature[];
};

export type ExplainerChapter = {
  id: string;
  number: string;
  navLabel: string;
  kicker: string;
  title: string;
  description?: string;
  boundary?: string;
  topics: readonly ExplainerTopic[];
};

export const explainerChapters: readonly ExplainerChapter[] = [
  {
    id: "scout",
    number: "01",
    navLabel: "Scout",
    kicker: "The Scout page",
    title: "One question can create value for both sides.",
    description:
      "Scout helps a requester understand a need and choose a next step. It also helps a business use TradeScout, be considered for work that fits, and receive a clearer request when the requester chooses to send one. Scout recommends and prepares; both sides still approve the action.",
    boundary:
      "Scout does not make the final decision for either side. It cannot guarantee price, quality, availability, legality, safety, or fit. It does not silently contact, hire, publish, submit, or pay. The requester and business remain responsible for reviewing the information and approving the action that affects them.",
    topics: [
      {
        id: "understand",
        label: "Understand the need",
        moments: [
          {
            number: "01",
            title: "Clarify the need",
            requester: {
              title: "Start in ordinary language.",
              body: "Describe the problem, goal, product, property, event, job, or decision without knowing the correct category first. Scout asks for the missing details that would materially change the answer.",
            },
            business: {
              title: "Receive a need that is easier to judge.",
              body: "When the requester proceeds, the business can receive clearer work, timing, location, budget, urgency, and fit information instead of a vague call or empty contact form.",
            },
          },
          {
            number: "02",
            title: "Compare the paths",
            requester: {
              title: "See more than one reasonable answer.",
              body: "Compare hiring, doing it yourself, buying, renting, booking, posting, requesting, or waiting when those are valid choices. Scout can put the strongest path first without hiding the alternatives.",
            },
            business: {
              title: "Compete on fit instead of purchased position.",
              body: "A business can be considered because its offer, location, availability, verification, recommendations, and outcome history fit the need—not because it bought a higher rank.",
            },
          },
        ],
      },
      {
        id: "control",
        label: "Explain and prepare",
        moments: [
          {
            number: "03",
            title: "Explain the recommendation",
            requester: {
              title: "Understand why an option fits.",
              body: "See the useful evidence, local context, tradeoffs, missing information, and checks that matter before acting. A recommendation is a supported starting point, not an unexplained command.",
            },
            business: {
              title: "Let the maintained business record speak.",
              body: "The profile, offers, service area, current availability, verified proof, recommendations, response history, and completed outcomes can help explain why the business belongs in the answer.",
            },
          },
          {
            number: "04",
            title: "Keep control",
            requester: {
              title: "Review before anything is sent.",
              body: "Scout can prepare a request, listing draft, post, or other next step, but the requester reviews it and chooses whether to continue, who should receive it, and what information is included.",
            },
            business: {
              title: "A recommendation is not permission to interrupt.",
              body: "Being shown by Scout does not expose private contact information or create a blind call. A selected business reviews a submitted request before direct contact opens.",
            },
          },
          {
            number: "05",
            title: "Move into action",
            requester: {
              title: "Carry the answer into the next tool.",
              body: "Useful context can become a prepared Direct Connect request, Exchange listing draft, HomeID action, community post, saved comparison, or another reviewable next step without starting over.",
            },
            business: {
              title: "Receive context, not a resold name.",
              body: "The chosen business gets a structured opportunity tied to the original need. TradeScout does not charge the business for the lead or broadcast the same private contact to a crowd.",
            },
          },
        ],
      },
      {
        id: "complete",
        label: "Carry context forward",
        moments: [
          {
            number: "06",
            title: "Prepare the next action",
            requester: {
              title: "Start the next tool with the answer already attached.",
              body: "Review a prepared request, listing draft, HomeID action, community post, saved comparison, booking step, or purchase path without describing the same need again.",
            },
            business: {
              title: "Receive the context the requester approved.",
              body: "If the requester chooses the business, the prepared action can carry the relevant scope, timing, location, evidence, and constraints forward instead of becoming an empty lead.",
            },
          },
          {
            number: "07",
            title: "Use connected context",
            requester: {
              title: "Bring the relevant history forward.",
              body: "Scout can use selected HomeID context, prior conversation, saved work, nearby activity, recommendations, listings, events, and current proof when that information belongs in the decision.",
            },
            business: {
              title: "Keep business information useful everywhere.",
              body: "Updating the profile, offer, service area, availability, verification, or completed work improves the source Scout can use instead of forcing the business to maintain a separate answer for every search.",
            },
          },
        ],
      },
      {
        id: "operate",
        label: "Operate and promote",
        moments: [
          {
            number: "08",
            title: "Use Scout as a business tool",
            requester: {
              title: "Ask for help across daily decisions.",
              body: "A requester can use Scout for local help, products, property, projects, employment, community activity, events, trust checks, price factors, and what to do next.",
            },
            business: {
              title: "Ask what the business should do next.",
              body: "A business owner can use Scout to review profile gaps, verification needs, offers, customer requests, materials, local demand signals, property work, finances, and the next available operating step.",
            },
          },
          {
            number: "09",
            title: "Match promotion to the need",
            requester: {
              title: "See useful options at the useful moment.",
              body: "When the need calls for a product, service, material, booking, or local offer, Scout can include a relevant option in the decision instead of filling the page with promotions unrelated to the question.",
            },
            business: {
              title: "Put the offer where it can actually help.",
              body: "A business can describe what it sells, where it applies, who it fits, and when it is available. Scout can bring that offer forward when the active need matches it. Any paid, sponsored, or affiliate placement stays identified and cannot buy a recommendation, CVS, or false fit.",
            },
          },
        ],
      },
      {
        id: "improve",
        label: "Improve the next result",
        moments: [
          {
            number: "10",
            title: "Improve the next result",
            requester: {
              title: "Leave useful evidence for the next requester.",
              body: "The recommendation, request, response, completed outcome, and later positive or negative recommendation can make the next answer more informed.",
            },
            business: {
              title: "Earn stronger discovery through participation.",
              body: "Timely responses, completed work, verified purchases, recommendations, current proof, and resolved problems can improve future trust and fit. Payment cannot manufacture that history.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "connect",
    number: "02",
    navLabel: "Requests & contact",
    kicker: "Direct Connect",
    title: "A request becomes contact only after both sides choose it.",
    description:
      "Direct Connect owns the request, preview, acceptance, contact, and outcome. It is not a lead list, an open contact form, or permission to interrupt someone because Scout mentioned a business.",
    boundary:
      "Direct Connect does not create a contract, guarantee payment or performance, replace emergency services, or remove licensing, insurance, inspection, safety, disclosure, or legal responsibilities.",
    topics: [
      {
        id: "prepare",
        label: "Prepare the request",
        moments: [
          {
            number: "01",
            title: "Prepare the request",
            requester: {
              title: "Define the need before sending it.",
              body: "Review the outcome, scope, place, timing, urgency, budget information, photos, documents, property context, and anything else the recipient needs to judge the request.",
            },
            business: {
              title: "Nothing arrives while the request is still a draft.",
              body: "A search, comparison, or recommendation does not create a lead. The business receives nothing until the requester approves the request and chooses where it should go.",
            },
          },
        ],
      },
      {
        id: "choose",
        label: "Choose recipients",
        moments: [
          {
            number: "02",
            title: "Choose recipients",
            requester: {
              title: "Choose who may review the request.",
              body: "Use recommendations, profile evidence, service area, availability, CVS, credentials, and fit to choose a business. Sending to more than one business remains an explicit requester choice, not an automatic broadcast.",
            },
            business: {
              title: "Appear because the request fits.",
              body: "Eligibility can depend on the offer, location, availability, current proof, category requirements, recommendations, outcomes, and CVS. Payment cannot buy inclusion or priority.",
            },
          },
        ],
      },
      {
        id: "preview",
        label: "Preview before contact",
        moments: [
          {
            number: "03",
            title: "Preview before contact",
            requester: {
              title: "See what will be shared before it leaves.",
              body: "The requester reviews the recipient and the information packet. Unrelated Home Vault records, private documents, and contact details stay out unless the requester deliberately includes or authorizes them.",
            },
            business: {
              title: "Judge the opportunity before exposing direct contact.",
              body: "The business can review the supplied scope, timing, location context, evidence, and constraints before accepting. This reduces blind calls, vague inquiries, poor-fit work, and time spent chasing a resold name.",
            },
          },
        ],
      },
      {
        id: "accept",
        label: "Accept or decline",
        moments: [
          {
            number: "04",
            title: "Accept or decline",
            requester: {
              title: "Receive a decision instead of losing control of the request.",
              body: "If a business declines or does not fit, the requester can keep the request, revise it, or choose another recipient. A decline does not release private contact information.",
            },
            business: {
              title: "Accept suitable work or decline it without buying the lead.",
              body: "The response becomes part of the request history. Timely accepts and declines can support responsiveness signals; silence and repeated poor handling can affect future eligibility.",
            },
          },
        ],
      },
      {
        id: "work",
        label: "Work and outcome",
        moments: [
          {
            number: "05",
            title: "Work and outcome",
            requester: {
              title: "Keep the conversation, decision, payment, and result with the need.",
              body: "Messages, quotes, bookings, purchases, work steps, payment records, completion evidence, disputes, and the final recommendation can stay attached instead of being rebuilt across disconnected services.",
            },
            business: {
              title: "Turn an accepted request into an operating record.",
              body: "Clients, jobs, materials, estimates, invoices, receipts, follow-ups, delivery proof, and completed outcomes can improve the business record and future recommendations when the evidence supports them.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "businesses",
    number: "03",
    navLabel: "Business home",
    kicker: "What is different about TradeScout",
    title: "A working business home, not another page on the internet.",
    description:
      "TradeScout is for the full small-business economy—not only contractors. A restaurant, retailer, service company, shop, practice, maker, or professional can be found, checked, chosen, contacted, and paid through one connected system.",
    topics: [
      {
        id: "rollout",
        label: "How category tools work",
        cards: [
          {
            eyebrow: "Built around the business",
            title: "Business-category tools are rolling out every day.",
            body: "TradeScout adds tools around how each kind of business actually operates, so each profile can replace more of the separate software that kind of business pays for today.",
            tone: "accent",
          },
        ],
      },
      {
        id: "service",
        label: "Service businesses",
        cards: [
          {
            eyebrow: "Service businesses",
            title: "Move from request to completed work.",
            body: "Profile offers, service areas, proof, Direct Connect requests, estimates, jobs, materials, invoices, payment records, licensing, insurance, and completed-work history.",
          },
        ],
      },
      {
        id: "shops",
        label: "Restaurants, shops, and sellers",
        cards: [
          {
            eyebrow: "Restaurants, retail, makers, and sellers",
            title: "Turn discovery into an order or visit.",
            body: "Profiles, hours, locations, recommendations, fixed-price items or services, bookings, purchases, promotions, and Exchange categories including local food and handmade goods.",
          },
        ],
      },
      {
        id: "property",
        label: "Property professionals",
        cards: [
          {
            eyebrow: "Realtors and property professionals",
            title: "Connect the listing to the property record.",
            body: "Property listings, clients, market analysis, comparative market analysis, appointments, contacts, inspections, repair decisions, and the history that follows the asset.",
          },
        ],
      },
      {
        id: "vehicles",
        label: "Vehicle sellers",
        cards: [
          {
            eyebrow: "Vehicle sellers",
            title: "Manage more than the listing.",
            body: "Vehicle listings, customer follow-up, financing steps, trade-in information, VIN lookup, appointments, and the conversations that move a buyer toward a decision.",
          },
        ],
      },
      {
        id: "groups",
        label: "Managers, HOAs, and groups",
        cards: [
          {
            eyebrow: "Property managers, HOAs, and groups",
            title: "Keep shared responsibilities visible.",
            body: "Residents, members, maintenance requests, violations, documents, vendors, votes, finances, community posts, and the decisions tied to a shared place.",
          },
        ],
      },
      {
        id: "employment",
        label: "Employers, workers, and helpers",
        cards: [
          {
            eyebrow: "Employers, workers, and helpers",
            title: "Connect available work with available people.",
            body: "Job posts, resume posts, pay ranges, applications, shortlists, helper profiles, odd jobs, crew needs, job-site support, and direct replies after the right checks.",
          },
        ],
      },
      {
        id: "replace-stack",
        label: "Replace the website stack",
        intro: {
          eyebrow: "Selective Inheritance",
          title: "Keep your domain. Replace the website and the pile of services behind it.",
          body: "Your existing domain should point directly to your TradeScout business profile. That profile becomes your public business home inside the same system people use to find you, check your proof, contact you, send a request, choose what happens next, and handle payment-related steps.",
        },
        cards: [
          {
            eyebrow: "The stack businesses pay for now",
            title: "Disconnected pieces of one customer journey.",
            bullets: [
              "A website, hosting, forms, listings, messaging, lead services, and payment add-ons",
              "The same business information maintained in several places",
              "Separate bills for disconnected pieces of one customer journey",
              "A domain that sends people to a page with no connection to the rest of the process",
            ],
          },
          {
            eyebrow: "TradeScout as the business home",
            title: "One maintained profile that keeps working.",
            bullets: [
              "Your existing domain points straight to one maintained profile",
              "One profile supports discovery, proof, contact, requests, decisions, and payments",
              "Useful facts and media can move over with their source and check date attached",
              "Stop paying another vendor for any job TradeScout already provides",
            ],
            tone: "accent",
          },
        ],
      },
    ],
  },
  {
    id: "property",
    number: "04",
    navLabel: "Home & property",
    kicker: "HomeID, HomeScout, and 1 Tap Sale",
    title: "The property keeps its history. The owner controls what happens next.",
    description:
      "HomeID is the durable property record. HomeScout is the discovery, listing, and action side. Direct Connect turns a property need into work, then verified results can improve the HomeID. 1 Tap Sale begins the selling path from information the owner has already kept.",
    topics: [
      {
        id: "record",
        label: "HomeID and the private record",
        cards: [
          {
            eyebrow: "HomeID",
            title: "Give the property an identity that lasts longer than one owner.",
            body: "HomeID belongs to the property identity, not to a username. Owners and other authorized people receive time-scoped authority over it. When ownership changes, the identity and allowed history can continue while the prior owner's private information stays private. A property manager can receive only the authority needed to maintain the property without being treated as the owner.",
          },
          {
            eyebrow: "The private Home Vault",
            title: "Keep the details that are expensive to reconstruct later.",
            body: "An owner can keep property details, systems and appliances, models and serial numbers, maintenance, upgrades, inspections, costs, warranties, documents, photos, evidence, maintenance schedules, projects, build milestones, and a completed-work timeline. Authorized professionals can start with what the owner has approved instead of rebuilding the property story from scattered files and memory.",
          },
          {
            eyebrow: "Physical HomeID NFC card",
            title: "Carry a tap-to-open access point when the property record is needed on the go.",
            body: "Use a compatible phone to open an owner-approved HomeID view during a listing appointment, walkthrough, inspection, maintenance visit, or vendor handoff. The tap never makes the entire private Home Vault public; the owner still chooses what to share.",
          },
        ],
      },
      {
        id: "work",
        label: "Requests and inspections",
        cards: [
          {
            eyebrow: "From record to request",
            title: "Use the property history to ask for the right work.",
            body: "The owner chooses which HomeID details belong in a request, previews the packet, and creates a Direct Connect draft. Nothing is sent just because the record exists. The chosen business sees useful context without receiving unrelated private property information.",
          },
          {
            eyebrow: "From completed work back to HomeID",
            title: "Let verified work improve the property memory.",
            body: "Estimates, invoices, receipts, inspections, maintenance, upgrades, completion evidence, and other approved records can be linked to the property. Evidence and verification rules decide what becomes part of the timeline.",
          },
          {
            eyebrow: "Inspection intelligence and expedited follow-up",
            title: "Reduce the time between a question, usable evidence, and the right follow-up.",
            body: "TradeScout is building guided, evidence-linked workflows for permit inspections, home inspections, insurance claims, pre-sale review, item valuation, and equipment condition. TradeScout cannot approve a permit, guarantee a faster appointment, replace an official inspection, or turn general guidance into local authority.",
          },
        ],
      },
      {
        id: "sale",
        label: "HomeScout and selling",
        cards: [
          {
            eyebrow: "HomeScout",
            title: "Turn property information into discovery and action.",
            body: "HomeScout connects property listings with Exchange discovery, inspection and repair decisions, Direct Connect work, and the HomeID that should survive the transaction. A HomeID can exist without a public listing; a listing is an action taken from the record, not the record itself.",
          },
          {
            eyebrow: "1 Tap Sale",
            title: "Start the sale without rebuilding the property from scratch.",
            body: "1 Tap Sale uses saved HomeID and Home Vault information to start a HomeScout listing draft. It does not complete a property sale in one tap. The owner reviews the listing, chooses what becomes public, supplies anything missing, and controls submission and transfer.",
          },
          {
            eyebrow: "Transfer without oversharing",
            title: "Carry the useful property record forward, not the prior owner's private life.",
            body: "A sale or approved handoff closes the old authority window and opens the new one. The transfer packet is explicit and filtered by visibility rules. Private owner data does not automatically transfer with the home.",
          },
          {
            eyebrow: "AssetID direction",
            title: "Use HomeID as the first durable asset record.",
            body: "The larger design is an AssetID pattern for records that can outlast individual owners. HomeID is the implemented starting point; future asset types will only claim the same depth when their history, authority, evidence, and transfer support actually exist.",
          },
        ],
      },
      {
        id: "realtor",
        label: "For realtors",
        intro: {
          eyebrow: "What this changes for a realtor",
          title:
            "Spend less time reconstructing the property and more time representing the client.",
          body: "HomeID does not replace the realtor. It gives an authorized realtor a cleaner starting point, better-supported answers, and a connected way to move from listing preparation to closing without taking control away from the owner.",
        },
        cards: [
          {
            title: "Prepare the listing faster",
            body: "Use owner-approved property facts, systems, upgrades, documents, and completed work instead of asking the seller to rebuild everything from memory.",
          },
          {
            title: "See what needs attention before launch",
            body: "Review missing details, inspection findings, maintenance history, and items that need verification before they become buyer questions.",
          },
          {
            title: "Coordinate sale preparation",
            body: "Turn repairs, cleanup, staging support, photos, or inspection follow-up into controlled Direct Connect requests with the right property context attached.",
          },
          {
            title: "Share better information during the appointment",
            body: "Use the physical HomeID NFC card or an owner-approved packet during a listing meeting, walkthrough, inspection, or buyer conversation.",
          },
          {
            title: "Support claims with dated evidence",
            body: "Separate documented systems, maintenance, upgrades, and completed work from unsupported marketing language.",
          },
          {
            title: "Carry the property through closing",
            body: "Prepare an explicit transfer packet so useful history can follow the home while private seller information stays out of the buyer handoff.",
          },
          {
            title: "Keep the client relationship connected",
            body: "Use realtor clients, market analysis, comparative market analysis, appointments, contacts, connections, and follow-up beside the property workflow.",
          },
          {
            title: "Explain what 1 Tap Sale actually saves",
            body: "It saves the first round of duplicate entry by starting a listing draft from HomeID; professional review, pricing, presentation, disclosure, and submission still matter.",
          },
        ],
      },
      {
        id: "manager",
        label: "For property managers",
        intro: {
          eyebrow: "What this changes for a property manager",
          title:
            "Manage the property from its history instead of a pile of disconnected work orders.",
          body: "A property manager can receive scoped authority to maintain the asset, coordinate vendors, and keep records current without becoming the owner or receiving every private owner record.",
        },
        cards: [
          {
            title: "Keep each property separate and durable",
            body: "Store systems, appliances, documents, inspections, completed work, and schedules with the property they belong to.",
          },
          {
            title: "Give vendors useful context",
            body: "Share the component, issue, prior work, access details, and selected evidence needed for the job without opening the entire owner vault.",
          },
          {
            title: "Turn maintenance into a controlled request",
            body: "Create and review a Direct Connect request from the property record, then choose who receives it and when contact opens.",
          },
          {
            title: "Use the NFC card during field work",
            body: "Tap the physical HomeID card at the property to reach an approved view or packet during inspection, maintenance, turnover, or vendor access.",
          },
          {
            title: "Track recurring work and costs",
            body: "Keep maintenance schedules, project planning, invoices, receipts, costs, warranties, and completion evidence attached to the asset.",
          },
          {
            title: "Coordinate HOA and shared-property work",
            body: "Connect residents, maintenance requests, violations, documents, approved vendors, votes, and finances where a managed community is involved.",
          },
          {
            title: "Prepare for sale or owner review",
            body: "Use the property history to explain condition, recent work, open items, and sale preparation without reconstructing years of management activity.",
          },
          {
            title: "Hand off management cleanly",
            body: "Close the prior manager's authority and open the next one while the allowed property history stays with the asset.",
          },
        ],
      },
      {
        id: "owner",
        label: "Owner-led sale",
        intro: {
          eyebrow: "When an owner does not want a realtor",
          title: "Use the same property history to lead the sale directly.",
          body: "TradeScout does not require a realtor to start a HomeScout listing. The owner can choose an owner-led path, use 1 Tap Sale to begin from HomeID, and bring in only the professional help they decide they need.",
        },
        cards: [
          {
            title: "Start without re-entering the property",
            body: "Use saved property facts, systems, upgrades, documents, photos, and completed work to prepare the first listing draft.",
          },
          {
            title: "Choose what buyers can see",
            body: "Publish selected listing information and share approved HomeID evidence without making the private Home Vault public.",
          },
          {
            title: "Prepare the property through Direct Connect",
            body: "Request inspection follow-up, repairs, cleanup, photography, moving help, or other sale preparation from selected businesses and helpers.",
          },
          {
            title: "Answer property questions with history",
            body: "Use dated maintenance, systems, appliances, documents, and completed-work records instead of relying only on memory or sales language.",
          },
          {
            title: "Share on site with the NFC card",
            body: "Open an owner-approved HomeID view or packet during a showing, walkthrough, inspection, or buyer conversation.",
          },
          {
            title: "Keep the choice to add representation later",
            body: "Invite an authorized realtor or another professional when that help becomes valuable without abandoning the existing record or listing work.",
          },
          {
            title: "Avoid paying for representation the owner does not want",
            body: "An owner-led path can avoid a representation fee that was never chosen. Other transaction, inspection, repair, title, closing, tax, or legal costs may still apply.",
          },
          {
            title: "Know what TradeScout does not replace",
            body: "TradeScout does not provide the owner's pricing judgment, required disclosures, negotiation, contract review, title work, closing services, inspections, or legal advice.",
          },
        ],
      },
    ],
  },
  {
    id: "money",
    number: "05",
    navLabel: "Money",
    kicker: "How money works",
    title: "TradeScout earns money without selling leads, trust, ranking, or contact information.",
    description:
      "Core access, standard profiles, requests, and connections are free. TradeScout earns through disclosed transaction fees, qualifying partner revenue, optional profile and marketing services, branded product sales, and labeled sponsorships.",
    topics: [
      {
        id: "affiliate",
        label: "Automatic affiliate split",
        cards: [
          {
            eyebrow: "For every account",
            title: "Affiliate attribution is automatic.",
            body: "When a signed-in account shares a TradeScout link, its referral code is attached. If someone joins through that link and later generates qualifying TradeScout revenue, the program attributes 5% to the referrer, 5% to community vaults, and 5% to trade and culinary scholarships.",
            chips: ["No signup fee", "No fee to share", "Revenue event required"],
          },
        ],
      },
      {
        id: "revenue",
        label: "How TradeScout earns",
        cards: [
          {
            eyebrow: "For TradeScout",
            title: "The platform earns at specific money events.",
            body: "The current purchase rule is a flat $1 TradeScout fee on an on-platform purchase. TradeScout can also earn commission from qualifying partner offers and revenue from approved, clearly labeled sponsor or advertising relationships. None of those payments can buy CVS, organic ranking, request routing, or contact information.",
            chips: ["$1 purchase fee", "Partner commission", "Labeled sponsorship"],
          },
        ],
      },
      {
        id: "business-spend",
        label: "Optional business spending",
        cards: [
          {
            eyebrow: "For businesses — optional paid service",
            title: "Express Profile is an optional done-for-you service.",
            body: "A business can still claim, create, and operate its standard TradeScout profile for free. Express Profile pays for hands-on design, setup, and publishing of a more customized branded presentation. The charge pays for that work—not CVS, recommendations, organic ranking, request routing, leads, or access to contact information.",
            chips: ["Optional", "Scope and price disclosed first", "No trust advantage"],
          },
          {
            eyebrow: "For businesses — planned, not active",
            title: "A business will be able to pay only for an agreed result.",
            body: "A business would choose whether to participate and agree to the event that creates a charge. Event types, rates, billing, and settlement rules have not been set up yet, so TradeScout is not charging businesses through this model today.",
            chips: ["Business chooses", "Cost event agreed first", "No paid ranking"],
            tone: "warning",
          },
        ],
      },
      {
        id: "scoutfitters",
        label: "ScoutFitters",
        cards: [
          {
            eyebrow: "ScoutFitters — products and services",
            title: "Brand purchases help subsidize the TradeScout ecosystem.",
            body: "ScoutFitters sells useful brand products and marketing services instead of charging people for TradeScout access. Its current self-serve tool lets a business upload a logo, preview placement, and order configured branded workwear.",
            bullets: [
              "Metal business cards and NFC business cards",
              "Engraved, printed, and other custom-branded products",
              "Marketing services, social marketing plans, and related brand support",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "impact",
    number: "06",
    navLabel: "Community",
    kicker: "Community reinvestment and opportunity",
    title: "Local activity should create more than a transaction.",
    description:
      "TradeScout is designed to keep useful work, money, evidence, and opportunity circulating through the communities that created them. Current products, stated initiatives, and planned programs stay clearly separated so support for the mission is never mistaken for a guarantee that a program has already launched.",
    topics: [
      {
        id: "vaults",
        label: "Community vaults",
        cards: [
          {
            eyebrow: "Community vaults and Community Builders",
            title: "Show what came in and help decide where it can do local good.",
            body: "Community vaults keep local contributions visible and connected to local efforts. Community Builders can review needs, propose or support efforts, and help direct funding across education, health, housing, food access, youth and elder support, environmental work, public spaces, emergency relief, and veteran support.",
          },
        ],
      },
      {
        id: "education",
        label: "Scholarships and Trade-Up",
        cards: [
          {
            eyebrow: "Trade and culinary scholarships",
            title: "Help more people afford training, tools, and a path into skilled work.",
            body: "Scholarship funding is intended to reduce the cost of education and training in skilled trades and culinary fields. A school partner, recipient, award, or distribution process is only confirmed when TradeScout names it publicly.",
          },
          {
            eyebrow: "Trade-Up For Trade Schools",
            title: "Trade one carpenter's pencil toward $250,000 in trade-school scholarships.",
            body: "The TradeScout-run series starts with one carpenter's pencil and follows consecutive accepted swaps toward the goal. Verified updates are added as trades occur; it does not imply a school endorsement, selected recipient, or finished distribution process.",
          },
        ],
      },
      {
        id: "work",
        label: "Jobs, resumes, and helpers",
        cards: [
          {
            eyebrow: "Hiring and employment",
            title: "Let employers post work and let people show that they are available.",
            body: "The Employment Board supports job posts and resume posts. Employers can include the work, place, trade, and pay range, then review applicants and shortlist or decline them. A complete applicant-tracking workspace is not finished yet.",
          },
          {
            eyebrow: "Helpers and odd jobs",
            title: "Treat useful people as first-class participants.",
            body: "Helpers can offer odd jobs, gig work, non-licensed labor, cleanup, moving, yard work, furniture assembly, seasonal tasks, job-site support, and crew overflow through the same request and outcome system. Work that legally requires a license still requires it.",
          },
        ],
      },
      {
        id: "veterans",
        label: "Veteran opportunity",
        cards: [
          {
            eyebrow: "Veteran work and training",
            title: "Build paths from service into local work, retraining, and business ownership.",
            body: "TradeScout's stated direction includes veteran job opportunities, tools, retraining, job placement support, and connections into skilled work. Dedicated partners, program terms, and guaranteed placements are not published as an active standalone program yet.",
          },
        ],
      },
      {
        id: "loop",
        label: "How the loop connects",
        cards: [
          {
            eyebrow: "The intended loop",
            title:
              "Work creates history; history creates trust; revenue helps create the next opportunity.",
            body: "A requester finds help, both sides choose the connection, the outcome improves future recommendations, the business keeps more of what it earns, and qualifying revenue can support referrers, local efforts, education, training, and future workers.",
            tone: "accent",
          },
        ],
      },
    ],
  },
  {
    id: "trust",
    number: "07",
    navLabel: "CVS",
    kicker: "Community Verification Score (CVS)",
    title: "Trust affects where an account appears and what it can do.",
    description:
      "Community Verification Score is not a star rating or a payment tier. It uses verification, responsiveness, completed outcomes, recommendations, marketplace history, and risk signals to decide where an account can appear and which actions it is eligible to take.",
    topics: [
      {
        id: "overview",
        label: "What CVS changes",
        cards: [
          {
            eyebrow: "What it changes",
            title: "Who can appear, where they appear, and what they can do.",
            body: "CVS can affect Scout ordering, Direct Connect eligibility, Exchange visibility, Community standing, maps, directories, and other places where verified trust matters.",
          },
          {
            eyebrow: "The four outcomes",
            title: "Eligible, limited, restricted, or blocked.",
            body: "A strong score in one area cannot erase a missing required credential, a suspended verification, or an active risk condition in another.",
          },
          {
            eyebrow: "What it does not promise",
            title: "Evidence improves the decision; it does not guarantee the outcome.",
            body: "CVS cannot promise price, quality, availability, or fit. The requester and business still make those decisions.",
          },
        ],
      },
      {
        id: "activity",
        label: "What raises or lowers it",
        cards: [
          {
            eyebrow: "What can raise the current score",
            title: "Verified activity earns points.",
            bullets: [
              "Completed jobs: +2 each, up to +12",
              "People helped: +1 each, up to +5",
              "Active weeks: +1 to +4; recent activity: +1 or +2",
              "Timely request responses, including accepts or declines: +1 to +3",
              "Approved public positive recommendations: +2 each, up to +10",
              "Delivered orders: up to +5; verified-purchase positive reviews: up to +5",
            ],
            tone: "positive",
          },
          {
            eyebrow: "What can lower the current score",
            title: "Problems remain attached to the history.",
            bullets: [
              "Approved public negative recommendations: −5 each, up to −20",
              "Verified-purchase negative reviews: −3 each, up to −12",
              "Active disputes: −4 each, up to −12",
              "Activity older than a year after prior participation: −2",
              "Confirmed low external reputation can apply a small −3 or −6 adjustment",
            ],
            tone: "warning",
          },
        ],
      },
      {
        id: "proof",
        label: "Required proof and limits",
        cards: [
          {
            eyebrow: "What can cap or stop eligibility",
            title: "Missing required proof can stop access, even when other signals are strong.",
            bullets: [
              "Rejected or suspended verification sets the score to 0",
              "An unverified address normally sets the score to 0",
              "A service provider missing required approved license or insurance evidence scores 0",
              "A profile that is not fully approved is capped below 50",
              "Expired credentials create risk flags and can stop new request eligibility",
            ],
            tone: "gated",
          },
        ],
      },
      {
        id: "outside",
        label: "Outside evidence",
        cards: [
          {
            eyebrow: "Outside evidence",
            title: "Useful, labeled, and limited.",
            body: "For a non-service business, a confirmed public listing and enough outside history can provide a limited starting score. Confirmed external ratings can apply a small adjustment. They never become TradeScout work history and never replace required identity, address, license, or insurance proof.",
          },
          {
            eyebrow: "Temporary points for verified launch evidence",
            title: "Audited and never purchased.",
            body: "Current policy can temporarily recognize a fully verified launch, a named operator who confirms the business firsthand, or an attributable portfolio. Every grant records its evidence and expiration.",
          },
        ],
      },
      {
        id: "money",
        label: "Why payment cannot affect it",
        cards: [
          {
            eyebrow: "What never affects CVS",
            title: "Money cannot buy trust.",
            body: "Subscriptions, advertising, sponsorship, affiliate participation, transaction fees, and paid promotion cannot improve CVS, organic ordering, request routing, or contact access. Profile display choices also stay separate from CVS scoring.",
            tone: "accent",
          },
        ],
      },
    ],
  },
  {
    id: "system",
    number: "08",
    navLabel: "Every feature",
    kicker: "Feature inventory",
    title: "Everything TradeScout helps you do.",
    topics: [
      {
        id: "discover",
        label: "Discover and decide",
        features: [
          {
            number: "01.01",
            action: "Ask what to do next",
            name: "Scout",
            description: "Describe a need, search, compare options, and get a useful next step.",
          },
          {
            number: "01.02",
            action: "Check safety, codes, permits, and inspection steps",
            name: "Scout safety and code guidance",
            description:
              "Scout can explain general safety concerns, identify locally sourced requirements when available, flag what still needs confirmation, and prepare the next step. It does not issue permits, replace official code text, or act as the inspector.",
          },
          {
            number: "01.03",
            action: "See who people support or warn against",
            name: "Recommendations",
            description:
              "Read positive and negative experiences with comments, context, and moderation.",
          },
          {
            number: "01.04",
            action: "Follow what is happening nearby",
            name: "Community",
            description:
              "See questions, updates, organizations, events, and business activity around you.",
          },
          {
            number: "01.05",
            action: "Turn information into a next step",
            name: "Decision Cards",
            description:
              "See the recommended action, why it fits, and what should be checked first.",
          },
          {
            number: "01.06",
            action: "Compare the business behind the offer",
            name: "Business profiles",
            description:
              "See what it offers, where it operates, who controls it, and what proof is available.",
          },
          {
            number: "01.07",
            action: "Understand why an account appears",
            name: "Community Verification Score (CVS)",
            description:
              "See trust eligibility shaped by verification, responsiveness, outcomes, recommendations, marketplace history, and risk.",
          },
          {
            number: "01.08",
            action: "See activity and service coverage",
            name: "Maps",
            description:
              "Explore businesses, listings, offers, and local activity by place instead of searching disconnected sources.",
          },
          {
            number: "01.09",
            action: "See who is contributing locally",
            name: "Leaderboard",
            description:
              "Compare participation and trust momentum without letting payment buy the position.",
          },
          {
            number: "01.10",
            action: "Browse organized local results",
            name: "Local directories",
            description:
              "Move through businesses, places, categories, and recent activity without losing the location that makes the result relevant.",
          },
          {
            number: "01.11",
            action: "Search local help with more filters",
            name: "Advanced search",
            description:
              "Narrow local providers by place, service, and available profile evidence when the ordinary directory is too broad.",
          },
          {
            number: "01.12",
            action: "Find verified people nearby",
            name: "People discovery",
            description:
              "Search verified people by place, open a profile, request a connection, or move into a controlled Direct Connect conversation.",
          },
          {
            number: "01.13",
            action: "Follow people and keep local relationships",
            name: "Social connections",
            description:
              "Follow or unfollow people, review existing connections, and keep social participation distinct from permission to receive a business request.",
          },
          {
            number: "01.14",
            action: "Compare common cost factors",
            name: "Decision calculators",
            description:
              "Use available mortgage, vehicle-payment, pricing, affordability, and project-cost tools as inputs to a decision without treating an estimate as an approval or final price.",
          },
          {
            number: "01.15",
            action: "Find urgent local help",
            name: "Emergency directory",
            description:
              "Narrow the business directory to services intended for time-sensitive local needs.",
          },
          {
            number: "01.16",
            action: "Find partner offers for active needs",
            name: "TradeDeals",
            description:
              "See relevant supplier and partner offers when they can help with a project or purchase.",
          },
          {
            number: "01.17",
            action: "Buy, sell, or rent locally",
            name: "Exchange",
            description:
              "Browse property, vehicles, equipment, tools, food, business items, and other local listings.",
          },
          {
            number: "01.18",
            action: "Install TradeScout on the device",
            name: "Installable app",
            description:
              "Add TradeScout to a supported phone, tablet, or computer home screen while keeping the same account and connected work.",
          },
        ],
      },
      {
        id: "connect-act",
        label: "Connect and act",
        features: [
          {
            number: "02.01",
            action: "Turn a need into a trackable request",
            name: "Requests",
            description:
              "Keep the description, recipients, decisions, and progress attached to one need.",
          },
          {
            number: "02.02",
            action: "Send it only to businesses you choose",
            name: "Direct Connect",
            description:
              "Selected businesses review the request; contact opens only after acceptance.",
          },
          {
            number: "02.03",
            action: "Keep the conversation with the request",
            name: "Messages and quotes",
            description:
              "Carry questions, replies, quotes, and follow-ups beside the work they concern.",
          },
          {
            number: "02.04",
            action: "Search prior conversations",
            name: "Conversation search",
            description:
              "Find the person, business, request, or message thread without opening every conversation one at a time.",
          },
          {
            number: "02.05",
            action: "See what changed without checking every tool",
            name: "Notifications",
            description:
              "Review request activity, conversation requests, replies, status changes, and the next action from one notification center.",
          },
          {
            number: "02.06",
            action: "Return to people who approved contact",
            name: "Connections",
            description: "Keep agreed direct contacts separate from followers and strangers.",
          },
          {
            number: "02.07",
            action: "Check identity and business proof",
            name: "Verification",
            description:
              "Use the checks that fit the person, business, claim, or action instead of one badge for everything.",
          },
          {
            number: "02.08",
            action: "Complete extra screening when the role requires it",
            name: "Background screening and Screen Pass",
            description:
              "A background-check intake exists as an additional verification path. Screen Pass is the portable direction: show that the required screen was completed without exposing the private report. Broader partner completion is still expanding.",
          },
          {
            number: "02.09",
            action: "Establish who controls something",
            name: "Claims",
            description:
              "Claim a business, profile, property, or asset before taking actions that require authority.",
          },
          {
            number: "02.10",
            action: "Sell a defined service or item",
            name: "Fixed-price offers",
            description:
              "Publish a clear offer so the customer can understand the scope and begin a guided request or purchase.",
          },
          {
            number: "02.11",
            action: "Let customers request a time",
            name: "Bookings",
            description:
              "Show availability, accept free booking requests, and optionally require a disclosed deposit.",
          },
          {
            number: "02.12",
            action: "Complete a disclosed payment",
            name: "Checkout and payment history",
            description:
              "Pay for an eligible purchase, booking, or work step and keep the result in the account history.",
          },
          {
            number: "02.13",
            action: "Post a job or a resume",
            name: "Employment Board",
            description:
              "Businesses can post openings and review applicants; people can post resumes and apply. A complete applicant-tracking workspace is still being built.",
          },
          {
            number: "02.14",
            action: "Find help for ordinary work",
            name: "Helpers",
            description:
              "Connect people who do odd jobs, gig work, non-licensed labor, cleanup, moving, yard work, and crew support with people who need those skills.",
          },
          {
            number: "02.15",
            action: "Coordinate a shared place",
            name: "Groups and HOA tools",
            description:
              "Organize members, requests, vendors, finances, votes, documents, and neighborhood activity around one community.",
          },
          {
            number: "02.16",
            action: "Publish and follow a local event",
            name: "Events",
            description:
              "Create community activity that people can discover beside the businesses, groups, and places involved.",
          },
          {
            number: "02.17",
            action: "Report harmful or misleading activity",
            name: "Community moderation",
            description:
              "Use reports, moderation review, content limits, and account restrictions to protect participation without turning popularity or payment into authority.",
          },
          {
            number: "02.18",
            action: "Request a mobile or remote notarization",
            name: "Notary services",
            description:
              "Start a mobile or remote notary request with the service details and legal limits kept distinct from ordinary service work.",
          },
        ],
      },
      {
        id: "record",
        label: "Keep the useful record",
        features: [
          {
            number: "03.01",
            action: "Track the assets you care for",
            name: "Asset Management",
            description:
              "Keep inspections, maintenance, upgrades, documents, and project history together with a home-first focus.",
          },
          {
            number: "03.02",
            action: "Preserve a property history",
            name: "HomeID",
            description:
              "Carry components, service, completed work, ownership context, and supporting records forward.",
          },
          {
            number: "03.03",
            action: "Publish or follow a property listing",
            name: "HomeScout and Exchange property listings",
            description:
              "Keep property discovery, listing details, decisions, inspections, and later ownership records connected.",
          },
          {
            number: "03.04",
            action: "Capture a guided property inspection",
            name: "Zero Base Fee inspection tools",
            description:
              "Eligible roles can document a property with guided capture, then keep the report available for repair and ownership decisions.",
          },
          {
            number: "03.05",
            action: "Order and track materials",
            name: "Supply Run",
            description:
              "Build a materials order, send it for fulfillment, follow status, and keep proof with the run.",
          },
          {
            number: "03.06",
            action: "Save something for later",
            name: "Saved items",
            description:
              "Keep useful listings, offers, projects, and ideas available without starting the search over.",
          },
          {
            number: "03.07",
            action: "Write down what matters",
            name: "Notes",
            description:
              "Keep working notes close to the people, jobs, purchases, and decisions they support.",
          },
          {
            number: "03.08",
            action: "Request access to or deletion of account data",
            name: "Privacy requests",
            description:
              "Submit a privacy request without treating a public profile, transaction record, or legally retained record as the same kind of data.",
          },
          {
            number: "03.09",
            action: "Review the rules that govern an action",
            name: "Policies and compliance",
            description:
              "Keep privacy, terms, verification, professional requirements, marketplace rules, and action-specific limits available beside the work they govern.",
          },
        ],
      },
      {
        id: "operate",
        label: "Run and grow the business",
        features: [
          {
            number: "04.01",
            action: "Publish one business home",
            name: "Business profile",
            description:
              "Show the offer, service area, proof, recommendations, requests, and next actions in one place.",
          },
          {
            number: "04.02",
            action: "Point your existing domain to it",
            name: "Custom domain",
            description:
              "Keep the domain customers already know while the TradeScout profile becomes the working business home.",
          },
          {
            number: "04.03",
            action: "Carry over useful outside evidence",
            name: "Selective Inheritance",
            description:
              "Bring supported facts, media, records, and certifications with the source and observation date attached.",
          },
          {
            number: "04.04",
            action: "Use tools built for the business category",
            name: "Category-specific tools",
            description:
              "Add workflows that fit how the business actually operates as new category tools roll out.",
          },
          {
            number: "04.05",
            action: "Work from a role-specific workspace",
            name: "Professional tools",
            description:
              "Realtors, vehicle sellers, property managers, service providers, and other approved roles can use tools built around their work.",
          },
          {
            number: "04.06",
            action: "Manage clients, jobs, and financial records",
            name: "Business finances",
            description:
              "Keep clients, jobs, expenses, materials, vendors, payroll, reports, and records together.",
          },
          {
            number: "04.07",
            action: "Keep an accounting trail",
            name: "Ledger and reporting",
            description:
              "Record revenue, expenses, transaction history, and financial categories so the business can review what happened without treating TradeScout as a replacement for required accounting or tax advice.",
          },
          {
            number: "04.08",
            action: "Create estimates and invoices",
            name: "Invoicing",
            description:
              "Prepare customer documents and keep payment progress connected to the work.",
          },
          {
            number: "04.09",
            action: "Manage relationships and follow-ups",
            name: "CRM",
            description:
              "Keep contacts, opportunities, conversations, and next steps attached to the business relationship.",
          },
          {
            number: "04.10",
            action: "Review work that fits before accepting it",
            name: "Business request board",
            description:
              "See eligible Direct Connect requests, review the supplied context, and accept or decline before private contact is released.",
          },
          {
            number: "04.11",
            action: "Find and bid on commercial work",
            name: "Commercial directory",
            description:
              "Verified businesses can review commercial projects, open supporting documents, submit a bid, and keep the project and verification requirements together.",
          },
          {
            number: "04.12",
            action: "Understand business performance",
            name: "Analytics",
            description:
              "Review requests, profile attention, project value, outcomes, and revenue trends in one place.",
          },
          {
            number: "04.13",
            action: "Operate a vehicle-sales workflow",
            name: "Vehicle sales tools",
            description:
              "Keep vehicle listings, VIN information, customer follow-up, financing factors, payment estimates, trade-in context, appointments, and buyer conversations together where those tools are available.",
          },
          {
            number: "04.14",
            action: "Operate a property-sales workflow",
            name: "Real-estate professional tools",
            description:
              "Keep listings, clients, market analysis, comparative market analysis, mortgage factors, appointments, contacts, inspection follow-up, and property history connected where the role is approved.",
          },
          {
            number: "04.15",
            action: "Build local discovery from maintained information",
            name: "Local reach and shareable profiles",
            description:
              "Use the maintained business identity, categories, service area, location, offers, proof, and public activity as the source for local discovery instead of rewriting the same information for every channel.",
          },
          {
            number: "04.16",
            action: "Learn a tool before depending on it",
            name: "Resource and training areas",
            description:
              "Read available guidance and training material for platform and business workflows. Coverage varies by tool, and a visible resource page does not mean every lesson, partner, or program is finished.",
          },
          {
            number: "04.17",
            action: "Apply for business support when a program is open",
            name: "Accelerator and support programs",
            description:
              "Use published application areas for growth or support programs when TradeScout has named the terms, availability, and selection process. A program page alone is not a promise of funding or acceptance.",
          },
          {
            number: "04.18",
            action: "Write and save the business story",
            name: "Story Generator",
            description:
              "Create, save, copy, publish, or remove a professional business story without rebuilding the company background for every channel.",
          },
          {
            number: "04.19",
            action: "Publish an offer without buying trust",
            name: "Promotions",
            description:
              "Create a business promotion while keeping paid visibility separate from CVS, recommendations, and organic trust ordering.",
          },
          {
            number: "04.21",
            action: "Track money moving through the account",
            name: "Wallet",
            description:
              "See the account balance and payment history tied to activity in TradeScout.",
          },
          {
            number: "04.22",
            action: "Share without losing referral credit",
            name: "Share Hub and affiliate system",
            description:
              "Signed-in sharing keeps attribution attached and pays only after qualifying TradeScout revenue occurs.",
          },
          {
            number: "04.23",
            action: "Have TradeScout build the branded profile",
            name: "Express Profile",
            description:
              "Pay for optional hands-on profile design and setup without buying trust, ranking, requests, or contact access.",
          },
          {
            number: "04.24",
            action: "Order branded products or marketing help",
            name: "ScoutFitters",
            description:
              "Create branded workwear or request cards, custom products, marketing services, and social plans.",
          },
        ],
      },
    ],
  },
];
