import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, MessageCircle, UserPlus, UserMinus, Users, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

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

interface FriendsList {
  friends?: UserProfile[];
  type?: string;
  suggestions?: UserProfile[];
}

/**
 * SOCIAL DISCOVERY PANEL
 * 
 * Allows users to:
 * - Search for people in their area
 * - View friend suggestions
 * - Manage connections (add/remove friends)
 * - Message people directly
 */
export const SocialDiscovery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [scope, setScope] = useState<'county' | 'state'>('county');
  const [activeTab, setActiveTab] = useState('search');

  // Search users
  const { data: searchResults, isLoading: isSearching } = useQuery<SearchResult>({
    queryKey: ['/api/social/search', searchQuery, scope],
    queryFn: async () => {
      if (!searchQuery.trim()) return { results: [], total: 0 };
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      params.set('scope', scope);
      params.set('excludeFollowing', 'true');
      
      const response = await fetch(`/api/social/search?${params}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: !!searchQuery.trim(),
  });

  // Get friends
  const { data: friendsData, isLoading: isLoadingFriends } = useQuery<FriendsList>({
    queryKey: ['/api/social/friends', 'friends'],
    queryFn: async () => {
      const response = await fetch('/api/social/friends?filter=friends&limit=50');
      if (!response.ok) throw new Error('Failed to fetch friends');
      return response.json();
    },
  });

  // Get friend suggestions
  const { data: suggestionsData, isLoading: isLoadingSuggestions } = useQuery<FriendsList>({
    queryKey: ['/api/social/friends', 'suggestions'],
    queryFn: async () => {
      const response = await fetch('/api/social/friends?filter=suggestions');
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
  });

  // Add friend mutation
  const addFriendMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/social/friends/${userId}/add`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/search'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/friends'] });
      toast({
        title: 'Friend Added',
        description: 'You can now message them and see their activity',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to add friend',
        variant: 'destructive',
      });
    },
  });

  // Remove friend mutation
  const removeFriendMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('POST', `/api/social/friends/${userId}/remove`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/friends'] });
      toast({
        title: 'Friend Removed',
        description: 'You are no longer following this user',
      });
    },
  });

  // Start conversation mutation
  const startConversationMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest('POST', '/api/social/conversations/start', { targetUserId });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Conversation Started',
        description: 'Go to Messages to start chatting',
      });
      // Navigate to messages would go here
    },
  });

  const renderUserCard = (userProfile: UserProfile, showMessageButton = true) => (
    <Card key={userProfile.id} className="bg-[color:var(--surface-card)] border-[color:var(--border-subtle)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Avatar className="w-10 h-10">
              <AvatarImage src={userProfile.avatar} />
              <AvatarFallback>
                {userProfile.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white truncate">{userProfile.name}</h3>
              {userProfile.role && (
                <p className="text-xs text-[color:var(--text-secondary)] capitalize">
                  {userProfile.role}
                </p>
              )}
              {userProfile.location && (
                <p className="text-xs text-[color:var(--text-secondary)]">{userProfile.location}</p>
              )}
              {userProfile.reason && (
                <p className="text-xs text-orange-400 mt-1">{userProfile.reason}</p>
              )}
            </div>
          </div>
          {userProfile.verified && (
            <Badge className="bg-green-500/20 text-green-300 text-xs">Verified</Badge>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          {showMessageButton ? (
            <>
              <Button
                size="sm"
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => startConversationMutation.mutate(userProfile.id)}
                disabled={startConversationMutation.isPending}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => addFriendMutation.mutate(userProfile.id)}
                disabled={addFriendMutation.isPending}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                onClick={() => startConversationMutation.mutate(userProfile.id)}
                disabled={startConversationMutation.isPending}
              >
                <MessageCircle className="h-4 w-4 mr-1" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => removeFriendMutation.mutate(userProfile.id)}
                disabled={removeFriendMutation.isPending}
              >
                <UserMinus className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>

        {/* SEARCH TAB */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[color:var(--text-secondary)]" />
                <Input
                  placeholder="Search by name, email..."
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
          </div>

          {isSearching && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          )}

          {searchResults && searchResults.results.length > 0 && (
            <div className="grid gap-3">
              {searchResults.results.map((user) => renderUserCard(user))}
            </div>
          )}

          {!isSearching && searchQuery && searchResults?.results.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[color:var(--text-secondary)]">No users found matching "{searchQuery}"</p>
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[color:var(--text-secondary)]">Search to discover people in your area</p>
            </div>
          )}
        </TabsContent>

        {/* FRIENDS TAB */}
        <TabsContent value="friends" className="space-y-4 mt-4">
          {isLoadingFriends ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : friendsData?.friends && friendsData.friends.length > 0 ? (
            <div className="grid gap-3">
              {friendsData.friends.map((friend) => renderUserCard(friend, false))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[color:var(--text-secondary)]">No friends yet</p>
              <p className="text-xs text-[color:var(--text-secondary)] mt-1">Search for people to add them as friends</p>
            </div>
          )}
        </TabsContent>

        {/* SUGGESTIONS TAB */}
        <TabsContent value="suggestions" className="space-y-4 mt-4">
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : suggestionsData?.suggestions && suggestionsData.suggestions.length > 0 ? (
            <div className="grid gap-3">
              {suggestionsData.suggestions.map((suggestion) => renderUserCard(suggestion))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-[color:var(--text-secondary)]">No suggestions available</p>
              <p className="text-xs text-[color:var(--text-secondary)] mt-1">We'll suggest people as you explore the community</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialDiscovery;
