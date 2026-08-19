import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ProcurementWorkspaceType = "platform" | "fulfillment_partner" | "supplier" | "admin";

type ProcurementWorkspace = {
  id: string;
  slug: string;
  name: string;
  workspaceType?: ProcurementWorkspaceType | string | null;
  workspace_type?: ProcurementWorkspaceType | string | null;
  status?: string | null;
  branding?: {
    publicName?: string | null;
    tagline?: string | null;
    primaryColor?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
  } | null;
  memberCount?: number | null;
  orderCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceForm = {
  slug: string;
  name: string;
  workspaceType: ProcurementWorkspaceType;
  status: string;
  publicName: string;
  tagline: string;
  primaryColor: string;
  supportEmail: string;
  supportPhone: string;
};

const workspaceTypes: ProcurementWorkspaceType[] = [
  "platform",
  "fulfillment_partner",
  "supplier",
  "admin",
];

function routeId(location: string): string {
  const pathname = (location || "").split(/[?#]/, 1)[0] || "";
  return decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function workspaceType(workspace: ProcurementWorkspace): ProcurementWorkspaceType {
  const value = String(workspace.workspaceType || workspace.workspace_type || "admin");
  return workspaceTypes.includes(value as ProcurementWorkspaceType)
    ? (value as ProcurementWorkspaceType)
    : "admin";
}

function formFromWorkspace(workspace: ProcurementWorkspace): WorkspaceForm {
  return {
    slug: String(workspace.slug || ""),
    name: String(workspace.name || ""),
    workspaceType: workspaceType(workspace),
    status: String(workspace.status || "active"),
    publicName: String(workspace.branding?.publicName || ""),
    tagline: String(workspace.branding?.tagline || ""),
    primaryColor: String(workspace.branding?.primaryColor || ""),
    supportEmail: String(workspace.branding?.supportEmail || ""),
    supportPhone: String(workspace.branding?.supportPhone || ""),
  };
}

async function loadWorkspaces(): Promise<ProcurementWorkspace[]> {
  const result = await apiRequest("GET", "/api/procurement/workspaces");
  if (Array.isArray(result)) return result as ProcurementWorkspace[];
  if (Array.isArray(result?.workspaces)) return result.workspaces as ProcurementWorkspace[];
  return [];
}

function statusBadge(status?: string | null) {
  if (status === "active") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Active
      </Badge>
    );
  }
  if (status === "suspended" || status === "inactive") {
    return <Badge className="border-red-400/25 bg-red-400/10 text-red-100">{readable(status)}</Badge>;
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/52">
      {readable(status || "active")}
    </Badge>
  );
}

export default function ProcurementWorkspaceDetailPage() {
  const [location] = useLocation();
  const id = useMemo(() => routeId(location), [location]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<WorkspaceForm>({
    slug: "",
    name: "",
    workspaceType: "admin",
    status: "active",
    publicName: "",
    tagline: "",
    primaryColor: "",
    supportEmail: "",
    supportPhone: "",
  });

  const workspacesQuery = useQuery<ProcurementWorkspace[]>({
    queryKey: ["/api/procurement/workspaces"],
    queryFn: loadWorkspaces,
    retry: false,
  });

  const workspace = useMemo(
    () => (workspacesQuery.data || []).find((entry) => String(entry.id) === id) || null,
    [id, workspacesQuery.data]
  );

  useEffect(() => {
    if (workspace) setForm(formFromWorkspace(workspace));
  }, [workspace?.id]);

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!id) throw new Error("Workspace identifier is missing.");
      if (!form.slug.trim() || !form.name.trim()) {
        throw new Error("Workspace slug and name are required.");
      }
      return apiRequest("PATCH", `/api/procurement/workspaces/${id}`, {
        slug: form.slug.trim(),
        name: form.name.trim(),
        workspaceType: form.workspaceType,
        status: form.status,
        branding: {
          publicName: form.publicName.trim() || form.name.trim(),
          tagline: form.tagline.trim() || undefined,
          primaryColor: form.primaryColor.trim() || undefined,
          supportEmail: form.supportEmail.trim() || undefined,
          supportPhone: form.supportPhone.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/workspaces"] });
      toast({ title: "Procurement workspace updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Workspace not updated",
        description: formatUserFacingErrorMessage(error, "Review the workspace fields and try again."),
        variant: "destructive",
      });
    },
  });

  if (!id) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Workspace identifier missing"
          description="Return to Procurement Workspaces and choose a workspace."
          action={
            <Link href="/admin/procurement/workspaces">
              <Button variant="outline">Back to workspaces</Button>
            </Link>
          }
        />
      </AdminWorkspace>
    );
  }

  if (workspacesQuery.isLoading) {
    return (
      <AdminWorkspace>
        <div className="flex min-h-64 items-center justify-center border-y border-white/10 text-sm text-white/45">
          <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
          Loading procurement workspace…
        </div>
      </AdminWorkspace>
    );
  }

  if (workspacesQuery.isError || !workspace) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Procurement workspace unavailable"
          description="The workspace could not be found in the current workspace registry. No workspace setting was changed."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => workspacesQuery.refetch()}>
                Retry
              </Button>
              <Link href="/admin/procurement/workspaces">
                <Button variant="outline">Back to workspaces</Button>
              </Link>
            </div>
          }
        />
      </AdminWorkspace>
    );
  }

  const supportConfigured = Boolean(form.supportEmail.trim() || form.supportPhone.trim());
  const brandingConfigured = Boolean(
    form.publicName.trim() || form.tagline.trim() || form.primaryColor.trim()
  );

  return (
    <AdminWorkspace data-testid="admin-procurement-workspace-detail-v2">
      <AdminSection
        title={workspace.name}
        description={`Workspace ${workspace.id} · /${workspace.slug} · created ${formatDate(
          workspace.createdAt || workspace.created_at
        )}`}
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => workspacesQuery.refetch()}
              disabled={workspacesQuery.isFetching}
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${workspacesQuery.isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Link href="/admin/procurement/workspaces">
              <Button
                type="button"
                variant="outline"
                className="border-white/12 bg-transparent text-white/65"
              >
                Back to workspaces
              </Button>
            </Link>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Status",
              value: statusBadge(workspace.status),
              detail: `Updated ${formatDate(workspace.updatedAt || workspace.updated_at)}`,
              tone:
                workspace.status === "inactive" || workspace.status === "suspended"
                  ? "warning"
                  : "good",
            },
            {
              label: "Workspace type",
              value: readable(workspaceType(workspace)),
              detail: "Stored procurement workspace role",
            },
            {
              label: "Branding",
              value: brandingConfigured ? "Configured" : "Incomplete",
              detail: form.publicName || workspace.name,
              tone: brandingConfigured ? "good" : "warning",
            },
            {
              label: "Support contact",
              value: supportConfigured ? "Configured" : "Missing",
              detail: form.supportEmail || form.supportPhone || "No email or phone",
              tone: supportConfigured ? "good" : "warning",
            },
          ]}
        />
      </AdminSection>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <AdminSection
          title="Workspace settings"
          description="The existing PATCH route owns identity, type, status, branding, and support-contact changes."
          className="pt-0"
        >
          <div className="grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2">
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  }))
                }
                className="border-white/10 bg-black/20 text-white"
              />
            </Field>
            <Field label="Internal name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="border-white/10 bg-black/20 text-white"
              />
            </Field>
            <Field label="Workspace type">
              <Select
                value={form.workspaceType}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    workspaceType: value as ProcurementWorkspaceType,
                  }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {readable(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value }))
                }
              >
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </AdminSection>

        <AdminSection
          title="Registry evidence"
          description="Read-only counts and timestamps returned with the workspace registry."
          className="pt-0"
        >
          <AdminList>
            <EvidenceRow label="Workspace ID" value={workspace.id} />
            <EvidenceRow
              label="Members"
              value={workspace.memberCount == null ? "Not reported" : String(workspace.memberCount)}
            />
            <EvidenceRow
              label="Orders"
              value={workspace.orderCount == null ? "Not reported" : String(workspace.orderCount)}
            />
            <EvidenceRow
              label="Created"
              value={formatDate(workspace.createdAt || workspace.created_at)}
            />
            <EvidenceRow
              label="Updated"
              value={formatDate(workspace.updatedAt || workspace.updated_at)}
            />
          </AdminList>
        </AdminSection>
      </div>

      <AdminSection
        title="Public branding and support"
        description="Presentation and support-contact fields stored inside the workspace branding object."
        className="pt-0"
      >
        <div className="grid gap-4 border-y border-white/10 px-3 py-5 sm:px-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Public name">
            <Input
              value={form.publicName}
              onChange={(event) =>
                setForm((current) => ({ ...current, publicName: event.target.value }))
              }
              placeholder="Defaults to internal name"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Primary color">
            <Input
              value={form.primaryColor}
              onChange={(event) =>
                setForm((current) => ({ ...current, primaryColor: event.target.value }))
              }
              placeholder="#f97316"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Support email">
            <Input
              type="email"
              value={form.supportEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, supportEmail: event.target.value }))
              }
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Support phone">
            <Input
              value={form.supportPhone}
              onChange={(event) =>
                setForm((current) => ({ ...current, supportPhone: event.target.value }))
              }
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Tagline" wide>
            <Textarea
              value={form.tagline}
              onChange={(event) =>
                setForm((current) => ({ ...current, tagline: event.target.value }))
              }
              rows={5}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
        </div>
      </AdminSection>

      <div className="flex flex-col gap-4 border-y border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-xs leading-5 text-white/42">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          Updating this workspace does not create an order, member, supplier quote, payment, proof,
          or public procurement record.
        </div>
        <Button
          type="button"
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !form.slug.trim() || !form.name.trim()}
          className="bg-orange-500 text-black hover:bg-orange-400"
        >
          {updateMutation.isPending ? "Saving…" : "Save workspace"}
        </Button>
      </div>
    </AdminWorkspace>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`space-y-1 text-xs text-white/42 ${wide ? "md:col-span-2 xl:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3 text-sm sm:px-4">
      <span className="text-white/42">{label}</span>
      <span className="max-w-[65%] break-all text-right text-white/68">{value}</span>
    </div>
  );
}
