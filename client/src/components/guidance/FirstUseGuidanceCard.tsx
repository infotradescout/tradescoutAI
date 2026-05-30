import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FirstUseGuidanceCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-white/10 bg-tsCard">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-white/75">{description}</p>
      </CardContent>
    </Card>
  );
}
