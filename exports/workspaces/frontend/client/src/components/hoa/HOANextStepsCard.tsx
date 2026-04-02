import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type HOANextStepsCardProps = {
  title: string;
  description: string;
  steps: string[];
  simpleViewEnabled: boolean;
  onToggleSimpleView: () => void;
};

export function HOANextStepsCard({
  title,
  description,
  steps,
  simpleViewEnabled,
  onToggleSimpleView,
}: HOANextStepsCardProps) {
  return (
    <Card className="bg-white/5 border-white/10" data-testid="hoa-next-steps-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-white/70">{description}</p>
        <ol className="space-y-1.5 text-xs text-white/70 list-decimal pl-4">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-white/60">
            Simple View reduces on-screen options for easier navigation.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onToggleSimpleView}>
            {simpleViewEnabled ? "Use Full View" : "Use Simple View"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
