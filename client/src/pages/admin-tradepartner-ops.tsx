import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Megaphone, ShieldCheck, UserRoundPlus } from "lucide-react";
import { AdminWorkspace, AdminWorkspaceSubnav } from "@/admin/AdminWorkspace";
import AdminManagedPartnerIntakesPage from "@/pages/admin-managed-partner-intakes";
import AdminManagedPartnerProfilesPage from "@/pages/admin-managed-partner-profiles";
import AdminPromotionsPage from "@/pages/admin-promotions";
import AdminTradePartnerCampaignsPage from "@/pages/admin-tradepartner-campaigns";

export default function AdminTradePartnerOpsPage() {
  return (
    <AdminWorkspace data-testid="admin-tradepartner-workspace">
      <Tabs defaultValue="partner-intake" className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-0 bg-transparent p-0">
            <TabsTrigger
              value="partner-intake"
              className="min-h-10 shrink-0 gap-2 rounded-lg border border-transparent px-3 text-white/55 data-[state=active]:border-orange-500/25 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-100"
            >
              <UserRoundPlus className="h-4 w-4" />
              Partner Intake
            </TabsTrigger>
            <TabsTrigger
              value="managed-profiles"
              className="min-h-10 shrink-0 gap-2 rounded-lg border border-transparent px-3 text-white/55 data-[state=active]:border-orange-500/25 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-100"
            >
              <ShieldCheck className="h-4 w-4" />
              Live Profiles
            </TabsTrigger>
            <TabsTrigger
              value="tradedeals"
              className="min-h-10 shrink-0 gap-2 rounded-lg border border-transparent px-3 text-white/55 data-[state=active]:border-orange-500/25 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-100"
            >
              <Briefcase className="h-4 w-4" />
              TradeDeals
            </TabsTrigger>
            <TabsTrigger
              value="campaigns"
              className="min-h-10 shrink-0 gap-2 rounded-lg border border-transparent px-3 text-white/55 data-[state=active]:border-orange-500/25 data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-100"
            >
              <Megaphone className="h-4 w-4" />
              Campaigns
            </TabsTrigger>
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="partner-intake" className="m-0 outline-none">
          <AdminManagedPartnerIntakesPage />
        </TabsContent>
        <TabsContent value="managed-profiles" className="m-0 outline-none">
          <AdminManagedPartnerProfilesPage />
        </TabsContent>
        <TabsContent value="tradedeals" className="m-0 outline-none">
          <AdminPromotionsPage />
        </TabsContent>
        <TabsContent value="campaigns" className="m-0 outline-none">
          <AdminTradePartnerCampaignsPage />
        </TabsContent>
      </Tabs>
    </AdminWorkspace>
  );
}
