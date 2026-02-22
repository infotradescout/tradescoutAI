import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function Accelerator() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="bg-tsCard border-tsBorder">
        <CardHeader>
          <CardTitle className="text-3xl text-tsTextMain flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-tsAccent" />
            Connection Without Compromise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-tsTextSecondary">
          <p>
            TradeScout does not run paid acceleration tracks, paid priority routing, paid exposure,
            or paid ranking controls.
          </p>
          <p>
            Access is open. Ranking is trust-and-relevance only. Trust systems are financially
            blind.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => (window.location.href = "/how-it-works")}>View Doctrine</Button>
            <Button
              variant="outline"
              className="border-tsBorder"
              onClick={() => (window.location.href = "/direct-connect")}
            >
              Open Direct Connect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
