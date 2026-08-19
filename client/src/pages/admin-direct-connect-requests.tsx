import { useSearch } from "wouter";
import {
  AdminSection,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { AdminDirectConnectRequestCard } from "@/components/admin/AdminDirectConnectRequestCard";
import { AdminDirectConnectRequestDetail } from "@/components/admin/AdminDirectConnectRequestDetail";

export default function AdminDirectConnectRequestsPage() {
  const search = useSearch();
  const requestId = new URLSearchParams(search).get("requestId");

  return (
    <AdminWorkspace data-testid="admin-request-operations-v2">
      {requestId ? (
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

      <AdminSection
        title="Create a request"
        description="Create a customer request on someone’s behalf while preserving the normal request lifecycle and routing controls."
        className={requestId ? undefined : "pt-0"}
      >
        <div className="[&>div]:rounded-none [&>div]:border-x-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div>div:first-child]:hidden [&>div>div:last-child]:p-0">
          <AdminDirectConnectRequestCard />
        </div>
      </AdminSection>
    </AdminWorkspace>
  );
}
