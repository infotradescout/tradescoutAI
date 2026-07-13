import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { useLocation, useParams } from "wouter";
import {
  Building,
  DollarSign,
  Users,
  Vote,
  Wrench,
  Calendar,
  TrendingUp,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { HOAManagementShell } from "@/shells/HOAManagementShell";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { HOANextStepsCard } from "@/components/hoa/HOANextStepsCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HOA_SIMPLE_VIEW_KEY = "ts:hoa:simple_view:v1";

interface HOA {
  id: string;
  name: string;
  address: string;
  totalUnits: number;
  monthlyFees: string;
  reserves: string;
  managementCompany: string;
  boardMembers: Array<{
    name: string;
    position: string;
    term: string;
  }>;
  amenities: string[];
  nextMeeting: string;
  governance?: {
    votingEnabled?: boolean;
    financialsEnabled?: boolean;
    vendorManagementEnabled?: boolean;
    documentLibraryEnabled?: boolean;
    eventCalendarEnabled?: boolean;
    communicationsEnabled?: boolean;
    architecturalReviewEnabled?: boolean;
    violationsEnabled?: boolean;
    maintenanceRequestsEnabled?: boolean;
    residentDirectoryEnabled?: boolean;
    commonAreaReservationsEnabled?: boolean;
    customRoles?: any;
    quorumPercentage?: number;
    votePassThreshold?: number;
  };
}

interface Vote {
  id: string;
  title: string;
  description: string;
  type: string;
  startDate: string;
  endDate: string;
  requiredQuorum: number;
  currentVotes: number;
  votesFor: number;
  votesAgainst: number;
  estimatedCost: string;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  contactPerson: string;
  phone: string;
  email: string;
  monthlyContract: string;
  rating: number;
  status: string;
  services: string[];
}

interface HOAMember {
  id: string;
  role: string;
  unitNumber?: string;
  canViewFinances: boolean;
  canEditDocuments: boolean;
  canManageVendors: boolean;
  canCreateVotes: boolean;
  votingRights: boolean;
  inGoodStanding: boolean;
}

type HOAMemberDirectoryRecord = {
  userId: string;
  userEmail?: string;
  userName?: string;
  role?: string;
};

type HoaMembership = {
  hoaId: string;
  hoaName: string;
  role: string;
  status: string;
  stateCode: string | null;
  countyFips: string | null;
  groupType?: string;
};

export default function HOAManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { unreadCount } = useNotifications();
  const params = useParams();
  const hoaIdFromRoute = (params as any)?.hoaId as string | undefined;
  const [, navigate] = useLocation();
  const location = useLocationContext({
    layer: "hoa",
    hoaId: hoaIdFromRoute ?? undefined,
  });
  const countyCommitted = hasCountyContext(location);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [simpleView, setSimpleView] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [targetRole, setTargetRole] = useState<"president" | "vice_president">("president");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [durationHours, setDurationHours] = useState("168");
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setSimpleView(window.localStorage.getItem(HOA_SIMPLE_VIEW_KEY) === "1");
    } catch {
      // no-op
    }
  }, []);

  const toggleSimpleView = () => {
    setSimpleView((prev) => {
      const next = !prev;
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HOA_SIMPLE_VIEW_KEY, next ? "1" : "0");
        }
      } catch {
        // no-op
      }
      return next;
    });
  };

  const leaveHoAMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      if (!activeHoaId) throw new Error("No active HOA membership");
      const response = await fetch(`/api/hoa/${activeHoaId}/membership`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: data.reason }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to leave HOA");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "You left the HOA",
        description: "Your membership has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "member"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "members"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to leave HOA",
        description: formatUserFacingErrorMessage(error, "Unable to leave HOA."),
        variant: "destructive",
      });
    },
  });

  const initiateBoardTransferVoteMutation = useMutation({
    mutationFn: async (data: {
      targetRole: "president" | "vice_president";
      nomineeUserId: string;
      reason: string;
      durationHours: number;
    }) => {
      if (!activeHoaId) throw new Error("No active HOA membership");
      const response = await fetch(`/api/hoa/${activeHoaId}/votes/board-transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to start transfer vote");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote created",
        description: "The transfer vote is now active.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "votes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "member"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to create vote",
        description: formatUserFacingErrorMessage(error, "Unable to create vote."),
        variant: "destructive",
      });
    },
  });

  // Load HOA memberships for the current user
  const { data: hoaMembershipData, isLoading: membershipLoading } = useQuery<{
    memberships: HoaMembership[];
  }>({
    queryKey: ["/api/hoa", location.stateCode, location.countyFips, location.hoaId],
    queryFn: async () => {
      const res = await fetch("/api/hoa");
      if (!res.ok) {
        throw new Error("Failed to load HOA memberships");
      }
      return res.json();
    },
    enabled: !!user && countyCommitted,
  });

  const memberships = hoaMembershipData?.memberships ?? [];
  const activeHoaId = memberships[0]?.hoaId;

  // Fetch user's HOA membership and permissions
  const { data: memberData, isLoading: memberLoading } = useQuery<HOAMember>({
    queryKey: ["/api/hoa", activeHoaId, "member"],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${activeHoaId}/member`);
      if (!response.ok) {
        throw new Error("Not a member of this HOA");
      }
      return response.json();
    },
    enabled: !!user && !!activeHoaId && countyCommitted,
    retry: false,
  });

  const { data: hoaMembersDirectory = [] } = useQuery<HOAMemberDirectoryRecord[]>({
    queryKey: ["/api/hoa", activeHoaId, "members"],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${activeHoaId}/members`);
      if (!response.ok) throw new Error("Failed to load members");
      return response.json();
    },
    enabled: !!activeHoaId && countyCommitted,
  });

  const { data: hoa, isLoading: hoaLoading } = useQuery({
    queryKey: ["/api/hoa", activeHoaId],
    queryFn: async () => {
      const res = await fetch(`/api/hoa/${activeHoaId}`);
      if (!res.ok) {
        throw new Error("Failed to load HOA");
      }
      const json = await res.json();

      if (countyCommitted) {
        try {
          const { recordActivity } = await import("../agent/activity");
          recordActivity({
            type: "county_gated_query_success",
            ts: new Date().toISOString(),
            path: typeof window !== "undefined" ? window.location.pathname : "",
            meta: { surface: "hoa_management", queryKey: "hoa_detail" },
          });
        } catch {
          // ignore telemetry failures
        }
      }

      return json;
    },
    enabled: !!activeHoaId && countyCommitted,
  });

  const { data: finances, isLoading: financesLoading } = useQuery({
    queryKey: ["/api/hoa", activeHoaId, "finances"],
    queryFn: () => fetch(`/api/hoa/${activeHoaId}/finances`).then((res) => res.json()),
    enabled: !!activeHoaId && (memberData?.canViewFinances || false) && countyCommitted,
  });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["/api/hoa", activeHoaId, "vendors"],
    queryFn: () => fetch(`/api/hoa/${activeHoaId}/vendors`).then((res) => res.json()),
    initialData: [],
    enabled: !!activeHoaId && countyCommitted,
  });

  const { data: votes = [], isLoading: votesLoading } = useQuery({
    queryKey: ["/api/hoa", activeHoaId, "votes"],
    queryFn: () => fetch(`/api/hoa/${activeHoaId}/votes`).then((res) => res.json()),
    initialData: [],
    enabled: !!activeHoaId && countyCommitted,
  });

  // Placeholder for refreshing financial data
  const refreshFinancials = () => {
    if (activeHoaId) {
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "finances"] });
    }
  };

  const submitVoteMutation = useMutation({
    mutationFn: async ({ voteId, decision }: { voteId: string; decision: string }) => {
      const response = await fetch(`/api/hoa/votes/${voteId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error("Failed to submit vote");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Vote Submitted",
        description: "Your vote has been recorded successfully.",
      });
      if (activeHoaId) {
        queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "votes"] });
      }
    },
    onError: () => {
      toast({
        title: "Vote Failed",
        description: "Unable to submit vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleVote = (voteId: string, decision: "for" | "against") => {
    submitVoteMutation.mutate({ voteId, decision });
  };

  const [serviceTypeByVendor, setServiceTypeByVendor] = useState<Record<string, string>>({});
  const [urgencyByVendor, setUrgencyByVendor] = useState<Record<string, string>>({});

  const handleStartTransferVote = () => {
    const nominee = hoaMembersDirectory.find(
      (m) => (m.userEmail || "").toLowerCase() === nomineeEmail.trim().toLowerCase()
    );
    if (!nominee?.userId) {
      toast({
        title: "Nominee not found",
        description: "Use an email shown in the member list.",
        variant: "destructive",
      });
      return;
    }

    if (transferReason.trim().length < 5) {
      toast({
        title: "Reason required",
        description: "Please provide at least 5 characters.",
        variant: "destructive",
      });
      return;
    }

    const parsedDuration = Number(durationHours);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 720) {
      toast({
        title: "Invalid duration",
        description: "Enter a number of hours between 1 and 720.",
        variant: "destructive",
      });
      return;
    }

    initiateBoardTransferVoteMutation.mutate({
      targetRole,
      nomineeUserId: nominee.userId,
      reason: transferReason.trim(),
      durationHours: parsedDuration,
    });
  };

  const handleLeaveHoa = () => {
    if (leaveReason.trim().length < 5) {
      toast({
        title: "Reason required",
        description: "Please provide at least 5 characters.",
        variant: "destructive",
      });
      return;
    }
    leaveHoAMutation.mutate({ reason: leaveReason.trim() });
  };

  const requestServiceMutation = useMutation({
    mutationFn: async ({ vendorId }: { vendorId: string }) => {
      const serviceType =
        serviceTypeByVendor[vendorId] ||
        (vendors.find((v: any) => v.id === vendorId)?.services?.[0] as string) ||
        "general_maintenance";
      const urgency = urgencyByVendor[vendorId] || "normal";
      const response = await fetch(`/api/hoa/vendors/${vendorId}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          description: "Service request from HOA management dashboard",
          urgency,
          contactPreference: "email",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to request service");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Service Request Sent",
        description: "The vendor has received your service request.",
      });
    },
    onError: () => {
      toast({
        title: "Request Failed",
        description: "Unable to request service. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getVoteProgress = (vote: Vote) => {
    return Math.min((vote.currentVotes / vote.requiredQuorum) * 100, 100);
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} days remaining` : "Voting closed";
  };

  // New function for fee collection
  const handleFeeCollection = async (residentId: string, amount: number) => {
    try {
      const response = await fetch("/api/hoa/collect-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hoaId: hoa?.id, // Use hoa?.id to safely access the id
          residentId,
          amount,
          description: "Monthly HOA dues",
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setNotification({
          type: "success",
          message: `Fee collection initiated for $${amount}`,
        });
        refreshFinancials();
      } else {
        throw new Error("Fee collection failed");
      }
    } catch (error) {
      console.error("Fee collection error:", error);
      setNotification({
        type: "error",
        message: "Fee collection failed",
      });
    }
  };

  // Helper function to get role display name
  const getRoleDisplayName = (role: string) => {
    const roleNames: Record<string, string> = {
      member: "Member",
      board_member: "Board Member",
      president: "President",
      vice_president: "Vice President",
      treasurer: "Treasurer",
      secretary: "Secretary",
    };
    return roleNames[role] || role;
  };

  if (countyCommitted && (hoaLoading || memberLoading || membershipLoading)) {
    return (
      <HOAManagementShell locationOverride={location}>
        <div className="text-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30 mx-auto"></div>
          <p className="mt-2 text-white/60">Loading HOA information...</p>
        </div>
      </HOAManagementShell>
    );
  }

  // Show message if user has no HOA memberships
  if (countyCommitted && !activeHoaId && !membershipLoading) {
    return (
      <HOAManagementShell locationOverride={location}>
        <Card className="bg-white/5 border-white/10 text-center p-12" data-testid="hoa-not-member">
          <Building className="w-16 h-16 text-ts-orange mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Not an HOA Member</h2>
          <p className="text-white/60 mb-6">You're not currently linked to an HOA in TradeScout.</p>
          <Button
            data-testid="button-back-home"
            onClick={() => navigate("/")}
            className="bg-ts-orange hover:bg-ts-orange-dark"
          >
            Return Home
          </Button>
        </Card>
      </HOAManagementShell>
    );
  }

  return (
    <HOAManagementShell locationOverride={location}>
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
            <Building className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white">HOA Management</h1>
        </div>
        {hoa && (
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-ts-orange">{hoa.name}</h2>
            <p className="text-white/70">{hoa.address}</p>
            {memberData && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge className="bg-teal-600 text-white" data-testid="badge-member-role">
                  {getRoleDisplayName(memberData.role)}
                </Badge>
                {memberData.unitNumber && (
                  <Badge variant="outline" className="border-white/15 text-white/70">
                    Unit {memberData.unitNumber}
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <HOANextStepsCard
        title="What to do next"
        description="Start with one workflow at a time. You can keep the interface simple and still complete every HOA task."
        steps={[
          "Review Overview for board, amenities, and current status.",
          "Open Voting to cast or monitor active decisions.",
          "Use Vendors to request scoped service work.",
        ]}
        simpleViewEnabled={simpleView}
        onToggleSimpleView={toggleSimpleView}
      />

      {activeHoaId && (
        <div className="space-y-4">
          <div className="flex justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => setShowTransferForm((v) => !v)}>
              {showTransferForm ? "Close Transfer Form" : "Open Transfer Vote Form"}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setShowLeaveForm((v) => !v)}>
              {showLeaveForm ? "Cancel Leave HOA" : "Leave HOA"}
            </Button>
          </div>

          {showTransferForm && (
            <Card className="bg-white/5 border-white/10 max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white">Start Transfer Vote</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="transfer-role" className="text-white/70">
                    Target role
                  </Label>
                  <select
                    id="transfer-role"
                    className="w-full rounded-lg border border-white/10 bg-tsCard px-3 py-2 text-sm text-white"
                    value={targetRole}
                    onChange={(e) =>
                      setTargetRole(
                        e.target.value === "vice_president" ? "vice_president" : "president"
                      )
                    }
                  >
                    <option value="president">President</option>
                    <option value="vice_president">Vice President</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nominee-email" className="text-white/70">
                    Nominee email
                  </Label>
                  <Input
                    id="nominee-email"
                    value={nomineeEmail}
                    onChange={(e) => setNomineeEmail(e.target.value)}
                    placeholder="member@example.com"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="transfer-reason" className="text-white/70">
                    Reason (minimum 5 characters)
                  </Label>
                  <Input
                    id="transfer-reason"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    placeholder="Why this transfer vote is needed"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="duration-hours" className="text-white/70">
                    Vote duration (hours)
                  </Label>
                  <Input
                    id="duration-hours"
                    type="number"
                    min={1}
                    max={720}
                    value={durationHours}
                    onChange={(e) => setDurationHours(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="button"
                    disabled={initiateBoardTransferVoteMutation.isPending}
                    onClick={handleStartTransferVote}
                  >
                    Start Transfer Vote
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showLeaveForm && (
            <Card className="bg-white/5 border-white/10 max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-white">Leave HOA Membership</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="leave-reason" className="text-white/70">
                    Reason (minimum 5 characters)
                  </Label>
                  <Input
                    id="leave-reason"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Tell us why you are leaving"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={leaveHoAMutation.isPending}
                    onClick={handleLeaveHoa}
                  >
                    Confirm Leave HOA
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4 text-sm text-white/70">
          <p className="font-medium text-white">Work with Scout from this HOA surface</p>
          <p className="mt-1 text-xs text-white/60">
            Try asking Scout to "Post HOA notice", "Review dues and payments", or "Find vendors for
            our common areas" and youll land back here with the right tab or tools ready.
          </p>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {hoa && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Building className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">{hoa.totalUnits}</div>
              <p className="text-white/60">Total Units</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">${hoa.monthlyFees}</div>
              <p className="text-white/60">Monthly Fees</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                ${parseInt(hoa.reserves).toLocaleString()}
              </div>
              <p className="text-white/60">Reserves</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-ts-orange/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-ts-orange" />
              </div>
              <div className="text-sm font-bold text-white">
                {new Date(hoa.nextMeeting).toLocaleDateString()}
              </div>
              <p className="text-white/60">Next Meeting</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList
          className={`grid w-full ${
            simpleView
              ? "grid-cols-3"
              : memberData?.canViewFinances && hoa?.governance?.votingEnabled !== false
                ? "grid-cols-5"
                : memberData?.canViewFinances || hoa?.governance?.votingEnabled !== false
                  ? "grid-cols-4"
                  : "grid-cols-3"
          } bg-white/5`}
        >
          <TabsTrigger value="overview" className="data-[state=active]:bg-ts-orange">
            Overview
          </TabsTrigger>
          {!simpleView && memberData?.canViewFinances && (
            <TabsTrigger
              value="finances"
              className="data-[state=active]:bg-ts-orange"
              data-testid="tab-finances"
            >
              Finances
            </TabsTrigger>
          )}
          {hoa?.governance?.votingEnabled !== false && (
            <TabsTrigger value="voting" className="data-[state=active]:bg-ts-orange">
              Voting
            </TabsTrigger>
          )}
          <TabsTrigger value="vendors" className="data-[state=active]:bg-ts-orange">
            Vendors
          </TabsTrigger>
          {!simpleView && (
            <TabsTrigger value="documents" className="data-[state=active]:bg-ts-orange">
              Documents
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {hoa && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span>Board Members</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(hoa.boardMembers || []).map((member: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-white/10 rounded-lg"
                    >
                      <div>
                        <div className="font-semibold text-white">{member.name}</div>
                        <div className="text-sm text-white/60">{member.position}</div>
                      </div>
                      <Badge variant="outline" className="border-white/15 text-white/70">
                        {member.term}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Building className="w-5 h-5 text-ts-orange" />
                    <span>Amenities</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {(hoa.amenities || []).map((amenity: string, index: number) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="bg-ts-orange/20 text-ts-orange justify-center"
                      >
                        {amenity}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {memberData?.canViewFinances && (
          <TabsContent value="finances" className="space-y-6">
            {finances && !financesLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Financial Summary</CardTitle>
                    {["treasurer", "president", "vice_president"].includes(memberData.role) && (
                      <p className="text-sm text-green-400 mt-1">Full Access</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Total Revenue</span>
                      <span className="text-green-400 font-semibold">
                        ${parseInt(finances.totalRevenue).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Total Expenses</span>
                      <span className="text-red-400 font-semibold">
                        ${parseInt(finances.totalExpenses).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Reserves</span>
                      <span className="text-blue-400 font-semibold">
                        ${parseInt(finances.reserves).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Outstanding Fees</span>
                      <span className="text-ts-orange font-semibold">
                        ${parseInt(finances.outstandingFees).toLocaleString()}
                      </span>
                    </div>
                    {/* Button to trigger fee collection - only for treasurer/president */}
                    {["treasurer", "president", "vice_president"].includes(memberData.role) && (
                      <Button
                        onClick={() =>
                          handleFeeCollection(user?.id || "", parseInt(hoa?.monthlyFees || "0"))
                        }
                        className="w-full bg-teal-600 hover:bg-teal-700"
                        disabled={!hoa}
                        data-testid="button-collect-fees"
                      >
                        Collect Monthly Fees
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Expense Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(finances.expenseCategories || []).map((category: any, index: number) => (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/70">{category.category}</span>
                          <span className="text-white">{category.percentage}%</span>
                        </div>
                        <Progress value={category.percentage} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        )}

        {hoa?.governance?.votingEnabled !== false && (
          <TabsContent value="voting" className="space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                  <Vote className="w-5 h-5 text-purple-400" />
                  <span>Active Votes</span>
                </h3>
                {memberData?.canCreateVotes && (
                  <Badge className="bg-purple-600 text-white" data-testid="badge-can-create-votes">
                    Can Create Votes
                  </Badge>
                )}
              </div>
              {!memberData?.votingRights && (
                <Card className="bg-yellow-500/10 border-yellow-500/50">
                  <CardContent className="p-4">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Your voting rights are currently suspended. Please contact the HOA board.
                    </p>
                  </CardContent>
                </Card>
              )}
              {(votes || []).map((vote: Vote) => (
                <Card
                  key={vote.id}
                  className="bg-white/5 border-white/10"
                  data-testid={`vote-${vote.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <CardTitle className="text-white">{vote.title}</CardTitle>
                        <Badge
                          variant={vote.status === "active" ? "default" : "secondary"}
                          className="bg-purple-500/20 text-purple-400"
                        >
                          {vote.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-ts-orange">
                          ${parseInt(vote.estimatedCost).toLocaleString()}
                        </div>
                        <p className="text-sm text-white/60">Estimated Cost</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-white/70 leading-relaxed">{vote.description}</p>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">
                          Participation ({vote.currentVotes} / {vote.requiredQuorum} required)
                        </span>
                        <span className="text-white">{Math.round(getVoteProgress(vote))}%</span>
                      </div>
                      <Progress value={getVoteProgress(vote)} className="h-3" />
                      <p className="text-sm text-white/60">{getTimeRemaining(vote.endDate)}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-500/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-400">{vote.votesFor}</div>
                        <p className="text-green-300">For</p>
                      </div>
                      <div className="text-center p-4 bg-red-500/20 rounded-lg">
                        <div className="text-2xl font-bold text-red-400">{vote.votesAgainst}</div>
                        <p className="text-red-300">Against</p>
                      </div>
                    </div>

                    {vote.status === "active" && memberData?.votingRights && (
                      <div className="flex space-x-4">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleVote(vote.id, "for")}
                          disabled={submitVoteMutation.isPending}
                          data-testid={`vote-for-${vote.id}`}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Vote For
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleVote(vote.id, "against")}
                          disabled={submitVoteMutation.isPending}
                          data-testid={`vote-against-${vote.id}`}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Vote Against
                        </Button>
                      </div>
                    )}
                    {vote.status === "active" && !memberData?.votingRights && (
                      <p className="text-yellow-400 text-sm text-center">
                        Voting rights suspended - Contact HOA board
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        <TabsContent value="vendors" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(vendors || []).map((vendor: Vendor) => (
              <Card
                key={vendor.id}
                className="bg-white/5 border-white/10"
                data-testid={`vendor-${vendor.id}`}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <CardTitle className="text-white">{vendor.name}</CardTitle>
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                        {vendor.category}
                      </Badge>
                    </div>
                    <Badge variant="outline" className="border-white/15 text-white/70">
                      Vendor profile
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4 text-white/60" />
                      <span className="text-white/70">{vendor.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-white/60" />
                      <span className="text-white/70">{vendor.email}</span>
                    </div>
                  </div>

                  <div className="text-center p-3 bg-green-500/20 rounded-lg">
                    <div className="text-xl font-bold text-green-400">
                      ${parseInt(vendor.monthlyContract).toLocaleString()}
                    </div>
                    <p className="text-green-300">Monthly Contract</p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Services:</h4>
                    <div className="flex flex-wrap gap-1">
                      {(vendor.services || []).map((service, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="text-xs border-white/15 text-white/60"
                        >
                          {service}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {memberData?.canManageVendors && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="mb-1 block text-[11px] text-white/60">
                            Service type
                          </label>
                          <select
                            className="w-full rounded-lg border border-white/10 bg-tsCard px-2 py-1 text-xs text-white"
                            value={serviceTypeByVendor[vendor.id] || ""}
                            onChange={(e) =>
                              setServiceTypeByVendor((prev) => ({
                                ...prev,
                                [vendor.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {vendor.services?.[0] || "General maintenance"}
                            </option>
                            {(vendor.services || []).map((service, index) => (
                              <option key={index} value={service}>
                                {service}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="mb-1 block text-[11px] text-white/60">Urgency</label>
                          <select
                            className="w-full rounded-lg border border-white/10 bg-tsCard px-2 py-1 text-xs text-white"
                            value={urgencyByVendor[vendor.id] || "normal"}
                            onChange={(e) =>
                              setUrgencyByVendor((prev) => ({
                                ...prev,
                                [vendor.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid={`contact-vendor-${vendor.id}`}
                        disabled={requestServiceMutation.isPending}
                        onClick={() => requestServiceMutation.mutate({ vendorId: vendor.id })}
                      >
                        <Wrench className="w-4 h-4 mr-2" />
                        Request Service
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">HOA Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="w-16 h-16 text-white/60 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Document Library</h3>
                <p className="text-white/60">
                  Access to CC&Rs, budgets, meeting minutes, and other important documents.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </HOAManagementShell>
  );
}
