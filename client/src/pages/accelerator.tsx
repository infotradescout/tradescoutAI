import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function Accelerator() {
  const [, navigate] = useLocation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-ts-orange" />
            Fair connections, no pay-to-win
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-white/70">
          <p>
            TradeScout does not sell priority placement, paid ranking, or pay-to-win visibility.
          </p>
          <p>Everyone gets the same fair shot. Match order is based on trust and fit, not spend.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate("/how-it-works")}>See how it works</Button>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => navigate("/direct-connect")}
            >
              Go to Direct Connect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
