import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type LiveStreamItem = {
  id: string;
  timestamp: string;
  kind: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  narrative: string;
  source: string;
};

type LiveStreamResponse = {
  generatedAt: string;
  summary: {
    truthNow: string;
    currentLeadCounty: string | null;
    currentLeadState: string | null;
    crawlerRequests24h: number;
    activeAlerts: number;
  };
  stream: LiveStreamItem[];
};

const priorityTone: Record<LiveStreamItem["priority"], string> = {
  critical: "bg-red-600/20 text-red-200 border-red-500/30",
  high: "bg-orange-600/20 text-orange-200 border-orange-500/30",
  medium: "bg-blue-600/20 text-blue-200 border-blue-500/30",
  low: "bg-white/10 text-white/70 border-white/10",
};

export default function AdminLiveStreamPage() {
  const { data, isLoading, error } = useQuery<LiveStreamResponse>({
    queryKey: ["/api/admin/observability/live-stream"],
    queryFn: async () => {
      const response = await fetch("/api/admin/observability/live-stream", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch live stream");
      }
      return response.json();
    },
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-6">
      <Card className="bg-tsCard/95 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">TradeScout Live Stream</CardTitle>
          <CardDescription className="text-white/70">
            Real-time natural-language stream of current system truth, crawler activity, partner
            intelligence, and LISA findings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Truth Now</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.truthNow || (isLoading ? "Loading..." : "Unavailable")}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Lead County</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.currentLeadCounty || "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">Lead State</div>
              <div className="mt-2 text-sm text-white/85">
                {data?.summary.currentLeadState || "Unavailable"}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-white/40">
                Crawler Requests 24h
              </div>
              <div className="mt-2 text-sm text-white/85">
                {typeof data?.summary.crawlerRequests24h === "number"
                  ? data.summary.crawlerRequests24h
                  : "Unavailable"}
              </div>
            </div>
          </div>

          <div className="text-xs text-white/50">
            {data?.generatedAt
              ? `Updated ${new Date(data.generatedAt).toLocaleString()}`
              : isLoading
                ? "Loading live stream..."
                : "No live stream available"}
          </div>

          {error ? (
            <div className="rounded-md border border-red-600/40 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              Failed to load live stream.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-tsCard/95 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Live Feed</CardTitle>
          <CardDescription className="text-white/70">
            Server-produced entries only. The UI does not synthesize intelligence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(data?.stream || []).length === 0 ? (
              <div className="text-sm text-white/65">
                {isLoading ? "Loading stream..." : "No live entries available."}
              </div>
            ) : (
              data?.stream.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-white">{item.title}</div>
                      <Badge className={priorityTone[item.priority]}>{item.priority}</Badge>
                      <Badge variant="outline" className="border-white/10 text-white/60">
                        {item.source}
                      </Badge>
                    </div>
                    <div className="text-xs text-white/50">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm text-white/80">{item.narrative}</div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
