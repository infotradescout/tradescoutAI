const rulesUrl = "https://www.thetradescout.com/giveaway-rules";
const privacyUrl = "https://www.thetradescout.com/privacy";

type RuleSection = {
  title: string;
  body: JSX.Element;
};

const sections: RuleSection[] = [
  {
    title: "1. Promotion Period",
    body: (
      <p>
        The TradeScout Direct Connect Giveaway begins when announced by TradeScout and ends at 11:59
        p.m. Central Time on July 3, 2026. Entries submitted after the promotion period are not
        eligible.
      </p>
    ),
  },
  {
    title: "2. Eligibility",
    body: (
      <p>
        The giveaway is open only to legal residents of Florida who are 18 years of age or older at
        the time of entry. Employees, contractors, officers, directors, and agents of TradeScout,
        and members of their immediate households, are not eligible.
      </p>
    ),
  },
  {
    title: "3. How to Enter",
    body: (
      <>
        <p>
          There are two (2) ways to enter the Sweepstakes. Both methods carry the exact same odds of
          winning.
        </p>
        <p>
          <strong>Method A (Platform Entry):</strong> Navigate to the TradeScout website at{" "}
          <a href="https://www.thetradescout.com">https://www.thetradescout.com</a> and successfully
          submit a free, bona fide Direct Connect request during the Sweepstakes Period. A "bona
          fide request" is defined as a genuine request for services containing accurate and valid
          contact information.
        </p>
        <p>
          <strong>Method B (Alternative Method of Entry - AMOE):</strong> To enter without
          submitting a request, hand-print your full name, complete physical mailing address,
          telephone number, email address, and date of birth on a standard 3" x 5" postcard and mail
          it with proper postage to: TradeScout Direct Connect Giveaway, Attn: Sweepstakes Entry,
          3715 Theresa Street, Pensacola, FL 32505. Mail-in entries must be postmarked by the
          Sweepstakes End Date and received within five (5) business days after the Sweepstakes End
          Date.
        </p>
        <p>
          <strong>Entry Limit:</strong> Maximum of one (1) entry per person, per day, regardless of
          the method of entry. For the purposes of this Sweepstakes, a "day" is defined as a 24-hour
          period beginning at 12:00 AM CT and ending at 11:59 PM CT. Mass-automated entries,
          scripted entries, or requests deemed by the Sponsors (in their sole discretion) to be
          fraudulent, incomplete, or submitted in bad faith will be disqualified.
        </p>
      </>
    ),
  },
  {
    title: "4. Prize",
    body: (
      <p>
        The prize, approximate retail value, and any prize-specific limitations will be stated in
        the applicable TradeScout giveaway announcement. Prize substitution, transfer, or cash
        redemption is not permitted except at TradeScout's discretion. Taxes and any expenses not
        specifically stated as included are the winner's responsibility.
      </p>
    ),
  },
  {
    title: "5. Winner Selection and Notification",
    body: (
      <>
        <p>
          After the promotion period ends, TradeScout will select the potential winner from among
          eligible entries by random drawing or another neutral selection method described in the
          applicable announcement. The potential winner will be notified using the contact
          information provided at entry.
        </p>
        <p>
          A potential winner may be required to confirm eligibility, provide a mailing address, and
          complete any required tax or eligibility documentation. If a potential winner cannot be
          contacted, is ineligible, does not respond in a reasonable time, or declines the prize,
          TradeScout may select an alternate winner.
        </p>
      </>
    ),
  },
  {
    title: "6. Publicity and Privacy",
    body: (
      <>
        <p>
          By entering, entrants consent to TradeScout's use of entry information to administer the
          giveaway, verify eligibility, contact entrants, and award the prize. Personal information
          is handled according to the TradeScout Privacy Policy at{" "}
          <a href={privacyUrl}>{privacyUrl}</a>.
        </p>
        <p>
          Except where prohibited by law, accepting a prize may allow TradeScout to use the winner's
          name, city, state, likeness, and prize information for promotional purposes without
          additional compensation.
        </p>
      </>
    ),
  },
  {
    title: "7. General Conditions",
    body: (
      <p>
        TradeScout may disqualify any entrant who tampers with the entry process, violates these
        Official Rules, acts fraudulently or disruptively, or attempts to undermine the lawful
        operation of the giveaway. TradeScout may cancel, suspend, or modify the giveaway if fraud,
        technical failure, legal restriction, or any other factor impairs the integrity or proper
        administration of the giveaway.
      </p>
    ),
  },
  {
    title: "8. Release and Limitation of Liability",
    body: (
      <p>
        By entering, entrants release TradeScout and its affiliates, officers, directors, employees,
        agents, and partners from claims arising from participation in the giveaway or acceptance,
        use, or misuse of any prize, except where prohibited by law.
      </p>
    ),
  },
  {
    title: "9. Sponsor",
    body: (
      <p>
        Sponsor: TradeScout. Questions about the giveaway may be sent to contact@thetradescout.com.
      </p>
    ),
  },
  {
    title: "10. Master Rules URL",
    body: (
      <p>
        These Official Rules are hosted at <a href={rulesUrl}>{rulesUrl}</a>. Giveaway
        advertisements, social media captions, email footers, and Direct Connect submission
        disclosures should link to this URL.
      </p>
    ),
  },
];

export default function GiveawayRules() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="border-b border-slate-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
            Official Rules
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-bold leading-tight text-white sm:text-4xl">
            TradeScout Direct Connect Giveaway
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
            No purchase necessary. Void where prohibited. Last updated June 6, 2026.
          </p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Eligibility</p>
            <p className="mt-1 font-semibold text-white">Legal FL residents 18+</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Ends</p>
            <p className="mt-1 font-semibold text-white">July 3, 2026 at 11:59 PM CT</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Entry Limit</p>
            <p className="mt-1 font-semibold text-white">One entry per person per day</p>
          </div>
        </section>

        <div className="mt-8 rounded-lg border border-slate-700 bg-slate-950">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className={`px-5 py-6 sm:px-8 ${
                index === sections.length - 1 ? "" : "border-b border-slate-800"
              }`}
            >
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-200 [&_a]:font-semibold [&_a]:text-orange-300 [&_a]:underline [&_strong]:text-white">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-6 rounded-lg border border-orange-400/40 bg-orange-400/10 px-5 py-4 text-center text-sm font-semibold text-orange-100">
          NO PURCHASE NECESSARY. Open to legal FL residents 18+. Ends 7/3/26.
        </footer>
      </div>
    </main>
  );
}
