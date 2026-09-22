import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminDiscoveryEvidence from "./admin-discovery-evidence";
import { AdminRequestStages } from "@/admin/AdminRequestStages";

export default function AdminDiscoveryObservatory() {
  return (
    <Tabs defaultValue="requests" className="space-y-6" data-testid="admin-discovery-overview">
      <TabsList aria-label="Discovery reporting views" className="h-auto max-w-full flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger value="requests" className="min-h-11 px-4">Request outcomes</TabsTrigger>
        <TabsTrigger value="evidence" className="min-h-11 px-4">Discovery evidence</TabsTrigger>
      </TabsList>
      <TabsContent value="requests" forceMount className="mt-0 data-[state=inactive]:hidden">
        <AdminRequestStages />
      </TabsContent>
      <TabsContent value="evidence" forceMount className="mt-0 data-[state=inactive]:hidden">
        <AdminDiscoveryEvidence />
      </TabsContent>
    </Tabs>
  );
}
