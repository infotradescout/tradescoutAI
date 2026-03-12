import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Users, MessageSquare, Plus, Search, MapPin, Crown } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useLocationContext } from "@/hooks/useLocationContext";
import { GroupsShell } from "@/shells/GroupsShell";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";

interface Group {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  stateCode: string | null;
  countyFips: string | null;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
}

type HoaMembership = {
  hoaId: string;
  hoaName: string;
  role: string;
  status: string;
  stateCode: string | null;
  countyFips: string | null;
  groupType?: string;
};

export default function Groups() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({
    name: "",
    description: "",
    type: "county_community",
    isPublic: true,
    tags: "",
    rules: "",
  });
  const location = useLocationContext();
  const stateCode = location.stateCode as string | undefined;
  const countyFips = location.countyFips as string | undefined;
  const hasCountyContext = Boolean(stateCode && (countyFips || (location as any).county));

  const { data: hoaMembershipData } = useQuery<{ memberships: HoaMembership[] }>({
    queryKey: ["/api/hoa", stateCode, countyFips],
    queryFn: async () => {
      const res = await fetch("/api/hoa");
      if (!res.ok) {
        throw new Error("Failed to load HOA memberships");
      }
      return res.json();
    },
    enabled: true,
  });

  const hoaMemberships = hoaMembershipData?.memberships ?? [];
  const primaryHoa = hoaMemberships.find((m) => m.groupType === "hoa" || !m.groupType);
  const hasLocationMeta = !!primaryHoa?.stateCode || !!primaryHoa?.countyFips;

  const { data, isLoading: groupsLoading } = useQuery<{ groups: Group[] | undefined }>({
    queryKey: ["/api/community/groups", stateCode, countyFips, searchQuery, selectedType],
    enabled: hasCountyContext && Boolean(stateCode && countyFips),
    queryFn: async () => {
      const params = new URLSearchParams({
        scope: "county",
        stateCode: stateCode!,
        countyFips: countyFips!,
        limit: "20",
        offset: "0",
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      const response = await fetch(`/api/community/groups?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch groups");
      }
      return response.json();
    },
  });

  const groups: Group[] = (data?.groups as Group[]) ?? [];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "TradeScout Community Groups",
        description:
          "County and HOA collaboration spaces for homeowners, pros, and local community members.",
        url: "https://www.thetradescout.com/groups",
      },
      createBreadcrumbStructuredData([
        { name: "TradeScout", url: "/" },
        { name: "Groups", url: "/groups" },
      ]),
    ],
  };

  const joinGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/community/groups/${groupId}/join`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to join group");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Joined Group!",
        description: "You've successfully joined the group and can now participate in discussions.",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/community/groups", stateCode, countyFips, searchQuery, selectedType],
      });
    },
    onError: () => {
      toast({
        title: "Join Failed",
        description: "Unable to join group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (groupData: any) => {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...groupData,
          tags: groupData.tags
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean),
          rules: groupData.rules
            .split("\n")
            .map((r: string) => r.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Group Created!",
        description: "Your new group has been created and you are now an admin.",
      });
      setIsCreateDialogOpen(false);
      setNewGroup({
        name: "",
        description: "",
        type: "county_community",
        isPublic: true,
        tags: "",
        rules: "",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/community/groups", stateCode, countyFips, searchQuery, selectedType],
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Unable to create group. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleJoinGroup = (groupId: string) => {
    joinGroupMutation.mutate(groupId);
  };

  const handleCreateGroup = () => {
    createGroupMutation.mutate(newGroup);
  };

  const isUserMember = (group: Group) => group.isMember;

  if (!hasCountyContext) {
    return (
      <GroupsShell>
        <div className="max-w-7xl mx-auto py-10">
          <Card className="border-white/10 bg-tsCard/95">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-ts-orange" />
                Set your county to discover local groups
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/70 text-sm">
                Choose your home county so we can show you groups that match your community. This
                keeps discussions and recommendations local to {location.label || "your area"}.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/settings">
                  <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                    Open settings to set county
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </GroupsShell>
    );
  }

  if (groupsLoading) {
    return (
      <GroupsShell>
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ts-orange/30 mx-auto"></div>
            <p className="mt-2 text-white/60">Loading groups...</p>
          </div>
        </div>
      </GroupsShell>
    );
  }

  return (
    <GroupsShell>
      <SEOHelmet
        title="Community Groups | County and HOA Collaboration"
        description="Browse TradeScout community groups and county-scoped collaboration spaces for local homeowners, pros, and HOA members."
        canonical="https://www.thetradescout.com/groups"
        structuredData={structuredData}
      />
      <div className="max-w-7xl mx-auto space-y-8" data-testid="groups-page">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">Community Groups</h1>
          </div>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Connect with homeowners and contractors in {location.label || "your area"}. Share
            experiences, get advice, and build relationships.
          </p>
        </div>

        {/* Your HOA Bridge */}
        {primaryHoa && (
          <Card className="mb-4 border-white/10 bg-tsCard/95">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-white">Your HOA</CardTitle>
                <p className="mt-1 truncate text-xs text-white/70">{primaryHoa.hoaName}</p>

                {hasLocationMeta && (
                  <p className="mt-1 text-[11px] text-white/60">
                    {primaryHoa.stateCode && <span>{primaryHoa.stateCode}</span>}
                    {primaryHoa.stateCode && primaryHoa.countyFips && (
                      <span className="mx-1"> b7</span>
                    )}
                    {primaryHoa.countyFips && <span>Local coverage: #{primaryHoa.countyFips}</span>}
                  </p>
                )}
              </div>

              <Link
                href={primaryHoa.hoaId ? `/hoa-dashboard/${primaryHoa.hoaId}` : "/hoa-dashboard"}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap text-xs"
                  data-testid="your-hoa-link"
                >
                  Open HOA dashboard
                </Button>
              </Link>
            </CardHeader>
          </Card>
        )}

        {/* Search and Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
            <Input
              placeholder="Search groups by name or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder-slate-400"
              data-testid="search-groups"
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full md:w-48 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-white/5 border-white/10">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="county_community">County Community</SelectItem>
              <SelectItem value="specialty_trade">Trade Specialty</SelectItem>
              <SelectItem value="interest_based">Interest Based</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                data-testid="create-group-button"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white/5 border-white/10 text-white max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create a New Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Group name"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="bg-white/10 border-white/15"
                  data-testid="group-name-input"
                />
                <Textarea
                  placeholder="Group description"
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="bg-white/10 border-white/15 min-h-24"
                  data-testid="group-description-input"
                />
                <Select
                  value={newGroup.type}
                  onValueChange={(value) => setNewGroup({ ...newGroup, type: value })}
                >
                  <SelectTrigger className="bg-white/10 border-white/15">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/5 border-white/10">
                    <SelectItem value="county_community">County Community</SelectItem>
                    <SelectItem value="specialty_trade">Trade Specialty</SelectItem>
                    <SelectItem value="interest_based">Interest Based</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Tags (comma separated)"
                  value={newGroup.tags}
                  onChange={(e) => setNewGroup({ ...newGroup, tags: e.target.value })}
                  className="bg-white/10 border-white/15"
                  data-testid="group-tags-input"
                />
                <Textarea
                  placeholder="Group rules (one per line)"
                  value={newGroup.rules}
                  onChange={(e) => setNewGroup({ ...newGroup, rules: e.target.value })}
                  className="bg-white/10 border-white/15 min-h-24"
                  data-testid="group-rules-input"
                />
                <Button
                  onClick={handleCreateGroup}
                  disabled={createGroupMutation.isPending || !newGroup.name.trim()}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600"
                  data-testid="submit-create-group"
                >
                  {createGroupMutation.isPending ? "Creating..." : "Create Group"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* My Groups Section */}
        {groups.filter((g) => g.isMember).length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              <span>My Groups</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.isArray(groups) &&
                groups
                  .filter((g) => g.isMember)
                  .map((group) => (
                    <Card
                      key={group.id}
                      className="bg-white/5 border-white/10 hover:border-blue-500/50 transition-all duration-300"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-white text-lg">{group.name}</CardTitle>
                            {group.category && (
                              <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                                {group.category}
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                              {group.isAdmin ? "Admin" : "Member"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-white/70 text-sm line-clamp-2">{group.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-white/60 flex items-center">
                            <Users className="w-4 h-4 mr-1" />
                            {group.memberCount} members
                          </span>
                        </div>
                        <Link href={`/groups/${group.id}`}>
                          <Button
                            variant="outline"
                            className="w-full"
                            data-testid={`view-group-${group.id}`}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            View Group
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
            </div>
          </div>
        )}

        {/* All Groups Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Search className="w-6 h-6 text-ts-orange" />
            <span>Discover Groups</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(groups)
              ? groups.map((group: Group) => (
                  <Card
                    key={group.id}
                    className="bg-white/5 border-white/10 hover:border-ts-orange/30 transition-all duration-300"
                    data-testid="group-card"
                  >
                    <CardHeader className="pb-3">
                      <div className="space-y-2">
                        <CardTitle className="text-white text-lg">{group.name}</CardTitle>
                        <div className="flex items-center space-x-2">
                          {group.category && (
                            <Badge variant="secondary" className="bg-ts-orange/20 text-ts-orange">
                              {group.category}
                            </Badge>
                          )}
                          {group.countyFips && (
                            <Badge variant="outline" className="border-white/15 text-white/70">
                              <MapPin className="w-3 h-3 mr-1" />
                              Local
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-white/70 text-sm leading-relaxed line-clamp-3">
                        {group.description}
                      </p>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/60 flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {group.memberCount} members
                        </span>
                        {group.isAdmin && (
                          <Badge
                            variant="outline"
                            className="border-yellow-500 text-yellow-500 text-xs"
                          >
                            Admin
                          </Badge>
                        )}
                      </div>

                      {isUserMember(group) ? (
                        <Link href={`/groups/${group.id}`}>
                          <Button
                            variant="outline"
                            className="w-full"
                            data-testid="group-leave-button"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Joined - View Group
                          </Button>
                        </Link>
                      ) : (
                        <Button
                          className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium"
                          onClick={() => handleJoinGroup(group.id)}
                          disabled={joinGroupMutation.isPending}
                          data-testid="group-join-button"
                        >
                          {joinGroupMutation.isPending ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <Plus className="w-4 h-4 mr-2" />
                          )}
                          Join Group
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              : null}
          </div>
        </div>

        {groups.length === 0 && !groupsLoading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-white/60 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Groups Found</h3>
            <p className="text-white/60 mb-6">
              {searchQuery
                ? "Try adjusting your search terms or filters."
                : "Be the first to create a group in your area!"}
            </p>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-gradient-to-r from-blue-500 to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Group
            </Button>
          </div>
        )}
      </div>
    </GroupsShell>
  );
}
