import { ListChecks, UserPlus } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { AdminSection, AdminWorkspace, AdminWorkspaceSubnav } from "@/admin/AdminWorkspace";
import { AdminDirectConnectQueue } from "@/components/admin/AdminDirectConnectQueue";
import { AdminDirectConnectRequestCard } from "@/components/admin/AdminDirectConnectRequestCard";
import { AdminDirectConnectRequestDetail } from "@/components/admin/AdminDirectConnectRequestDetail";
import { Button } from "@/components/ui/button";

export default function AdminDirectConnectRequestsPage() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const requestId = params.get("requestId");
  const activeView = params.get("view") === "create" ? "create" : "queue";

  return (
    <AdminWorkspace data-testid="admin-request-operations-v2">
      <AdminWorkspaceSubnav>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            type="button"
            variant={activeView === "queue" ? "default" : "outline"}
            onClick={() => setLocation("/admin/direct-connect-requests")}
          >
            <ListChecks className="mr-1.5 h-4 w-4" />
            Request queue
          </Button>
          <Button
            type="button"
            variant={activeView === "create" ? "default" : "outline"}
            onClick={() => setLocation("/admin/direct-connect-requests?view=create")}
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            Create request
          </Button>
        </div>
      </AdminWorkspaceSubnav>

      {activeView === "queue" && requestId ? (
        <AdminSection
          title="Request detail"
          description="Inspect the selected request, its current state, and its operating history."
          className="pt-0"
        >
          <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none">
            <AdminDirectConnectRequestDetail requestId={requestId} />
          </div>
        </AdminSection>
      ) : null}

      {activeView === "queue" ? (
        <AdminSection
          title="Request queue"
          description="Find every Direct Connect request, then inspect its requester, assignments, and operating history."
          className={requestId ? undefined : "pt-0"}
        >
          <AdminDirectConnectQueue />
        </AdminSection>
      ) : (
        <AdminSection
          title="Create a request"
          description="Create a customer request on someone’s behalf while preserving the normal request lifecycle and routing controls."
          className="pt-0"
        >
          <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div>div:first-child]:hidden [&>div>div:last-child]:p-0">
            <AdminDirectConnectRequestCard />
          </div>
        </AdminSection>
      )}
    </AdminWorkspace>
  );
}
