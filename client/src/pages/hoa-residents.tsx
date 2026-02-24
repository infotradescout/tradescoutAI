import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { useParams } from "wouter";
import { Users, UserCheck, UserPlus, Shield, Edit } from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { HOAManagementShell } from "@/shells/HOAManagementShell";

/**
 * /hoa/residents - HOA Member Directory and Management
 *
 * Psychology Intent:
 * - Target belief: "HOA governance is legitimate and traceable."
 * - Target behavior: maintain an accurate roster through the official channel.
 * - Principle(s): procedural clarity, accountability.
 * - Risk prevented: unauthorized control or ambiguity.
 */

type HOAMember = {
  id: string;
  userId: string;
  unitNumber?: string;
  role: string;
  joinedAt: string;
  termStart?: string;
  termEnd?: string;
  isPrimary: boolean;
  votingRights: boolean;
  inGoodStanding: boolean;
  canViewFinances: boolean;
  canEditDocuments: boolean;
  canManageVendors: boolean;
  canCreateVotes: boolean;
  userName?: string;
  userEmail?: string;
};

type HoaMembership = {
  hoaId: string;
  hoaName: string;
  role: string;
  status: string;
  stateCode: string | null;
  countyFips: string | null;
  groupType: "hoa";
};

const HOAResidents = memo(function HOAResidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useParams();
  const hoaIdFromRoute = params?.hoaId as string | undefined;
  const location = useLocationContext({
    layer: "hoa",
    hoaId: hoaIdFromRoute ?? undefined,
  });
  const countyCommitted = hasCountyContext(location);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberUnit, setNewMemberUnit] = useState("");

  // Load HOA memberships for the current user
  const { data: hoaMembershipData } = useQuery<{ memberships: HoaMembership[] }>({
    queryKey: ["/api/hoa", location.stateCode, location.countyFips, location.hoaId],
    queryFn: async () => {
      const res = await fetch("/api/hoa");
      if (!res.ok) throw new Error("Failed to load HOA memberships");
      return res.json();
    },
    enabled: !!user && countyCommitted,
  });

  const memberships = hoaMembershipData?.memberships ?? [];
  const activeHoaId = memberships[0]?.hoaId;

  // Fetch current user's HOA membership for permissions
  const { data: currentMemberData } = useQuery<HOAMember>({
    queryKey: ["/api/hoa", activeHoaId, "member"],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${activeHoaId}/member`);
      if (!response.ok) throw new Error("Not a member of this HOA");
      return response.json();
    },
    enabled: !!user && !!activeHoaId && countyCommitted,
    retry: false,
  });

  // Fetch all HOA members
  const { data: members = [], isLoading } = useQuery<HOAMember[]>({
    queryKey: ["/api/hoa", activeHoaId, "members"],
    queryFn: async () => {
      const response = await fetch(`/api/hoa/${activeHoaId}/members`);
      if (!response.ok) throw new Error("Failed to load members");
      return response.json();
    },
    enabled: !!activeHoaId && countyCommitted,
  });

  // Check if current user can add members
  const canAddMembers =
    currentMemberData?.role === "president" || currentMemberData?.role === "vice_president";

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string; unitNumber?: string }) => {
      const response = await fetch(`/api/hoa/${activeHoaId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: data.email,
          unitNumber: data.unitNumber,
          role: "member",
          votingRights: true,
        }),
      });
      if (!response.ok) throw new Error("Failed to add member");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Member Added",
        description: "New member has been successfully added to the HOA.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/hoa", activeHoaId, "members"] });
      setAddMemberOpen(false);
      setNewMemberEmail("");
      setNewMemberUnit("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Add Member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMember = () => {
    if (!newMemberEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    addMemberMutation.mutate({
      email: newMemberEmail,
      unitNumber: newMemberUnit || undefined,
    });
  };

  if (!countyCommitted) {
    return (
      <HOAManagementShell locationOverride={location}>
        <SEOHelmet
          title="HOA Residents Directory | TradeScout"
          description="Manage HOA member roster and permissions."
          canonical="https://www.thetradescout.com/hoa/residents"
          noIndex
        />
        <Card className="bg-navy-800/60 border-navy-600">
          <CardContent className="p-6">
            <p className="text-gray-300">County context required to view HOA residents.</p>
          </CardContent>
        </Card>
      </HOAManagementShell>
    );
  }

  if (!activeHoaId) {
    return (
      <HOAManagementShell locationOverride={location}>
        <SEOHelmet
          title="HOA Residents Directory | TradeScout"
          description="Manage HOA member roster and permissions."
          canonical="https://www.thetradescout.com/hoa/residents"
          noIndex
        />
        <Card className="bg-navy-800/60 border-navy-600">
          <CardContent className="p-6">
            <p className="text-gray-300">You are not currently a member of an HOA.</p>
          </CardContent>
        </Card>
      </HOAManagementShell>
    );
  }

  return (
    <HOAManagementShell locationOverride={location}>
      <SEOHelmet
        title="HOA Residents Directory | TradeScout"
        description="Manage HOA member roster and permissions."
        canonical="https://www.thetradescout.com/hoa/residents"
        noIndex
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-400" />
              HOA Residents
            </h1>
            <p className="text-gray-300 mt-2">{memberships[0]?.hoaName || "Your HOA"}</p>
          </div>
          {canAddMembers && (
            <Button
              onClick={() => setAddMemberOpen(!addMemberOpen)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          )}
        </div>

        {addMemberOpen && canAddMembers && (
          <Card className="bg-navy-800/60 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white">Add New Member</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-200">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="member@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="bg-navy-700 text-white border-navy-600"
                />
              </div>
              <div>
                <Label htmlFor="unit" className="text-gray-200">
                  Unit Number (optional)
                </Label>
                <Input
                  id="unit"
                  placeholder="e.g., 101"
                  value={newMemberUnit}
                  onChange={(e) => setNewMemberUnit(e.target.value)}
                  className="bg-navy-700 text-white border-navy-600"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddMember} className="bg-emerald-600 hover:bg-emerald-700">
                  Add Member
                </Button>
                <Button
                  onClick={() => {
                    setAddMemberOpen(false);
                    setNewMemberEmail("");
                    setNewMemberUnit("");
                  }}
                  variant="outline"
                  className="border-navy-600 text-gray-200"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <Card className="bg-navy-800/60 border-navy-600">
            <CardContent className="p-6">
              <p className="text-gray-300">Loading residents...</p>
            </CardContent>
          </Card>
        ) : members.length === 0 ? (
          <Card className="bg-navy-800/60 border-navy-600">
            <CardContent className="p-6">
              <p className="text-gray-300">No members found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {members.map((member) => (
              <Card key={member.id} className="bg-navy-800/60 border-navy-600">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <UserCheck className="h-6 w-6 text-blue-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">
                            {member.userName || member.userEmail || "Member"}
                          </span>
                          {member.unitNumber && (
                            <Badge variant="outline" className="border-gray-600 text-gray-300">
                              Unit {member.unitNumber}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm">
                          <Badge className="bg-purple-600 text-white">{member.role}</Badge>
                          {member.inGoodStanding ? (
                            <Badge className="bg-emerald-600 text-white">Good Standing</Badge>
                          ) : (
                            <Badge className="bg-red-600 text-white">Not in Good Standing</Badge>
                          )}
                          {member.votingRights && (
                            <Badge variant="outline" className="border-blue-400 text-blue-300">
                              Voting Rights
                            </Badge>
                          )}
                        </div>
                        {(member.canViewFinances ||
                          member.canEditDocuments ||
                          member.canManageVendors ||
                          member.canCreateVotes) && (
                          <div className="flex items-center gap-2 mt-2">
                            <Shield className="h-4 w-4 text-orange-400" />
                            <span className="text-xs text-gray-400">
                              Permissions:{" "}
                              {[
                                member.canViewFinances && "Finances",
                                member.canEditDocuments && "Documents",
                                member.canManageVendors && "Vendors",
                                member.canCreateVotes && "Voting",
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {canAddMembers && (
                      <Button size="sm" variant="outline" className="border-navy-600 text-gray-300">
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </HOAManagementShell>
  );
});

export default HOAResidents;
