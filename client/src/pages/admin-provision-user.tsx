import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  resolvedTradeTags?: string[];
  createdTradeTags?: string[];
  message?: string;
};

type PublicPresenceProvisionResponse = {
  ok: boolean;
  message?: string;
  user?: { id?: string; email?: string };
  business?: { id?: string; slug?: string; name?: string; url?: string };
  profile?: {
    id?: string;
    slug?: string;
    displayName?: string;
    created?: boolean;
    url?: string;
  };
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
  const [provisionReason, setProvisionReason] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [createBusinessProfile, setCreateBusinessProfile] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileRoleContext, setProfileRoleContext] = useState("business_owner");
  const [profileHeadline, setProfileHeadline] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [provisionProfileVisibility, setProvisionProfileVisibility] = useState<
    "public" | "private"
  >("public");
  const [provisionServicesDescription, setProvisionServicesDescription] = useState("");
  const [provisionProfileSections, setProvisionProfileSections] = useState({
    about: true,
    rolesAndBadges: true,
    stats: true,
    services: true,
    marketplaceListings: true,
    reviews: true,
    communityActivity: true,
    contactCard: true,
  });
  const [provisionUserTypes, setProvisionUserTypes] = useState("");
  const [provisionTradeTags, setProvisionTradeTags] = useState("");
  const [createBusinessRecord, setCreateBusinessRecord] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessTags, setBusinessTags] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [result, setResult] = useState<ProvisionResponse | null>(null);
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
  const [editTradeTags, setEditTradeTags] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSafetyKey, setEditSafetyKey] = useState("");
  const [editAllowPrivilegedTarget, setEditAllowPrivilegedTarget] = useState(false);
  const [repairPublicPresenceOnSupportEdit, setRepairPublicPresenceOnSupportEdit] = useState(false);
  const presenceTargetEmail = "";
  const presenceTargetUserId = "";
  const [presenceBusinessId, setPresenceBusinessId] = useState("");
  const [presenceBusinessSlug, setPresenceBusinessSlug] = useState("");
  const [presenceBusinessName, setPresenceBusinessName] = useState("");
  const [presenceBusinessDescription, setPresenceBusinessDescription] = useState("");
  const [presenceBusinessPhone, setPresenceBusinessPhone] = useState("");
  const [presenceBusinessEmail, setPresenceBusinessEmail] = useState("");
  const [presenceBusinessWebsite, setPresenceBusinessWebsite] = useState("");
  const [presenceBusinessCategory, setPresenceBusinessCategory] = useState("");
  const [presenceBusinessTags, setPresenceBusinessTags] = useState("");
  const [presenceBusinessAddress, setPresenceBusinessAddress] = useState("");
  const [presenceBusinessCity, setPresenceBusinessCity] = useState("");
  const [presenceStateCode, setPresenceStateCode] = useState("");
  const [presenceCountyFips, setPresenceCountyFips] = useState("");
  const [presenceZipCode, setPresenceZipCode] = useState("");
  const [presenceRoleContext, setPresenceRoleContext] = useState("business_owner");
  const [presenceProfileDisplayName, setPresenceProfileDisplayName] = useState("");
  const [presenceProfileHeadline, setPresenceProfileHeadline] = useState("");
  const [presenceProfileAbout, setPresenceProfileAbout] = useState("");
  const [presenceCtaLabel, setPresenceCtaLabel] = useState("Send message");
  const [presenceCtaKind, setPresenceCtaKind] = useState<"message" | "call" | "email" | "link">(
    "message"
  );
  const [presenceCtaValue, setPresenceCtaValue] = useState("");
  const [presenceSeoTitle, setPresenceSeoTitle] = useState("");
  const [presenceSeoDescription, setPresenceSeoDescription] = useState("");
  const [presenceAllowReassign, setPresenceAllowReassign] = useState(false);
  const [presenceMakePublic, setPresenceMakePublic] = useState(true);
  const presenceReason = "";
  const presenceSafetyKey = "";
  const [presenceResult, setPresenceResult] = useState<PublicPresenceProvisionResponse | null>(
    null
  );

  const provision = useMutation({
    mutationFn: async () => {
      const parseCsv = (value: string) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      const userTypes = parseCsv(provisionUserTypes);
      const normalizedBusinessTags = parseCsv(businessTags);
      const normalizedTradeTags = parseCsv(provisionTradeTags);
      const payload = {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
        stateCode: stateCode.trim().toUpperCase() || undefined,
        countyFips: countyFips.trim() || undefined,
        userTypes: userTypes.length > 0 ? userTypes : undefined,
        tradeTags: normalizedTradeTags.length > 0 ? normalizedTradeTags : undefined,
        businessTags: normalizedBusinessTags.length > 0 ? normalizedBusinessTags : undefined,
        password: password || undefined,
        adminSafety: { reason: provisionReason.trim() },
        sendEmail,
        profileVisibility: provisionProfileVisibility,
        servicesDescription: provisionServicesDescription.trim() || undefined,
        profileSections: provisionProfileSections,
        profile: createBusinessProfile
          ? {
              create: true,
              displayName: profileDisplayName.trim() || undefined,
              roleContext: profileRoleContext.trim() || undefined,
              headline: profileHeadline.trim() || undefined,
              about: profileAbout.trim() || undefined,
              profileVisibility: provisionProfileVisibility,
              servicesDescription: provisionServicesDescription.trim() || undefined,
              profileSections: provisionProfileSections,
              tradeTags: normalizedTradeTags.length > 0 ? normalizedTradeTags : undefined,
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

  const supportEditUser = useMutation({
    mutationFn: async () => {
      const parseCsv = (value: string) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
      const patch: Record<string, unknown> = {};
      const preferencesPatch: Record<string, unknown> = {};

      if (editFirstName.trim()) patch.firstName = editFirstName.trim();
      if (editLastName.trim()) patch.lastName = editLastName.trim();
      if (editPhone.trim()) patch.phone = editPhone.trim();
      if (editCity.trim()) patch.city = editCity.trim();
      if (editStateCode.trim()) patch.stateCode = editStateCode.trim().toUpperCase();
      if (editCountyFips.trim()) patch.countyFips = editCountyFips.trim();
      const normalizedEditTradeTags = parseCsv(editTradeTags);
      if (normalizedEditTradeTags.length > 0) {
        patch.tradeTags = normalizedEditTradeTags;
      }
      if (editBio.trim()) preferencesPatch.bio = editBio.trim();
      preferencesPatch.profileVisibility = editProfileVisibility;

      if (Object.keys(preferencesPatch).length > 0) {
        patch.preferencesPatch = preferencesPatch;
      }

      const supportResponse = await apiRequest("POST", "/api/admin/users/support-edit", {
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

      if (!repairPublicPresenceOnSupportEdit) {
        return { supportResponse, presenceResponse: null };
      }

      const businessServices = presenceBusinessTags
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const presenceResponse = (await apiRequest(
        "POST",
        "/api/admin/users/public-presence/provision",
        {
          targetUserId: presenceTargetUserId.trim() || editTargetUserId.trim() || undefined,
          targetEmail:
            presenceTargetEmail.trim().toLowerCase() ||
            editTargetEmail.trim().toLowerCase() ||
            undefined,
          presence: {
            allowReassign: presenceAllowReassign,
            makeProfilePublic: presenceMakePublic,
            business: {
              businessId: presenceBusinessId.trim() || undefined,
              businessSlug: presenceBusinessSlug.trim() || undefined,
              name: presenceBusinessName.trim() || undefined,
              description: presenceBusinessDescription.trim() || editBio.trim() || undefined,
              phone: presenceBusinessPhone.trim() || editPhone.trim() || undefined,
              email: presenceBusinessEmail.trim().toLowerCase() || undefined,
              website: presenceBusinessWebsite.trim() || undefined,
              category: presenceBusinessCategory.trim() || undefined,
              services: businessServices.length > 0 ? businessServices : undefined,
              address: presenceBusinessAddress.trim() || undefined,
              city: presenceBusinessCity.trim() || editCity.trim() || undefined,
              stateCode:
                presenceStateCode.trim().toUpperCase() ||
                editStateCode.trim().toUpperCase() ||
                undefined,
              countyFips: presenceCountyFips.trim() || editCountyFips.trim() || undefined,
              zipCode: presenceZipCode.trim() || undefined,
              roleContext: presenceRoleContext.trim() || undefined,
            },
            profile: {
              displayName: presenceProfileDisplayName.trim() || undefined,
              headline: presenceProfileHeadline.trim() || undefined,
              about: presenceProfileAbout.trim() || editBio.trim() || undefined,
              ctaPrimaryLabel: presenceCtaLabel.trim() || undefined,
              ctaPrimaryKind: presenceCtaKind,
              ctaPrimaryValue: presenceCtaValue.trim() || undefined,
              seoTitle: presenceSeoTitle.trim() || undefined,
              seoDescription: presenceSeoDescription.trim() || undefined,
              roleContext: presenceRoleContext.trim() || undefined,
            },
          },
          adminSafety: {
            reason: presenceReason.trim() || editReason.trim(),
            confirmPhrase: "I UNDERSTAND THIS EDIT IS AUDITED",
            safetyKey: presenceSafetyKey.trim() || editSafetyKey.trim() || undefined,
          },
        }
      )) as PublicPresenceProvisionResponse;

      return { supportResponse, presenceResponse };
    },
    onSuccess: (data: any) => {
      const presenceResponse = data?.presenceResponse as PublicPresenceProvisionResponse | null;
      if (presenceResponse) {
        setPresenceResult(presenceResponse);
      }
      toast({
        title: presenceResponse ? "User updated + public presence repaired" : "User updated",
        description: presenceResponse
          ? `Support edit saved and linked to ${presenceResponse?.business?.name || "business profile"}.`
          : "Support edit completed and logged.",
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
              if (provisionReason.trim().length < 12) return;
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
                  autoComplete="email"
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
                  name="provision-password"
                  autoComplete="new-password"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60">Provisioning reason (required)</label>
              <Textarea
                value={provisionReason}
                onChange={(e) => setProvisionReason(e.target.value)}
                placeholder="Explain why this account is being provisioned"
                maxLength={500}
                rows={2}
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
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

            <div className="space-y-2">
              <label className="text-xs text-white/60">Location (optional)</label>
              <StateCountySelector
                selectedState={stateCode}
                selectedCounty={countyFips}
                onStateChange={(value) => setStateCode(value)}
                onCountyChange={(value) => setCountyFips(value)}
                className="!grid-cols-1 md:!grid-cols-2"
              />
              <p className="text-[11px] text-white/50">
                Selected state: {stateCode || "none"} | County FIPS: {countyFips || "none"}
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
              Send setup email (recommended)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Profile visibility</label>
                <Select
                  value={provisionProfileVisibility}
                  onValueChange={(value) =>
                    setProvisionProfileVisibility(value === "private" ? "private" : "public")
                  }
                >
                  <SelectTrigger className="w-full border-[color:var(--border-subtle)] bg-black/30 text-white">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">public</SelectItem>
                    <SelectItem value="private">private</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>

            <div>
              <label className="text-xs text-white/60">Services description (optional)</label>
              <Textarea
                value={provisionServicesDescription}
                onChange={(e) => setProvisionServicesDescription(e.target.value)}
                placeholder="What they do, service area, and specialties."
                rows={3}
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/60">
                Trade tags for routing (comma separated, optional)
              </label>
              <Input
                value={provisionTradeTags}
                onChange={(e) => setProvisionTradeTags(e.target.value)}
                placeholder="roofing, pressure-washing, hvac"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>

            <div className="space-y-2 rounded-md border border-[color:var(--border-subtle)] bg-black/30 p-3">
              <div className="text-xs font-semibold text-white/80">Public profile sections</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-white/80">
                {[
                  ["about", "About"],
                  ["rolesAndBadges", "Roles & badges"],
                  ["stats", "Stats"],
                  ["services", "Services"],
                  ["marketplaceListings", "Marketplace"],
                  ["reviews", "Reviews"],
                  ["communityActivity", "Community"],
                  ["contactCard", "Contact card"],
                ].map(([key, label]) => {
                  const sectionKey = key as keyof typeof provisionProfileSections;
                  return (
                    <label key={key} className="flex items-center gap-2">
                      <Checkbox
                        checked={provisionProfileSections[sectionKey] === true}
                        onCheckedChange={(value) =>
                          setProvisionProfileSections((current) => ({
                            ...current,
                            [sectionKey]: value === true,
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

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
              disabled={provision.isPending || !email.trim() || provisionReason.trim().length < 12}
              className="w-full sm:w-auto bg-ts-orange hover:bg-ts-orange-dark"
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
                  autoComplete="username"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div className="space-y-2">
                <label className="text-xs text-white/60">Location (optional)</label>
                <StateCountySelector
                  selectedState={editStateCode}
                  selectedCounty={editCountyFips}
                  onStateChange={(value) => setEditStateCode(value)}
                  onCountyChange={(value) => setEditCountyFips(value)}
                  className="!grid-cols-1"
                />
                <p className="text-[11px] text-white/50">
                  Selected state: {editStateCode || "none"} | County FIPS:{" "}
                  {editCountyFips || "none"}
                </p>
              </div>
              <div>
                <label className="text-xs text-white/60">Profile visibility</label>
                <Select
                  value={editProfileVisibility}
                  onValueChange={(value) =>
                    setEditProfileVisibility(value === "private" ? "private" : "public")
                  }
                >
                  <SelectTrigger className="w-full border-[color:var(--border-subtle)] bg-black/30 text-white">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">public</SelectItem>
                    <SelectItem value="private">private</SelectItem>
                  </SelectContent>
                </Select>
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
            <div>
              <label className="text-xs text-white/60">
                Trade tags for routing (comma separated, optional)
              </label>
              <Input
                value={editTradeTags}
                onChange={(e) => setEditTradeTags(e.target.value)}
                placeholder="roofing, pressure-washing, hvac"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70">
              <Checkbox
                checked={repairPublicPresenceOnSupportEdit}
                onCheckedChange={(v) => setRepairPublicPresenceOnSupportEdit(v === true)}
              />
              Also repair/attach public business profile for this same user
            </label>

            {repairPublicPresenceOnSupportEdit ? (
              <div className="space-y-3 rounded-md border border-[color:var(--border-subtle)] bg-black/20 p-3">
                <div className="text-xs font-semibold text-white/80">Public Presence Controls</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceBusinessId}
                    onChange={(e) => setPresenceBusinessId(e.target.value)}
                    placeholder="Existing business ID (optional)"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceBusinessSlug}
                    onChange={(e) => setPresenceBusinessSlug(e.target.value)}
                    placeholder="Existing business slug (optional)"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceBusinessName}
                    onChange={(e) => setPresenceBusinessName(e.target.value)}
                    placeholder="Business name"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceRoleContext}
                    onChange={(e) => setPresenceRoleContext(e.target.value)}
                    placeholder="Role context (business_owner, contractor...)"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <Textarea
                  value={presenceBusinessDescription}
                  onChange={(e) => setPresenceBusinessDescription(e.target.value)}
                  placeholder="Business description (optional)"
                  rows={3}
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceBusinessPhone}
                    onChange={(e) => setPresenceBusinessPhone(e.target.value)}
                    placeholder="Business phone"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceBusinessEmail}
                    onChange={(e) => setPresenceBusinessEmail(e.target.value)}
                    placeholder="Business email"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <Input
                  value={presenceBusinessWebsite}
                  onChange={(e) => setPresenceBusinessWebsite(e.target.value)}
                  placeholder="Business website"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceBusinessCategory}
                    onChange={(e) => setPresenceBusinessCategory(e.target.value)}
                    placeholder="Business category"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceBusinessTags}
                    onChange={(e) => setPresenceBusinessTags(e.target.value)}
                    placeholder="Service tags (comma separated)"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <Input
                  value={presenceBusinessAddress}
                  onChange={(e) => setPresenceBusinessAddress(e.target.value)}
                  placeholder="Street address"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    value={presenceBusinessCity}
                    onChange={(e) => setPresenceBusinessCity(e.target.value)}
                    placeholder="City"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceStateCode}
                    onChange={(e) => setPresenceStateCode(e.target.value)}
                    placeholder="State code"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceZipCode}
                    onChange={(e) => setPresenceZipCode(e.target.value)}
                    placeholder="Zip code"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <Input
                  value={presenceCountyFips}
                  onChange={(e) => setPresenceCountyFips(e.target.value)}
                  placeholder="County FIPS (optional)"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceProfileDisplayName}
                    onChange={(e) => setPresenceProfileDisplayName(e.target.value)}
                    placeholder="Public profile display name"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceProfileHeadline}
                    onChange={(e) => setPresenceProfileHeadline(e.target.value)}
                    placeholder="Public profile headline"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <Textarea
                  value={presenceProfileAbout}
                  onChange={(e) => setPresenceProfileAbout(e.target.value)}
                  placeholder="Public profile about section"
                  rows={3}
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input
                    value={presenceCtaLabel}
                    onChange={(e) => setPresenceCtaLabel(e.target.value)}
                    placeholder="CTA label"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Select
                    value={presenceCtaKind}
                    onValueChange={(v) => setPresenceCtaKind(v as any)}
                  >
                    <SelectTrigger className="border-[color:var(--border-subtle)] bg-black/30 text-white">
                      <SelectValue placeholder="CTA kind" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message">message</SelectItem>
                      <SelectItem value="call">call</SelectItem>
                      <SelectItem value="email">email</SelectItem>
                      <SelectItem value="link">link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={presenceCtaValue}
                    onChange={(e) => setPresenceCtaValue(e.target.value)}
                    placeholder="CTA value"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    value={presenceSeoTitle}
                    onChange={(e) => setPresenceSeoTitle(e.target.value)}
                    placeholder="SEO title"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                  <Input
                    value={presenceSeoDescription}
                    onChange={(e) => setPresenceSeoDescription(e.target.value)}
                    placeholder="SEO description"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-white/70">
                  <Checkbox
                    checked={presenceAllowReassign}
                    onCheckedChange={(v) => setPresenceAllowReassign(v === true)}
                  />
                  Allow ownership transfer if business is owned by another user
                </label>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <Checkbox
                    checked={presenceMakePublic}
                    onCheckedChange={(v) => setPresenceMakePublic(v === true)}
                  />
                  Force profile visibility to public
                </label>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">
                  Audit reason (required, min 12 chars)
                </label>
                <Input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="User requested profile correction via support ticket..."
                  autoComplete="off"
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
                  name="admin-safety-key"
                  autoComplete="current-password"
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
              className="w-full sm:w-auto bg-ts-orange hover:bg-ts-orange-dark"
            >
              {supportEditUser.isPending
                ? "Applying support fix..."
                : repairPublicPresenceOnSupportEdit
                  ? "Apply support edit + repair public presence"
                  : "Apply safeguarded support edit"}
            </Button>

            {presenceResult ? (
              <div className="rounded-md border border-[color:var(--border-subtle)] bg-black/25 p-3 text-xs text-white/80 space-y-1">
                <div>
                  Presence repair result for:{" "}
                  {presenceResult.user?.email || presenceResult.user?.id || "unknown user"}
                </div>
                <div>
                  Business: {presenceResult.business?.name || "unknown"}{" "}
                  {presenceResult.business?.url ? `(${presenceResult.business.url})` : ""}
                </div>
                <div>
                  Profile:{" "}
                  {presenceResult.profile?.displayName || presenceResult.profile?.slug || "unknown"}{" "}
                  {presenceResult.profile?.url ? `(${presenceResult.profile.url})` : ""}
                </div>
              </div>
            ) : null}
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
          <CardContent className="space-y-2 break-words text-xs text-white/70">
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
            <div>
              Resolved trade tags:{" "}
              {Array.isArray(result.resolvedTradeTags) && result.resolvedTradeTags.length > 0
                ? result.resolvedTradeTags.join(", ")
                : "none"}
            </div>
            <div>
              Newly created trade tags:{" "}
              {Array.isArray(result.createdTradeTags) && result.createdTradeTags.length > 0
                ? result.createdTradeTags.join(", ")
                : "none"}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
