import { useSearch } from "wouter";
import { AdminDirectConnectRequestCard } from "@/components/admin/AdminDirectConnectRequestCard";
import { AdminDirectConnectRequestDetail } from "@/components/admin/AdminDirectConnectRequestDetail";
import { AdminDirectConnectQueue } from "@/components/admin/AdminDirectConnectQueue";

export default function AdminDirectConnectRequestsPage() {
  const search = useSearch();
  const requestId = new URLSearchParams(search).get("requestId");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      {requestId ? <AdminDirectConnectRequestDetail requestId={requestId} /> : null}
      <AdminDirectConnectQueue />
      <AdminDirectConnectRequestCard />
    </div>
  );
}
