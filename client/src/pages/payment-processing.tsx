import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const PaymentProcessing = memo(function PaymentProcessing() {
  return (
    <div className="h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto bg-tsCard border-tsBorder">
          <CardHeader>
            <CardTitle className="text-3xl flex items-center gap-3 text-tsTextMain">
              <ShieldCheck className="h-8 w-8 text-tsAccent" />
              Payment Model Guardrails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-tsTextSecondary">
            <p>
              TradeScout revenue is transaction-based and value-movement based only. Payment data is
              isolated from ranking, recommendation, and trust scoring.
            </p>
            <p>
              No paid access tiers, no pay-for-lead extraction, and no paid exposure controls are
              available in this system.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default PaymentProcessing;
