import { useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Globe2,
  Loader2,
  Mail,
  Menu,
  Phone,
  Play,
  Send,
  ShieldCheck,
} from "lucide-react";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import { isValidDirectConnectRequestPhone } from "@shared/directConnectPhone";
import {
  RED_GRANITI_GROUP_URL,
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_MANAGED_CONTACT,
  RED_GRANITI_PUBLIC_IDENTITY,
  RED_GRANITI_QUARRIES_URL,
} from "@shared/redGranitiProfile";
import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PUBLIC_IDENTITY,
} from "@shared/jwStonePresentation";

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
};

type RequestStatus = "idle" | "sending" | "success" | "error";

type RequestForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  customerType: string;
  material: string;
  format: string;
  quantityDimensions: string;
  destination: string;
  timing: string;
  details: string;
  website: string;
};

const EMPTY_REQUEST_FORM: RequestForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  customerType: "",
  material: "",
  format: "",
  quantityDimensions: "",
  destination: "",
  timing: "",
  details: "",
  website: "",
};

const RED_SITE_MEDIA = {
  hero: "/images/businesses/red-graniti/source/home-hero.svg",
  business: [
    "/images/businesses/red-graniti/source/business-blocks.svg",
    "/images/businesses/red-graniti/source/business-slabs.svg",
    "/images/businesses/red-graniti/source/business-distribution.svg",
  ],
  world: "/images/businesses/red-graniti/source/eureka-danby.svg",
  quarries: "/images/businesses/red-graniti/source/nero-africa.svg",
  projects: [
    "/images/businesses/red-graniti/source/project-arkansas-office.svg",
    "/images/businesses/red-graniti/source/project-colorado-bank.svg",
    "/images/businesses/red-graniti/source/project-lincoln-memorial.svg",
    "/images/businesses/red-graniti/source/project-mansion-dubai.svg",
  ],
} as const;

const BUSINESS_AREAS = [
  {
    title: "BLOCKS",
    body:
      "For more than fifty years, R.E.D. Graniti has built its core business around carefully selected blocks from company-owned quarries. Each block is checked, controlled, and cataloged for dependable quality and supply.",
  },
  {
    title: "SLABS",
    body:
      "R.E.D. Graniti supplies a broad range of semi-finished slabs produced near key source regions. Every slab follows the same quality checks and selection standards used for rough blocks.",
  },
  {
    title: "DISTRIBUTION",
    body:
      "R.E.D. Graniti serves major natural-stone markets around the world, moving material from block to slab with reliable timing, broad access, and continuing service.",
  },
] as const;

const PROJECTS = [
  {
    title: "The Arkansas Office",
    material: "Arabescato Danby / Montclair",
    href: "https://www.redgraniti.com/portfolio/the-arkansas-office/",
  },
  {
    title: "Colorado National Bank Building",
    material: "Colorado White Marble",
    href: "https://www.redgraniti.com/portfolio/colorado-national-bank-building/",
  },
  {
    title: "Lincoln Memorial",
    material: "Colorado White Marble",
    href: "https://www.redgraniti.com/portfolio/lincoln-memorial/",
  },
  {
    title: "Mansion in Dubai",
    material: "Colorado White Marble",
    href: "https://www.redgraniti.com/portfolio/mansion-in-dubai/",
  },
] as const;

const OFFICIAL_WORLD_URL = "https://www.redgraniti.com/en/r-e-d-in-the-world/";
const OFFICIAL_VIDEO_URL = "https://www.redgraniti.com/r-e-d-nel-mondo/video/";
const OFFICIAL_PROJECTS_URL = "https://www.redgraniti.com/r-e-d-projects/";

function externalLinkProps() {
  return {
    target: "_blank" as const,
    rel: "noreferrer noopener",
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4">
      <span className="h-px w-10 bg-[#d71920] sm:w-16" aria-hidden="true" />
      <h2 className="text-center text-2xl font-light uppercase tracking-[0.2em] text-[#252122] sm:text-3xl">
        {children}
      </h2>
      <span className="h-px w-10 bg-[#d71920] sm:w-16" aria-hidden="true" />
    </div>
  );
}

function LocalSectionLink({
  sectionId,
  className,
  children,
}: {
  sectionId: string;
  className: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(window.history.state, "", `#${sectionId}`);
  };

  return (
    <a href={`#${sectionId}`} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

function fieldClassName(): string {
  return "mt-2 min-h-12 w-full border border-white/35 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-white focus:ring-2 focus:ring-white/25";
}

function clean(value: string): string {
  return value.trim();
}

export default function RedGranitiWebsiteProfile({
  profileSlug,
  platformBaseHref = "",
}: Props) {
  const identity = RED_GRANITI_PUBLIC_IDENTITY;
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [requestForm, setRequestForm] = useState<RequestForm>(EMPTY_REQUEST_FORM);
  const [requestStatus, setRequestStatus] = useState<RequestStatus>("idle");
  const [requestError, setRequestError] = useState("");
  const [requestId, setRequestId] = useState("");

  const jwProfileHref = qualifyPublicProfileItemDestination(
    `/u/${JW_STONE_PROFILE_SLUG}`,
    platformBaseHref
  );
  const tradeScoutHomeHref = qualifyPublicProfileItemDestination("/", platformBaseHref);

  const updateField = (field: keyof RequestForm, value: string) => {
    setRequestForm((current) => ({ ...current, [field]: value }));
    if (requestStatus === "error") {
      setRequestStatus("idle");
      setRequestError("");
    }
  };

  const focusRequestForm = () => {
    window.setTimeout(() => firstFieldRef.current?.focus(), 350);
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestStatus === "sending") return;

    const name = clean(requestForm.name);
    const email = clean(requestForm.email);
    const phone = clean(requestForm.phone);
    const customerType = clean(requestForm.customerType);
    const materialFormat = clean(requestForm.format);
    const destination = clean(requestForm.destination);

    if (name.length < 2 || !email.includes("@")) {
      setRequestStatus("error");
      setRequestError("Enter your name and a working email address.");
      return;
    }
    if (!isValidDirectConnectRequestPhone(phone)) {
      setRequestStatus("error");
      setRequestError("Enter a complete phone number.");
      return;
    }
    if (!customerType || !materialFormat || !destination) {
      setRequestStatus("error");
      setRequestError("Choose the customer type and material format, then enter the destination.");
      return;
    }

    const message = [
      "R.E.D. Graniti first-cut request",
      `Customer type: ${customerType}`,
      clean(requestForm.company) ? `Company: ${clean(requestForm.company)}` : "",
      clean(requestForm.material)
        ? `Material: ${clean(requestForm.material)}`
        : "Material: Help me choose",
      `Needed format: ${materialFormat}`,
      clean(requestForm.quantityDimensions)
        ? `Quantity or dimensions: ${clean(requestForm.quantityDimensions)}`
        : "Quantity or dimensions: To be confirmed",
      `Delivery destination: ${destination}`,
      clean(requestForm.timing)
        ? `Needed timing: ${clean(requestForm.timing)}`
        : "Needed timing: To be confirmed",
      clean(requestForm.details)
        ? `Project details: ${clean(requestForm.details)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    setRequestStatus("sending");
    setRequestError("");

    try {
      const response = await fetch(
        `/api/tradepartner-profiles/${JW_STONE_PROFILE_SLUG}/express-request`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            requestType: "request_material",
            message,
            stoneName: clean(requestForm.material) || undefined,
            serviceName: "R.E.D. Graniti first-cut distribution",
            updatesOptIn: false,
            website: requestForm.website,
          }),
        }
      );

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          response.status === 400
            ? "Check the contact and project details, then send the request again."
            : "The request could not be sent. Call or email the managed contact instead."
        );
      }

      setRequestId(String(json?.requestId || ""));
      setRequestStatus("success");
    } catch (cause: unknown) {
      setRequestStatus("error");
      setRequestError(
        cause instanceof Error
          ? cause.message
          : "The request could not be sent. Call or email the managed contact instead."
      );
    }
  };

  return (
    <div
      className="min-h-screen overflow-x-clip bg-white pb-[calc(5.25rem+env(safe-area-inset-bottom))] font-sans text-[#252122] sm:pb-0"
      data-testid="red-graniti-website-profile"
      data-profile-slug={profileSlug}
      data-presentation="official-website-recreation"
    >
      <div
        className="bg-[#272324] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/76"
        data-testid="red-graniti-managed-contact-strip"
      >
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <a
              href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`}
              className="hover:text-white"
              data-testid="red-graniti-strip-call"
            >
              TEL {RED_GRANITI_MANAGED_CONTACT.phone}
            </a>
            <a
              href={`mailto:${RED_GRANITI_MANAGED_CONTACT.email}`}
              className="hover:text-white"
              data-testid="red-graniti-strip-email"
            >
              {RED_GRANITI_MANAGED_CONTACT.email}
            </a>
          </div>
          <span className="text-white/45">TRADESCOUT MANAGED CONTACT</span>
        </div>
      </div>

      <header className="sticky top-[var(--ts-profile-top-offset,0px)] z-[80] border-b border-black/10 bg-white/96 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[82px] max-w-[1180px] items-center gap-5 px-4 sm:px-6">
          <LocalSectionLink sectionId="red-top" className="shrink-0" >
            <img
              src={RED_GRANITI_LOGO_URL}
              alt="R.E.D. Graniti"
              className="h-14 w-14 object-contain"
            />
          </LocalSectionLink>

          <nav className="ml-auto hidden items-center gap-5 lg:flex" aria-label="R.E.D. Graniti">
            <LocalSectionLink sectionId="red-top" className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              HOME
            </LocalSectionLink>
            <a href={RED_GRANITI_GROUP_URL} {...externalLinkProps()} className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              R.E.D. GROUP
            </a>
            <LocalSectionLink sectionId="business" className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              PRODUCTS
            </LocalSectionLink>
            <a href={RED_GRANITI_QUARRIES_URL} {...externalLinkProps()} className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              QUARRIES
            </a>
            <LocalSectionLink sectionId="projects" className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              PROJECTS
            </LocalSectionLink>
            <LocalSectionLink sectionId="contact" className="text-[11px] font-bold tracking-[0.12em] text-black/66 hover:text-[#d71920]">
              CONTACT
            </LocalSectionLink>
          </nav>

          <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-2">
            <a
              href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`}
              data-testid="red-graniti-primary-call"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-black/15 px-4 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:border-black hover:bg-black hover:text-white"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
            <LocalSectionLink
              sectionId="quotation"
              className="inline-flex min-h-11 items-center justify-center bg-[#d71920] px-5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#b71016]"
            >
              <span onClick={focusRequestForm}>Start a Request</span>
            </LocalSectionLink>
          </div>

          <details className="group relative ml-auto lg:hidden">
            <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center border border-black/15 text-black [&::-webkit-details-marker]:hidden">
              <Menu className="h-5 w-5 group-open:hidden" aria-hidden="true" />
              <span className="hidden text-lg group-open:block" aria-hidden="true">×</span>
              <span className="sr-only">Open profile menu</span>
            </summary>
            <nav className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-[min(20rem,calc(100vw-2rem))] border border-black/10 bg-white p-3 shadow-2xl" aria-label="Mobile profile menu">
              <LocalSectionLink sectionId="red-top" className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">HOME</LocalSectionLink>
              <a href={RED_GRANITI_GROUP_URL} {...externalLinkProps()} className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">R.E.D. GROUP</a>
              <LocalSectionLink sectionId="business" className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">PRODUCTS</LocalSectionLink>
              <a href={RED_GRANITI_QUARRIES_URL} {...externalLinkProps()} className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">QUARRIES</a>
              <LocalSectionLink sectionId="projects" className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">PROJECTS</LocalSectionLink>
              <LocalSectionLink sectionId="contact" className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70">CONTACT</LocalSectionLink>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
                <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} className="inline-flex min-h-11 items-center justify-center border border-black/15 text-xs font-bold uppercase tracking-[0.1em]">Call</a>
                <LocalSectionLink sectionId="quotation" className="inline-flex min-h-11 items-center justify-center bg-[#d71920] text-xs font-bold uppercase tracking-[0.1em] text-white">Start a Request</LocalSectionLink>
              </div>
            </nav>
          </details>
        </div>
      </header>

      <main id="red-top" className="scroll-mt-28">
        <section
          className="relative isolate min-h-[650px] overflow-hidden bg-black sm:min-h-[720px]"
          data-testid="red-graniti-website-hero"
          aria-label="R.E.D. Graniti natural stone quarry"
        >
          <SafeProfileImg
            src={RED_SITE_MEDIA.hero}
            alt="R.E.D. Graniti natural stone quarry"
            loading="eager"
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-black/28" aria-hidden="true" />
          <div className="mx-auto flex min-h-[650px] max-w-[1180px] flex-col items-center justify-center px-4 py-20 text-center text-white sm:min-h-[720px] sm:px-6">
            <div className="flex max-w-4xl flex-col items-center">
              <p className="bg-[#d71920] px-5 py-3 text-xl font-light uppercase tracking-[0.17em] sm:px-8 sm:text-4xl">
                FOR OVER 50 YEARS
              </p>
              <p className="mt-2 bg-[#d71920] px-5 py-3 text-base font-light uppercase tracking-[0.15em] sm:px-8 sm:text-2xl">
                RESEARCH AND SUSTAINABILITY
              </p>
              <LocalSectionLink
                sectionId="world"
                className="mt-8 inline-flex min-h-12 items-center justify-center border border-white/75 bg-black/20 px-8 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black"
              >
                Our world
              </LocalSectionLink>
            </div>

            <div className="mt-16 w-full max-w-5xl border-y border-white/50 bg-black/35 px-4 py-5 backdrop-blur-[2px] sm:px-8">
              <p className="text-sm font-light uppercase tracking-[0.13em] sm:text-xl">
                MARBLE, ONYX &amp; QUARTZITE FROM AROUND THE WORLD
              </p>
              <p className="mt-3 text-xs font-light uppercase leading-6 tracking-[0.1em] text-white/82 sm:text-base sm:leading-7">
                A GLOBAL LEADER IN ROUGH GRANITE BLOCKS — NOW ALSO IN SLABS
              </p>
            </div>
          </div>
        </section>

        <section id="business" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24" data-testid="red-graniti-business-areas">
          <div className="mx-auto max-w-[1180px]">
            <SectionTitle>OUR BUSINESS</SectionTitle>
            <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
              {BUSINESS_AREAS.map((area, index) => (
                <article key={area.title} className="group text-center">
                  <div className="relative overflow-hidden bg-[#272324]">
                    <SafeProfileImg
                      src={RED_SITE_MEDIA.business[index]}
                      alt={`R.E.D. Graniti ${area.title.toLowerCase()}`}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    />
                    <div className="absolute inset-0 bg-[#d71920]/0 transition-colors duration-500 group-hover:bg-[#d71920]/38" />
                  </div>
                  <h3 className="mt-7 text-xl font-light uppercase tracking-[0.16em] text-[#252122]">
                    {area.title}
                  </h3>
                  <span className="mx-auto mt-4 block h-px w-10 bg-[#d71920]" />
                  <p className="mx-auto mt-5 max-w-sm text-sm font-light leading-7 text-[#7d7776]">
                    {area.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="world" className="scroll-mt-24 grid lg:grid-cols-2" data-testid="red-graniti-world-and-quarries">
          <article className="relative isolate min-h-[470px] overflow-hidden bg-[#262223] text-white">
            <SafeProfileImg src={RED_SITE_MEDIA.world} alt="R.E.D. Graniti worldwide natural stone network" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-black/64" />
            <div className="flex min-h-[470px] flex-col items-center justify-center px-8 py-14 text-center">
              <Globe2 className="h-11 w-11 text-white/80" aria-hidden="true" />
              <h2 className="mt-6 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">R.E.D. GRANITI IN THE WORLD</h2>
              <span className="mt-5 h-px w-12 bg-[#d71920]" />
              <p className="mt-6 max-w-xl text-sm font-light leading-7 text-white/82 sm:text-base">
                The R.E.D. Graniti group and related companies operate across Europe, Africa, Asia, and the Americas.
              </p>
              <a href={OFFICIAL_WORLD_URL} {...externalLinkProps()} className="mt-8 inline-flex items-center gap-2 border border-white/65 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition hover:bg-white hover:text-black">
                More <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </article>

          <article className="relative isolate min-h-[470px] overflow-hidden bg-[#d71920] text-white" data-testid="red-graniti-quarries">
            <SafeProfileImg src={RED_SITE_MEDIA.quarries} alt="R.E.D. Graniti company-owned quarry" loading="lazy" className="absolute inset-0 -z-20 h-full w-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-[#d71920]/82" />
            <div className="flex min-h-[470px] flex-col items-center justify-center px-8 py-14 text-center">
              <img src={RED_GRANITI_LOGO_URL} alt="" aria-hidden="true" className="h-14 w-14 object-contain brightness-0 invert" />
              <h2 className="mt-6 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">R.E.D. GRANITI QUARRIES</h2>
              <span className="mt-5 h-px w-12 bg-white/75" />
              <p className="mt-6 max-w-xl text-sm font-light leading-7 text-white/88 sm:text-base">
                Company-owned quarry operations span South Africa, Namibia, Zimbabwe, Madagascar, Brazil, the United States, Canada, Finland, and Norway.
              </p>
              <a href={RED_GRANITI_QUARRIES_URL} {...externalLinkProps()} className="mt-8 inline-flex items-center gap-2 border border-white/75 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition hover:bg-white hover:text-[#d71920]">
                More <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </article>
        </section>

        <section className="grid bg-[#2a2627] text-white md:grid-cols-3" data-testid="red-graniti-home-actions">
          <LocalSectionLink sectionId="quotation" className="group min-h-[285px] border-b border-white/10 px-7 py-12 text-left transition hover:bg-[#d71920] md:border-b-0 md:border-r">
            <Mail className="h-8 w-8 text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">REQUEST A QUOTE</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Send the material, format, dimensions, destination, and timing for a clear first-cut response.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">Start a Request <ArrowRight className="h-4 w-4" /></span>
          </LocalSectionLink>

          <a href={OFFICIAL_VIDEO_URL} {...externalLinkProps()} className="group min-h-[285px] border-b border-white/10 px-7 py-12 transition hover:bg-[#d71920] md:border-b-0 md:border-r">
            <Play className="h-8 w-8 fill-current text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">WATCH VIDEO</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Enter the R.E.D. quarry world through official production and source-region films.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">Watch official videos <ArrowUpRight className="h-4 w-4" /></span>
          </a>

          <a href={RED_GRANITI_QUARRIES_URL} {...externalLinkProps()} className="group min-h-[285px] px-7 py-12 transition hover:bg-[#d71920]">
            <Globe2 className="h-8 w-8 text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">MATERIALS &amp; QUARRIES</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Review the official quarry directory and the natural-stone sources behind the R.E.D. network.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">View directory <ArrowUpRight className="h-4 w-4" /></span>
          </a>
        </section>

        <section id="projects" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24" data-testid="red-graniti-projects">
          <div className="mx-auto max-w-[1180px]">
            <SectionTitle>PROJECTS</SectionTitle>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECTS.map((project, index) => (
                <a key={project.title} href={project.href} {...externalLinkProps()} className="group relative overflow-hidden bg-black text-white">
                  <SafeProfileImg src={RED_SITE_MEDIA.projects[index]} alt={`${project.title} using ${project.material}`} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/62">{project.material}</p>
                    <h3 className="mt-2 text-lg font-light uppercase tracking-[0.08em]">{project.title}</h3>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-9 text-center">
              <a href={OFFICIAL_PROJECTS_URL} {...externalLinkProps()} className="inline-flex min-h-12 items-center gap-2 border border-black/20 px-7 text-xs font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-black hover:text-white">
                All projects <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 grid bg-[#292526] text-white lg:grid-cols-2" data-testid="red-graniti-contact-and-quotation">
          <div className="px-5 py-14 sm:px-10 sm:py-16 lg:px-[max(3rem,calc((100vw-1180px)/2))] lg:pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d71920]">HEADQUARTER</p>
            <h2 className="mt-4 text-3xl font-light uppercase tracking-[0.1em]">R.E.D. Graniti S.p.A.</h2>
            <div className="mt-7 space-y-8 text-sm font-light leading-7 text-white/70">
              <div><p className="font-semibold uppercase tracking-[0.12em] text-white">Massa headquarters</p><p className="mt-2">Via Dorsale 12 · 54100 Massa · Italy</p><p>{identity.legalId}</p></div>
              <div><p className="font-semibold uppercase tracking-[0.12em] text-white">Blocks warehouse</p><p className="mt-2">Via Fontana 273 · 37020 Dolcè (VR) · Italy</p></div>
              <div><p className="font-semibold uppercase tracking-[0.12em] text-white">Slabs warehouse</p><p className="mt-2">Via dell’Industria 1 · 37010 Cavaion Veronese (VR) · Italy</p></div>
            </div>

            <div className="mt-10 border-t border-white/14 pt-7" data-testid="red-graniti-managed-contact">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d71920]">{RED_GRANITI_MANAGED_CONTACT.label}</p>
              <p className="mt-3 text-sm font-light leading-7 text-white/68">{RED_GRANITI_MANAGED_CONTACT.description}</p>
              <div className="mt-5 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:gap-7">
                <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} className="inline-flex items-center gap-2 hover:text-[#d71920]"><Phone className="h-4 w-4" />{RED_GRANITI_MANAGED_CONTACT.phone}</a>
                <a href={`mailto:${RED_GRANITI_MANAGED_CONTACT.email}`} className="inline-flex items-center gap-2 hover:text-[#d71920]"><Mail className="h-4 w-4" />{RED_GRANITI_MANAGED_CONTACT.email}</a>
              </div>
            </div>
          </div>

          <div id="quotation" className="scroll-mt-24 bg-[#d71920] px-5 py-14 text-white sm:px-10 sm:py-16 lg:px-14" data-testid="red-graniti-inline-quotation">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/72">REQUEST QUOTATION</p>
            <h2 className="mt-4 max-w-xl text-3xl font-light uppercase leading-tight tracking-[0.08em] sm:text-4xl">Tell us what the project needs.</h2>
            <p className="mt-5 max-w-xl text-sm font-light leading-7 text-white/82 sm:text-base">
              Share the material, required format, dimensions, quantity, destination, and schedule. The first-cut team will respond directly.
            </p>

            {requestStatus === "success" ? (
              <div className="mt-8 border border-white/45 bg-white p-6 text-[#252122]" data-testid="red-graniti-request-success">
                <CheckCircle2 className="h-8 w-8 text-[#d71920]" aria-hidden="true" />
                <h3 className="mt-4 text-2xl font-semibold">Request sent.</h3>
                <p className="mt-2 text-sm leading-7 text-black/65">The first-cut team will contact you using the details provided.</p>
                {requestId ? <p className="mt-3 text-xs text-black/45">Reference: {requestId}</p> : null}
                <button type="button" onClick={() => { setRequestForm(EMPTY_REQUEST_FORM); setRequestStatus("idle"); setRequestId(""); }} className="mt-5 border border-black/20 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em]">Send another request</button>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="mt-8 space-y-5" data-testid="red-graniti-request-form">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Name<input ref={firstFieldRef} required autoComplete="name" value={requestForm.name} onChange={(event) => updateField("name", event.target.value)} className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Company <span className="normal-case tracking-normal text-white/55">(optional)</span><input autoComplete="organization" value={requestForm.company} onChange={(event) => updateField("company", event.target.value)} className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Email<input required type="email" autoComplete="email" value={requestForm.email} onChange={(event) => updateField("email", event.target.value)} className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Phone<input required type="tel" autoComplete="tel" value={requestForm.phone} onChange={(event) => updateField("phone", event.target.value)} className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Customer type<select required value={requestForm.customerType} onChange={(event) => updateField("customerType", event.target.value)} className={fieldClassName()}><option value="" className="text-black">Choose one</option><option className="text-black">Fabricator</option><option className="text-black">Builder or developer</option><option className="text-black">Designer</option><option className="text-black">Architect</option><option className="text-black">Homeowner</option><option className="text-black">Other</option></select></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Material<input value={requestForm.material} onChange={(event) => updateField("material", event.target.value)} placeholder="Stone name or help me choose" className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Needed format<select required value={requestForm.format} onChange={(event) => updateField("format", event.target.value)} className={fieldClassName()}><option value="" className="text-black">Choose one</option><option className="text-black">Rough block</option><option className="text-black">Slab</option><option className="text-black">First-cut requirement</option><option className="text-black">Not sure yet</option></select></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Quantity or dimensions<input value={requestForm.quantityDimensions} onChange={(event) => updateField("quantityDimensions", event.target.value)} placeholder="Bundle, square feet, dimensions, or quantity" className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Delivery destination<input required value={requestForm.destination} onChange={(event) => updateField("destination", event.target.value)} placeholder="City, state, or country" className={fieldClassName()} /></label>
                  <label className="text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Needed timing<input value={requestForm.timing} onChange={(event) => updateField("timing", event.target.value)} placeholder="Target date or schedule" className={fieldClassName()} /></label>
                </div>

                <label className="block text-xs font-semibold uppercase tracking-[0.13em] text-white/80">Project details<textarea rows={5} value={requestForm.details} onChange={(event) => updateField("details", event.target.value)} placeholder="Application, finish, cutting, freight, or other requirements" className={`${fieldClassName()} resize-y`} /></label>
                <label className="sr-only">Website<input tabIndex={-1} autoComplete="off" value={requestForm.website} onChange={(event) => updateField("website", event.target.value)} /></label>

                {requestStatus === "error" ? <p role="alert" className="border border-white/45 bg-black/20 px-4 py-3 text-sm font-semibold text-white" data-testid="red-graniti-request-error">{requestError}</p> : null}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button type="submit" disabled={requestStatus === "sending"} className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-8 text-xs font-bold uppercase tracking-[0.16em] text-[#d71920] transition hover:bg-[#292526] hover:text-white disabled:cursor-wait disabled:opacity-70" data-testid="red-graniti-submit-request">
                    {requestStatus === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {requestStatus === "sending" ? "Sending" : "Send request"}
                  </button>
                  <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/60 px-7 text-xs font-bold uppercase tracking-[0.14em] text-white hover:bg-white hover:text-[#d71920]"><Phone className="h-4 w-4" />Call instead</a>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="border-t border-black/10 bg-white px-4 py-8 sm:px-6" data-testid="red-graniti-first-cut-relationship">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#d71920]" aria-hidden="true" />
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d71920]">{identity.partnership.relationshipLabel}</p><p className="mt-2 text-sm font-light leading-7 text-black/60">{identity.partnership.description}</p></div>
            </div>
            <a href={jwProfileHref} className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 hover:text-black">View {JW_STONE_PUBLIC_IDENTITY.brandName}<ArrowRight className="h-4 w-4" /></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#272324] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 text-center text-xs uppercase tracking-[0.14em] text-white/60 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span>R.E.D. Graniti · Quarries, blocks and slabs</span>
          <a href={tradeScoutHomeHref} className="font-semibold text-white underline decoration-white/35 underline-offset-4 hover:text-white/80">Powered by TradeScout</a>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/12 bg-white/96 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} data-testid="red-graniti-mobile-call" className="inline-flex min-h-12 items-center justify-center gap-2 border border-black/15 bg-white px-4 text-sm font-bold text-black"><Phone className="h-4 w-4" />Call</a>
          <LocalSectionLink sectionId="quotation" className="inline-flex min-h-12 items-center justify-center bg-[#d71920] px-4 text-sm font-bold text-white">Start a Request</LocalSectionLink>
        </div>
      </div>
    </div>
  );
}
