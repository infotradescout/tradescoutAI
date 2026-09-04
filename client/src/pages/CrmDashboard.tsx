import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Mail, RefreshCw, Search } from "lucide-react";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
  AdminWorkspaceSubnav,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ContactStatus = "lead" | "prospect" | "customer" | "inactive";
type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";
type ActivityType = "call" | "email" | "meeting" | "note" | "task" | "internal_message";

type CrmContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status: ContactStatus | string;
  assignedToUserId?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type CrmDeal = {
  id: string;
  title: string;
  value?: string | number | null;
  stage: DealStage | string;
  contactId?: string | null;
  assignedToUserId?: string | null;
  description?: string | null;
  expectedCloseDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  contact?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
};

type CrmActivity = {
  id: string;
  type: ActivityType | string;
  subject: string;
  description: string;
  contactId?: string | null;
  dealId?: string | null;
  createdAt?: string | null;
  createdByUserId?: string | null;
  toEmail?: string | null;
  fromEmail?: string | null;
  isInternal?: boolean | null;
  contact?: {
    id?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  deal?: {
    id?: string;
    title?: string | null;
  } | null;
};

type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  assignedToUserId: string;
  notes: string;
};

type DealDraft = {
  title: string;
  value: string;
  stage: DealStage;
  contactId: string;
  assignedToUserId: string;
  description: string;
  expectedCloseDate: string;
};

type ActivityDraft = {
  type: ActivityType;
  subject: string;
  description: string;
  contactId: string;
  dealId: string;
};

const contactStatuses: ContactStatus[] = ["lead", "prospect", "customer", "inactive"];
const dealStages: DealStage[] = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
];
const activityTypes: ActivityType[] = [
  "call",
  "email",
  "meeting",
  "note",
  "task",
  "internal_message",
];

function emptyContactDraft(): ContactDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    status: "lead",
    assignedToUserId: "",
    notes: "",
  };
}

function emptyDealDraft(): DealDraft {
  return {
    title: "",
    value: "",
    stage: "lead",
    contactId: "",
    assignedToUserId: "",
    description: "",
    expectedCloseDate: "",
  };
}

function emptyActivityDraft(): ActivityDraft {
  return {
    type: "note",
    subject: "",
    description: "",
    contactId: "none",
    dealId: "none",
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

function money(value: unknown): string {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function contactName(contact: CrmContact | CrmDeal["contact"] | CrmActivity["contact"]): string {
  if (!contact) return "Contact not linked";
  const name = `${contact.firstName || ""} ${contact.lastName || ""}`.trim();
  return name || contact.email || "Unnamed contact";
}

function ContactStatusBadge({ status }: { status: ContactStatus | string }) {
  if (status === "customer") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Customer
      </Badge>
    );
  }
  if (status === "prospect") {
    return <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-200">Prospect</Badge>;
  }
  if (status === "lead") {
    return <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">Lead</Badge>;
  }
  return (
    <Badge className="border-white/15 bg-white/5 text-white/48">{readable(status)}</Badge>
  );
}

function DealStageBadge({ stage }: { stage: DealStage | string }) {
  if (stage === "closed_won") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Closed won
      </Badge>
    );
  }
  if (stage === "closed_lost") {
    return <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Closed lost</Badge>;
  }
  if (stage === "proposal" || stage === "negotiation") {
    return <Badge className="border-sky-400/25 bg-sky-400/10 text-sky-200">{readable(stage)}</Badge>;
  }
  return (
    <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
      {readable(stage)}
    </Badge>
  );
}

export default function CrmDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("contacts");
  const [contactSearch, setContactSearch] = useState("");
  const [contactStatusFilter, setContactStatusFilter] = useState("all");
  const [dealSearch, setDealSearch] = useState("");
  const [dealStageFilter, setDealStageFilter] = useState("all");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");

  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContactDraft);
  const [dealDraft, setDealDraft] = useState<DealDraft>(emptyDealDraft);
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(emptyActivityDraft);
  const [contactStatusDrafts, setContactStatusDrafts] = useState<Record<string, string>>({});
  const [dealStageDrafts, setDealStageDrafts] = useState<Record<string, string>>({});

  const contactsQuery = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts"],
    queryFn: () => apiRequest("GET", "/api/crm/contacts") as Promise<CrmContact[]>,
    retry: false,
  });

  const dealsQuery = useQuery<CrmDeal[]>({
    queryKey: ["/api/crm/deals"],
    queryFn: () => apiRequest("GET", "/api/crm/deals") as Promise<CrmDeal[]>,
    retry: false,
  });

  const activitiesQuery = useQuery<CrmActivity[]>({
    queryKey: ["/api/crm/activities"],
    queryFn: () => apiRequest("GET", "/api/crm/activities") as Promise<CrmActivity[]>,
    retry: false,
  });

  const contacts = Array.isArray(contactsQuery.data) ? contactsQuery.data : [];
  const deals = Array.isArray(dealsQuery.data) ? dealsQuery.data : [];
  const activities = Array.isArray(activitiesQuery.data) ? activitiesQuery.data : [];

  const createContactMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crm/contacts", {
        firstName: contactDraft.firstName.trim(),
        lastName: contactDraft.lastName.trim(),
        email: contactDraft.email.trim(),
        phone: contactDraft.phone.trim() || undefined,
        company: contactDraft.company.trim() || undefined,
        status: contactDraft.status,
        assignedToUserId: contactDraft.assignedToUserId.trim() || undefined,
        notes: contactDraft.notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      setContactDraft(emptyContactDraft());
      setContactDialogOpen(false);
      toast({ title: "Contact created" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Contact not created",
        description: formatUserFacingErrorMessage(error, "Review the required contact fields."),
        variant: "destructive",
      });
    },
  });

  const createDealMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crm/deals", {
        title: dealDraft.title.trim(),
        value: dealDraft.value.trim() || undefined,
        stage: dealDraft.stage,
        contactId: dealDraft.contactId,
        assignedToUserId: dealDraft.assignedToUserId.trim() || undefined,
        description: dealDraft.description.trim() || undefined,
        expectedCloseDate: dealDraft.expectedCloseDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      setDealDraft(emptyDealDraft());
      setDealDialogOpen(false);
      toast({ title: "Deal created" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Deal not created",
        description: formatUserFacingErrorMessage(error, "Review the required deal fields."),
        variant: "destructive",
      });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/crm/activities", {
        type: activityDraft.type,
        subject: activityDraft.subject.trim(),
        description: activityDraft.description.trim(),
        contactId: activityDraft.contactId === "none" ? undefined : activityDraft.contactId,
        dealId: activityDraft.dealId === "none" ? undefined : activityDraft.dealId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      setActivityDraft(emptyActivityDraft());
      setActivityDialogOpen(false);
      toast({ title: "Activity logged" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Activity not logged",
        description: formatUserFacingErrorMessage(error, "Review the activity subject and details."),
        variant: "destructive",
      });
    },
  });

  const updateContactStatusMutation = useMutation({
    mutationFn: ({ contactId, status }: { contactId: string; status: string }) =>
      apiRequest("PUT", `/api/crm/contacts/${contactId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Contact status updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Contact update failed",
        description: formatUserFacingErrorMessage(error, "The contact was not changed."),
        variant: "destructive",
      });
    },
  });

  const updateDealStageMutation = useMutation({
    mutationFn: ({ dealId, stage }: { dealId: string; stage: string }) =>
      apiRequest("PUT", `/api/crm/deals/${dealId}`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      toast({ title: "Deal stage updated" });
    },
    onError: (error: unknown) => {
      toast({
        title: "Deal update failed",
        description: formatUserFacingErrorMessage(error, "The deal was not changed."),
        variant: "destructive",
      });
    },
  });

  const filteredContacts = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (contactStatusFilter !== "all" && contact.status !== contactStatusFilter) return false;
      if (!term) return true;
      return [contact.firstName, contact.lastName, contact.email, contact.phone, contact.company]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [contactSearch, contactStatusFilter, contacts]);

  const filteredDeals = useMemo(() => {
    const term = dealSearch.trim().toLowerCase();
    return deals.filter((deal) => {
      if (dealStageFilter !== "all" && deal.stage !== dealStageFilter) return false;
      if (!term) return true;
      return [deal.title, deal.description, contactName(deal.contact), deal.contact?.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [dealSearch, dealStageFilter, deals]);

  const filteredActivities = useMemo(() => {
    const term = activitySearch.trim().toLowerCase();
    return [...activities]
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      })
      .filter((activity) => {
        if (activityTypeFilter !== "all" && activity.type !== activityTypeFilter) return false;
        if (!term) return true;
        return [
          activity.subject,
          activity.description,
          contactName(activity.contact),
          activity.deal?.title,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
  }, [activities, activitySearch, activityTypeFilter]);

  const openDeals = deals.filter(
    (deal) => deal.stage !== "closed_won" && deal.stage !== "closed_lost"
  );
  const openPipelineValue = openDeals.reduce((total, deal) => total + Number(deal.value || 0), 0);
  const wonValue = deals
    .filter((deal) => deal.stage === "closed_won")
    .reduce((total, deal) => total + Number(deal.value || 0), 0);
  const recentActivityCount = activities.filter((activity) => {
    if (!activity.createdAt) return false;
    return Date.now() - new Date(activity.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;
  const anyLoading = contactsQuery.isLoading || dealsQuery.isLoading || activitiesQuery.isLoading;
  const anyError = contactsQuery.isError || dealsQuery.isError || activitiesQuery.isError;

  const canCreateContact =
    contactDraft.firstName.trim().length > 0 &&
    contactDraft.lastName.trim().length > 0 &&
    /^\S+@\S+\.\S+$/.test(contactDraft.email.trim());
  const canCreateDeal = dealDraft.title.trim().length > 0 && dealDraft.contactId.length > 0;
  const canCreateActivity =
    activityDraft.subject.trim().length > 0 && activityDraft.description.trim().length > 0;

  return (
    <AdminWorkspace data-testid="admin-sales-pipeline-v2">
      <AdminSection
        title="Sales pipeline"
        description="Internal contacts, active opportunities, and relationship activity. CRM records remain restricted to operations and Super Admin roles by the existing server routes."
        className="pt-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                contactsQuery.refetch();
                dealsQuery.refetch();
                activitiesQuery.refetch();
              }}
              disabled={
                contactsQuery.isFetching || dealsQuery.isFetching || activitiesQuery.isFetching
              }
              className="border-white/12 bg-transparent text-white/65"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  contactsQuery.isFetching || dealsQuery.isFetching || activitiesQuery.isFetching
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActivityDialogOpen(true)}
              className="border-white/12 bg-transparent text-white/65"
            >
              Log activity
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDealDialogOpen(true)}
              className="border-white/12 bg-transparent text-white/65"
            >
              Add deal
            </Button>
            <Button
              type="button"
              onClick={() => setContactDialogOpen(true)}
              className="bg-orange-500 text-black hover:bg-orange-400"
            >
              Add contact
            </Button>
          </div>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Contacts",
              value: contactsQuery.isError ? "—" : contacts.length,
              detail: contactsQuery.isError
                ? "Contact source unavailable"
                : `${contacts.filter((contact) => contact.status === "customer").length} customers`,
              tone: contactsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Open deals",
              value: dealsQuery.isError ? "—" : openDeals.length,
              detail: dealsQuery.isError ? "Deal source unavailable" : money(openPipelineValue),
              tone: dealsQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Won value",
              value: dealsQuery.isError ? "—" : money(wonValue),
              detail: `${deals.filter((deal) => deal.stage === "closed_won").length} won deals`,
              tone: dealsQuery.isError ? "warning" : "good",
            },
            {
              label: "Activity · 7 days",
              value: activitiesQuery.isError ? "—" : recentActivityCount,
              detail: activitiesQuery.isError
                ? "Activity source unavailable"
                : `${activities.length} total activity records`,
              tone: activitiesQuery.isError ? "warning" : "neutral",
            },
          ]}
        />
      </AdminSection>

      {anyError ? (
        <div className="border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm text-amber-100">
          One or more CRM sources are unavailable. Missing data is not represented as a successful
          zero.
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            <TabsTrigger
              value="contacts"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Contacts
            </TabsTrigger>
            <TabsTrigger
              value="deals"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Deals
            </TabsTrigger>
            <TabsTrigger
              value="activities"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Activity
            </TabsTrigger>
          </TabsList>
        </AdminWorkspaceSubnav>

        <TabsContent value="contacts" className="mt-6">
          <AdminSection
            title="Contact registry"
            description="Search relationship records and update the current contact state."
            className="pt-0"
          >
            <AdminToolbar>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
                  <Input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search person, email, phone, or company"
                    className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
                  />
                </div>
                <Select value={contactStatusFilter} onValueChange={setContactStatusFilter}>
                  <SelectTrigger className="w-[11rem] border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {contactStatuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {readable(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-white/35">
                {filteredContacts.length} of {contacts.length} contacts
              </span>
            </AdminToolbar>

            {contactsQuery.isLoading ? (
              <QueueLoading label="Loading CRM contacts…" />
            ) : contactsQuery.isError ? (
              <QueueUnavailable label="CRM contacts are unavailable." />
            ) : filteredContacts.length ? (
              <AdminList className="mt-4">
                {filteredContacts.map((contact) => {
                  const currentStatus = contactStatusDrafts[contact.id] || contact.status;
                  return (
                    <details key={contact.id} className="group">
                      <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(12rem,0.65fr)_minmax(10rem,0.5fr)] lg:items-center [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{contactName(contact)}</p>
                            <ContactStatusBadge status={contact.status} />
                          </div>
                          <p className="mt-1 truncate text-sm text-white/48">
                            {contact.email || "Email not recorded"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Company
                          </p>
                          <p className="mt-2 text-sm text-white/62">
                            {contact.company || "Not recorded"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Updated
                          </p>
                          <p className="mt-2 text-sm text-white/52">
                            {formatDate(contact.updatedAt || contact.createdAt)}
                          </p>
                        </div>
                      </summary>
                      <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                          <DetailBlock label="Phone" value={contact.phone || "Not recorded"} />
                          <DetailBlock
                            label="Assigned to"
                            value={contact.assignedToUserId || "Not assigned"}
                          />
                          <DetailBlock label="Created" value={formatDate(contact.createdAt)} />
                          <DetailBlock label="Contact ID" value={contact.id} />
                        </div>
                        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                              Notes
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/58">
                              {contact.notes || "No notes recorded."}
                            </p>
                          </div>
                          <div className="space-y-3 border-y border-white/10 px-3 py-4">
                            <Select
                              value={currentStatus}
                              onValueChange={(value) =>
                                setContactStatusDrafts((current) => ({
                                  ...current,
                                  [contact.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {contactStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {readable(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                updateContactStatusMutation.isPending ||
                                currentStatus === contact.status
                              }
                              onClick={() =>
                                updateContactStatusMutation.mutate({
                                  contactId: contact.id,
                                  status: currentStatus,
                                })
                              }
                              className="w-full border-white/12 bg-transparent text-white/65"
                            >
                              Save contact status
                            </Button>
                            {contact.email ? (
                              <a
                                href={`mailto:${contact.email}`}
                                className="flex h-9 items-center justify-center gap-2 border border-white/12 text-sm text-white/62 hover:bg-white/[0.04]"
                              >
                                <Mail className="h-4 w-4" />
                                Open email client
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No contacts match these filters"
                description="Change the search or contact-status filter."
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="deals" className="mt-6">
          <AdminSection
            title="Opportunity pipeline"
            description="Review current value, customer context, expected close date, and stage movement."
            className="pt-0"
          >
            <AdminToolbar>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
                  <Input
                    value={dealSearch}
                    onChange={(event) => setDealSearch(event.target.value)}
                    placeholder="Search deal, contact, or description"
                    className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
                  />
                </div>
                <Select value={dealStageFilter} onValueChange={setDealStageFilter}>
                  <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {dealStages.map((stage) => (
                      <SelectItem key={stage} value={stage}>
                        {readable(stage)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-white/35">
                {filteredDeals.length} of {deals.length} deals
              </span>
            </AdminToolbar>

            {dealsQuery.isLoading ? (
              <QueueLoading label="Loading CRM deals…" />
            ) : dealsQuery.isError ? (
              <QueueUnavailable label="CRM deals are unavailable." />
            ) : filteredDeals.length ? (
              <AdminList className="mt-4">
                {filteredDeals.map((deal) => {
                  const currentStage = dealStageDrafts[deal.id] || deal.stage;
                  return (
                    <details key={deal.id} className="group">
                      <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(10rem,0.5fr)_minmax(12rem,0.65fr)] lg:items-center [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{deal.title}</p>
                            <DealStageBadge stage={deal.stage} />
                          </div>
                          <p className="mt-1 truncate text-sm text-white/48">
                            {contactName(deal.contact)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Value
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white/72">
                            {money(deal.value)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                            Expected close
                          </p>
                          <p className="mt-2 text-sm text-white/52">
                            {formatDate(deal.expectedCloseDate)}
                          </p>
                        </div>
                      </summary>
                      <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                          <DetailBlock label="Deal ID" value={deal.id} />
                          <DetailBlock
                            label="Contact ID"
                            value={deal.contactId || deal.contact?.id || "Not linked"}
                          />
                          <DetailBlock
                            label="Assigned to"
                            value={deal.assignedToUserId || "Not assigned"}
                          />
                          <DetailBlock label="Created" value={formatDate(deal.createdAt)} />
                        </div>
                        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                              Description
                            </p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/58">
                              {deal.description || "No description recorded."}
                            </p>
                          </div>
                          <div className="space-y-3 border-y border-white/10 px-3 py-4">
                            <Select
                              value={currentStage}
                              onValueChange={(value) =>
                                setDealStageDrafts((current) => ({
                                  ...current,
                                  [deal.id]: value,
                                }))
                              }
                            >
                              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {dealStages.map((stage) => (
                                  <SelectItem key={stage} value={stage}>
                                    {readable(stage)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={
                                updateDealStageMutation.isPending || currentStage === deal.stage
                              }
                              onClick={() =>
                                updateDealStageMutation.mutate({
                                  dealId: deal.id,
                                  stage: currentStage,
                                })
                              }
                              className="w-full border-white/12 bg-transparent text-white/65"
                            >
                              Save deal stage
                            </Button>
                          </div>
                        </div>
                      </div>
                    </details>
                  );
                })}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No deals match these filters"
                description="Change the search or pipeline-stage filter."
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="activities" className="mt-6">
          <AdminSection
            title="Relationship activity"
            description="Calls, emails, meetings, notes, tasks, and internal-message records linked to contacts or deals."
            className="pt-0"
          >
            <AdminToolbar>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
                  <Input
                    value={activitySearch}
                    onChange={(event) => setActivitySearch(event.target.value)}
                    placeholder="Search activity, contact, or deal"
                    className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
                  />
                </div>
                <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                  <SelectTrigger className="w-[12rem] border-white/10 bg-black/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All activity types</SelectItem>
                    {activityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {readable(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-white/35">
                {filteredActivities.length} of {activities.length} activities
              </span>
            </AdminToolbar>

            {activitiesQuery.isLoading ? (
              <QueueLoading label="Loading CRM activity…" />
            ) : activitiesQuery.isError ? (
              <QueueUnavailable label="CRM activity is unavailable." />
            ) : filteredActivities.length ? (
              <AdminList className="mt-4">
                {filteredActivities.slice(0, 100).map((activity) => (
                  <details key={activity.id} className="group">
                    <summary className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(15rem,1fr)_minmax(11rem,0.55fr)_minmax(10rem,0.5fr)] lg:items-center [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{activity.subject}</p>
                          <Badge className="border-white/15 bg-white/5 text-white/52">
                            {readable(activity.type)}
                          </Badge>
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm text-white/48">
                          {activity.description}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          Related contact
                        </p>
                        <p className="mt-2 text-sm text-white/62">
                          {contactName(activity.contact)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          When
                        </p>
                        <p className="mt-2 text-sm text-white/52">
                          {formatDate(activity.createdAt)}
                        </p>
                      </div>
                    </summary>
                    <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-white/58">
                        {activity.description}
                      </p>
                      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                        <DetailBlock
                          label="Deal"
                          value={activity.deal?.title || activity.dealId || "Not linked"}
                        />
                        <DetailBlock
                          label="Created by"
                          value={activity.createdByUserId || "Not recorded"}
                        />
                        <DetailBlock
                          label="Email route"
                          value={
                            activity.toEmail
                              ? `${activity.fromEmail || "Unknown sender"} → ${activity.toEmail}`
                              : "Not an outbound email record"
                          }
                        />
                        <DetailBlock
                          label="Visibility"
                          value={activity.isInternal ? "Internal" : "Standard CRM activity"}
                        />
                      </div>
                    </div>
                  </details>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No activity matches these filters"
                description="Change the search or activity-type filter."
              />
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>

      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        draft={contactDraft}
        setDraft={setContactDraft}
        pending={createContactMutation.isPending}
        canSubmit={canCreateContact}
        onSubmit={() => createContactMutation.mutate()}
      />
      <DealDialog
        open={dealDialogOpen}
        onOpenChange={setDealDialogOpen}
        draft={dealDraft}
        setDraft={setDealDraft}
        contacts={contacts}
        pending={createDealMutation.isPending}
        canSubmit={canCreateDeal}
        onSubmit={() => createDealMutation.mutate()}
      />
      <ActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        draft={activityDraft}
        setDraft={setActivityDraft}
        contacts={contacts}
        deals={deals}
        pending={createActivityMutation.isPending}
        canSubmit={canCreateActivity}
        onSubmit={() => createActivityMutation.mutate()}
      />
    </AdminWorkspace>
  );
}

function ContactDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  pending,
  canSubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ContactDraft;
  setDraft: (draft: ContactDraft) => void;
  pending: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto border-white/10 bg-tsBg text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription className="text-white/48">
            Create an internal sales relationship record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name">
            <Input
              value={draft.firstName}
              onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Last name">
            <Input
              value={draft.lastName}
              onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Phone">
            <Input
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Company">
            <Input
              value={draft.company}
              onChange={(event) => setDraft({ ...draft, company: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onValueChange={(value) => setDraft({ ...draft, status: value as ContactStatus })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contactStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {readable(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned user ID">
            <Input
              value={draft.assignedToUserId}
              onChange={(event) =>
                setDraft({ ...draft, assignedToUserId: event.target.value })
              }
              placeholder="Optional"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Notes" wide>
            <Textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={5}
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
            {pending ? "Creating…" : "Create contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  contacts,
  pending,
  canSubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: DealDraft;
  setDraft: (draft: DealDraft) => void;
  contacts: CrmContact[];
  pending: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto border-white/10 bg-tsBg text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add deal</DialogTitle>
          <DialogDescription className="text-white/48">
            Create an opportunity linked to an existing CRM contact.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Deal title" wide>
            <Input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Value">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Stage">
            <Select
              value={draft.stage}
              onValueChange={(value) => setDraft({ ...draft, stage: value as DealStage })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dealStages.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {readable(stage)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Contact" wide>
            <Select
              value={draft.contactId || undefined}
              onValueChange={(value) => setDraft({ ...draft, contactId: value })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Choose contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contactName(contact)} · {contact.email || "No email"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected close date">
            <Input
              type="date"
              value={draft.expectedCloseDate}
              onChange={(event) =>
                setDraft({ ...draft, expectedCloseDate: event.target.value })
              }
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Assigned user ID">
            <Input
              value={draft.assignedToUserId}
              onChange={(event) =>
                setDraft({ ...draft, assignedToUserId: event.target.value })
              }
              placeholder="Optional"
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Description" wide>
            <Textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={5}
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
            {pending ? "Creating…" : "Create deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActivityDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  contacts,
  deals,
  pending,
  canSubmit,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ActivityDraft;
  setDraft: (draft: ActivityDraft) => void;
  contacts: CrmContact[];
  deals: CrmDeal[];
  pending: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto border-white/10 bg-tsBg text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log activity</DialogTitle>
          <DialogDescription className="text-white/48">
            Add a call, email, meeting, note, task, or internal-message activity record.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Activity type">
            <Select
              value={draft.type}
              onValueChange={(value) => setDraft({ ...draft, type: value as ActivityType })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {readable(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subject">
            <Input
              value={draft.subject}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
              className="border-white/10 bg-black/20 text-white"
            />
          </Field>
          <Field label="Related contact">
            <Select
              value={draft.contactId}
              onValueChange={(value) => setDraft({ ...draft, contactId: value })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contactName(contact)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Related deal">
            <Select
              value={draft.dealId}
              onValueChange={(value) => setDraft({ ...draft, dealId: value })}
            >
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No deal</SelectItem>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description" wide>
            <Textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={6}
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
            {pending ? "Logging…" : "Log activity"}
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
