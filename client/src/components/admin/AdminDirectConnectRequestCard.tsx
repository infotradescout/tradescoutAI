import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StateCountySelector } from "@/components/state-county-selector";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createClientOperationId } from "@/lib/clientOperationId";

type DirectConnectAdminResult = {
  request?: { id?: string | null; status?: string | null } | null;
  requesterIntent?: string | null;
  resolvedCategory?: string | null;
  resolvedTradeId?: string | null;
  createdTradeId?: boolean;
  createdForUser?: { id?: string; email?: string } | null;
  targetUserProvisioned?: boolean;
  targetUserExisted?: boolean;
  setupEmailSent?: boolean;
  requestEmailSent?: boolean;
  setupEmailSkippedReason?: string | null;
  requestEmailSkippedReason?: string | null;
  setupEmailMessageId?: string;
  requestEmailMessageId?: string;
  activationLinkIncluded?: boolean;
  verifyLinkIncluded?: boolean;
  idempotentReplay?: boolean;
  operationId?: string;
};

const adminDirectConnectRequestTypes = [
  {
    value: "service_request",
    label: "Service request",
    helper: "Customer needs a provider to do work.",
  },
  {
    value: "business_request",
    label: "Business request",
    helper: "Business needs another business/service partner.",
  },
  {
    value: "customer_support",
    label: "Hire for someone else",
    helper: "Create a request on behalf of someone else who needs help.",
  },
] as const;

export function AdminDirectConnectRequestCard() {
  const { toast } = useToast();
  const pendingCreateOperationRef = useRef<{
    fingerprint: string;
    operationId: string;
  } | null>(null);

  const [targetUserEmail, setTargetUserEmail] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestCategory, setRequestCategory] =
    useState<(typeof adminDirectConnectRequestTypes)[number]["value"]>("service_request");
  const [requestTradeId, setRequestTradeId] = useState("");
  const [requestCountyFips, setRequestCountyFips] = useState("");
  const [requestStateCode, setRequestStateCode] = useState("");
  const [requestBudgetMin, setRequestBudgetMin] = useState("");
  const [requestBudgetMax, setRequestBudgetMax] = useState("");
  const [targetContractorIds, setTargetContractorIds] = useState("");
  const [directConnectResult, setDirectConnectResult] = useState<DirectConnectAdminResult | null>(
    null
  );

  const createDirectConnectRequest = useMutation({
    mutationFn: async (options: { autoRoute: boolean }) => {
      const contractorIds = targetContractorIds
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const payload: Record<string, unknown> = {
        title: requestTitle.trim(),
        description: requestDescription.trim(),
      };

      if (targetUserId.trim()) payload.targetUserId = targetUserId.trim();
      if (targetUserEmail.trim()) payload.targetEmail = targetUserEmail.trim().toLowerCase();
      payload.category = requestCategory;
      if (requestTradeId.trim()) payload.tradeId = requestTradeId.trim();
      if (requestCountyFips.trim()) payload.countyFips = requestCountyFips.trim();
      if (requestStateCode.trim()) payload.stateCode = requestStateCode.trim().toUpperCase();
      if (requestBudgetMin.trim()) payload.budgetMin = Number(requestBudgetMin);
      if (requestBudgetMax.trim()) payload.budgetMax = Number(requestBudgetMax);
      if (contractorIds.length > 0) payload.targetProviderIds = contractorIds;
      payload.autoRoute = options.autoRoute;
      const fingerprint = JSON.stringify(payload);
      const operationId =
        pendingCreateOperationRef.current?.fingerprint === fingerprint
          ? pendingCreateOperationRef.current.operationId
          : createClientOperationId("dc-admin");
      pendingCreateOperationRef.current = { fingerprint, operationId };
      payload.operationId = operationId;

      return apiRequest("POST", "/api/admin/direct-connect/requests", payload);
    },
    onSuccess: (data: any, variables) => {
      pendingCreateOperationRef.current = null;
      setDirectConnectResult(data as DirectConnectAdminResult);
      const emailSummary = data?.idempotentReplay
        ? "Existing request recovered; no email resent"
        : data?.setupEmailSent
          ? "Setup email sent"
          : data?.requestEmailSent
            ? "Request notification sent"
            : "Request created (email not sent)";
      toast({
        title: data?.idempotentReplay
          ? "Direct Connect request recovered"
          : "Direct Connect request created",
        description: `${emailSummary} for ${data?.createdForUser?.email || "target user"}. ${
          variables?.autoRoute ? "Auto-route started." : "Manual routing preserved."
        }`,
      });
      setTargetUserId("");
      setTargetUserEmail("");
      setRequestTitle("");
      setRequestDescription("");
      setRequestCategory("service_request");
      setRequestTradeId("");
      setRequestCountyFips("");
      setRequestStateCode("");
      setRequestBudgetMin("");
      setRequestBudgetMax("");
      setTargetContractorIds("");
    },
    onError: (e: any) => {
      toast({
        title: "Failed to create request",
        description: e?.message || "Could not create Direct Connect request",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
      <CardHeader>
        <CardTitle className="text-white">Create Direct Connect Request for User</CardTitle>
        <CardDescription className="text-[color:var(--text-secondary)]">
          Use this when the target user is looking to get work done or hire a provider. The request
          still enters the normal Direct Connect lifecycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Target user email</label>
            <Input
              value={targetUserEmail}
              onChange={(e) => setTargetUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Target user ID (optional)</label>
            <Input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="uuid..."
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Request title</label>
            <Input
              value={requestTitle}
              onChange={(e) => setRequestTitle(e.target.value)}
              placeholder="Roof leak repair request"
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Request type</label>
            <Select
              value={requestCategory}
              onValueChange={(value) =>
                setRequestCategory(
                  value as (typeof adminDirectConnectRequestTypes)[number]["value"]
                )
              }
            >
              <SelectTrigger className="flex h-10 w-full rounded-xl border-[color:var(--border-subtle)] bg-black/30 text-sm text-white">
                <SelectValue placeholder="Select request type" />
              </SelectTrigger>
              <SelectContent>
                {adminDirectConnectRequestTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[11px] text-white/50">
              {
                adminDirectConnectRequestTypes.find((option) => option.value === requestCategory)
                  ?.helper
              }
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60">Description</label>
          <Textarea
            value={requestDescription}
            onChange={(e) => setRequestDescription(e.target.value)}
            placeholder="Describe the job details"
            className="bg-black/30 border-[color:var(--border-subtle)] text-white min-h-24"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Trade ID / tag (optional)</label>
            <Input
              value={requestTradeId}
              onChange={(e) => setRequestTradeId(e.target.value)}
              placeholder="roofing, driveway-repair, etc."
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
            <p className="mt-1 text-[11px] text-white/50">
              If this trade tag does not exist yet, it will be created automatically.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-white/60">Location (optional)</label>
            <StateCountySelector
              selectedState={requestStateCode}
              selectedCounty={requestCountyFips}
              onStateChange={(value) => setRequestStateCode(value)}
              onCountyChange={(value) => setRequestCountyFips(value)}
              className="!grid-cols-1"
            />
            <p className="text-[11px] text-white/50">
              Selected state: {requestStateCode || "none"} | County FIPS:{" "}
              {requestCountyFips || "none"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60">Budget min (optional)</label>
            <Input
              value={requestBudgetMin}
              onChange={(e) => setRequestBudgetMin(e.target.value)}
              placeholder="500"
              type="number"
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
          <div>
            <label className="text-xs text-white/60">Budget max (optional)</label>
            <Input
              value={requestBudgetMax}
              onChange={(e) => setRequestBudgetMax(e.target.value)}
              placeholder="2500"
              type="number"
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60">
            Target provider IDs (optional, comma-separated)
          </label>
          <Input
            value={targetContractorIds}
            onChange={(e) => setTargetContractorIds(e.target.value)}
            placeholder="provider-id-1, provider-id-2"
            className="bg-black/30 border-[color:var(--border-subtle)] text-white"
          />
          <p className="mt-1 text-[11px] text-white/50">
            Leave empty to keep this request open for manual staff routing. Use skip to auto-route.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => createDirectConnectRequest.mutate({ autoRoute: false })}
            disabled={
              createDirectConnectRequest.isPending ||
              !requestTitle.trim() ||
              !requestDescription.trim() ||
              (!targetUserEmail.trim() && !targetUserId.trim())
            }
            className="w-full sm:w-auto bg-ts-orange hover:bg-ts-orange-dark"
          >
            {createDirectConnectRequest.isPending
              ? "Creating request..."
              : "Create request (manual routing)"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => createDirectConnectRequest.mutate({ autoRoute: true })}
            disabled={
              createDirectConnectRequest.isPending ||
              !requestTitle.trim() ||
              !requestDescription.trim() ||
              (!targetUserEmail.trim() && !targetUserId.trim())
            }
            className="w-full sm:w-auto border-[color:var(--border-subtle)]"
          >
            {createDirectConnectRequest.isPending
              ? "Creating request..."
              : "Skip manual routing and auto-route"}
          </Button>
        </div>

        {directConnectResult ? (
          <div className="rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3 text-xs text-white/80 space-y-1 break-words">
            <div>
              Request ID:{" "}
              <span className="font-mono">{directConnectResult.request?.id || "n/a"}</span>
            </div>
            <div>Requester intent: {directConnectResult.requesterIntent || "hire_provider"}</div>
            <div>Request type: {directConnectResult.resolvedCategory || "service_request"}</div>
            <div>Trade tag: {directConnectResult.resolvedTradeId || "none"}</div>
            <div>Created new trade tag: {String(directConnectResult.createdTradeId === true)}</div>
            <div>Target user: {directConnectResult.createdForUser?.email || "n/a"}</div>
            <div>
              Provisioned new user: {String(directConnectResult.targetUserProvisioned === true)}
            </div>
            <div>Email sent (setup): {String(directConnectResult.setupEmailSent === true)}</div>
            <div>Setup email message ID: {directConnectResult.setupEmailMessageId || "none"}</div>
            <div>
              Setup email skipped reason: {directConnectResult.setupEmailSkippedReason || "none"}
            </div>
            <div>
              Email sent (request notice): {String(directConnectResult.requestEmailSent === true)}
            </div>
            <div>
              Request email message ID: {directConnectResult.requestEmailMessageId || "none"}
            </div>
            <div>
              Request email skipped reason:{" "}
              {directConnectResult.requestEmailSkippedReason || "none"}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
