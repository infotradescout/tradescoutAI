import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Megaphone, ShieldCheck } from "lucide-react";
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
            Unified control surface for managed partner profiles, promotions, TradeDeals operations,
            and partner campaigns running at the same time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="managed-profiles" className="space-y-4">
            <TabsList className="h-auto flex-wrap justify-start">
              <TabsTrigger value="managed-profiles" className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3" />
                Managed Profiles
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
