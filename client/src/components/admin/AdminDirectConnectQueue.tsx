import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

type QueueItem = {
  id: string;
  title: string;
  status: string | null;
  category: string | null;
  source: string | null;
  createdAt: string | null;
  requesterId: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  profileSlug: string | null;
  businessName: string | null;
  assignmentCount: number;
  responseCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function AdminDirectConnectQueue() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const query = useMemo(() => {
    const params = new URLSearchParams({ limit: "250", status });
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [search, status]);
  const { data, isLoading, isError } = useQuery<{ requests: QueueItem[] }>({
    queryKey: ["/api/admin/direct-connect/requests", query],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests?${query}`),
    refetchInterval: 30_000,
  });

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-white">Direct Connect operations queue</CardTitle>
        <CardDescription>
          Every request available to TradeScout staff for review and assistance.
        </CardDescription>
        <div className="grid gap-2 pt-2 sm:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search request, person, email, or business"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="routed">Routed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? <div className="text-sm text-white/60">Loading requests…</div> : null}
        {isError ? <div className="text-sm text-red-300">Could not load the request queue.</div> : null}
        {!isLoading && !isError && (data?.requests.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-white/60">
            No requests match this filter.
          </div>
        ) : null}
        {data?.requests.map((request) => (
          <Link
            key={request.id}
            href={`/admin/direct-connect-requests?requestId=${encodeURIComponent(request.id)}`}
            className="block rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-orange-500/40 hover:bg-orange-500/5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-white">{request.title}</div>
                <div className="mt-1 text-xs text-white/55">
                  {request.requesterName || request.requesterEmail || "Unknown requester"}
                  {request.businessName ? ` → ${request.businessName}` : ""}
                </div>
              </div>
              <Badge variant="outline">{request.status || "unknown"}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
              <span>{formatDate(request.createdAt)}</span>
              <span>{request.assignmentCount} assignments</span>
              <span>{request.responseCount} responses</span>
              <span>{request.source || "unknown source"}</span>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
