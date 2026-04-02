import { useLocation } from "wouter";
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

const ApplyAccelerator = memo(function ApplyAccelerator() {
  const [, navigate] = useLocation();
  return (
    <div className="h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-ts-orange" />
              Connection Without Compromise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white/70">
            <p>
              This flow is retired. TradeScout does not provide paid acceleration programs or paid
              connection advantages.
            </p>
            <p>Every provider uses the same access model. Matching and trust are payment-blind.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={() => navigate("/contractors/apply")}>
                Continue Contractor Verification
              </Button>
              <Button
                variant="outline"
                className="border-white/10"
                onClick={() => navigate("/how-it-works")}
              >
                Read How TradeScout Works
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default ApplyAccelerator;
