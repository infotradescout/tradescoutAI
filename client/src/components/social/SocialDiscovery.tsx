import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  HelpCircle,
  Users,
  Loader2,
  AlertCircle,
  X,
  UserRound,
  Briefcase,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
  location?: string;
  verified?: boolean;
  reason?: string;
}

interface SearchResult {
  results: UserProfile[];
  total: number;
}

type IntentType = "hire" | "advise" | "collaborate" | "reconnect";

interface IntentModalState {
  isOpen: boolean;
  targetUser?: UserProfile;
  selectedIntent?: IntentType;
}

/**
 * FIND HELP & COLLABORATORS
 *
 * Decision-scoped exploration of people you could work with.
 *
 * ✅ MESSAGING AUTHORITY CONTRACT COMPLIANT
 * - Search does not initiate messaging
 * - All contact requires explicit intent selection
 * - Intent metadata captured before conversation
 * - Verified status shown for every user
 * - County-scoped for trust and relevance
 */
export const SocialDiscovery = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [scope, setScope] = useState<"county" | "state">("county");
  const [intentModal, setIntentModal] = useState<IntentModalState>({ isOpen: false });
  const [activeContactOutcome, setActiveContactOutcome] = useState<ContactOutcome | null>(null);

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResult>({
    queryKey: ["/api/social/search", searchQuery, scope],
    queryFn: async () => {
      if (!searchQuery.trim()) return { results: [], total: 0 };
      const params = new URLSearchParams();
      params.set("q", searchQuery);
      params.set("scope", scope);
      params.set("excludeFollowing", "true");

      const response = await fetch(`/api/social/search?${params}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: !!searchQuery.trim(),
  });

  const routeToScoutMutation = useMutation({
    mutationFn: async ({ targetUser, intent }: { targetUser: UserProfile; intent: IntentType }) => {
      const roleLabel = targetUser.role ? ` (${targetUser.role})` : "";
      const prompt = [
        `I want to ${intent} with ${targetUser.name}${roleLabel}.`,
        "Please run the authority check and open the correct intent-based contact path if approved.",
      ].join(" ");
      navigate(`/scout?prompt=${encodeURIComponent(prompt)}`);
      return { ok: true };
    },
    onSuccess: () => {
      toast({
        title: "Scout Check Started",
        description: "Scout will evaluate intent and route contact if approved.",
      });
      setIntentModal({ isOpen: false });
      queryClient.invalidateQueries({ queryKey: ["/api/social/search"] });
    },
  });

  const handleExploreCollaboration = (user: UserProfile) => {
    setIntentModal({ isOpen: true, targetUser: user, selectedIntent: undefined });
  };

  const handleIntentConfirm = (intent: IntentType) => {
    if (intentModal.targetUser) {
      routeToScoutMutation.mutate({
        targetUser: intentModal.targetUser,
        intent,
      });
    }
  };

  const handleOpenProfile = (userId: string) => {
    if (!userId) return;
    navigate(`/community/u/${encodeURIComponent(userId)}`);
  };

  const handleOpenDirectConnect = (userProfile: UserProfile) => {
    const params = new URLSearchParams({
      source: "social_discovery",
      target: userProfile.id,
    });
    const trimmedName = String(userProfile.name || "").trim();
    if (trimmedName) {
      params.set("targetName", trimmedName);
    }
    navigate(`/direct-connect?${params.toString()}`);
  };

  const handleConnectionRequest = (userProfile: UserProfile) => {
    const targetUserId = String(userProfile.id || "").trim();
    if (!targetUserId) return;

    const targetUserName = String(userProfile.name || "").trim() || "Community member";
    const targetRole = String(userProfile.role || "").trim() || "Member";
    const targetLocation = String(userProfile.location || "").trim() || undefined;

    setActiveContactOutcome({
      targetUserId,
      targetUserName,
      targetRole,
      targetLocation,
      suggestedIntent: "collaborate",
      reasonForContact:
        "I found your profile in Community and want to connect so we can coordinate directly.",
      riskFlags: [],
      decisionScope: `social_discovery:${targetUserId}`,
      decisionTitle: "Community connection request",
    });
  };

  const renderUserCard = (userProfile: UserProfile) => (
    <Card
      key={userProfile.id}
      className="bg-[color:var(--surface-card)] border-[color:var(--border-subtle)] hover:border-ts-orange/30 transition-colors"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <button
              type="button"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ts-orange/70"
              onClick={() => handleOpenProfile(userProfile.id)}
              aria-label={`Open ${userProfile.name} profile`}
              title="View public profile"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={userProfile.avatar} />
                <AvatarFallback>
                  {userProfile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="flex-1 min-w-0">
              <button
                type="button"
                className="font-semibold text-white truncate hover:text-ts-orange text-left"
                onClick={() => handleOpenProfile(userProfile.id)}
                title="View public profile"
              >
                {userProfile.name}
              </button>
              {userProfile.role && (
                <p className="text-xs text-[color:var(--text-secondary)] capitalize">
                  {userProfile.role}
                </p>
              )}
              {userProfile.location && (
                <p className="text-xs text-[color:var(--text-secondary)]">{userProfile.location}</p>
              )}
            </div>
          </div>
          <Badge
            className={
              userProfile.verified
                ? "bg-green-500/20 text-green-300 text-xs"
                : "bg-white/10 text-white/70 text-xs"
            }
            title={
              userProfile.verified
                ? "Verified profile"
                : "Unverified profile. Verified members are more likely to be accepted."
            }
          >
            {userProfile.verified ? "Verified" : "Unverified"}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--border-subtle)] text-xs"
            onClick={() => handleOpenProfile(userProfile.id)}
          >
            <UserRound className="h-3.5 w-3.5 mr-1" />
            Profile
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--border-subtle)] text-xs"
            onClick={() => handleOpenDirectConnect(userProfile)}
          >
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            Direct
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-[color:var(--border-subtle)] text-xs"
            onClick={() => handleConnectionRequest(userProfile)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Connect
          </Button>
        </div>

        <Button
          size="sm"
          className="w-full mt-3 bg-ts-orange hover:bg-ts-orange-dark text-white"
          onClick={() => handleExploreCollaboration(userProfile)}
          disabled={routeToScoutMutation.isPending}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          See how you could work together
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Find Help & Collaborators</h1>
        <p className="text-[color:var(--text-secondary)] text-sm">
          Search for people in your area to work with. Scout will assess each connection before you
          make contact.
        </p>
      </div>

      <div className="space-y-4">
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-secondary)]" />
            <Input
              placeholder="Search by name, email, or trade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[color:var(--surface-intermediate)] border-[color:var(--border-subtle)]"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="px-3 py-2 rounded-md bg-[color:var(--surface-intermediate)] border border-[color:var(--border-subtle)] text-white text-sm"
          >
            <option value="county">County</option>
            <option value="state">State</option>
          </select>
        </div>

        {/* Contract Notice */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md flex gap-3 items-start">
          <AlertCircle className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-200">
            When you choose to explore someone, Scout will assess the connection and capture your
            intent before you can contact them.
          </p>
        </div>

        {/* Search Results */}
        {isSearching && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-ts-orange" />
          </div>
        )}

        {searchResults && searchResults.results.length > 0 && (
          <div className="grid gap-3">
            {searchResults.results.map((user) => renderUserCard(user))}
          </div>
        )}

        {!isSearching && searchQuery && searchResults?.results.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-white/60 mx-auto mb-3" />
            <p className="text-[color:var(--text-secondary)]">
              No users found matching "{searchQuery}" in {scope}.
            </p>
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-white/60 mx-auto mb-3" />
            <p className="text-[color:var(--text-secondary)]">
              Search to find people you could work with.
            </p>
            <p className="text-xs text-[color:var(--text-secondary)] mt-1">
              Discovery is scoped to your county first, then state.
            </p>
          </div>
        )}
      </div>

      {/* Intent Selection Modal */}
      {intentModal.isOpen && intentModal.targetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-[color:var(--surface-card)] border-[color:var(--border-subtle)]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-bold text-white">
                  How do you want to work with {intentModal.targetUser.name}?
                </h2>
                <button
                  onClick={() => setIntentModal({ isOpen: false })}
                  className="text-[color:var(--text-secondary)] hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-[color:var(--text-secondary)] mb-4">
                Scout will assess this connection based on your intent before you can make contact.
              </p>

              <div className="space-y-2">
                {[
                  {
                    value: "hire" as IntentType,
                    label: "Hire them for work",
                    description: "Looking to contract for a specific project",
                  },
                  {
                    value: "advise" as IntentType,
                    label: "Get advice from them",
                    description: "Seeking guidance or expertise",
                  },
                  {
                    value: "collaborate" as IntentType,
                    label: "Collaborate together",
                    description: "Working on something jointly",
                  },
                  {
                    value: "reconnect" as IntentType,
                    label: "Reconnect",
                    description: "We already worked together",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleIntentConfirm(option.value)}
                    disabled={routeToScoutMutation.isPending}
                    className="w-full text-left p-3 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] hover:border-ts-orange/30 hover:bg-ts-orange/5 transition-colors disabled:opacity-50"
                  >
                    <div className="font-semibold text-white">{option.label}</div>
                    <div className="text-xs text-[color:var(--text-secondary)]">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setIntentModal({ isOpen: false })}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeContactOutcome && (
        <ContactOutcomeModal
          outcome={activeContactOutcome}
          onClose={() => setActiveContactOutcome(null)}
        />
      )}
    </div>
  );
};

export default SocialDiscovery;
