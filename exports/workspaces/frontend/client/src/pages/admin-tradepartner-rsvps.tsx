import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";

type AttendanceStatus = "pending" | "showed_up" | "no_show" | "cancelled";

type TradePartnerRsvp = {
  id: number | string;
  partnerSlug: string;
  countySlug: string;
  countyLabel: string;
  eventLabel: string;
  meetingId: string | null;
  meetingDate: string | null;
  timeLabel: string | null;
  startDateTime: string | null;
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  attendeeCount: number;
  lunchAttendees: number;
  notes: string | null;
  submittedByUserId: string | null;
  attendanceStatus: AttendanceStatus;
  attendanceNotes: string | null;
  checkedInAt: string | null;
  checkedInByUserId: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type TradePartnerRsvpResponse = {
  items: TradePartnerRsvp[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const PAGE_SIZE = 100;

function buildListPath(
  countySlug: string,
  partnerSlug: string,
  status: AttendanceStatus | "all",
  search: string,
  offset: number,
  limit = PAGE_SIZE
): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (countySlug) params.set("countySlug", countySlug);
  if (partnerSlug) params.set("partnerSlug", partnerSlug);
  if (status !== "all") params.set("status", status);
  if (search) params.set("q", search);
  return `/api/admin/tradepartner-rsvps?${params.toString()}`;
}

function buildExportPath(
  countySlug: string,
  partnerSlug: string,
  status: AttendanceStatus | "all",
  search: string
): string {
  const params = new URLSearchParams();
  if (countySlug) params.set("countySlug", countySlug);
  if (partnerSlug) params.set("partnerSlug", partnerSlug);
  if (status !== "all") params.set("status", status);
  if (search) params.set("q", search);
  params.set("maxRows", "20000");
  return `/api/admin/tradepartner-rsvps/export.csv?${params.toString()}`;
}

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^"]+)"?/i.exec(headerValue);
  if (!match?.[1]) return null;
  return match[1];
}

function statusBadge(status: AttendanceStatus) {
  switch (status) {
    case "showed_up":
      return <Badge className="bg-emerald-600 text-white">Showed Up</Badge>;
    case "no_show":
      return <Badge className="bg-red-700 text-white">No Show</Badge>;
    case "cancelled":
      return <Badge className="bg-zinc-600 text-white">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

export default function AdminTradePartnerRsvps() {
  const queryClient = useQueryClient();
  const [countySlugInput, setCountySlugInput] = useState("");
  const [partnerSlugInput, setPartnerSlugInput] = useState("cumulus-media");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("pending");
  const [editNotes, setEditNotes] = useState("");

  const countySlug = countySlugInput.trim().toLowerCase();
  const partnerSlug = partnerSlugInput.trim().toLowerCase();
  const search = searchInput.trim();

  const queryPath = useMemo(
    () => buildListPath(countySlug, partnerSlug, statusFilter, search, offset, PAGE_SIZE),
    [countySlug, partnerSlug, statusFilter, search, offset]
  );

  const { data, isLoading, isFetching, error } = useQuery<TradePartnerRsvpResponse>({
    queryKey: [
      "/api/admin/tradepartner-rsvps",
      countySlug,
      partnerSlug,
      statusFilter,
      search,
      offset,
    ],
    queryFn: () => apiRequest("GET", queryPath),
  });

  const updateAttendance = useMutation({
    mutationFn: async ({
      id,
      status,
      attendanceNotes,
    }: {
      id: string;
      status: AttendanceStatus;
      attendanceNotes: string;
    }) => {
      return apiRequest("PATCH", `/api/admin/tradepartner-rsvps/${id}/attendance`, {
        status,
        attendanceNotes,
      });
    },
    onSuccess: () => {
      setEditingId(null);
      setEditNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tradepartner-rsvps"] });
    },
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext = data?.hasMore === true;

  const handleApplyFilters = () => {
    setOffset(0);
  };

  const openEdit = (row: TradePartnerRsvp) => {
    setEditingId(String(row.id));
    setEditStatus(row.attendanceStatus);
    setEditNotes(row.attendanceNotes || "");
  };

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const path = buildExportPath(countySlug, partnerSlug, statusFilter, search);
      const response = await fetch(buildApiUrl(path), {
        method: "GET",
        credentials: "include",
        headers: { Accept: "text/csv" },
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const headerFilename = getFilenameFromHeader(response.headers.get("content-disposition"));
      const fallbackFilename = `tradepartner-rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
      const filename = headerFilename || fallbackFilename;

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setExportError(err?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>TradePartner RSVP Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Partner slug</div>
              <Input
                value={partnerSlugInput}
                onChange={(e) => setPartnerSlugInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">County slug</div>
              <Input
                placeholder="tangipahoa-parish-la"
                value={countySlugInput}
                onChange={(e) => setCountySlugInput(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Attendance status</div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="showed_up">Showed Up</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">Search</div>
              <Input
                placeholder="Business, contact, email, event..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={handleApplyFilters}>
              Apply Filters
            </Button>
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Loading RSVPs..." : `${total.toLocaleString()} RSVP records`}
              {isFetching && !isLoading ? " (refreshing...)" : ""}
            </div>
            <Button onClick={handleExport} disabled={exporting || isLoading}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>

          {error ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {(error as Error)?.message || "Failed to load RSVPs"}
            </div>
          ) : null}

          {exportError ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {exportError}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1700px] text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Submitted</th>
                  <th className="px-3 py-2 font-medium">County</th>
                  <th className="px-3 py-2 font-medium">Meeting</th>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Seats</th>
                  <th className="px-3 py-2 font-medium">Attendance</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={8}>
                      No RSVPs found for current filters.
                    </td>
                  </tr>
                ) : null}

                {rows.map((row) => {
                  const isEditing = editingId === String(row.id);
                  return (
                    <tr key={`${row.id}`} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{row.countyLabel || row.countySlug}</div>
                        <div className="text-xs text-muted-foreground">{row.countySlug}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.eventLabel}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.meetingDate || "-"} {row.timeLabel || ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.businessName}</div>
                        <div className="text-xs text-muted-foreground">
                          User: {row.submittedByUserId || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.contactName}</div>
                        <a className="underline" href={`mailto:${row.contactEmail}`}>
                          {row.contactEmail}
                        </a>
                        <div className="text-xs text-muted-foreground">
                          {row.contactPhone || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{row.attendeeCount} total</div>
                        <div className="text-xs text-muted-foreground">
                          {row.lunchAttendees} lunch
                        </div>
                      </td>
                      <td className="px-3 py-2 space-y-2">
                        <div>{statusBadge(row.attendanceStatus)}</div>
                        {row.checkedInAt ? (
                          <div className="text-xs text-muted-foreground">
                            Check-in: {new Date(row.checkedInAt).toLocaleString()}
                          </div>
                        ) : null}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Select
                              value={editStatus}
                              onValueChange={(v) => setEditStatus(v as AttendanceStatus)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="showed_up">Showed Up</SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Internal attendance notes"
                              className="min-h-[72px]"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {row.attendanceNotes || "-"}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 space-y-2">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() =>
                                updateAttendance.mutate({
                                  id: String(row.id),
                                  status: editStatus,
                                  attendanceNotes: editNotes,
                                })
                              }
                              disabled={updateAttendance.isPending}
                            >
                              {updateAttendance.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditingId(null);
                                setEditNotes("");
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                            Update
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">Page {currentPage}</div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!hasPrev || isLoading || isFetching}
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={!hasNext || isLoading || isFetching}
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
