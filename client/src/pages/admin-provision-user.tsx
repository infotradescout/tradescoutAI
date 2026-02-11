import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
    </div>
  );
}
