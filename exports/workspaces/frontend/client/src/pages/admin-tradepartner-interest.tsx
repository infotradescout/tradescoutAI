import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/apiBaseUrl";

type TradePartnerInterestSubmission = {
  id: number | string;
  countySlug: string;
  countyName: string | null;
  stateCode: string | null;
  businessName: string;
  serviceCategory: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  acknowledgesExclusivity: boolean;
  acknowledgesTerm: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
};

type TradePartnerInterestResponse = {
  items: TradePartnerInterestSubmission[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const PAGE_SIZE = 100;

function buildListPath(
  countySlug: string,
  search: string,
  offset: number,
  limit = PAGE_SIZE
): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (countySlug) params.set("countySlug", countySlug);
  if (search) params.set("q", search);
  return `/api/admin/tradepartner-interest?${params.toString()}`;
}

function buildExportPath(countySlug: string, search: string): string {
  const params = new URLSearchParams();
  if (countySlug) params.set("countySlug", countySlug);
  if (search) params.set("q", search);
  params.set("maxRows", "20000");
  return `/api/admin/tradepartner-interest/export.csv?${params.toString()}`;
}

function getFilenameFromHeader(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const match = /filename="?([^"]+)"?/i.exec(headerValue);
  if (!match?.[1]) return null;
  return match[1];
}

export default function AdminTradePartnerInterest() {
  const [countySlugInput, setCountySlugInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const countySlug = countySlugInput.trim().toLowerCase();
  const search = searchInput.trim();

  const queryPath = useMemo(
    () => buildListPath(countySlug, search, offset, PAGE_SIZE),
    [countySlug, search, offset]
  );

  const { data, isLoading, isFetching, error } = useQuery<TradePartnerInterestResponse>({
    queryKey: ["/api/admin/tradepartner-interest", countySlug, search, offset],
    queryFn: () => apiRequest("GET", queryPath),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext = data?.hasMore === true;

  const handleApplyFilters = () => {
    setOffset(0);
  };

  const handleExport = async () => {
    setExportError(null);
    setExporting(true);

    try {
      const path = buildExportPath(countySlug, search);
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
      const fallbackFilename = `tradepartner-interest-${new Date().toISOString().slice(0, 10)}.csv`;
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
          <CardTitle>Trade Partner Interest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">County slug</div>
              <Input
                placeholder="escambia-fl"
                value={countySlugInput}
                onChange={(e) => setCountySlugInput(e.target.value)}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-muted-foreground">Search</div>
              <Input
                placeholder="Business, contact, email, category..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button className="w-full" variant="secondary" onClick={handleApplyFilters}>
                Apply Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {isLoading ? "Loading submissions..." : `${total.toLocaleString()} total submissions`}
              {isFetching && !isLoading ? " (refreshing...)" : ""}
            </div>
            <Button onClick={handleExport} disabled={exporting || isLoading}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>

          {error ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {(error as Error)?.message || "Failed to load submissions"}
            </div>
          ) : null}

          {exportError ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {exportError}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Submitted</th>
                  <th className="px-3 py-2 font-medium">County</th>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Phone</th>
                  <th className="px-3 py-2 font-medium">Message</th>
                  <th className="px-3 py-2 font-medium">Acknowledged</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-muted-foreground" colSpan={9}>
                      No submissions found for the current filter.
                    </td>
                  </tr>
                ) : null}

                {rows.map((row) => {
                  const countyLabel =
                    row.countyName && row.stateCode
                      ? `${row.countyName}, ${row.stateCode}`
                      : row.countySlug;

                  return (
                    <tr key={`${row.id}`} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{countyLabel}</td>
                      <td className="px-3 py-2">{row.businessName}</td>
                      <td className="px-3 py-2">{row.serviceCategory}</td>
                      <td className="px-3 py-2">{row.contactName}</td>
                      <td className="px-3 py-2">
                        <a className="underline" href={`mailto:${row.email}`}>
                          {row.email}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.phone || "-"}</td>
                      <td className="px-3 py-2 max-w-[360px] truncate" title={row.message || ""}>
                        {row.message || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.acknowledgesExclusivity && row.acknowledgesTerm ? "Yes" : "No"}
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
