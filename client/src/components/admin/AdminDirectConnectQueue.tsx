import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Link } from "wouter";
import { AdminEmptyState, AdminList, AdminToolbar } from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

const PAGE_SIZE = 25;

type QueueItem = {
  id: string;
  title: string;
  status: string | null;
  category: string | null;
  createdAt: string | null;
  requesterEmail: string | null;
  requesterName: string | null;
  profileSlug: string | null;
  businessName: string | null;
  assignmentCount: number;
  responseCount: number;
};

type QueueResponse = {
  requests: QueueItem[];
  hasMore: boolean;
  nextOffset: number | null;
};

function formatDate(value: string | null): string {
  if (!value) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

function formatToken(value: string | null): string {
  return String(value || "unknown").replaceAll("_", " ");
}

export function AdminDirectConnectQueue() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);
  const query = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
      status,
    });
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [offset, search, status]);
  const { data, isError, isFetching, isLoading } = useQuery<QueueResponse>({
    queryKey: ["/api/admin/direct-connect/requests", query],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests?${query}`),
    refetchInterval: 30_000,
  });

  const requests = data?.requests ?? [];
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4" data-testid="admin-direct-connect-queue">
      <AdminToolbar>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/40" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search request, person, email, or business"
            aria-label="Search Direct Connect requests"
            className="pl-9"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setOffset(0);
          }}
        >
          <SelectTrigger className="w-full md:w-48" aria-label="Filter requests by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="routed">Routed</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="pending_outcome">Pending outcome</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </AdminToolbar>

      {isLoading ? <div className="px-4 py-10 text-sm text-white/55">Loading requests…</div> : null}
      {isError ? (
        <div className="border-y border-red-400/20 bg-red-500/5 px-4 py-5 text-sm text-red-200">
          The request queue could not be loaded. Try again in a moment.
        </div>
      ) : null}
      {!isLoading && !isError && requests.length === 0 ? (
        <AdminEmptyState
          title="No matching requests"
          description="Change the status or search text to see a different part of the queue."
        />
      ) : null}

      {requests.length > 0 ? (
        <AdminList>
          {requests.map((request) => (
            <article
              key={request.id}
              className="grid gap-3 px-3 py-4 transition hover:bg-white/[0.025] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/direct-connect-requests?requestId=${encodeURIComponent(request.id)}`}
                    className="truncate font-medium text-white hover:text-ts-orange"
                  >
                    {request.title}
                  </Link>
                  <Badge variant="outline" className="capitalize">
                    {formatToken(request.status)}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
                  <span>{formatDate(request.createdAt)}</span>
                  <span className="capitalize">{formatToken(request.category)}</span>
                  <span>{request.assignmentCount} assignments</span>
                  <span>{request.responseCount} responses</span>
                </div>
                <div className="mt-2 text-xs text-white/60">
                  {request.requesterName || request.requesterEmail || "Unknown requester"}
                  {request.businessName ? ` · ${request.businessName}` : ""}
                  {request.profileSlug ? ` · /u/${request.profileSlug}` : ""}
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full md:w-auto">
                <Link
                  href={`/admin/direct-connect-requests?requestId=${encodeURIComponent(request.id)}`}
                >
                  Review
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </article>
          ))}
        </AdminList>
      ) : null}

      {!isLoading && !isError ? (
        <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/45">
            Page {pageNumber}
            {requests.length ? ` · Showing ${offset + 1}–${offset + requests.length}` : ""}
            {isFetching && !isLoading ? " · Refreshing" : ""}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0 || isFetching}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!data?.hasMore || isFetching}
              onClick={() => setOffset(data?.nextOffset ?? offset + PAGE_SIZE)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
