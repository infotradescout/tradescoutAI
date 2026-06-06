import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const rulesUrl = "https://www.thetradescout.com/giveaway-rules";
const privacyUrl = "https://www.thetradescout.com/privacy";

export default function GiveawayRules() {
  return (
    <div className="bg-[var(--surface-frame)] py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">
              TradeScout Direct Connect Giveaway Official Rules
            </CardTitle>
            <p className="text-sm text-white/60 dark:text-white/70">
              No purchase necessary. Void where prohibited. Last updated June 6, 2026.
            </p>
          </CardHeader>
          <CardContent className="prose max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">1. Promotion Period</h2>
              <p className="mb-4">
                The TradeScout Direct Connect Giveaway begins when announced by TradeScout and ends
                at 11:59 p.m. Central Time on July 3, 2026. Entries submitted after the promotion
                period are not eligible.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">2. Eligibility</h2>
              <p className="mb-4">
                The giveaway is open only to legal residents of Florida who are 18 years of age or
                older at the time of entry. Employees, contractors, officers, directors, and agents
                of TradeScout, and members of their immediate households, are not eligible.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">3. How to Enter</h2>
              <p className="mb-4">
                There are two (2) ways to enter the Sweepstakes. Both methods carry the exact same
                odds of winning.
              </p>
              <p className="mb-4">
                <strong>Method A (Platform Entry):</strong> Navigate to the TradeScout website at{" "}
                <a href="https://www.thetradescout.com" className="text-blue-600 underline">
                  https://www.thetradescout.com
                </a>{" "}
                and successfully submit a free, bona fide Direct Connect request during the
                Sweepstakes Period. A "bona fide request" is defined as a genuine request for
                services containing accurate and valid contact information.
              </p>
              <p className="mb-4">
                <strong>Method B (Alternative Method of Entry - AMOE):</strong> To enter without
                submitting a request, hand-print your full name, complete physical mailing address,
                telephone number, email address, and date of birth on a standard 3" x 5" postcard
                and mail it with proper postage to: TradeScout Direct Connect Giveaway, Attn:
                Sweepstakes Entry, 3715 Theresa Street, Pensacola, FL 32505. Mail-in entries must be
                postmarked by the Sweepstakes End Date and received within five (5) business days
                after the Sweepstakes End Date.
              </p>
              <p className="mb-4">
                <strong>Entry Limit:</strong> Maximum of one (1) entry per person, per day,
                regardless of the method of entry. For the purposes of this Sweepstakes, a "day" is
                defined as a 24-hour period beginning at 12:00 AM CT and ending at 11:59 PM CT.
                Mass-automated entries, scripted entries, or requests deemed by the Sponsors (in
                their sole discretion) to be fraudulent, incomplete, or submitted in bad faith will
                be disqualified.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">4. Prize</h2>
              <p className="mb-4">
                The prize, approximate retail value, and any prize-specific limitations will be
                stated in the applicable TradeScout giveaway announcement. Prize substitution,
                transfer, or cash redemption is not permitted except at TradeScout's discretion.
                Taxes and any expenses not specifically stated as included are the winner's
                responsibility.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">5. Winner Selection and Notification</h2>
              <p className="mb-4">
                After the promotion period ends, TradeScout will select the potential winner from
                among eligible entries by random drawing or another neutral selection method
                described in the applicable announcement. The potential winner will be notified
                using the contact information provided at entry.
              </p>
              <p className="mb-4">
                A potential winner may be required to confirm eligibility, provide a mailing
                address, and complete any required tax or eligibility documentation. If a potential
                winner cannot be contacted, is ineligible, does not respond in a reasonable time, or
                declines the prize, TradeScout may select an alternate winner.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">6. Publicity and Privacy</h2>
              <p className="mb-4">
                By entering, entrants consent to TradeScout's use of entry information to administer
                the giveaway, verify eligibility, contact entrants, and award the prize. Personal
                information is handled according to the TradeScout Privacy Policy at{" "}
                <a href={privacyUrl} className="text-blue-600 underline">
                  {privacyUrl}
                </a>
                .
              </p>
              <p className="mb-4">
                Except where prohibited by law, accepting a prize may allow TradeScout to use the
                winner's name, city, state, likeness, and prize information for promotional purposes
                without additional compensation.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">7. General Conditions</h2>
              <p className="mb-4">
                TradeScout may disqualify any entrant who tampers with the entry process, violates
                these Official Rules, acts fraudulently or disruptively, or attempts to undermine
                the lawful operation of the giveaway. TradeScout may cancel, suspend, or modify the
                giveaway if fraud, technical failure, legal restriction, or any other factor impairs
                the integrity or proper administration of the giveaway.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">
                8. Release and Limitation of Liability
              </h2>
              <p className="mb-4">
                By entering, entrants release TradeScout and its affiliates, officers, directors,
                employees, agents, and partners from claims arising from participation in the
                giveaway or acceptance, use, or misuse of any prize, except where prohibited by law.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">9. Sponsor</h2>
              <p className="mb-4">
                Sponsor: TradeScout. Questions about the giveaway may be sent to
                support@tradescout.com.
              </p>
            </section>

            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="mb-4 text-2xl font-semibold">10. Master Rules URL</h2>
              <p className="mb-4">
                These Official Rules are hosted at{" "}
                <a href={rulesUrl} className="text-blue-600 underline">
                  {rulesUrl}
                </a>
                . Giveaway advertisements, social media captions, email footers, and Direct Connect
                submission disclosures should link to this URL.
              </p>
            </section>

            <div
              className="mt-8 border-t pt-6 text-center"
              style={{ borderColor: "var(--border-secondary)" }}
            >
              <p className="text-sm text-white/60 dark:text-white/60">
                NO PURCHASE NECESSARY. Open to legal FL residents 18+. Ends 7/3/26.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
