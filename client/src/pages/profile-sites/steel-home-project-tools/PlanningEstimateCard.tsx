import { CircleDollarSign, ShieldCheck } from "lucide-react";
import { formatPlanningRange, type SteelHomePlanningEstimate } from "./projectModel";

type Props = {
  estimate: SteelHomePlanningEstimate;
  testId: string;
  roofIncluded?: boolean;
  theme?: "light" | "dark";
};

export default function PlanningEstimateCard({
  estimate,
  testId,
  roofIncluded = false,
  theme = "dark",
}: Props) {
  const dark = theme === "dark";

  return (
    <div
      className={`mt-6 overflow-hidden rounded-[2rem] border p-5 shadow-[0_20px_60px_rgba(24,49,47,0.12)] sm:p-6 ${
        dark
          ? "border-white/10 bg-[#18312f] text-white"
          : "border-[#18312f]/10 bg-white/[0.72] text-[#18312f]"
      }`}
      data-testid={testId}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span
            className={`inline-flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.16em] ${
              dark ? "text-[#f0b392]" : "text-[#a94f2e]"
            }`}
          >
            <CircleDollarSign className="h-4 w-4" aria-hidden="true" />
            Materials planning range
          </span>
          <p className="mt-3 font-editorial text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            {formatPlanningRange(estimate.range)}
          </p>
          <p className={`mt-2 text-sm ${dark ? "text-white/[0.62]" : "text-[#68736f]"}`}>
            {estimate.label}
          </p>
        </div>
        {roofIncluded ? (
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
              dark ? "bg-[#dfe9df] text-[#18312f]" : "bg-[#18312f] text-white"
            }`}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Base roof included
          </span>
        ) : null}
      </div>

      <div className={`mt-6 divide-y ${dark ? "divide-white/10" : "divide-[#18312f]/10"}`}>
        {estimate.breakdown.map((line) => (
          <div key={line.key} className="flex items-start justify-between gap-5 py-3 first:pt-0">
            <div>
              <p className="text-sm font-semibold">{line.label}</p>
              <p className={`mt-1 text-xs ${dark ? "text-white/[0.5]" : "text-[#74807b]"}`}>
                {line.quantity.toLocaleString()} {line.unit}
              </p>
              <p
                className={`mt-1 max-w-xl text-xs leading-5 ${
                  dark ? "text-white/[0.42]" : "text-[#74807b]"
                }`}
              >
                {line.detail}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold">{formatPlanningRange(line.range)}</p>
          </div>
        ))}
      </div>

      <p className={`mt-5 text-xs leading-5 ${dark ? "text-white/[0.52]" : "text-[#68736f]"}`}>
        {estimate.disclaimer}
      </p>
    </div>
  );
}
