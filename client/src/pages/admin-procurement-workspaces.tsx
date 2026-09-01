import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { Link } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  public_name?: string | null;
  tagline?: string | null;
  primary_color?: string | null;
  support_email?: string | null;
  support_phone?: string | null;
  memberCount?: number | null;
  orderCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type WorkspaceDraft = {
  slug: string;
  name: string;
  workspaceType: ProcurementWorkspaceType;
  publicName: string;
  tagline: string;
};

const workspaceTypes: ProcurementWorkspaceType[] = [
  "platform",
  "fulfillment_partner",
  "supplier",
  "admin",
];

function emptyDraft(): WorkspaceDraft {
  return {
    slug: "",
    name: "",
    workspaceType: "fulfillment_partner",
    publicName: "",
    tagline: "",
  };
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

function workspaceType(workspace: ProcurementWorkspace): string {
  return String(workspace.workspaceType || workspace.workspace_type || "not_recorded");
}

function workspaceBranding(workspace: ProcurementWorkspace) {
  return {
    publicName: workspace.branding?.publicName || workspace.public_name || "",
    tagline: workspace.branding?.tagline || workspace.tagline || "",
    primaryColor: workspace.branding?.primaryColor || workspace.primary_color || "",
    supportEmail: workspace.branding?.supportEmail || workspace.support_email || "",
    supportPhone: workspace.branding?.supportPhone || workspace.support_phone || "",
  };
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

async function loadWorkspaces(): Promise<ProcurementWorkspace[]> {
  const result = await apiRequest("GET", "/api/procurement/workspaces");
  if (Array.isArray(result)) return result as ProcurementWorkspace[];
  if (Array.isArray(result?.workspaces)) return result.workspaces as ProcurementWorkspace[];
  return [];
}

export default function ProcurementWorkspacesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<WorkspaceDraft>(emptyDraft);

  const workspacesQuery = useQuery<ProcurementWorkspace[]>({
    queryKey: ["/api/procurement/workspaces"],
    queryFn: loadWorkspaces,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!draft.slug.trim() || !draft.name.trim()) {
        throw new Error("Workspace slug and name are required.");
      }
      return apiRequest("POST", "/api/procurement/workspaces", {
        slug: draft.slug.trim(),
        name: draft.name.trim(),
        workspaceType: draft.workspaceType,
        branding: {
          publicName: draft.publicName.trim() || draft.name.trim(),
          tagline: draft.tagline.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/procurement/workspaces"] });
      setDraft(emptyDraft());
      setCreateOpen(false);
      toast({ title: "Procurement workspace created" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Workspace not created",
        description: formatUserFacingErrorMessage(error, "Review the required workspace fields."),
        variant: "destructive",
      });
    },
  });

  const workspaces = workspacesQuery.data || [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const branding = workspaceBranding(workspace);
      if (typeFilter !== "all" && workspaceType(workspace) !== typeFilter) return false;
      const normalizedStatus = String(workspace.status || "active");
      if (statusFilter !== "all" && normalizedStatus !== statusFilter) return false;
      if (!term) return true;
      return [
        workspace.name,
        workspace.slug,
        branding.publicName,
        branding.tagline,
        branding.supportEmail,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [search, statusFilter, typeFilter, workspaces]);

  const summary = useMemo(
    () => ({
      active: workspaces.filter((workspace) => String(workspace.status || "active") === "active")
        .length,
      fulfillment: workspaces.filter(
        (workspace) => workspaceType(workspace) === "fulfillment_partner"
      ).length,
      supplier: workspaces.filter((workspace) => workspaceType(workspace) === "supplier").length,
      supportConfigured: workspaces.filter((workspace) => {
        const branding = workspaceBranding(workspace);
        return Boolean(branding.supportEmail || branding.supportPhone);
      }).length,
    }),
    [workspaces]
  );

  return (
    <AdminWorkspace data-testid="admin-procurement-workspaces-v2">
      <AdminSection
        title="Procurement workspaces"
        description="Platform, fulfillment-partner, supplier, and admin workspaces that receive or support procurement orders. Workspace writes remain on the existing procurement workspace routes."
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
            <Link href="/admin/procurement">
              <Button
                type="button"
                variant="outline"
                className="border-white/12 bg-transparent text-white/65"
              >
                Back to Procurement
              </Button>
            </Link>
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              New workspace
            </Button>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Workspaces",
              value: workspacesQuery.isError ? "—" : workspaces.length,
              detail: workspacesQuery.isError
                ? "Workspace source unavailable"
                : `${summary.active} active`,
              tone: workspacesQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Fulfillment partners",
              value: workspacesQuery.isError ? "—" : summary.fulfillment,
              detail: "Eligible order handoff destinations",
              tone: workspacesQuery.isError ? "warning" : "good",
            },
            {
              label: "Suppliers",
              value: workspacesQuery.isError ? "—" : summary.supplier,
              detail: "Supplier-type workspaces",
              tone: workspacesQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Support configured",
              value: workspacesQuery.isError ? "—" : summary.supportConfigured,
              detail: "Email or phone present in branding",
              tone:
                workspacesQuery.isError || summary.supportConfigured < workspaces.length
                  ? "warning"
                  : "good",
            },
          ]}
        />
      </AdminSection>

      <AdminSection
        title="Workspace registry"
        description="Expand a row for branding and support context, then open the existing detail route to update the workspace."
        className="pt-0"
      >
        <AdminToolbar>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workspace, slug, branding, or support"
                className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[13rem] border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workspace types</SelectItem>
                {workspaceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {readable(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-white/35">
            {filtered.length} of {workspaces.length} workspaces
          </span>
        </AdminToolbar>

        {workspacesQuery.isLoading ? (
          <QueueLoading label="Loading procurement workspaces…" />
        ) : workspacesQuery.isError ? (
          <QueueUnavailable label="Procurement workspaces are unavailable. No workspace was changed." />
        ) : filtered.length ? (
          <AdminList className="mt-4">
            {filtered.map((workspace) => {
              const branding = workspaceBranding(workspace);
              return (
                <details key={workspace.id} className="group">
                  <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.55fr)_minmax(10rem,0.5fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{workspace.name}</p>
                        {statusBadge(workspace.status)}
                      </div>
                      <p className="mt-1 font-mono text-xs text-white/30">/{workspace.slug}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Type
                      </p>
                      <p className="mt-2 text-sm text-white/62">{readable(workspaceType(workspace))}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                        Public name
                      </p>
                      <p className="mt-2 truncate text-sm text-white/62">
                        {branding.publicName || workspace.name}
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/30 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                      <DetailBlock label="Tagline" value={branding.tagline || "Not recorded"} />
                      <DetailBlock
                        label="Support email"
                        value={branding.supportEmail || "Not recorded"}
                      />
                      <DetailBlock
                        label="Support phone"
                        value={branding.supportPhone || "Not recorded"}
                      />
                      <DetailBlock
                        label="Primary color"
                        value={branding.primaryColor || "Not recorded"}
                      />
                      <DetailBlock
                        label="Members"
                        value={workspace.memberCount == null ? "Not reported" : String(workspace.memberCount)}
                      />
                      <DetailBlock
                        label="Orders"
                        value={workspace.orderCount == null ? "Not reported" : String(workspace.orderCount)}
                      />
                      <DetailBlock
                        label="Created"
                        value={formatDate(workspace.createdAt || workspace.created_at)}
                      />
                      <DetailBlock
                        label="Updated"
                        value={formatDate(workspace.updatedAt || workspace.updated_at)}
                      />
                    </div>
                    <div className="mt-5 flex justify-end">
                      <Link href={`/admin/procurement/workspaces/${workspace.id}`}>
                        <Button
                          type="button"
                          className="bg-orange-500 text-black hover:bg-orange-400"
                        >
                          Open workspace
                        </Button>
                      </Link>
                    </div>
                  </div>
                </details>
              );
            })}
          </AdminList>
        ) : (
          <AdminEmptyState
            title="No workspaces match these filters"
            description="Change the search, workspace type, or status filter."
          />
        )}
      </AdminSection>

      <CreateWorkspaceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        draft={draft}
        setDraft={setDraft}
        pending={createMutation.isPending}
        onSubmit={() => createMutation.mutate()}
      />
    </AdminWorkspace>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: WorkspaceDraft;
  setDraft: (draft: WorkspaceDraft) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const canSubmit = draft.slug.trim().length > 0 && draft.name.trim().length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] border-white/10 bg-tsBg text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create procurement workspace</DialogTitle>
          <DialogDescription className="text-white/48">
            Create an existing procurement workspace record and its initial public branding.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Slug">
            <Input
              value={draft.slug}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  slug: event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-")
                    .replace(/-+/g, "-"),
                })
              }
              placeholder="grunt"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Internal name">
            <Input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Workspace type">
            <Select
              value={draft.workspaceType}
              onValueChange={(value) =>
                setDraft({ ...draft, workspaceType: value as ProcurementWorkspaceType })
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
          <Field label="Public name">
            <Input
              value={draft.publicName}
              onChange={(event) => setDraft({ ...draft, publicName: event.target.value })}
              placeholder="Defaults to internal name"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Tagline" wide>
            <Textarea
              value={draft.tagline}
              onChange={(event) => setDraft({ ...draft, tagline: event.target.value })}
              rows={4}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit || pending}
            className="bg-orange-500 text-black hover:bg-orange-400"
          >
            {pending ? "Creating…" : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <label className={`space-y-1 text-xs text-white/42 ${wide ? "md:col-span-2" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 break-words text-sm leading-6 text-white/58">{value}</p>
    </div>
  );
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ label }: { label: string }) {
  return (
    <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      {label}
    </div>
  );
}
