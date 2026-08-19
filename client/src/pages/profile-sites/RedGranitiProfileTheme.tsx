import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Globe2,
  Mail,
  MapPin,
  Menu,
  Phone,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
import { qualifyPublicProfileItemDestination } from "@/lib/publicProfileItemDestination";
import RedGranitiDirectConnectPanel, {
  type RedGranitiContactEntry,
} from "@/pages/profile-sites/RedGranitiDirectConnectPanel";
import { SafeProfileImg } from "@/pages/profile-sites/safeProfileImage";
import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff";
import {
  RED_GRANITI_LOGO_URL,
  RED_GRANITI_MANAGED_CONTACT,
  RED_GRANITI_PUBLIC_IDENTITY,
  RED_GRANITI_QUARRIES_URL,
} from "@shared/redGranitiProfile";
import { JW_STONE_PUBLIC_IDENTITY } from "@shared/jwStonePresentation";

type Props = {
  profileSlug: string;
  platformBaseHref?: string;
  profileShareDestination: string;
  hasViewerSession: boolean;
  businessAddress?: string | null;
  trustActions: ReactNode;
  profileItems?: ReactNode;
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
      "R.E.D. Graniti serves major luxury-stone markets around the world, moving material from block to slab with reliable timing, broad access, and continuing service.",
  },
] as const;

const PROJECTS = [
  {
    title: "The Arkansas Office",
    material: "Arabescato Danby / Montclair",
  },
  {
    title: "Colorado National Bank Building",
    material: "Colorado White Marble",
  },
  {
    title: "Lincoln Memorial",
    material: "Colorado White Marble",
  },
  {
    title: "Mansion in Dubai",
    material: "Colorado White Marble",
  },
] as const;

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

export default function RedGranitiProfileTheme({
  profileSlug,
  platformBaseHref = "",
  profileShareDestination,
  trustActions,
  profileItems,
}: Props) {
  const identity = RED_GRANITI_PUBLIC_IDENTITY;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactEntry, setContactEntry] = useState<RedGranitiContactEntry>("request");
  const jwProfileHref = qualifyPublicProfileItemDestination(
    `/u/${identity.partnership.partnerProfileSlug}`,
    platformBaseHref
  );
  const homeHref = qualifyPublicProfileItemDestination("/", platformBaseHref);
  const pageStyle = {
    ["--red-site-mark" as string]: "#d71920",
    ["--red-site-ink" as string]: "#252122",
    ["--red-site-muted" as string]: "#7d7776",
    ["--red-site-paper" as string]: "#ffffff",
    ["--red-site-warm" as string]: "#f2f0ed",
  } as CSSProperties;

  const openContact = (entry: RedGranitiContactEntry) => {
    setContactEntry(entry);
    setContactOpen(true);
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { label: "HOME", href: "#top" },
    { label: "R.E.D. GROUP", href: "#world" },
    { label: "PRODUCTS", href: "#business" },
    { label: "QUARRIES", href: "#quarries" },
    { label: "PROJECTS", href: "#projects" },
    { label: "CONTACT", href: "#contact" },
  ] as const;

  return (
    <div
      className="min-h-screen overflow-x-clip bg-[var(--red-site-paper)] pb-[calc(5.25rem+env(safe-area-inset-bottom))] font-sans text-[var(--red-site-ink)] sm:pb-0"
      style={pageStyle}
      data-testid="red-graniti-profile-theme"
      data-presentation="official-website-recreation"
    >
      <div
        className="bg-[#272324] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/76"
        data-testid="red-graniti-managed-contact-strip"
      >
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} className="hover:text-white">
              TEL {RED_GRANITI_MANAGED_CONTACT.phone}
            </a>
            <a href={`mailto:${RED_GRANITI_MANAGED_CONTACT.email}`} className="hover:text-white">
              {RED_GRANITI_MANAGED_CONTACT.email}
            </a>
          </div>
          <span className="text-white/45">TRADE­SCOUT MANAGED CONTACT</span>
        </div>
      </div>

      <header className="sticky top-[var(--ts-profile-top-offset,0px)] z-[80] border-b border-black/10 bg-white/96 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[82px] max-w-[1180px] items-center gap-5 px-4 sm:px-6">
          <a href="#top" className="shrink-0" aria-label="R.E.D. Graniti home">
            <img
              src={RED_GRANITI_LOGO_URL}
              alt="R.E.D. Graniti"
              className="h-14 w-14 object-contain"
            />
          </a>

          <nav className="ml-auto hidden items-center gap-5 lg:flex" aria-label="R.E.D. Graniti profile">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[11px] font-bold tracking-[0.12em] text-black/66 transition-colors hover:text-[var(--red-site-mark)]"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-2">
            <button
              type="button"
              onClick={() => openContact("call")}
              data-testid="red-graniti-primary-call"
              className="inline-flex min-h-11 items-center justify-center gap-2 border border-black/15 px-4 text-xs font-bold uppercase tracking-[0.12em] text-black transition hover:border-black hover:bg-black hover:text-white"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </button>
            <button
              type="button"
              onClick={() => openContact("request")}
              data-testid="red-graniti-primary-request"
              className="inline-flex min-h-11 items-center justify-center bg-[var(--red-site-mark)] px-5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-[#b71016]"
            >
              Start a Request
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="ml-auto inline-flex h-11 w-11 items-center justify-center border border-black/15 text-black sm:ml-0 lg:hidden"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="border-t border-black/10 bg-white px-4 py-4 lg:hidden">
            <nav className="mx-auto grid max-w-[1180px] gap-1" aria-label="Mobile profile menu">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="border-b border-black/8 px-2 py-3 text-xs font-bold tracking-[0.12em] text-black/70"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => openContact("call")}
                  className="min-h-11 border border-black/15 text-xs font-bold uppercase tracking-[0.1em]"
                >
                  Call
                </button>
                <button
                  type="button"
                  onClick={() => openContact("request")}
                  className="min-h-11 bg-[var(--red-site-mark)] text-xs font-bold uppercase tracking-[0.1em] text-white"
                >
                  Start a Request
                </button>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="top">
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
              <p className="bg-[var(--red-site-mark)] px-5 py-3 text-xl font-light uppercase tracking-[0.17em] sm:px-8 sm:text-4xl">
                FOR OVER 50 YEARS
              </p>
              <p className="mt-2 bg-[var(--red-site-mark)] px-5 py-3 text-base font-light uppercase tracking-[0.15em] sm:px-8 sm:text-2xl">
                RESEARCH AND SUSTAINABILITY
              </p>
              <a
                href="#world"
                className="mt-8 inline-flex min-h-12 items-center justify-center border border-white/75 bg-black/20 px-8 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-black"
              >
                Our world
              </a>
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
                    <div className="absolute inset-0 bg-[var(--red-site-mark)]/0 transition-colors duration-500 group-hover:bg-[var(--red-site-mark)]/38" />
                  </div>
                  <h3 className="mt-7 text-xl font-light uppercase tracking-[0.16em] text-[#252122]">
                    {area.title}
                  </h3>
                  <span className="mx-auto mt-4 block h-px w-10 bg-[var(--red-site-mark)]" />
                  <p className="mx-auto mt-5 max-w-sm text-sm font-light leading-7 text-[var(--red-site-muted)]">
                    {area.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="world" className="scroll-mt-24 grid lg:grid-cols-2" data-testid="red-graniti-world-and-quarries">
          <article className="relative isolate min-h-[470px] overflow-hidden bg-[#262223] text-white">
            <SafeProfileImg
              src={RED_SITE_MEDIA.world}
              alt="R.E.D. Graniti worldwide natural stone network"
              loading="lazy"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-black/64" />
            <div className="flex min-h-[470px] flex-col items-center justify-center px-8 py-14 text-center">
              <Globe2 className="h-11 w-11 text-white/80" aria-hidden="true" />
              <h2 className="mt-6 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">
                R.E.D. GRANITI IN THE WORLD
              </h2>
              <span className="mt-5 h-px w-12 bg-[var(--red-site-mark)]" />
              <p className="mt-6 max-w-xl text-sm font-light leading-7 text-white/82 sm:text-base">
                The R.E.D. Graniti group and related companies operate across Europe, Africa, Asia, and the Americas.
              </p>
              <a
                href={identity.officialLinks[1].href}
                {...externalLinkProps()}
                className="mt-8 inline-flex items-center gap-2 border border-white/65 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition hover:bg-white hover:text-black"
              >
                More
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </article>

          <article id="quarries" className="relative isolate min-h-[470px] scroll-mt-24 overflow-hidden bg-[var(--red-site-mark)] text-white" data-testid="red-graniti-quarries">
            <SafeProfileImg
              src={RED_SITE_MEDIA.quarries}
              alt="R.E.D. Graniti company-owned quarry"
              loading="lazy"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-[var(--red-site-mark)]/82" />
            <div className="flex min-h-[470px] flex-col items-center justify-center px-8 py-14 text-center">
              <img src={RED_GRANITI_LOGO_URL} alt="" aria-hidden="true" className="h-14 w-14 object-contain brightness-0 invert" />
              <h2 className="mt-6 text-2xl font-light uppercase tracking-[0.16em] sm:text-3xl">
                R.E.D. GRANITI QUARRIES
              </h2>
              <span className="mt-5 h-px w-12 bg-white/75" />
              <p className="mt-6 max-w-xl text-sm font-light leading-7 text-white/88 sm:text-base">
                Company-owned quarry operations span South Africa, Namibia, Zimbabwe, Madagascar, Brazil, the United States, Canada, Finland, and Norway.
              </p>
              <a
                href={RED_GRANITI_QUARRIES_URL}
                {...externalLinkProps()}
                className="mt-8 inline-flex items-center gap-2 border border-white/75 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition hover:bg-white hover:text-[var(--red-site-mark)]"
              >
                More
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </article>
        </section>

        <section className="grid bg-[#2a2627] text-white md:grid-cols-3" data-testid="red-graniti-home-actions">
          <button
            type="button"
            onClick={() => openContact("request")}
            className="group min-h-[285px] border-b border-white/10 px-7 py-12 text-left transition hover:bg-[var(--red-site-mark)] md:border-b-0 md:border-r"
          >
            <Mail className="h-8 w-8 text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">REQUEST A QUOTE</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Send the material, format, dimensions, destination, and timing for a clear first-cut response.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">
              Start a Request
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          <a
            href="https://www.redgraniti.com/r-e-d-nel-mondo/video/"
            {...externalLinkProps()}
            className="group min-h-[285px] border-b border-white/10 px-7 py-12 transition hover:bg-[var(--red-site-mark)] md:border-b-0 md:border-r"
          >
            <Play className="h-8 w-8 fill-current text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">WATCH VIDEO</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Enter the R.E.D. quarry world through official production and source-region films.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">
              Watch official videos
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </a>

          <a
            href={RED_GRANITI_QUARRIES_URL}
            {...externalLinkProps()}
            className="group min-h-[285px] px-7 py-12 transition hover:bg-[var(--red-site-mark)]"
          >
            <Globe2 className="h-8 w-8 text-white/75" aria-hidden="true" />
            <h3 className="mt-6 text-xl font-light uppercase tracking-[0.14em]">MATERIALS &amp; QUARRIES</h3>
            <p className="mt-4 max-w-sm text-sm font-light leading-7 text-white/68 group-hover:text-white/88">
              Review the official quarry directory and the natural-stone sources behind the R.E.D. network.
            </p>
            <span className="mt-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em]">
              View directory
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </a>
        </section>

        <section id="projects" className="scroll-mt-24 bg-white px-4 py-16 sm:px-6 sm:py-24" data-testid="red-graniti-projects">
          <div className="mx-auto max-w-[1180px]">
            <SectionTitle>PROJECTS</SectionTitle>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECTS.map((project, index) => (
                <a
                  key={project.title}
                  href="https://www.redgraniti.com/en/r-e-d-projects/"
                  {...externalLinkProps()}
                  className="group relative overflow-hidden bg-black text-white"
                >
                  <SafeProfileImg
                    src={RED_SITE_MEDIA.projects[index]}
                    alt={`${project.title} using ${project.material}`}
                    loading="lazy"
                    className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/62">
                      {project.material}
                    </p>
                    <h3 className="mt-2 text-lg font-light uppercase tracking-[0.08em]">
                      {project.title}
                    </h3>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-9 text-center">
              <a
                href="https://www.redgraniti.com/en/r-e-d-projects/"
                {...externalLinkProps()}
                className="inline-flex min-h-12 items-center gap-2 border border-black/20 px-7 text-xs font-semibold uppercase tracking-[0.15em] text-black transition hover:bg-black hover:text-white"
              >
                All projects
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {profileItems ? (
          <section className="border-y border-black/10 bg-[var(--red-site-warm)] px-4 py-10 sm:px-6" data-testid="red-graniti-profile-items">
            <div className="mx-auto max-w-[1180px]">{profileItems}</div>
          </section>
        ) : null}

        <section id="contact" className="scroll-mt-24 grid bg-[#292526] text-white lg:grid-cols-2" data-testid="red-graniti-contact-and-quotation">
          <div className="px-5 py-14 sm:px-10 sm:py-16 lg:px-[max(3rem,calc((100vw-1180px)/2))] lg:pr-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--red-site-mark)]">
              HEADQUARTER
            </p>
            <h2 className="mt-4 text-3xl font-light uppercase tracking-[0.1em]">R.E.D. Graniti S.p.A.</h2>
            <div className="mt-7 space-y-8 text-sm font-light leading-7 text-white/70">
              <div>
                <p className="font-semibold uppercase tracking-[0.12em] text-white">Massa headquarters</p>
                <p className="mt-2">Via Dorsale 12 · 54100 Massa · Italy</p>
                <p>{identity.legalId}</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-[0.12em] text-white">Blocks warehouse</p>
                <p className="mt-2">Via Fontana 273 · 37020 Dolcè (VR) · Italy</p>
              </div>
              <div>
                <p className="font-semibold uppercase tracking-[0.12em] text-white">Slabs warehouse</p>
                <p className="mt-2">Via dell’Industria 1 · 37010 Cavaion Veronese (VR) · Italy</p>
              </div>
            </div>

            <div className="mt-10 border-t border-white/14 pt-7" data-testid="red-graniti-managed-contact">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--red-site-mark)]">
                {RED_GRANITI_MANAGED_CONTACT.label}
              </p>
              <p className="mt-3 text-sm font-light leading-7 text-white/68">
                {RED_GRANITI_MANAGED_CONTACT.description}
              </p>
              <div className="mt-5 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:gap-7">
                <a href={`tel:${RED_GRANITI_MANAGED_CONTACT.tel}`} className="inline-flex items-center gap-2 hover:text-[var(--red-site-mark)]">
                  <Phone className="h-4 w-4" />
                  {RED_GRANITI_MANAGED_CONTACT.phone}
                </a>
                <a href={`mailto:${RED_GRANITI_MANAGED_CONTACT.email}`} className="inline-flex items-center gap-2 hover:text-[var(--red-site-mark)]">
                  <Mail className="h-4 w-4" />
                  {RED_GRANITI_MANAGED_CONTACT.email}
                </a>
              </div>
            </div>
          </div>

          <div className="bg-[var(--red-site-mark)] px-5 py-14 text-white sm:px-10 sm:py-16 lg:px-14" data-testid="red-graniti-quotation">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/72">REQUEST QUOTATION</p>
            <h2 className="mt-4 max-w-xl text-3xl font-light uppercase leading-tight tracking-[0.08em] sm:text-4xl">
              Tell us what the project needs.
            </h2>
            <p className="mt-5 max-w-xl text-sm font-light leading-7 text-white/82 sm:text-base">
              Share the material, block or slab format, dimensions, quantity, destination, and schedule. TradeScout will route the first-cut request through the verified JW Stone relationship.
            </p>

            <div className="mt-8 grid gap-px bg-white/35 sm:grid-cols-2" aria-label="Information collected in the request">
              {["NAME", "EMAIL", "COMPANY", "MATERIAL", "FORMAT", "DESTINATION"].map((field) => (
                <div key={field} className="min-h-14 bg-[var(--red-site-mark)] px-4 py-4 text-[10px] font-semibold tracking-[0.18em] text-white/72">
                  {field}
                </div>
              ))}
              <div className="min-h-24 bg-[var(--red-site-mark)] px-4 py-4 text-[10px] font-semibold tracking-[0.18em] text-white/72 sm:col-span-2">
                PROJECT DETAILS
              </div>
            </div>

            <button
              type="button"
              onClick={() => openContact("request")}
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 bg-white px-8 text-xs font-bold uppercase tracking-[0.16em] text-[var(--red-site-mark)] transition hover:bg-[#292526] hover:text-white"
            >
              Get a quotation now
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="border-t border-black/10 bg-white px-4 py-8 sm:px-6" data-testid="red-graniti-first-cut-relationship">
          <div className="mx-auto flex max-w-[1180px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-3xl items-start gap-4">
              <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[var(--red-site-mark)]" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--red-site-mark)]">
                  {identity.partnership.relationshipLabel}
                </p>
                <p className="mt-2 text-sm font-light leading-7 text-black/60">
                  {identity.partnership.description}
                </p>
              </div>
            </div>
            <a
              href={jwProfileHref}
              className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-black/65 hover:text-black"
            >
              View {JW_STONE_PUBLIC_IDENTITY.brandName}
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="bg-[var(--red-site-warm)] px-4 py-6 sm:px-6" data-testid="red-graniti-platform-actions">
          <div className="mx-auto grid max-w-[1180px] gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>{trustActions}</div>
            <ShareButton
              destination={profileShareDestination}
              title="R.E.D. Graniti | TradeScout"
              text="View the R.E.D. Graniti TradeScout profile."
              imageUrl={RED_GRANITI_LOGO_URL}
              className="min-h-11 border-black/15 bg-white px-5 text-black hover:bg-black hover:text-white"
            />
          </div>
        </section>
      </main>

      <TradeScoutProfileHandoff
        profileSlug={profileSlug}
        profileName={identity.brandName}
        platformBaseHref={platformBaseHref}
      />

      <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-black/12 bg-white/96 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openContact("call")}
            data-testid="red-graniti-mobile-call"
            className="inline-flex min-h-12 items-center justify-center gap-2 border border-black/15 bg-white px-4 text-sm font-bold text-black"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            Call
          </button>
          <button
            type="button"
            onClick={() => openContact("request")}
            data-testid="red-graniti-mobile-request"
            className="inline-flex min-h-12 items-center justify-center bg-[var(--red-site-mark)] px-4 text-sm font-bold text-white"
          >
            Start a Request
          </button>
        </div>
      </div>

      <RedGranitiDirectConnectPanel
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        initialView={contactEntry}
        platformBaseHref={platformBaseHref}
      />

      <a
        href={homeHref}
        className="sr-only focus:not-sr-only focus:fixed focus:bottom-24 focus:left-4 focus:z-[100] focus:bg-black focus:px-4 focus:py-3 focus:text-white"
      >
        Return to TradeScout
      </a>
    </div>
  );
}
