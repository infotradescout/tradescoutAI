import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export default function ContractorAccelerator() {
  const [, navigate] = useLocation();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Card className="bg-tsCard border-white/10">
        <CardHeader>
          <CardTitle className="text-3xl text-white flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-ts-orange" />
            Connection Without Compromise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-white/70">
          <p>
            Contractor acceleration offers are retired. TradeScout does not sell access, priority,
            or ranking placement.
          </p>
          <p>
            Contractor opportunity is governed by verification, trust signals, fit, and
            availability.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button onClick={() => navigate("/contractors/apply")}>Complete Verification</Button>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => navigate("/trust-model")}
            >
              Open Trust Model
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
