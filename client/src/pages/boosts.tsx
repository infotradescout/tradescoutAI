import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function Boosts() {
  const [, navigate] = useLocation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="boosts-page">
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-ts-orange" />
            Exposure Controls Disabled
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-white/70">
          <p>TradeScout does not offer paid boosting, paid featured placement, or paid ranking.</p>
          <p>
            Discovery remains trust-and-context based. Financial events cannot modify ranking,
            recommendations, or authority gates.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button onClick={() => navigate("/trust-model")}>Trust Rules</Button>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => navigate("/direct-connect")}
            >
              View Matches
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
