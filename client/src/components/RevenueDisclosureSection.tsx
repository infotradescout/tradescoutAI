import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, ShieldCheck } from "lucide-react";

export function RevenueDisclosureSection({
  title = "How TradeScout makes money",
  className = "",
}: {
  title?: string;
  className?: string;
}) {
  return (
    <section className={className} aria-label="Revenue disclosure">
      <Card className="bg-tsCard border-white/10 shadow-[0_18px_52px_rgba(0,0,0,0.36)]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ts-orange/20 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-ts-orange" />
            </div>
            <h2 className="font-display text-xl font-extrabold text-white">{title}</h2>
          </div>

          <p className="text-sm text-white/70 leading-relaxed">
            TradeScout is built to keep discovery open and contact protected. We do{" "}
            <strong className="text-white">not</strong> sell leads, and we do{" "}
            <strong className="text-white">not</strong> offer pay-to-play visibility. Revenue comes
            from:
          </p>

          <ul className="space-y-2 text-sm text-white/75">
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">TradePartners</strong> programs that support county
                operations, onboarding, and partner workflows.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Marketplace transactions</strong> where optional
                transaction fees apply only when an actual marketplace transaction occurs.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-ts-orange mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-white">Operational services</strong> and approved
                infrastructure partnerships that support ongoing TradeScout development.
              </span>
            </li>
          </ul>

          <p className="text-xs text-white/60 leading-relaxed">
            None of the above can buy trust, ranking, routing, or access. Visibility does not equal
            access.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
