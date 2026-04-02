import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";

const MembershipPortal = memo(function MembershipPortal() {
  return (
    <div className="h-full bg-background">
      <SEOHelmet
        title="Membership Portal | Access Without Paywalls"
        description="Learn how TradeScout membership works under Connection Without Compromise: no paid access tiers and no pay-for-exposure controls."
        canonical="https://www.thetradescout.com/membership-portal"
      />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto bg-tsCard border-white/10">
          <CardHeader>
            <CardTitle className="text-3xl text-white flex items-center gap-3">
              <ShieldCheck className="h-8 w-8 text-ts-orange" />
              Access Is Not Sold
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-white/70">
            <p>
              Membership tiers that control access, routing, or exposure are retired under the
              Connection Without Compromise doctrine.
            </p>
            <p>
              Platform participation is not subscription-gated. Trust and ranking remain financially
              blind.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default MembershipPortal;
