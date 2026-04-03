import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Activity,
  MessageSquare,
  Star,
  Briefcase,
  TrendingUp,
  Users2,
  Calendar,
  Bell,
  Wrench,
  Link as LinkIcon,
  Award,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface WidgetProps {
  className?: string;
}

export function ActivityStatsWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-ts-orange" />
          Your Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="text-center p-3 bg-tsSurface border border-white/10 rounded-lg">
            <div className="text-2xl font-bold text-white/70 dark:text-white">12</div>
            <div className="text-xs text-white/60 dark:text-white/60">Posts</div>
          </div>
          <div className="text-center p-3 bg-tsSurface border border-white/10 rounded-lg">
            <div className="text-2xl font-bold text-white/70 dark:text-white">48</div>
            <div className="text-xs text-white/60 dark:text-white/60">Comments</div>
          </div>
          <div className="text-center p-3 bg-tsSurface border border-white/10 rounded-lg">
            <div className="text-2xl font-bold text-ts-orange">124</div>
            <div className="text-xs text-white/60 dark:text-white/60">Likes Received</div>
          </div>
          <div className="text-center p-3 bg-tsSurface border border-white/10 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">5</div>
            <div className="text-xs text-white/60 dark:text-white/60">Connections</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentProjectsWidget({ className }: WidgetProps) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{
    myProjects?: Array<{
      id: string;
      title: string;
      status?: string;
      value?: string | number | null;
      createdAt?: string | Date | null;
      contractorName?: string | null;
    }>;
  }>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const projects = data?.myProjects ?? [];

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-ts-orange" />
            My Projects
          </CardTitle>
          <Link href="/project-tracker">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-6 text-sm text-white/60 dark:text-white/60">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-6 text-sm text-white/60 dark:text-white/60">
            No active projects yet
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-tsSurface p-3 transition-colors hover:bg-tsSurface-strong"
            >
              <div className="flex-1">
                <h4 className="font-medium text-sm text-white/70 dark:text-white">
                  {project.title}
                </h4>
                <p className="text-xs text-white/60 dark:text-white/60 mt-0.5">
                  {project.contractorName
                    ? project.contractorName
                    : project.createdAt
                      ? `Created ${formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}`
                      : ""}
                </p>
              </div>
              <Badge
                className={
                  project.status &&
                  ["new", "contacted", "qualified", "matched"].includes(project.status)
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }
              >
                {project.status
                  ? project.status.charAt(0).toUpperCase() + project.status.slice(1)
                  : "Active"}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function SavedContractorsWidget({ className }: WidgetProps) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<{
    stats?: {
      savedContractors?: number;
    };
  }>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const savedCount = data?.stats?.savedContractors ?? 0;

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-ts-orange" />
            Saved Contractors
          </CardTitle>
          <Link href="/saved-contractors">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View Saved
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="text-center py-6 text-sm text-white/60 dark:text-white/60">
            Loading saved contractors...
          </div>
        ) : savedCount > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-tsSurface p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-ts-orange text-white text-xs">
                  <Star className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-medium text-sm text-white/70 dark:text-white">Saved pros</h4>
                <p className="text-xs text-white/60 dark:text-white/60">
                  You have <span className="font-semibold">{savedCount}</span> saved contractor
                  {savedCount === 1 ? "" : "s"}. Open your saved list to compare and contact them.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Link href="/saved-contractors">
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  View saved providers
                </Button>
              </Link>
              <Link href="/direct-connect">
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Route a job
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-sm text-white/60 dark:text-white/60">
            <p className="mb-3">You haven't saved any providers yet.</p>
            <Link href="/direct-connect">
              <Button
                size="sm"
                className="h-8 text-xs bg-ts-orange-dark hover:bg-ts-orange-dark text-white"
              >
                Create a Direct Connect request
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MessagesPreviewWidget({ className }: WidgetProps) {
  const messages = [
    {
      id: 1,
      from: "Mike Johnson",
      message: "When can we schedule the inspection?",
      time: "2 hours ago",
    },
    {
      id: 2,
      from: "Elite Renovations",
      message: "Your quote is ready for review",
      time: "1 day ago",
    },
  ];

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-ts-orange" />
            Recent Messages
          </CardTitle>
          <Link href="/messages">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-sm text-white/60 dark:text-white/60">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="cursor-pointer rounded-lg border border-white/10 bg-tsSurface p-3 transition-colors hover:bg-tsSurface-strong"
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-medium text-sm text-white/70 dark:text-white">{msg.from}</h4>
                <span className="text-xs text-white/60 dark:text-white/60">{msg.time}</span>
              </div>
              <p className="text-xs text-white/60 dark:text-white/60 line-clamp-1">{msg.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function QuickActionsWidget({ className }: WidgetProps) {
  const quickActions = [
    { icon: Briefcase, label: "Post a Project", href: "/request-quote", color: "text-blue-600" },
    { icon: Wrench, label: "Find Contractor", href: "/contractors", color: "text-ts-orange" },
    { icon: MessageSquare, label: "Messages", href: "/messages", color: "text-green-600" },
  ];

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <Link key={index} href={action.href}>
              <button className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-tsSurface p-4 transition-colors hover:bg-tsSurface-strong">
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs font-medium text-white/70 dark:text-white">
                  {action.label}
                </span>
              </button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationsWidget({ className }: WidgetProps) {
  const notifications = [
    { id: 1, type: "like", message: "Someone liked your post", time: "1 hour ago" },
    { id: 2, type: "comment", message: "New comment on your project", time: "3 hours ago" },
    { id: 3, type: "message", message: "You have a new message", time: "5 hours ago" },
  ];

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-ts-orange" />
            Recent Notifications
          </CardTitle>
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="flex items-start gap-3 rounded-lg border border-white/10 bg-tsSurface p-2 transition-colors hover:bg-tsSurface-strong"
          >
            <div
              className={`h-2 w-2 rounded-full mt-2 ${notification.type === "message" ? "bg-blue-500" : "bg-ts-orange"}`}
            />
            <div className="flex-1">
              <p className="text-sm text-white/70 dark:text-white">{notification.message}</p>
              <p className="text-xs text-white/60 dark:text-white/60 mt-0.5">{notification.time}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function CommunityFeedWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users2 className="h-4 w-4 text-ts-orange" />
            Community Feed
          </CardTitle>
          <Link href="/home">
            <Button variant="ghost" size="sm" className="text-xs h-7">
              View Full Feed
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-white/60 dark:text-white/60 mb-3">
          See what your neighbors are talking about
        </p>
        <Link href="/home">
          <Button className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark text-white" size="sm">
            Go to Feed
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function AffiliateStatsWidget({ className }: WidgetProps) {
  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          Affiliate Earnings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-white/60 dark:text-white/60">Total Earned</span>
              <span className="text-2xl font-bold text-green-600">$0.00</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-white/60 dark:text-white/60">Pending</span>
              <span className="text-sm text-white/60 dark:text-white/60">$0.00</span>
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 dark:border-white/10">
            <Link href="/affiliate">
              <Button variant="outline" size="sm" className="w-full">
                <LinkIcon className="h-3 w-3 mr-2" />
                Get Your Referral Link
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CommunityBuilderImpactWidget({ className }: WidgetProps) {
  const { user } = useAuth();

  const hasCommunityBuilderRole = Array.isArray(user?.roles)
    ? user!.roles.includes("community_builder")
    : false;

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["/api/community-builder/profile", "impact"],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch("/api/community-builder/profile");
      if (res.status === 404 || res.status === 403) {
        return null;
      }
      if (!res.ok) throw new Error("Failed to fetch Community Builder stats");
      return res.json();
    },
  });

  const stats = (profile as any)?.stats as
    | { totalContributions: number; totalValue: string; totalHours: string; completedCount: number }
    | undefined;

  const hasImpact = !!stats && stats.totalContributions > 0;

  return (
    <Card className={`bg-tsCard border border-white/10 shadow-xl shadow-black/25 ${className}`}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="h-4 w-4 text-emerald-500" />
          Community Builder Impact
        </CardTitle>
        {hasCommunityBuilderRole && (
          <Badge
            variant="outline"
            className="border-emerald-500 text-emerald-600 dark:text-emerald-300 text-xs"
          >
            Badge active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading && <p className="text-white/60 dark:text-white/60">Loading your impact</p>}

        {!isLoading && profile === null && !hasCommunityBuilderRole && (
          <>
            <p className="text-white/60 dark:text-white/60">
              Earn the Community Builder badge to send and vote on which local causes get funded
              from your community vault.
            </p>
            <Link href="/community-builder/dashboard">
              <Button
                size="sm"
                className="mt-2 bg-ts-orange-dark hover:bg-ts-orange-dark text-white w-full"
              >
                Activate Community Builder badge
              </Button>
            </Link>
          </>
        )}

        {!isLoading && (profile !== null || hasCommunityBuilderRole) && !hasImpact && !isError && (
          <>
            <p className="text-white/60 dark:text-white/60">
              Your Community Builder badge is ready. Propose a contribution or support a local cause
              to start building your impact history.
            </p>
            <div className="flex gap-2">
              <Link href="/community-builder/dashboard">
                <Button variant="outline" size="sm" className="flex-1">
                  Open Community Builder dashboard
                </Button>
              </Link>
              <Link href="/foundation">
                <Button variant="outline" size="sm" className="flex-1">
                  Open Community Builders
                </Button>
              </Link>
            </div>
          </>
        )}

        {!isLoading && hasImpact && stats && (
          <>
            <p className="text-white/60 dark:text-white/60">
              Thanks to your Community Builder badge, you've helped unlock funding and hours for
              local causes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div className="text-center rounded-lg border border-white/10 bg-tsSurface p-2">
                <div className="text-xs text-white/60 dark:text-white/60 mb-1">
                  Verified contributions
                </div>
                <div className="text-lg font-semibold text-white/70 dark:text-white">
                  {stats.completedCount}
                </div>
              </div>
              <div className="text-center rounded-lg border border-white/10 bg-tsSurface p-2">
                <div className="text-xs text-white/60 dark:text-white/60 mb-1">Funded value</div>
                <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-300">
                  ${stats.totalValue}
                </div>
              </div>
              <div className="text-center rounded-lg border border-white/10 bg-tsSurface p-2">
                <div className="text-xs text-white/60 dark:text-white/60 mb-1">Hours donated</div>
                <div className="text-lg font-semibold text-white/70 dark:text-white">
                  {stats.totalHours}
                </div>
              </div>
            </div>
            <Link href="/community-builder/dashboard">
              <Button variant="outline" size="sm" className="mt-3 w-full">
                See full Community Builder history
              </Button>
            </Link>
          </>
        )}

        {isError && !isLoading && (
          <p className="text-xs text-red-500">
            We couldn't load your Community Builder impact right now. Try refreshing, or visit the
            Community Builder dashboard.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Widget registry for easy configuration
export const AVAILABLE_WIDGETS = [
  {
    id: "activity-stats",
    name: "Activity Stats",
    component: ActivityStatsWidget,
    defaultEnabled: true,
  },
  {
    id: "quick-actions",
    name: "Quick Actions",
    component: QuickActionsWidget,
    defaultEnabled: true,
  },
  {
    id: "recent-projects",
    name: "My Projects",
    component: RecentProjectsWidget,
    defaultEnabled: true,
  },
  {
    id: "saved-contractors",
    name: "Saved Contractors",
    component: SavedContractorsWidget,
    defaultEnabled: true,
  },
  {
    id: "messages-preview",
    name: "Recent Messages",
    component: MessagesPreviewWidget,
    defaultEnabled: true,
  },
  {
    id: "notifications",
    name: "Notifications",
    component: NotificationsWidget,
    defaultEnabled: false,
  },
  {
    id: "community-feed",
    name: "Community Feed",
    component: CommunityFeedWidget,
    defaultEnabled: false,
  },
  {
    id: "affiliate-stats",
    name: "Affiliate Earnings",
    component: AffiliateStatsWidget,
    defaultEnabled: false,
  },
  {
    id: "community-builder-impact",
    name: "Community Builder Impact",
    component: CommunityBuilderImpactWidget,
    defaultEnabled: true,
  },
] as const;
