import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type LineItem = {
  id: string;
  lineType: string;
  name: string;
  quantity: number;
  unit: string | null;
  unitCost: number | null;
  totalCost: number;
};

type EstimateDetail = {
  estimateId: string;
  jobWorkspaceId: string;
  requestId: string;
  title: string;
  scopeSummary: string;
  status: "draft" | "sent" | "accepted" | "change_requested" | "declined" | "void";
  totalEstimate: number;
  lineItems: LineItem[];
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

const LINE_TYPES = [
  "material",
  "labor",
  "permits",
  "disposal",
  "travel",
  "equipment",
  "other",
] as const;

export function CreateEstimatePanel({
  jobWorkspaceId,
  onCreated,
}: {
  jobWorkspaceId: string;
  onCreated?: (estimateId: string) => void;
}) {
  const { toast } = useToast();
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [scopeSummary, setScopeSummary] = useState("");
  const [lineDraft, setLineDraft] = useState({
    name: "",
    quantity: "1",
    unit: "each",
    unitCost: "",
  });
  const [lines, setLines] = useState<LineItem[]>([]);
  const [total, setTotal] = useState(0);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/direct-connect/jobs/${jobWorkspaceId}/estimates`, {
        title: title.trim(),
        scopeSummary: scopeSummary.trim(),
      }),
    onSuccess: (data: any) => {
      setEstimateId(data.estimateId);
      onCreated?.(data.estimateId);
    },
    onError: (error: any) => {
      toast({
        title: "Could not start estimate",
        description: formatUserFacingErrorMessage(error, "Could not start estimate."),
        variant: "destructive",
      });
    },
  });

  const addLineMutation = useMutation({
    mutationFn: () => {
      if (!estimateId) throw new Error("Create the estimate first");
      return apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/estimates/${estimateId}/line-items`,
        {
          lineType: "other",
          name: lineDraft.name.trim(),
          quantity: Number(lineDraft.quantity) || 1,
          unit: lineDraft.unit.trim() || "each",
          unitCost: lineDraft.unitCost ? Number(lineDraft.unitCost) : undefined,
        }
      );
    },
    onSuccess: (data: any) => {
      setLines((current) => [
        ...current,
        {
          id: data.lineItemId,
          lineType: "other",
          name: lineDraft.name.trim(),
          quantity: Number(lineDraft.quantity) || 1,
          unit: lineDraft.unit.trim() || "each",
          unitCost: lineDraft.unitCost ? Number(lineDraft.unitCost) : null,
          totalCost:
            (Number(lineDraft.quantity) || 1) *
            (lineDraft.unitCost ? Number(lineDraft.unitCost) : 0),
        },
      ]);
      setTotal(data.totals?.totalEstimate ?? 0);
      setLineDraft({ name: "", quantity: "1", unit: "each", unitCost: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not add line item",
        description: formatUserFacingErrorMessage(error, "Could not add line item."),
        variant: "destructive",
      });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () => {
      if (!estimateId) throw new Error("Create the estimate first");
      return apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/estimates/${estimateId}/send`,
        {}
      );
    },
    onSuccess: () => {
      toast({ title: "Estimate sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send estimate",
        description: formatUserFacingErrorMessage(error, "Could not send estimate."),
        variant: "destructive",
      });
    },
  });

  const sent = sendMutation.isSuccess;

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-base">Create estimate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <p className="text-sm text-emerald-400">
            Estimate sent. The requester will review it next.
          </p>
        ) : (
          <>
            {!estimateId ? (
              <>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Estimate title"
                />
                <Textarea
                  value={scopeSummary}
                  onChange={(e) => setScopeSummary(e.target.value)}
                  placeholder="Scope of work (what's included)"
                  className="min-h-[100px]"
                />
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={
                    createMutation.isPending ||
                    title.trim().length < 3 ||
                    scopeSummary.trim().length < 10
                  }
                >
                  Start estimate
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {lines.map((line) => (
                    <div key={line.id} className="flex justify-between text-sm">
                      <span>
                        {line.name} ({line.quantity} {line.unit})
                      </span>
                      <span>{formatMoney(line.totalCost)}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={lineDraft.name}
                    onChange={(e) => setLineDraft((c) => ({ ...c, name: e.target.value }))}
                    placeholder="Item name"
                    className="col-span-2"
                  />
                  <Input
                    value={lineDraft.quantity}
                    onChange={(e) => setLineDraft((c) => ({ ...c, quantity: e.target.value }))}
                    placeholder="Qty"
                    type="number"
                  />
                  <Input
                    value={lineDraft.unitCost}
                    onChange={(e) => setLineDraft((c) => ({ ...c, unitCost: e.target.value }))}
                    placeholder="Unit cost"
                    type="number"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => addLineMutation.mutate()}
                  disabled={addLineMutation.isPending || lineDraft.name.trim().length < 2}
                >
                  Add line item
                </Button>
                <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-sm font-semibold">{formatMoney(total)}</span>
                </div>
                <Button
                  onClick={() => sendMutation.mutate()}
                  disabled={sendMutation.isPending || lines.length === 0}
                  className="w-full bg-ts-orange text-text-black hover:bg-ts-orange/90"
                >
                  Send estimate to requester
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ReviewEstimatePanel({
  jobWorkspaceId,
  estimateId,
}: {
  jobWorkspaceId: string;
  estimateId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const { data: estimate, isLoading } = useQuery<EstimateDetail>({
    queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "estimates", estimateId],
    queryFn: () =>
      apiRequest("GET", `/api/direct-connect/jobs/${jobWorkspaceId}/estimates/${estimateId}`),
  });

  const respondMutation = useMutation({
    mutationFn: (decision: "accept" | "request_changes" | "decline") =>
      apiRequest(
        "POST",
        `/api/direct-connect/jobs/${jobWorkspaceId}/estimates/${estimateId}/respond`,
        {
          decision,
          note: note.trim() || undefined,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/direct-connect/jobs", jobWorkspaceId, "estimates", estimateId],
      });
      toast({ title: "Response sent" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send response",
        description: formatUserFacingErrorMessage(error, "Could not send response."),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
        <CardContent className="p-4 text-sm text-[color:var(--text-secondary)]">
          Loading estimate...
        </CardContent>
      </Card>
    );
  }

  if (!estimate) return null;

  const canRespond = estimate.status === "sent";

  return (
    <Card className="border-ts-orange/35 bg-[color:var(--surface-card)]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{estimate.title}</CardTitle>
          <Badge variant="outline">{estimate.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[color:var(--text-secondary)]">{estimate.scopeSummary}</p>
        <div className="space-y-1.5">
          {estimate.lineItems.map((line) => (
            <div key={line.id} className="flex justify-between text-sm">
              <span>
                {line.name} ({line.quantity} {line.unit})
              </span>
              <span>{formatMoney(line.totalCost)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-3">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold">{formatMoney(estimate.totalEstimate)}</span>
        </div>
        {canRespond && (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="min-h-[70px]"
            />
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => respondMutation.mutate("accept")}
                disabled={respondMutation.isPending}
                className="bg-ts-orange text-text-black hover:bg-ts-orange/90"
              >
                Accept
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("request_changes")}
                disabled={respondMutation.isPending}
              >
                Request changes
              </Button>
              <Button
                variant="outline"
                onClick={() => respondMutation.mutate("decline")}
                disabled={respondMutation.isPending}
              >
                Decline
              </Button>
            </div>
          </>
        )}
        {estimate.status === "accepted" && (
          <p className="text-sm text-emerald-400">Estimate accepted. Work can proceed.</p>
        )}
        {estimate.status === "declined" && (
          <p className="text-sm text-rose-400">Estimate declined.</p>
        )}
      </CardContent>
    </Card>
  );
}
