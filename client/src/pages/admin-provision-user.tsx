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
  profileProvisioned?: boolean;
  profileCreated?: boolean;
  profileId?: string | null;
  profileSlug?: string | null;
  businessId?: string | null;
  businessSlug?: string | null;
  activationLink?: string;
  verifyLink?: string;
  message?: string;
};

export default function AdminProvisionUser() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [countyFips, setCountyFips] = useState("");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [createBusinessProfile, setCreateBusinessProfile] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileRoleContext, setProfileRoleContext] = useState("business_owner");
  const [profileHeadline, setProfileHeadline] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [provisionUserTypes, setProvisionUserTypes] = useState("");
  const [createBusinessRecord, setCreateBusinessRecord] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessTags, setBusinessTags] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
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
  const [editTargetEmail, setEditTargetEmail] = useState("");
  const [editTargetUserId, setEditTargetUserId] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editStateCode, setEditStateCode] = useState("");
  const [editCountyFips, setEditCountyFips] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editProfileVisibility, setEditProfileVisibility] = useState<"public" | "private">(
    "public"
  );
  const [editReason, setEditReason] = useState("");
  const [editSafetyKey, setEditSafetyKey] = useState("");
  const [editAllowPrivilegedTarget, setEditAllowPrivilegedTarget] = useState(false);

  const provision = useMutation({
    mutationFn: async () => {
      const parseCsv = (value: string) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      const userTypes = parseCsv(provisionUserTypes);
      const normalizedBusinessTags = parseCsv(businessTags);
      const payload = {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        stateCode: stateCode.trim().toUpperCase() || undefined,
        countyFips: countyFips.trim() || undefined,
        userTypes: userTypes.length > 0 ? userTypes : undefined,
        businessTags: normalizedBusinessTags.length > 0 ? normalizedBusinessTags : undefined,
        password: password || undefined,
        sendEmail,
        profile: createBusinessProfile
          ? {
              create: true,
              displayName: profileDisplayName.trim() || undefined,
              roleContext: profileRoleContext.trim() || undefined,
              headline: profileHeadline.trim() || undefined,
              about: profileAbout.trim() || undefined,
              businessPhone: businessPhone.trim() || undefined,
              businessEmail: businessEmail.trim() || undefined,
              businessWebsite: businessWebsite.trim() || undefined,
              businessTags: normalizedBusinessTags.length > 0 ? normalizedBusinessTags : undefined,
              createBusinessRecord,
              businessName: businessName.trim() || undefined,
            }
          : undefined,
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

  const supportEditUser = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {};
      const preferencesPatch: Record<string, unknown> = {};

      if (editFirstName.trim()) patch.firstName = editFirstName.trim();
      if (editLastName.trim()) patch.lastName = editLastName.trim();
      if (editPhone.trim()) patch.phone = editPhone.trim();
      if (editCity.trim()) patch.city = editCity.trim();
      if (editStateCode.trim()) patch.stateCode = editStateCode.trim().toUpperCase();
      if (editCountyFips.trim()) patch.countyFips = editCountyFips.trim();
      if (editBio.trim()) preferencesPatch.bio = editBio.trim();
      preferencesPatch.profileVisibility = editProfileVisibility;

      if (Object.keys(preferencesPatch).length > 0) {
        patch.preferencesPatch = preferencesPatch;
      }

      return apiRequest("POST", "/api/admin/users/support-edit", {
        targetUserId: editTargetUserId.trim() || undefined,
        targetEmail: editTargetEmail.trim() || undefined,
        patch,
        adminSafety: {
          reason: editReason.trim(),
          confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
          safetyKey: editSafetyKey.trim() || undefined,
          allowPrivilegedTargetEdit: editAllowPrivilegedTarget,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "Support edit completed and logged.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Support edit failed",
        description: e?.message || "Could not edit user",
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
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim() || provision.isPending) return;
              provision.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Email</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Password (optional)</label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank to send set-password link"
                  type="password"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">First name</label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Last name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Phone (optional)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">City (optional)</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">State code (optional)</label>
                <Input
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="LA"
                  maxLength={2}
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">County FIPS (optional)</label>
                <Input
                  value={countyFips}
                  onChange={(e) => setCountyFips(e.target.value)}
                  placeholder="22105"
                  maxLength={5}
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
              Send setup email (recommended)
            </label>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <Checkbox
                checked={createBusinessProfile}
                onCheckedChange={(v) => setCreateBusinessProfile(v === true)}
              />
              Create public business profile during provisioning
            </label>

            {createBusinessProfile ? (
              <div className="space-y-3 rounded-md border border-[color:var(--border-subtle)] bg-black/30 p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/60">Profile display name</label>
                    <Input
                      value={profileDisplayName}
                      onChange={(e) => setProfileDisplayName(e.target.value)}
                      placeholder="Company or profile name"
                      className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60">Role context</label>
                    <Input
                      value={profileRoleContext}
                      onChange={(e) => setProfileRoleContext(e.target.value)}
                      placeholder="business_owner"
                      className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/60">Profile headline (optional)</label>
                  <Input
                    value={profileHeadline}
                    onChange={(e) => setProfileHeadline(e.target.value)}
                    placeholder="Trusted local service provider"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Profile about (optional)</label>
                  <Textarea
                    value={profileAbout}
                    onChange={(e) => setProfileAbout(e.target.value)}
                    placeholder="Longer profile summary shown in About section"
                    rows={3}
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">
                    User types (comma separated, optional)
                  </label>
                  <Input
                    value={provisionUserTypes}
                    onChange={(e) => setProvisionUserTypes(e.target.value)}
                    placeholder="business_owner, contractor"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-white/70">
                  <Checkbox
                    checked={createBusinessRecord}
                    onCheckedChange={(v) => setCreateBusinessRecord(v === true)}
                  />
                  Also create linked business record
                </label>

                {createBusinessRecord ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/60">Business name</label>
                      <Input
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Acme Services LLC"
                        className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-white/60">
                        Business tags (comma separated, optional)
                      </label>
                      <Input
                        value={businessTags}
                        onChange={(e) => setBusinessTags(e.target.value)}
                        placeholder="pest-control, commercial, residential"
                        className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-white/60">Business phone (optional)</label>
                        <Input
                          value={businessPhone}
                          onChange={(e) => setBusinessPhone(e.target.value)}
                          placeholder="(555) 555-5555"
                          className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-white/60">Business email (optional)</label>
                        <Input
                          value={businessEmail}
                          onChange={(e) => setBusinessEmail(e.target.value)}
                          placeholder="office@acme.com"
                          className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white/60">Business website (optional)</label>
                      <Input
                        value={businessWebsite}
                        onChange={(e) => setBusinessWebsite(e.target.value)}
                        placeholder="https://acme.example"
                        className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={provision.isPending || !email.trim()}
              className="bg-ts-orange hover:bg-ts-orange-dark"
            >
              {provision.isPending ? "Provisioning..." : "Provision user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle className="text-white">Support Edit User (Safeguarded)</CardTitle>
          <CardDescription className="text-[color:var(--text-secondary)]">
            Edit a user on their behalf with mandatory reason + audit confirmation. If
            `ADMIN_SAFETY_KEY` is configured, enter it below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (supportEditUser.isPending) return;
              if (!editTargetEmail.trim() && !editTargetUserId.trim()) return;
              if (editReason.trim().length < 12) return;
              supportEditUser.mutate();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Target user email</label>
                <Input
                  value={editTargetEmail}
                  onChange={(e) => setEditTargetEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Target user ID (optional)</label>
                <Input
                  value={editTargetUserId}
                  onChange={(e) => setEditTargetUserId(e.target.value)}
                  placeholder="uuid..."
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">First name (optional)</label>
                <Input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="First"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Last name (optional)</label>
                <Input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="Last"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-white/60">Phone (optional)</label>
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">City (optional)</label>
                <Input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  placeholder="City"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">State code (optional)</label>
                <Input
                  value={editStateCode}
                  onChange={(e) => setEditStateCode(e.target.value)}
                  placeholder="FL"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">County FIPS (optional)</label>
                <Input
                  value={editCountyFips}
                  onChange={(e) => setEditCountyFips(e.target.value)}
                  placeholder="12033"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Profile visibility</label>
                <select
                  value={editProfileVisibility}
                  onChange={(e) =>
                    setEditProfileVisibility(e.target.value === "private" ? "private" : "public")
                  }
                  className="w-full rounded-md border border-[color:var(--border-subtle)] bg-black/30 px-3 py-2 text-white"
                >
                  <option value="public">public</option>
                  <option value="private">private</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Bio (optional)</label>
              <Textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Support note or user-provided profile text"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white min-h-20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">
                  Audit reason (required, min 12 chars)
                </label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="User requested profile correction via support ticket..."
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Admin safety key (if required)</label>
                <Input
                  value={editSafetyKey}
                  onChange={(e) => setEditSafetyKey(e.target.value)}
                  placeholder="Enter key if server requires it"
                  type="password"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <Checkbox
                checked={editAllowPrivilegedTarget}
                onCheckedChange={(v) => setEditAllowPrivilegedTarget(v === true)}
              />
              Allow edit for protected admin target (head/super only)
            </label>

            <Button
              type="submit"
              disabled={
                supportEditUser.isPending ||
                (!editTargetEmail.trim() && !editTargetUserId.trim()) ||
                editReason.trim().length < 12
              }
              className="bg-ts-orange hover:bg-ts-orange-dark"
            >
              {supportEditUser.isPending ? "Applying edit..." : "Apply safeguarded support edit"}
            </Button>
          </form>
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
          <CardContent className="space-y-2 text-xs text-white/70">
            <div>User: {result.user.email}</div>
            <div>Business profile provisioned: {String(result.profileProvisioned === true)}</div>
            {result.profileId ? <div>Profile ID: {result.profileId}</div> : null}
            {result.profileSlug ? <div>Profile slug: {result.profileSlug}</div> : null}
            {result.businessId ? <div>Business ID: {result.businessId}</div> : null}
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
              <label className="text-xs text-white/60">Category (optional)</label>
              <Input
                value={requestCategory}
                onChange={(e) => setRequestCategory(e.target.value)}
                placeholder="repair"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-white/60">Trade ID (optional)</label>
              <Input
                value={requestTradeId}
                onChange={(e) => setRequestTradeId(e.target.value)}
                placeholder="roofing"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">County FIPS (optional)</label>
              <Input
                value={requestCountyFips}
                onChange={(e) => setRequestCountyFips(e.target.value)}
                placeholder="22105"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">State code (optional)</label>
              <Input
                value={requestStateCode}
                onChange={(e) => setRequestStateCode(e.target.value)}
                placeholder="LA"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
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
              Target contractor IDs (optional, comma-separated)
            </label>
            <Input
              value={targetContractorIds}
              onChange={(e) => setTargetContractorIds(e.target.value)}
              placeholder="contractor-id-1, contractor-id-2"
              className="bg-black/30 border-[color:var(--border-subtle)] text-white"
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
            className="bg-ts-orange hover:bg-ts-orange-dark"
          >
            {createDirectConnectRequest.isPending ? "Creating request..." : "Create request"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
