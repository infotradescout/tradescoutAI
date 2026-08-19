import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Megaphone, ShieldCheck, UserRoundPlus } from "lucide-react";
import AdminManagedPartnerIntakesPage from "@/pages/admin-managed-partner-intakes";
import AdminManagedPartnerProfilesPage from "@/pages/admin-managed-partner-profiles";
import AdminPromotionsPage from "@/pages/admin-promotions";
import AdminTradePartnerCampaignsPage from "@/pages/admin-tradepartner-campaigns";

export default function AdminTradePartnerOpsPage() {
  return (
    <div className="space-y-4">
      <Card className="bg-tsCard/95 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-ts-orange" />
            TradePartners and TradeDeals Portal
          </CardTitle>
          <CardDescription className="text-white/70">
            Unified control surface for incoming partnerships, managed live profiles, promotions,
            TradeDeals operations, and partner campaigns running at the same time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="partner-intake" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="partner-intake" className="flex items-center gap-2">
                <UserRoundPlus className="h-3 w-3" />
                Partner Intake
              </TabsTrigger>
              <TabsTrigger value="managed-profiles" className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                Live Profiles
              </TabsTrigger>
              <TabsTrigger value="tradedeals" className="flex items-center gap-2">
                <Briefcase className="h-3 w-3" />
                TradeDeals and Promotions
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="flex items-center gap-2">
                <Megaphone className="h-3 w-3" />
                TradePartner Campaigns
              </TabsTrigger>
            </TabsList>

            <TabsContent value="partner-intake">
              <AdminManagedPartnerIntakesPage />
            </TabsContent>
            <TabsContent value="managed-profiles">
              <AdminManagedPartnerProfilesPage />
            </TabsContent>
            <TabsContent value="tradedeals">
              <AdminPromotionsPage />
            </TabsContent>
            <TabsContent value="campaigns">
              <AdminTradePartnerCampaignsPage />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
