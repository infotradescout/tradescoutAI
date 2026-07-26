import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Search,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const PAGE_SIZE = 25;

type DirectConnectStatus =
  | "draft"
  | "open"
  | "routed"
  | "in_progress"
  | "pending_outcome"
  | "completed"
  | "cancelled";

type QueueItem = {
  id: string;
  title: string;
  status: DirectConnectStatus | null;
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

type QueueResponse = {
  requests: QueueItem[];
  hasMore?: boolean;
  nextOffset?: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function formatToken(value: string | null) {
  return value ? value.replaceAll("_", " ") : "unknown";
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
  const { data, isLoading, isError, isFetching } = useQuery<QueueResponse>({
    queryKey: ["/api/admin/direct-connect/requests", query],
    queryFn: () => apiRequest("GET", `/api/admin/direct-connect/requests?${query}`),
    refetchInterval: 30_000,
  });

  const requests = data?.requests ?? [];
  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrevious = offset > 0;
  const hasNext = data?.hasMore === true;
  const nextOffset = typeof data?.nextOffset === "number" ? data.nextOffset : offset + PAGE_SIZE;

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-white">Operations queue</CardTitle>
            <CardDescription>
              Every request available to TradeScout staff operators for review and assistance.
            </CardDescription>
          </div>
          {isFetching && !isLoading ? (
            <Badge variant="outline" className="text-white/60">
              Refreshing
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-2 pt-2 sm:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOffset(0);
              }}
              placeholder="Search request, person, email, or business"
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
            <SelectTrigger>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <div className="text-sm text-white/60">Loading requests…</div> : null}
        {isError ? (
          <div className="text-sm text-red-300">Could not load the request queue.</div>
        ) : null}
        {!isLoading && !isError && requests.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-sm text-white/60">
            No requests match this filter.
          </div>
        ) : null}
        {requests.map((request) => {
          const requestHref = `/admin/direct-connect-requests?requestId=${encodeURIComponent(
            request.id
          )}`;
          const requesterHref = request.requesterId
            ? `/profile/${encodeURIComponent(request.requesterId)}`
            : null;
          const businessHref = request.profileSlug
            ? `/u/${encodeURIComponent(request.profileSlug)}`
            : null;

          return (
            <article
              key={request.id}
              className="rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-orange-500/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={requestHref}
                    className="inline-flex max-w-full items-center gap-1 font-medium text-white hover:text-ts-orange"
                  >
                    <span className="truncate">{request.title}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                  </Link>
                  <div className="mt-1 text-xs capitalize text-white/50">
                    {formatToken(request.category)}
                  </div>
                </div>
                <Badge variant="outline">{request.status || "unknown"}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                <span>{formatDate(request.createdAt)}</span>
                <span>{request.assignmentCount} assignments</span>
                <span>{request.responseCount} responses</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <Link
                  href={requestHref}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-white/80 hover:border-ts-orange/50 hover:text-white"
                >
                  Review request
                </Link>
                {requesterHref ? (
                  <Link
                    href={requesterHref}
                    className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-white/70 hover:border-ts-orange/50 hover:text-white"
                  >
                    <UserRound className="h-3.5 w-3.5" />
                    <span className="max-w-44 truncate">
                      {request.requesterName || request.requesterEmail || "Requester profile"}
                    </span>
                  </Link>
                ) : (
                  <span className="inline-flex min-h-9 items-center text-xs text-white/40">
                    Requester profile unavailable
                  </span>
                )}
                {businessHref ? (
                  <Link
                    href={businessHref}
                    className="inline-flex min-h-9 min-w-0 items-center gap-1.5 rounded-md border border-white/10 px-2.5 text-xs font-medium text-white/70 hover:border-ts-orange/50 hover:text-white"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="max-w-44 truncate">
                      {request.businessName || "Business profile"}
                    </span>
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-white/50">
              Page {pageNumber}
              {requests.length > 0 ? ` · Showing ${offset + 1}–${offset + requests.length}` : ""}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrevious || isFetching}
                onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext || isFetching}
                onClick={() => setOffset(nextOffset)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
