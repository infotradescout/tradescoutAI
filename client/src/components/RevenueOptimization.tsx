import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

function DoctrineNotice({ text }: { text: string }) {
  return (
    <Card className="bg-tsCard border-tsBorder">
      <CardContent className="p-4 text-sm text-tsTextSecondary flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-tsAccent" />
        <span>{text}</span>
      </CardContent>
    </Card>
  );
}

export function AcceleratorPromotion({ placement }: { placement: "sidebar" | "inline" | "modal" }) {
  return (
    <DoctrineNotice
      text={`Connection Without Compromise is active. Paid connection advantages are disabled for ${placement} placement.`}
    />
  );
}

export function StrategicAdPlacement({
  context,
  revenue,
}: {
  context: "quote-result" | "contractor-list" | "project-completion" | "profile-view";
  revenue: "high" | "medium" | "low";
}) {
  return (
    <DoctrineNotice
      text={`Context "${context}" uses payment-blind ranking. Revenue tag "${revenue}" does not alter trust or visibility order.`}
    />
  );
}

export function AffiliateShoppingWidget({ projectType }: { projectType?: string }) {
  return (
    <DoctrineNotice
      text={`Partner content remains non-authoritative${projectType ? ` for ${projectType}` : ""}. Ranking and trust remain financially blind.`}
    />
  );
}

export function RevenueAnalytics() {
  return (
    <DoctrineNotice text="Revenue analytics report transaction and value movement only. Metrics cannot modify ranking, recommendation, or authority gates." />
  );
}

export function SmartProjectMagnet({
  trigger,
}: {
  trigger: "quote-view" | "competitor-check" | "project-miss";
}) {
  return (
    <DoctrineNotice
      text={`Opportunity signaling for "${trigger}" is neutral. No paid priority routing or paid visibility controls are applied.`}
    />
  );
}
