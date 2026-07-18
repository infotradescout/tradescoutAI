import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShieldCheck } from "lucide-react";

export function RevenueDisclosureSection({
  id,
  title = "How TradeScout stays free",
  className = "",
}: {
  id?: string;
  title?: string;
  className?: string;
}) {
  return (
    <section id={id} className={className} aria-label="Revenue disclosure">
      <Card className="bg-tsCard border-white/10 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ts-orange/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-ts-orange" />
            </div>
            <h2 className="font-display text-xl font-extrabold text-white">{title}</h2>
          </div>

          <p className="text-sm text-white/70 leading-relaxed">
            TradeScout does <strong className="text-white">not</strong> sell leads, access, trust,
            or organic ranking. The platform can earn money without making you the product.
          </p>

          <ul className="space-y-2 text-sm text-white/75">
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Relevant offers</strong> from verified TradePartners
                and local businesses when the offer brings real value and quality.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Optional marketplace transactions</strong> where a
                clearly disclosed fee can apply only when an actual transaction happens.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Approved partnerships and services</strong> that help
                keep TradeScout running without buying control over who people see or contact.
              </span>
            </li>
          </ul>

          <p className="text-xs text-white/60 leading-relaxed">
            No company gets to advertise just because it can pay. Verification, relevance, value,
            and quality are the price of admission. Sponsored offers are labeled and cannot buy CVS,
            organic ranking, routing, or contact access.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
