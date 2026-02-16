import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type ProvisionResponse = {
  ok: boolean;
  status: "created" | "existing";
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  emailSent: boolean;
  activationLinkIncluded: boolean;
  verifyLinkIncluded: boolean;
  activationLink?: string;
  verifyLink?: string;
  message?: string;
};

export default function AdminProvisionUser() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [result, setResult] = useState<ProvisionResponse | null>(null);
  const [targetUserEmail, setTargetUserEmail] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestCategory, setRequestCategory] = useState("");
  const [requestTradeId, setRequestTradeId] = useState("");
  const [requestCountyFips, setRequestCountyFips] = useState("");
  const [requestStateCode, setRequestStateCode] = useState("");
  const [requestBudgetMin, setRequestBudgetMin] = useState("");
  const [requestBudgetMax, setRequestBudgetMax] = useState("");
  const [targetContractorIds, setTargetContractorIds] = useState("");

  const provision = useMutation({
    mutationFn: async () => {
      const payload = {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        password: password || undefined,
        sendEmail,
      };
      return (await apiRequest("POST", "/api/admin/users/provision", payload)) as ProvisionResponse;
    },
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "User provisioned",
        description: `${data.status === "created" ? "Created" : "Found"}: ${data.user.email}`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Provision failed",
        description: e?.message || "Failed to provision user",
        variant: "destructive",
      });
    },
  });

  const createDirectConnectRequest = useMutation({
    mutationFn: async () => {
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
      if (requestCategory.trim()) payload.category = requestCategory.trim();
      if (requestTradeId.trim()) payload.tradeId = requestTradeId.trim();
      if (requestCountyFips.trim()) payload.countyFips = requestCountyFips.trim();
      if (requestStateCode.trim()) payload.stateCode = requestStateCode.trim().toUpperCase();
      if (requestBudgetMin.trim()) payload.budgetMin = Number(requestBudgetMin);
      if (requestBudgetMax.trim()) payload.budgetMax = Number(requestBudgetMax);
      if (contractorIds.length > 0) payload.targetContractorIds = contractorIds;

      return apiRequest("POST", "/api/admin/direct-connect/requests", payload);
    },
    onSuccess: (data: any) => {
      toast({
        title: "Direct Connect request created",
        description: `Request created for ${data?.createdForUser?.email || "target user"}.`,
      });
      setTargetUserId("");
      setTargetUserEmail("");
      setRequestTitle("");
      setRequestDescription("");
      setRequestCategory("");
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
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="text-white">Provision User</CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Create any non-admin user account and send a single setup email (set password + verify
            email). This does not create admin accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Password (optional)</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to send set-password link"
                type="password"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">First name</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Last name</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
            Send setup email (recommended)
          </label>

          <Button
            onClick={() => provision.mutate()}
            disabled={provision.isPending || !email.trim()}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {provision.isPending ? "Provisioning..." : "Provision user"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="text-white">Result</CardTitle>
            <CardDescription className="text-[color:var(--text-secondary)]">
              {result.status} | Email sent: {String(result.emailSent)} | Includes set-password link:{" "}
              {String(result.activationLinkIncluded)} | Includes verify link:{" "}
              {String(result.verifyLinkIncluded)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-slate-200">
            <div>User: {result.user.email}</div>
            {result.activationLink ? (
              <div className="break-all">Activation: {result.activationLink}</div>
            ) : null}
            {result.verifyLink ? (
              <div className="break-all">Verify: {result.verifyLink}</div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="text-white">Create Direct Connect Request for User</CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Staff/admin can create a request on behalf of an existing user. This still enters the
            normal Direct Connect request lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Target user email</label>
              <Input
                value={targetUserEmail}
                onChange={(e) => setTargetUserEmail(e.target.value)}
                placeholder="user@example.com"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Target user ID (optional)</label>
              <Input
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="uuid..."
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Request title</label>
              <Input
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                placeholder="Roof leak repair request"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Category (optional)</label>
              <Input
                value={requestCategory}
                onChange={(e) => setRequestCategory(e.target.value)}
                placeholder="repair"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">Description</label>
            <Textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              placeholder="Describe the job details"
              className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100 min-h-24"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400">Trade ID (optional)</label>
              <Input
                value={requestTradeId}
                onChange={(e) => setRequestTradeId(e.target.value)}
                placeholder="roofing"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">County FIPS (optional)</label>
              <Input
                value={requestCountyFips}
                onChange={(e) => setRequestCountyFips(e.target.value)}
                placeholder="22105"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">State code (optional)</label>
              <Input
                value={requestStateCode}
                onChange={(e) => setRequestStateCode(e.target.value)}
                placeholder="LA"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Budget min (optional)</label>
              <Input
                value={requestBudgetMin}
                onChange={(e) => setRequestBudgetMin(e.target.value)}
                placeholder="500"
                type="number"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Budget max (optional)</label>
              <Input
                value={requestBudgetMax}
                onChange={(e) => setRequestBudgetMax(e.target.value)}
                placeholder="2500"
                type="number"
                className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400">
              Target contractor IDs (optional, comma-separated)
            </label>
            <Input
              value={targetContractorIds}
              onChange={(e) => setTargetContractorIds(e.target.value)}
              placeholder="contractor-id-1, contractor-id-2"
              className="bg-slate-950/40 border-[color:var(--border-subtle)] text-slate-100"
            />
          </div>

          <Button
            onClick={() => createDirectConnectRequest.mutate()}
            disabled={
              createDirectConnectRequest.isPending ||
              !requestTitle.trim() ||
              !requestDescription.trim() ||
              (!targetUserEmail.trim() && !targetUserId.trim())
            }
            className="bg-orange-500 hover:bg-orange-600"
          >
            {createDirectConnectRequest.isPending ? "Creating request..." : "Create request"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
