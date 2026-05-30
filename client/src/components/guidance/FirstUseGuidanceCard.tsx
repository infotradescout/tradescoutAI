import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FirstUseGuidanceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-white/10 bg-tsCard/95 shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
      <CardHeader className="space-y-2 pb-1">
        <span className="h-1.5 w-12 rounded-full bg-ts-orange/70" aria-hidden="true" />
        <CardTitle className="text-base leading-tight text-white md:text-[1.03rem]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        <p className="text-sm leading-relaxed text-white/78">{description}</p>
      </CardContent>
    </Card>
  );
}
