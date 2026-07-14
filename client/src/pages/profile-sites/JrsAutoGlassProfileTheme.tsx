import { Link } from "wouter";
import { Camera, CarFront, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const requestDetails = [
  {
    icon: CarFront,
    title: "Vehicle",
    body: "Year, make, and model",
  },
  {
    icon: ShieldCheck,
    title: "Glass",
    body: "Which piece of glass is damaged",
  },
  {
    icon: Camera,
    title: "Damage",
    body: "What happened and photos, if available",
  },
  {
    icon: Clock3,
    title: "Timing",
    body: "When you would like a response",
  },
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
              TradeScout profile
            </p>
            <h1 className="max-w-3xl text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl md:text-6xl">
              JR&apos;s Auto Glass
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
              Send the vehicle and glass details in one private request. Your contact information
              stays protected inside TradeScout.
            </p>
            <div className="mt-7">
              <Link href={requestHref}>
                <Button className="h-12 w-full bg-red-600 px-6 font-bold text-white hover:bg-red-700 sm:w-auto">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Start a request
                </Button>
              </Link>
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

      <section className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-8 max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
            What to include
          </p>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
            Give the request the useful details
          </h2>
          <p className="mt-4 leading-7 text-zinc-400">
            These details help JR&apos;s understand what you need before deciding how to respond.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {requestDetails.map(({ icon: Icon, title, body }) => (
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
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[1fr_auto] md:items-center md:px-8 md:py-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-500">
              Private by design
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">
              Contact stays inside TradeScout
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
              Send the request first. Direct contact details remain locked until the people involved
              choose to release them.
            </p>
          </div>
          <Link href={requestHref}>
            <Button className="h-12 bg-red-600 px-6 font-bold text-white hover:bg-red-700">
              Send request to JR&apos;s
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
