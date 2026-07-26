import { ListChecks, UserPlus } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { AdminDirectConnectRequestCard } from "@/components/admin/AdminDirectConnectRequestCard";
import { AdminDirectConnectRequestDetail } from "@/components/admin/AdminDirectConnectRequestDetail";
import { AdminDirectConnectQueue } from "@/components/admin/AdminDirectConnectQueue";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminDirectConnectRequestsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const requestId = params.get("requestId");
  const activeTab = params.get("view") === "create" ? "create" : "queue";

  const changeTab = (value: string) => {
    setLocation(
      value === "create"
        ? "/admin/direct-connect-requests?view=create"
        : "/admin/direct-connect-requests"
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Direct Connect Operations
          </h1>
          <Badge variant="outline">Ops admin</Badge>
        </div>
        <p className="max-w-3xl text-sm text-white/60">
          Review every Direct Connect request, follow its routing and delivery history, and assist
          without bypassing the contact gate.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="grid w-full grid-cols-2 sm:inline-grid sm:w-auto">
          <TabsTrigger value="queue" className="gap-1.5">
            <ListChecks className="h-4 w-4" />
            Request queue
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            Create on behalf
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <div
              className={requestId ? "order-2 lg:order-1 lg:col-span-5" : "order-1 lg:col-span-12"}
            >
              <AdminDirectConnectQueue />
            </div>
            {requestId ? (
              <section
                aria-label="Selected Direct Connect request"
                className="order-1 lg:order-2 lg:col-span-7"
              >
                <AdminDirectConnectRequestDetail requestId={requestId} />
              </section>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="create" className="mt-4 max-w-4xl">
          <AdminDirectConnectRequestCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
