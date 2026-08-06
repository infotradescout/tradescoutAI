import { jw } from "./brand";

const WHY_JW = [
  {
    title: "Quarry-direct sourcing",
    body: "JW Stone selects material at the source so fabricators, designers, builders, and homeowners see the real stone — not a catalog substitute.",
  },
  {
    title: "Exact inventory photographs",
    body: "Every published selection is backed by current photos. Ask JW Stone to confirm what is on hand before you commit a project.",
  },
  {
    title: "Private contact until you choose",
    body: "Browse and save freely. Express Direct Connect only starts when you ask — your details stay gated until that decision.",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "How do I confirm availability or pricing?",
    answer:
      "Open a stone and ask JW Stone, or use Contact from the sticky bar. Availability and pricing are confirmed through Express Direct Connect — never invented on the page.",
  },
  {
    question: "Can I share a specific stone?",
    answer:
      "Yes. Each named stone has a stable share link under /stones/{slug} on JW Stone’s site (and /jw-stone/stones/{slug} on TradeScout).",
  },
  {
    question: "What if I do not see the material I need?",
    answer:
      "Use Contact and describe the stone, finish, and project timing. JW Stone can confirm current stock or source options without exposing contact details until you connect.",
  },
] as const;

/**
 * Company proof strip — about / differentiators / FAQ so the marketplace can
 * stand in for the legacy profile trust package on jwstonelogistics.com.
 */
export function MarketplaceTrustSection() {
  return (
    <section
      id="why-jw"
      data-testid="jw-marketplace-trust"
      aria-labelledby="jw-trust-heading"
      className={`border-y ${jw.border} bg-[var(--jw-bg)] ${jw.scrollTarget}`}
    >
      <div className="mx-auto max-w-[1100px] px-5 py-12 sm:px-9 sm:py-16 lg:px-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]">
          Why JW Stone
        </p>
        <h2
          id="jw-trust-heading"
          className="mt-3 font-editorial text-3xl tracking-tight text-[var(--jw-ink)] sm:text-4xl"
        >
          Natural stone, selected at the source.
        </h2>
        <p className={`mt-4 max-w-2xl text-base leading-7 sm:text-lg ${jw.muted}`}>
          JW Stone is a wholesale stone house for fabricators, architects, designers, builders, and
          homeowners — with quarry relationships, current inventory photography, and TradeScout
          Direct Connect when you are ready to ask.
        </p>

        <ul className="mt-10 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {WHY_JW.map((item) => (
            <li key={item.title} data-testid="jw-trust-differentiator">
              <h3 className="font-editorial text-xl text-[var(--jw-ink)]">{item.title}</h3>
              <p className={`mt-2 text-sm leading-6 ${jw.muted}`}>{item.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 border-t border-[var(--jw-border)] pt-10">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--jw-accent)]">
            FAQ
          </h3>
          <ul className="mt-5 space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <li key={faq.question} data-testid="jw-marketplace-faq-item">
                <details className="group border border-[var(--jw-border)] bg-white/40 px-4 py-3">
                  <summary className="cursor-pointer list-none font-semibold text-[var(--jw-ink)] marker:content-none [&::-webkit-details-marker]:hidden">
                    {faq.question}
                  </summary>
                  <p className={`mt-2 text-sm leading-6 ${jw.muted}`}>{faq.answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
