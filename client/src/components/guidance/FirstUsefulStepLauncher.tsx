import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FIRST_USE_STEP_OPTIONS } from "@/lib/firstUseGuidance";

export function FirstUsefulStepLauncher() {
  return (
    <Card className="border-white/10 bg-tsCard">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">Where should I start?</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {FIRST_USE_STEP_OPTIONS.map((option) => (
          <Link key={option.id} href={option.href}>
            <a className="block rounded-lg border border-white/10 bg-black/20 px-3 py-2 transition hover:border-ts-orange/40">
              <p className="text-sm font-semibold text-white">{option.label}</p>
              <p className="mt-1 text-xs text-white/70">{option.description}</p>
            </a>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
