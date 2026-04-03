import { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MapPin, ListChecks, Compass } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useContextualCopy } from "@/hooks/useContextualCopy";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  QuickActionsWidget,
  RecentProjectsWidget,
  SavedContractorsWidget,
  CommunityBuilderImpactWidget,
} from "@/components/dashboard/DashboardWidgets";
import { Page, Section } from "@/components/layout/PagePrimitives";

// Local view model for My TradeScout. This is intentionally
// conservative: it only derives state from existing user/session
// and the /api/dashboard endpoint, and it never fabricates metrics.
type MyTradeScoutState = {
  context: {
    countyLabel?: string;
    state?: string;
    roleLabel?: string;
  };
  activeThreads: Array<{
    id: string;
    type: "project";
    summary: string;
    primaryAction: { label: string; path: string };
  }>;
  recommendedActions: Array<{
    id: string;
    reason: string;
    action: { label: string; path: string };
  }>;
  opportunities: Array<{
    id: string;
    label: string;
    path: string;
  }>;
};

interface DashboardSnapshot {
  stats?: {
    activeProjects?: number;
    savedContractors?: number;
  };
  myProjects?: Array<{
    id: string;
    title?: string;
    status?: string;
  }>;
}

const MyTradeScoutPage = memo(function MyTradeScoutPage() {
  const { user } = useAuth();
  const locationCtx = useLocationContext();

  const { data: snapshot } = useQuery<DashboardSnapshot>({
    queryKey: ["/api/dashboard", user?.id],
    enabled: !!user?.id,
  });

  const model: MyTradeScoutState = useMemo(() => {
    const county = (user as any)?.location?.county as string | undefined;
    const state = (user as any)?.location?.state as string | undefined;
    const countyLabel = county && state ? `${county}, ${state}` : county || undefined;

    const roleLabel = (() => {
      const anyUser: any = user;
      if (!anyUser) return undefined;
      if (Array.isArray(anyUser.roles) && anyUser.roles.length > 0) {
        return anyUser.roles.join(", ");
      }
      return anyUser.role as string | undefined;
    })();

    const projects = snapshot?.myProjects ?? [];

    const activeThreads = projects.slice(0, 4).map((project) => ({
      id: project.id,
      type: "project" as const,
      summary: project.title || "Project",
      primaryAction: {
        label: "Open in Project Tracker",
        path: "/project-tracker",
      },
    }));

    const recommendedActions: MyTradeScoutState["recommendedActions"] = [];

    const isContractor =
      (user as any)?.role === "contractor_user" || (user as any)?.role === "accelerator_member";
    const isRealtor = (user as any)?.role === "realtor";

    if (!county || !state) {
      recommendedActions.push({
        id: "complete-location",
        reason: "Set your location so TradeScout can route local help accurately.",
        action: {
          label: "Set my location",
          path: "/settings?tab=location",
        },
      });
    }

    if (!snapshot?.myProjects?.length && !isContractor && county && state) {
      recommendedActions.push({
        id: "start-first-project",
        reason: "You have no projects in progress for your home yet.",
        action: {
          label: "Start a project with Direct Connect",
          path: "/direct-connect",
        },
      });
    }

    if (isContractor && !snapshot?.myProjects?.length) {
      recommendedActions.push({
        id: "browse-leads",
        reason: "You are set up as a contractor but have no active projects here yet.",
        action: {
          label: "Browse contractor leads",
          path: "/contractor-leads",
        },
      });
    }

    if (isRealtor && !snapshot?.myProjects?.length) {
      recommendedActions.push({
        id: "homescout-listings",
        reason: "You are a realtor; your HomeScout Listings tools are ready when you are.",
        action: {
          label: "Open HomeScout Listings",
          path: "/homescout-listings",
        },
      });
    }

    const opportunities: MyTradeScoutState["opportunities"] = [];

    if ((snapshot?.stats?.savedContractors ?? 0) > 0) {
      opportunities.push({
        id: "saved-contractors",
        label: "Review your saved contractors",
        path: "/saved-contractors",
      });
    }

    opportunities.push({
      id: "open-community-feed",
      label: "See what is happening in your community feed",
      path: "/community-feed",
    });

    return {
      context: {
        countyLabel,
        state,
        roleLabel,
      },
      activeThreads,
      recommendedActions,
      opportunities,
    };
  }, [snapshot, user]);

  if (!user) {
    return (
      <Page className="max-w-md">
        <div className="text-center space-y-3 py-16">
          <h1 className="text-xl font-semibold text-ts-orange">My TradeScout</h1>
          <p className="text-sm text-white/70">
            Sign in to see what TradeScout already knows about your projects and community.
          </p>
          <Link href="/pre-scout-setup?mode=signin">
            <Button className="w-full mt-2">Sign in</Button>
          </Link>
        </div>
      </Page>
    );
  }

  const hasThreads = model.activeThreads.length > 0;
  const hasRecommendations = model.recommendedActions.length > 0;
  const hasOpportunities = model.opportunities.length > 0;

  const hasPrimaryContent = hasThreads || hasRecommendations || hasOpportunities;

  const { line: myTradeScoutContextLine } = useContextualCopy({
    stateCode: locationCtx.stateCode,
    countyFips: locationCtx.countyFips,
    interest: "auto_dealers",
    timeframe: "30d",
    fallback: "Local activity will begin to appear here as your area comes online.",
  });

  return (
    <Page className="max-w-6xl pb-20 lg:pb-0">
      <Section
        title="My TradeScout"
        subtitle="A simple, honest view of where you are right now and the next few things TradeScout can help you do."
      >

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
          {/* Left: context + threads + recommended actions */}
          <div className="space-y-4">
            <Card className="bg-tsCard border-white/10">
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Compass className="h-4 w-4 text-ts-orange" />
                  Your current context
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ts-orange" />
                  <span>
                    {model.context.countyLabel
                      ? model.context.countyLabel
                      : "Location not set yet."}
                  </span>
                </div>
                {model.context.roleLabel && (
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-ts-orange" />
                    <span>Roles: {model.context.roleLabel}</span>
                  </div>
                )}
                {!model.context.roleLabel && (
                  <p className="text-xs text-white/60">
                    You can tell TradeScout more about how you use the platform in Profile Settings.
                  </p>
                )}
                <div className="pt-3 flex flex-wrap gap-2 thumb-action-row">
                  <Link href="/profile-settings">
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      Update profile & roles
                    </Button>
                  </Link>
                  <Link href="/scout">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-ts-orange-dark hover:bg-ts-orange-dark text-white thumb-primary-action"
                    >
                      Ask Scout what to do next
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {!hasPrimaryContent && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Compass className="h-4 w-4 text-ts-orange" />
                    Local activity context
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-white/70">
                  <p>{myTradeScoutContextLine}</p>
                </CardContent>
              </Card>
            )}

            {hasThreads && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <ListChecks className="h-4 w-4 text-ts-orange" />
                    In progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {model.activeThreads.map((thread) => (
                    <div
                      key={thread.id}
                      className="flex items-center justify-between rounded-lg bg-tsCard/80 px-3 py-2"
                    >
                      <div className="flex-1 mr-3">
                        <p className="font-medium text-white line-clamp-1">{thread.summary}</p>
                        <p className="text-xs text-white/60">Tracked as a {thread.type}</p>
                      </div>
                      <Link href={thread.primaryAction.path}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          {thread.primaryAction.label}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {hasRecommendations && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Compass className="h-4 w-4 text-ts-orange" />
                    Next best actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {model.recommendedActions.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <p className="text-white/70 max-w-xl">{item.reason}</p>
                      <Link href={item.action.path}>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-ts-orange-dark hover:bg-ts-orange-dark text-white"
                        >
                          {item.action.label}
                        </Button>
                      </Link>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {hasOpportunities && (
              <Card className="bg-tsCard border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Compass className="h-4 w-4 text-ts-orange" />
                    Other opportunities you can open now
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs">
                  {model.opportunities.map((opp) => (
                    <Link key={opp.id} href={opp.path}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-ts-orange/30 text-white hover:bg-ts-orange/10"
                      >
                        {opp.label}
                      </Button>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: existing widgets that already talk to real data or neutral actions */}
          <div className="space-y-4">
            <QuickActionsWidget />
            <RecentProjectsWidget />
            <SavedContractorsWidget />
            <CommunityBuilderImpactWidget />
          </div>
        </div>
      </Section>
    </Page>
  );
});

export default MyTradeScoutPage;
