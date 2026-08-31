import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Edit,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { hasAdminUiAccess } from "@/lib/roleChecks";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type BroadcastSegment = "all" | "homeowners" | "contractors" | "pros" | "admins";
type NativeSettingsTab =
  | "site-settings"
  | "contractor-settings"
  | "notification-ops"
  | "advertisements"
  | "prizes";
type CrudType = "site-settings" | "business-provider-settings" | "advertisements" | "prizes";

type SiteSetting = {
  id: string;
  category: string;
  key: string;
  value: unknown;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ContractorSetting = {
  id: string;
  category: string;
  setting: string;
  value: unknown;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type PrizeConfiguration = {
  id: string;
  name: string;
  description?: string;
  prizeType: string;
  value: string;
  vendor?: string;
  isActive: boolean;
  probability: string;
  terms?: string;
  expirationDays: number;
  createdAt?: string;
  updatedAt?: string;
};

type Advertisement = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  linkUrl?: string;
  placement: string;
  targetAudience: string;
  targetLocation: string;
  priority: number;
  communityScore: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  clickCount: number;
  viewCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type EditableItem = SiteSetting | ContractorSetting | PrizeConfiguration | Advertisement;

type EditorState = {
  type: CrudType;
  item: EditableItem | null;
} | null;

const TAB_ROUTES: Record<string, string> = {
  heatmap: "/admin/geo/counties",
  monitoring: "/admin/live-stream",
  "error-reports": "/admin/errors",
  "ai-fixes": "/admin/live-stream",
  pricing: "/admin/pricing",
  finance: "/admin/finance",
  authority: "/admin/control",
  "testing-controls": "/admin/control",
};

const NATIVE_TABS = new Set<NativeSettingsTab>([
  "site-settings",
  "contractor-settings",
  "notification-ops",
  "advertisements",
  "prizes",
]);

function readable(value: unknown): string {
  const text = String(value || "").trim();
  return text ? text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not recorded";
}

function jsonValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function activeBadge(active: boolean) {
  return active ? (
    <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Active</Badge>
  ) : (
    <Badge className="border-white/15 bg-white/5 text-white/50">Inactive</Badge>
  );
}

export default function AdminPanel() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedTab, setSelectedTab] = useState<NativeSettingsTab>("site-settings");
  const [editor, setEditor] = useState<EditorState>(null);
  const [broadcastSegment, setBroadcastSegment] = useState<BroadcastSegment>("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastEmail, setBroadcastEmail] = useState(false);
  const [broadcastPush, setBroadcastPush] = useState(false);
  const [broadcastCampaignType, setBroadcastCampaignType] = useState("");
  const [broadcastTags, setBroadcastTags] = useState("");
  const [broadcastTargetState, setBroadcastTargetState] = useState("");
  const [broadcastMarketingOnly, setBroadcastMarketingOnly] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab") || "site-settings";
    const redirect = TAB_ROUTES[tab];
    if (redirect) {
      navigate(redirect);
      return;
    }
    if (NATIVE_TABS.has(tab as NativeSettingsTab)) {
      setSelectedTab(tab as NativeSettingsTab);
    }
  }, [navigate]);

  const rawRole = String(user?.role || "").trim().toLowerCase();
  const hasAdminAccess = Boolean(
    isAuthenticated && user && (hasAdminUiAccess(user) || rawRole === "moderator")
  );

  const prizesQuery = useQuery<PrizeConfiguration[]>({
    queryKey: ["/api/admin/prizes"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/prizes");
      return Array.isArray(response) ? (response as PrizeConfiguration[]) : [];
    },
    enabled: hasAdminAccess,
    retry: false,
  });
  const adsQuery = useQuery<Advertisement[]>({
    queryKey: ["/api/admin/advertisements"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/advertisements");
      return Array.isArray(response) ? (response as Advertisement[]) : [];
    },
    enabled: hasAdminAccess,
    retry: false,
  });
  const siteSettingsQuery = useQuery<SiteSetting[]>({
    queryKey: ["/api/admin/site-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/site-settings");
      return Array.isArray(response) ? (response as SiteSetting[]) : [];
    },
    enabled: hasAdminAccess,
    retry: false,
  });
  const providerSettingsQuery = useQuery<ContractorSetting[]>({
    queryKey: ["/api/admin/business-provider-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/business-provider-settings");
      return Array.isArray(response) ? (response as ContractorSetting[]) : [];
    },
    enabled: hasAdminAccess,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: ({ type, data }: { type: CrudType; data: Record<string, unknown> }) =>
      apiRequest("POST", `/api/admin/${type}`, data),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      setEditor(null);
      toast({ title: "Configuration created", description: "The new record was saved." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Configuration was not created",
        description: formatUserFacingErrorMessage(error, "Failed to create the record."),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      type,
      id,
      data,
    }: {
      type: CrudType;
      id: string;
      data: Record<string, unknown>;
    }) => apiRequest("PUT", `/api/admin/${type}/${id}`, data),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      setEditor(null);
      toast({ title: "Configuration updated", description: "The changes were saved." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Configuration was not updated",
        description: formatUserFacingErrorMessage(error, "Failed to update the record."),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: CrudType; id: string }) =>
      apiRequest("DELETE", `/api/admin/${type}/${id}`),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({ queryKey: [`/api/admin/${variables.type}`] });
      toast({ title: "Configuration deleted", description: "The record was removed." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Configuration was not deleted",
        description: formatUserFacingErrorMessage(error, "Failed to delete the record."),
        variant: "destructive",
      });
    },
  });

  const testPushMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/test-push-notification", {}),
    onSuccess: () =>
      toast({
        title: "Test notification sent",
        description: "Check in-app notifications and the current push-enabled device.",
      }),
    onError: (error: unknown) =>
      toast({
        title: "Test notification failed",
        description: formatUserFacingErrorMessage(error, "Failed to send the test notification."),
        variant: "destructive",
      }),
  });

  const broadcastMutation = useMutation({
    mutationFn: () => {
      const deliveryMethods = ["in_app"];
      if (broadcastEmail) deliveryMethods.push("email");
      if (broadcastPush) deliveryMethods.push("push");
      const tags = broadcastTags
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const targetFilters: Record<string, unknown> = {};
      if (broadcastTargetState.trim()) {
        targetFilters.stateCodes = [broadcastTargetState.trim().toUpperCase()];
      }
      if (broadcastMarketingOnly) targetFilters.onlyWithMarketingEmails = true;
      return apiRequest("POST", "/api/admin/notifications/broadcast", {
        segment: broadcastSegment,
        title: broadcastTitle,
        message: broadcastMessage,
        deliveryMethods,
        campaignType: broadcastCampaignType.trim() || undefined,
        tags,
        targetFilters,
      });
    },
    onSuccess: (data: any) => {
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastEmail(false);
      setBroadcastPush(false);
      setBroadcastCampaignType("");
      setBroadcastTags("");
      setBroadcastTargetState("");
      setBroadcastMarketingOnly(false);
      toast({
        title: "Broadcast sent",
        description:
          typeof data?.targetCount === "number"
            ? `Delivered to ${data.targetCount} users.`
            : "The announcement was queued.",
      });
    },
    onError: (error: unknown) =>
      toast({
        title: "Broadcast failed",
        description: formatUserFacingErrorMessage(error, "Unable to send the announcement."),
        variant: "destructive",
      }),
  });

  const deleteItem = (type: CrudType, item: EditableItem) => {
    if (!window.confirm(`Delete this ${readable(type)} record? This action is permanent.`)) return;
    deleteMutation.mutate({ type, id: item.id });
  };

  if (!hasAdminAccess) {
    return (
      <AdminWorkspace>
        <AdminEmptyState
          title="Platform Settings require admin access"
          description="The current session cannot read or change platform configuration."
        />
      </AdminWorkspace>
    );
  }

  const siteSettings = siteSettingsQuery.data || [];
  const providerSettings = providerSettingsQuery.data || [];
  const advertisements = adsQuery.data || [];
  const prizes = prizesQuery.data || [];

  return (
    <AdminWorkspace data-testid="admin-platform-settings-v2">
      <AdminSection
        title="Platform configuration"
        description="Site settings, business-provider settings, notification operations, advertisements, and prizes. Older monitoring and finance tabs now open their canonical workspaces."
        className="pt-0"
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Site settings",
              value: siteSettingsQuery.isError ? "—" : siteSettings.length,
              detail: siteSettingsQuery.isError
                ? "Site settings unavailable"
                : `${siteSettings.filter((item) => item.isActive).length} active`,
              tone: siteSettingsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Provider settings",
              value: providerSettingsQuery.isError ? "—" : providerSettings.length,
              detail: providerSettingsQuery.isError
                ? "Provider settings unavailable"
                : `${providerSettings.filter((item) => item.isActive).length} active`,
              tone: providerSettingsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Advertisements",
              value: adsQuery.isError ? "—" : advertisements.length,
              detail: adsQuery.isError
                ? "Advertisement source unavailable"
                : `${advertisements.filter((item) => item.isActive).length} active · ${advertisements.reduce((sum, item) => sum + Number(item.viewCount || 0), 0)} views`,
              tone: adsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Prizes",
              value: prizesQuery.isError ? "—" : prizes.length,
              detail: prizesQuery.isError
                ? "Prize source unavailable"
                : `${prizes.filter((item) => item.isActive).length} active`,
              tone: prizesQuery.isError ? "warning" : "neutral",
            },
          ]}
        />
      </AdminSection>

      <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as NativeSettingsTab)} className="space-y-6">
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            {[
              ["site-settings", "Site settings"],
              ["contractor-settings", "Business providers"],
              ["notification-ops", "Notifications"],
              ["advertisements", "Advertisements"],
              ["prizes", "Prizes"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="site-settings" className="mt-0">
          <SettingsList
            title="Site settings"
            description="Platform-wide configuration records. JSON values remain explicit and editable."
            type="site-settings"
            items={siteSettings}
            loading={siteSettingsQuery.isLoading}
            error={siteSettingsQuery.isError}
            onRefresh={() => siteSettingsQuery.refetch()}
            onCreate={() => setEditor({ type: "site-settings", item: null })}
            onEdit={(item) => setEditor({ type: "site-settings", item })}
            onDelete={(item) => deleteItem("site-settings", item)}
          />
        </TabsContent>

        <TabsContent value="contractor-settings" className="mt-0">
          <SettingsList
            title="Business-provider settings"
            description="Settings used by business and provider experiences."
            type="business-provider-settings"
            items={providerSettings}
            loading={providerSettingsQuery.isLoading}
            error={providerSettingsQuery.isError}
            onRefresh={() => providerSettingsQuery.refetch()}
            onCreate={() => setEditor({ type: "business-provider-settings", item: null })}
            onEdit={(item) => setEditor({ type: "business-provider-settings", item })}
            onDelete={(item) => deleteItem("business-provider-settings", item)}
          />
        </TabsContent>

        <TabsContent value="notification-ops" className="mt-0">
          <NotificationOperations
            testPending={testPushMutation.isPending}
            onTest={() => testPushMutation.mutate()}
            segment={broadcastSegment}
            onSegmentChange={setBroadcastSegment}
            title={broadcastTitle}
            onTitleChange={setBroadcastTitle}
            message={broadcastMessage}
            onMessageChange={setBroadcastMessage}
            email={broadcastEmail}
            onEmailChange={setBroadcastEmail}
            push={broadcastPush}
            onPushChange={setBroadcastPush}
            campaignType={broadcastCampaignType}
            onCampaignTypeChange={setBroadcastCampaignType}
            tags={broadcastTags}
            onTagsChange={setBroadcastTags}
            targetState={broadcastTargetState}
            onTargetStateChange={setBroadcastTargetState}
            marketingOnly={broadcastMarketingOnly}
            onMarketingOnlyChange={setBroadcastMarketingOnly}
            broadcastPending={broadcastMutation.isPending}
            onBroadcast={() => broadcastMutation.mutate()}
          />
        </TabsContent>

        <TabsContent value="advertisements" className="mt-0">
          <AdvertisementList
            items={advertisements}
            loading={adsQuery.isLoading}
            error={adsQuery.isError}
            onRefresh={() => adsQuery.refetch()}
            onCreate={() => setEditor({ type: "advertisements", item: null })}
            onEdit={(item) => setEditor({ type: "advertisements", item })}
            onDelete={(item) => deleteItem("advertisements", item)}
          />
        </TabsContent>

        <TabsContent value="prizes" className="mt-0">
          <PrizeList
            items={prizes}
            loading={prizesQuery.isLoading}
            error={prizesQuery.isError}
            onRefresh={() => prizesQuery.refetch()}
            onCreate={() => setEditor({ type: "prizes", item: null })}
            onEdit={(item) => setEditor({ type: "prizes", item })}
            onDelete={(item) => deleteItem("prizes", item)}
          />
        </TabsContent>
      </Tabs>

      <ConfigurationDialog
        editor={editor}
        onClose={() => setEditor(null)}
        saving={createMutation.isPending || updateMutation.isPending}
        onSubmit={(data) => {
          if (!editor) return;
          if (editor.item) {
            updateMutation.mutate({ type: editor.type, id: editor.item.id, data });
          } else {
            createMutation.mutate({ type: editor.type, data });
          }
        }}
      />
    </AdminWorkspace>
  );
}

export const AdminPanelContent = AdminPanel;

function SettingsList({
  title,
  description,
  type,
  items,
  loading,
  error,
  onRefresh,
  onCreate,
  onEdit,
  onDelete,
}: {
  title: string;
  description: string;
  type: "site-settings" | "business-provider-settings";
  items: Array<SiteSetting | ContractorSetting>;
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (item: SiteSetting | ContractorSetting) => void;
  onDelete: (item: SiteSetting | ContractorSetting) => void;
}) {
  return (
    <AdminSection
      title={title}
      description={description}
      className="pt-0"
      actions={
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} className="border-white/12 bg-transparent text-white/60">
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button type="button" onClick={onCreate} className="bg-orange-500 text-black hover:bg-orange-400">
            <Plus className="mr-2 h-4 w-4" />Add setting
          </Button>
        </div>
      }
    >
      {loading ? (
        <QueueLoading label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <QueueUnavailable label={`${title} are unavailable. No record was changed.`} />
      ) : items.length ? (
        <AdminList>
          {items.map((item) => {
            const key = type === "business-provider-settings" ? (item as ContractorSetting).setting : (item as SiteSetting).key;
            return (
              <div key={item.id} className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(10rem,0.65fr)_minmax(12rem,0.8fr)_minmax(0,1.2fr)_auto] lg:items-center">
                <div>
                  <p className="font-semibold text-white">{item.category}</p>
                  <p className="mt-1 text-xs text-white/35">{activeBadge(item.isActive)}</p>
                </div>
                <div className="font-mono text-sm text-white/58">{key}</div>
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm leading-6 text-white/52">{item.description || "No description"}</p>
                  <p className="mt-1 truncate font-mono text-xs text-white/28">{jsonValue(item.value)}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)} className="border-white/12 bg-transparent text-white/60"><Edit className="h-4 w-4" /></Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => onDelete(item)} className="border-red-300/20 bg-transparent text-red-100"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </AdminList>
      ) : (
        <AdminEmptyState title={`No ${title.toLowerCase()}`} description="Create the first record when a real configuration value is required." />
      )}
    </AdminSection>
  );
}

function AdvertisementList({ items, loading, error, onRefresh, onCreate, onEdit, onDelete }: {
  items: Advertisement[];
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (item: Advertisement) => void;
  onDelete: (item: Advertisement) => void;
}) {
  return (
    <AdminSection title="Advertisements" description="Platform advertisement records and targeting configuration." className="pt-0" actions={<div className="flex gap-2"><Button type="button" variant="outline" onClick={onRefresh} className="border-white/12 bg-transparent text-white/60"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button type="button" onClick={onCreate} className="bg-orange-500 text-black hover:bg-orange-400"><Plus className="mr-2 h-4 w-4" />Add advertisement</Button></div>}>
      {loading ? <QueueLoading label="Loading advertisements…" /> : error ? <QueueUnavailable label="Advertisements are unavailable. No record was changed." /> : items.length ? (
        <AdminList>{items.map((item) => <div key={item.id} className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(12rem,0.7fr)_minmax(10rem,0.55fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-white">{item.title}</p>{activeBadge(item.isActive)}</div><p className="mt-2 line-clamp-2 text-sm text-white/48">{item.content}</p></div><div className="text-sm text-white/52"><p>{readable(item.placement)} · {readable(item.targetAudience)}</p><p className="mt-1 text-xs text-white/32">{item.targetLocation || "national"}</p></div><div className="text-sm text-white/52"><p>{item.viewCount || 0} views</p><p className="mt-1">{item.clickCount || 0} clicks</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)} className="border-white/12 bg-transparent text-white/60"><Edit className="h-4 w-4" /></Button><Button type="button" size="sm" variant="outline" onClick={() => onDelete(item)} className="border-red-300/20 bg-transparent text-red-100"><Trash2 className="h-4 w-4" /></Button></div></div>)}</AdminList>
      ) : <AdminEmptyState title="No advertisements" description="Create an advertisement only when a real placement and audience are defined." />}
    </AdminSection>
  );
}

function PrizeList({ items, loading, error, onRefresh, onCreate, onEdit, onDelete }: {
  items: PrizeConfiguration[];
  loading: boolean;
  error: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (item: PrizeConfiguration) => void;
  onDelete: (item: PrizeConfiguration) => void;
}) {
  return (
    <AdminSection title="Prize configurations" description="Giveaway prize records, probabilities, expirations, and active state." className="pt-0" actions={<div className="flex gap-2"><Button type="button" variant="outline" onClick={onRefresh} className="border-white/12 bg-transparent text-white/60"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button type="button" onClick={onCreate} className="bg-orange-500 text-black hover:bg-orange-400"><Plus className="mr-2 h-4 w-4" />Add prize</Button></div>}>
      {loading ? <QueueLoading label="Loading prizes…" /> : error ? <QueueUnavailable label="Prize configurations are unavailable. No record was changed." /> : items.length ? (
        <AdminList>{items.map((item) => <div key={item.id} className="grid gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(10rem,0.55fr)_minmax(10rem,0.55fr)_auto] lg:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-white">{item.name}</p>{activeBadge(item.isActive)}</div><p className="mt-2 line-clamp-2 text-sm text-white/48">{item.description || "No description"}</p></div><div className="text-sm text-white/55"><p>{readable(item.prizeType)}</p><p className="mt-1 text-xs text-white/32">{item.vendor || "No vendor"}</p></div><div className="text-sm text-white/55"><p>{item.value}</p><p className="mt-1 text-xs text-white/32">{(Number(item.probability || 0) * 100).toFixed(2)}% · {item.expirationDays || 30} days</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)} className="border-white/12 bg-transparent text-white/60"><Edit className="h-4 w-4" /></Button><Button type="button" size="sm" variant="outline" onClick={() => onDelete(item)} className="border-red-300/20 bg-transparent text-red-100"><Trash2 className="h-4 w-4" /></Button></div></div>)}</AdminList>
      ) : <AdminEmptyState title="No prizes" description="Create a prize only when its real terms and probability are defined." />}
    </AdminSection>
  );
}

function NotificationOperations(props: {
  testPending: boolean;
  onTest: () => void;
  segment: BroadcastSegment;
  onSegmentChange: (value: BroadcastSegment) => void;
  title: string;
  onTitleChange: (value: string) => void;
  message: string;
  onMessageChange: (value: string) => void;
  email: boolean;
  onEmailChange: (value: boolean) => void;
  push: boolean;
  onPushChange: (value: boolean) => void;
  campaignType: string;
  onCampaignTypeChange: (value: string) => void;
  tags: string;
  onTagsChange: (value: string) => void;
  targetState: string;
  onTargetStateChange: (value: string) => void;
  marketingOnly: boolean;
  onMarketingOnlyChange: (value: boolean) => void;
  broadcastPending: boolean;
  onBroadcast: () => void;
}) {
  return (
    <div className="grid gap-7 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <AdminSection title="Notification heartbeat" description="Send one test to the current admin account and verify in-app and push delivery." className="pt-0">
        <div className="border-y border-white/10 px-3 py-5 sm:px-4"><Button type="button" onClick={props.onTest} disabled={props.testPending} className="bg-orange-500 text-black hover:bg-orange-400"><Bell className="mr-2 h-4 w-4" />{props.testPending ? "Sending…" : "Send test notification"}</Button><p className="mt-4 text-sm leading-6 text-white/45">Confirm the notification appears in the header and full notification view. Push also requires a secure origin, valid browser permission, and an active device subscription.</p></div>
      </AdminSection>
      <AdminSection title="Broadcast announcement" description="In-app delivery is always included. Email and push remain optional and respect existing preferences and subscriptions." className="pt-0">
        <div className="space-y-5 border-y border-white/10 px-3 py-5 sm:px-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Segment</Label><Select value={props.segment} onValueChange={(value) => props.onSegmentChange(value as BroadcastSegment)}><SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All users</SelectItem><SelectItem value="homeowners">Homeowners and residents</SelectItem><SelectItem value="contractors">Contractors and trades</SelectItem><SelectItem value="pros">All professionals</SelectItem><SelectItem value="admins">Platform admins</SelectItem></SelectContent></Select></div><div className="space-y-3"><ToggleRow label="Email where allowed" checked={props.email} onChange={props.onEmailChange} /><ToggleRow label="Push where configured" checked={props.push} onChange={props.onPushChange} /><ToggleRow label="Marketing opt-in only" checked={props.marketingOnly} onChange={props.onMarketingOnlyChange} /></div></div><div className="space-y-2"><Label>Title</Label><Input value={props.title} onChange={(event) => props.onTitleChange(event.target.value)} className="border-white/10 bg-black/20 text-white" /></div><div className="space-y-2"><Label>Message</Label><Textarea value={props.message} onChange={(event) => props.onMessageChange(event.target.value)} className="min-h-32 border-white/10 bg-black/20 text-white" /></div><div className="grid gap-4 md:grid-cols-3"><TextInput label="Campaign type" value={props.campaignType} onChange={props.onCampaignTypeChange} /><TextInput label="Tags" value={props.tags} onChange={props.onTagsChange} /><TextInput label="Target state" value={props.targetState} onChange={(value) => props.onTargetStateChange(value.toUpperCase().slice(0, 2))} /></div><Button type="button" onClick={props.onBroadcast} disabled={props.broadcastPending || !props.title.trim() || !props.message.trim()} className="bg-orange-500 text-black hover:bg-orange-400"><Megaphone className="mr-2 h-4 w-4" />{props.broadcastPending ? "Sending…" : "Send broadcast"}</Button></div>
      </AdminSection>
    </div>
  );
}

function ConfigurationDialog({ editor, onClose, onSubmit, saving }: { editor: EditorState; onClose: () => void; onSubmit: (data: Record<string, unknown>) => void; saving: boolean }) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  useEffect(() => setFormData(editor?.item ? { ...editor.item } : {}), [editor]);
  if (!editor) return null;
  const update = (key: string, value: unknown) => setFormData((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[90vh] overflow-y-auto border-white/12 bg-tsBg text-white sm:max-w-3xl"><DialogHeader><DialogTitle className="text-white">{editor.item ? "Edit" : "Create"} {readable(editor.type)}</DialogTitle><DialogDescription className="text-white/45">Save only the configuration fields shown in this form.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); onSubmit(formData); }} className="space-y-5">{editor.type === "prizes" ? <PrizeFields data={formData} update={update} /> : editor.type === "advertisements" ? <AdvertisementFields data={formData} update={update} /> : <SettingFields type={editor.type} data={formData} update={update} />}<div className="flex justify-end gap-2 border-t border-white/10 pt-5"><Button type="button" variant="outline" onClick={onClose} className="border-white/12 bg-transparent text-white/60">Cancel</Button><Button type="submit" disabled={saving} className="bg-orange-500 text-black hover:bg-orange-400">{saving ? "Saving…" : editor.item ? "Save changes" : "Create"}</Button></div></form></DialogContent></Dialog>
  );
}

function PrizeFields({ data, update }: { data: Record<string, any>; update: (key: string, value: unknown) => void }) {
  return <><div className="grid gap-4 md:grid-cols-2"><TextInput label="Prize name" value={data.name || ""} onChange={(value) => update("name", value)} required /><div className="space-y-2"><Label>Prize type</Label><Select value={data.prizeType || undefined} onValueChange={(value) => update("prizeType", value)}><SelectTrigger className="border-white/10 bg-black/20 text-white"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="gift_card">Gift card</SelectItem><SelectItem value="discount">Discount</SelectItem><SelectItem value="premium_features">Premium features</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Description</Label><Textarea value={data.description || ""} onChange={(event) => update("description", event.target.value)} className="border-white/10 bg-black/20 text-white" /></div><div className="grid gap-4 md:grid-cols-3"><TextInput label="Value" value={data.value || ""} onChange={(value) => update("value", value)} required /><TextInput label="Vendor" value={data.vendor || ""} onChange={(value) => update("vendor", value)} /><NumberInput label="Probability %" value={Number(data.probability || 0) * 100 || 5} onChange={(value) => update("probability", String(value / 100))} /><NumberInput label="Expiration days" value={Number(data.expirationDays || 30)} onChange={(value) => update("expirationDays", value)} /></div><div className="space-y-2"><Label>Terms</Label><Textarea value={data.terms || ""} onChange={(event) => update("terms", event.target.value)} className="border-white/10 bg-black/20 text-white" /></div><ToggleRow label="Active" checked={data.isActive !== false} onChange={(value) => update("isActive", value)} /></>;
}

function AdvertisementFields({ data, update }: { data: Record<string, any>; update: (key: string, value: unknown) => void }) {
  return <><TextInput label="Title" value={data.title || ""} onChange={(value) => update("title", value)} required /><div className="space-y-2"><Label>Content</Label><Textarea value={data.content || ""} onChange={(event) => update("content", event.target.value)} className="min-h-28 border-white/10 bg-black/20 text-white" required /></div><div className="grid gap-4 md:grid-cols-2"><TextInput label="Image URL" value={data.imageUrl || ""} onChange={(value) => update("imageUrl", value)} /><TextInput label="Link URL" value={data.linkUrl || ""} onChange={(value) => update("linkUrl", value)} /></div><div className="grid gap-4 md:grid-cols-2"><TextInput label="Placement" value={data.placement || ""} onChange={(value) => update("placement", value)} required /><TextInput label="Target audience" value={data.targetAudience || "all"} onChange={(value) => update("targetAudience", value)} /><TextInput label="Target location" value={data.targetLocation || "national"} onChange={(value) => update("targetLocation", value)} /><NumberInput label="Priority" value={Number(data.priority || 0)} onChange={(value) => update("priority", value)} /><NumberInput label="Community score" value={Number(data.communityScore || 50)} onChange={(value) => update("communityScore", value)} /></div><div className="grid gap-4 md:grid-cols-2"><DateInput label="Start date" value={data.startDate} onChange={(value) => update("startDate", value)} /><DateInput label="End date" value={data.endDate} onChange={(value) => update("endDate", value)} /></div><ToggleRow label="Active" checked={data.isActive !== false} onChange={(value) => update("isActive", value)} /></>;
}

function SettingFields({ type, data, update }: { type: CrudType; data: Record<string, any>; update: (key: string, value: unknown) => void }) {
  const settingKey = type === "business-provider-settings" ? "setting" : "key";
  return <><div className="grid gap-4 md:grid-cols-2"><TextInput label="Category" value={data.category || ""} onChange={(value) => update("category", value)} required /><TextInput label={type === "business-provider-settings" ? "Setting" : "Key"} value={data[settingKey] || ""} onChange={(value) => update(settingKey, value)} required /></div><div className="space-y-2"><Label>Description</Label><Textarea value={data.description || ""} onChange={(event) => update("description", event.target.value)} className="border-white/10 bg-black/20 text-white" /></div><div className="space-y-2"><Label>Value (JSON or text)</Label><Textarea value={jsonValue(data.value)} onChange={(event) => { try { update("value", JSON.parse(event.target.value)); } catch { update("value", event.target.value); } }} className="min-h-36 border-white/10 bg-black/20 font-mono text-white" required /></div><ToggleRow label="Active" checked={data.isActive !== false} onChange={(value) => update("isActive", value)} /></>;
}

function QueueLoading({ label }: { label: string }) { return <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45"><RefreshCw className="mr-3 h-4 w-4 animate-spin" />{label}</div>; }
function QueueUnavailable({ label }: { label: string }) { return <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm text-amber-100">{label}</div>; }
function TextInput({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div className="space-y-2"><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="border-white/10 bg-black/20 text-white" /></div>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value || 0))} className="border-white/10 bg-black/20 text-white" /></div>; }
function DateInput({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string | null) => void }) { return <div className="space-y-2"><Label>{label}</Label><Input type="date" value={value ? String(value).split("T")[0] : ""} onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : null)} className="border-white/10 bg-black/20 text-white" /></div>; }
function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between gap-4 border-y border-white/10 px-3 py-3 text-sm text-white/60"><span>{label}</span><Switch checked={checked} onCheckedChange={onChange} /></div>; }
