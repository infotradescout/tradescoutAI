import { Link } from "wouter";
import {
  CarFront,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const services = [
  {
    icon: ShieldCheck,
    title: "Windshield Replacement",
    body: "Professional replacement for cracked, shattered, or unsafe windshields.",
  },
  {
    icon: Sparkles,
    title: "Rock Chip Repair",
    body: "Repair small chips before the damage spreads across the windshield.",
  },
  {
    icon: Truck,
    title: "Mobile Auto Glass Service",
    body: "Convenient service at your home, workplace, or another suitable location.",
  },
  {
    icon: CarFront,
    title: "All Makes & Models",
    body: "Windshield and auto glass service for a broad range of vehicles.",
  },
] as const;

const trustPoints = [
  { icon: Truck, label: "Mobile service available" },
  { icon: CircleDollarSign, label: "Affordable pricing" },
  { icon: Clock3, label: "Fast, efficient service" },
  { icon: Wrench, label: "Professional installation" },
] as const;

type Props = {
  directConnectHref: string;
  hasViewerSession: boolean;
  preScoutCreateHref: string;
};

export default function JrsAutoGlassProfileTheme({
  directConnectHref,
  hasViewerSession,
  preScoutCreateHref,
}: Props) {
  const requestHref = hasViewerSession ? directConnectHref : preScoutCreateHref;

  return (
    <main className="min-h-screen bg-[#070707] text-zinc-100">
      <section className="relative overflow-hidden border-b border-red-600/25 bg-[radial-gradient(circle_at_75%_10%,rgba(220,38,38,0.18),transparent_32%),linear-gradient(180deg,#111111_0%,#070707_100%)]">
        <div className="absolute inset-y-0 left-0 w-1 bg-red-600" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-16">
          <div className="flex flex-col justify-center">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-red-500">
              Ponchatoula, Louisiana
            </p>
            <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl">
              Mobile windshield repair & replacement
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              JR&apos;s Auto Glass provides windshield replacement, rock chip repair, and
              convenient mobile service for most makes and models.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href={requestHref}>
                <Button className="h-12 w-full bg-red-600 px-6 font-bold text-white hover:bg-red-700 sm:w-auto">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Request service
                </Button>
              </Link>
              <a href="tel:+19855076192">
                <Button
                  variant="outline"
                  className="h-12 w-full border-zinc-600 bg-zinc-950/70 px-6 font-bold text-white hover:bg-zinc-900 sm:w-auto"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  (985) 507-6192
                </Button>
              </a>
            </div>
          </div>

          <div className="relative flex min-h-[300px] items-center justify-center rounded-3xl border border-zinc-800 bg-black/70 p-6 shadow-2xl shadow-red-950/20">
            <div className="absolute inset-x-10 bottom-4 h-px bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />
            <img
              src="/images/businesses/jrs-auto-glass/logo.svg"
              alt="JR's Auto Glass"
              className="max-h-[330px] w-full object-contain"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-zinc-800 md:grid-cols-4">
          {trustPoints.map(({ icon: Icon, label }) => (
            <div key={label} className="flex min-h-28 items-center gap-3 bg-zinc-950 px-5 py-5">
              <Icon className="h-5 w-5 shrink-0 text-red-500" />
              <span className="text-sm font-semibold text-zinc-200">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">Services</p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Auto glass service that comes to you
          </h2>
          <p className="mt-4 leading-7 text-zinc-400">
            Get help with damaged auto glass without wasting time in a waiting room. Send the
            vehicle details and damage directly to JR&apos;s Auto Glass through TradeScout.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {services.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/15 text-red-500">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-zinc-800 bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-2 md:px-8 md:py-16">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">Why JR&apos;s</p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
              Fast, local, and straightforward
            </h2>
            <div className="mt-6 space-y-3">
              {["We come to you", "Family owned", "Fast turnaround", "Quality service without high costs"].map(
                (point) => (
                  <div key={point} className="flex items-center gap-3 text-zinc-300">
                    <CheckCircle2 className="h-5 w-5 text-red-500" />
                    <span>{point}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-red-600/25 bg-[linear-gradient(145deg,rgba(220,38,38,0.14),rgba(9,9,11,0.92))] p-6 md:p-8">
            <h2 className="text-2xl font-black uppercase text-white">Need auto glass service?</h2>
            <p className="mt-3 leading-7 text-zinc-300">
              Describe the damage, include the vehicle information, and attach a photo when
              available. Your request goes directly to JR&apos;s Auto Glass.
            </p>
            <Link href={requestHref}>
              <Button className="mt-6 h-12 bg-red-600 px-6 font-bold text-white hover:bg-red-700">
                Start service request
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <a href="tel:+19855076192" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-red-600/60">
            <Phone className="h-5 w-5 text-red-500" />
            <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Phone</p>
            <p className="mt-1 font-semibold text-white">(985) 507-6192</p>
          </a>
          <a href="mailto:jrs.autoglass3@gmail.com" className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-red-600/60">
            <Mail className="h-5 w-5 text-red-500" />
            <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Email</p>
            <p className="mt-1 break-all font-semibold text-white">jrs.autoglass3@gmail.com</p>
          </a>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <MapPin className="h-5 w-5 text-red-500" />
            <p className="mt-3 text-xs uppercase tracking-wider text-zinc-500">Location</p>
            <p className="mt-1 font-semibold text-white">41117 S Range Rd, Ponchatoula, LA 70454</p>
          </div>
        </div>
      </section>
    </main>
  );
}
