import { useSearch } from "wouter";
import { AdminDirectConnectRequestCard } from "@/components/admin/AdminDirectConnectRequestCard";
import { AdminDirectConnectRequestDetail } from "@/components/admin/AdminDirectConnectRequestDetail";

export default function AdminDirectConnectRequestsPage() {
  const search = useSearch();
  const requestId = new URLSearchParams(search).get("requestId");

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      {requestId ? <AdminDirectConnectRequestDetail requestId={requestId} /> : null}
      <AdminDirectConnectRequestCard />
    </div>
  );
}
