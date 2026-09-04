import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { UserPlus, Mail, ShieldCheck, Building2 } from "lucide-react";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ProvisionResponse = {
  user: { id: string; email: string; emailVerified?: boolean };
  activationLink?: string;
  verifyLink?: string;
  business?: { id: string; name: string; slug: string } | null;
  message?: string;
};

export default function AdminProvisioning() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");

  const [sendActivationEmail, setSendActivationEmail] = useState(true);
  const [sendVerificationEmail, setSendVerificationEmail] = useState(true);

  const [createBusiness, setCreateBusiness] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");

  const slugSuggestion = useMemo(() => {
    const base = businessName
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base.slice(0, 60);
  }, [businessName]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        sendEmail: sendActivationEmail || sendVerificationEmail,
        sendActivationEmail,
        sendVerificationEmail,
        adminSafety: { reason: reason.trim() },
      };
      if (createBusiness) {
        payload.profile = {
          create: true,
          displayName: businessName.trim() || undefined,
          roleContext: "business_owner",
          headline: undefined,
          createBusinessRecord: true,
          businessName: businessName.trim() || undefined,
        };
        payload.business = {
          name: businessName.trim(),
          slug: (businessSlug.trim() || slugSuggestion || "").trim() || undefined,
          phone: businessPhone.trim() || undefined,
          website: businessWebsite.trim() || undefined,
          email: email.trim() || undefined,
        };
      }
      return (await apiRequest("POST", "/api/admin/users/provision", payload)) as ProvisionResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Provisioned",
        description: data?.message || `Created ${data?.user?.email || "user"}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Provision failed",
        description: formatUserFacingErrorMessage(error, "Unable to provision user"),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <UserPlus className="h-5 w-5 text-ts-orange" />
            User Provisioning
          </CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Create a user account and (optionally) a public business profile with a linked business
            record. Email verification is always required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                Email
              </label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@business.com"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Phone (optional)</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">First name (optional)</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">Last name (optional)</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60">Provisioning reason (required)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this account is being provisioned"
              maxLength={500}
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
            />
          </div>

          <Separator className="bg-white/5" />

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={sendActivationEmail}
                onCheckedChange={(v) => setSendActivationEmail(v === true)}
              />
              Send activation email (set password)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/70">
              <Checkbox
                checked={sendVerificationEmail}
                onCheckedChange={(v) => setSendVerificationEmail(v === true)}
              />
              Send verification email
              <span className="text-xs text-white/60 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                recommended
              </span>
            </label>
          </div>

          <Separator className="bg-white/5" />

          <label className="flex items-center gap-2 text-sm text-white/70">
            <Checkbox
              checked={createBusiness}
              onCheckedChange={(v) => setCreateBusiness(v === true)}
            />
            Create business profile + linked business record
          </label>

          {createBusiness ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded border border-white/10 bg-black/30 p-3">
              <div className="md:col-span-2">
                <label className="text-xs text-white/60 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Business name
                </label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Acme Roofing"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Business slug (optional)</label>
                <Input
                  value={businessSlug}
                  onChange={(e) => setBusinessSlug(e.target.value)}
                  placeholder={slugSuggestion || "acme-roofing"}
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
                <div className="mt-1 text-[11px] text-white/60">
                  Suggested:{" "}
                  <span className="text-white/70">{slugSuggestion || "(type a name)"}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/60">Business phone (optional)</label>
                <Input
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/60">Website (optional)</label>
                <Input
                  value={businessWebsite}
                  onChange={(e) => setBusinessWebsite(e.target.value)}
                  placeholder="https://acme.example"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>
          ) : null}

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !email.trim() || reason.trim().length < 12}
            className="bg-ts-orange hover:bg-ts-orange-dark"
          >
            {mutation.isPending ? "Creating..." : "Create user"}
          </Button>

          {mutation.data ? (
            <div className="text-xs text-white/70 bg-black/30 rounded border border-[color:var(--border-subtle)] p-3 space-y-1">
              <div>User: {mutation.data.user.email}</div>
              {mutation.data.business ? (
                <div>
                  Business: {mutation.data.business.name} (slug: {mutation.data.business.slug})
                </div>
              ) : null}
              {mutation.data.activationLink ? (
                <div className="break-all">Activation: {mutation.data.activationLink}</div>
              ) : null}
              {mutation.data.verifyLink ? (
                <div className="break-all">Verify: {mutation.data.verifyLink}</div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
