import { Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import HomeOverview from "./homeid/HomeOverview";
import { collection, homeHref, resolveHomeView, type HomeSummary } from "./homeid/homeWorkspaceModel";
import "./homeid/HomeOverview.css";

const HomeIdWorkspace = lazy(() => import("./homeid/HomeIdWorkspace"));
const PropertyBlessingsLaunchWorkspace = lazy(() => import("./homeid/PropertyBlessingsLaunchWorkspace"));

export default function Homes() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const requestedHomeId = new URLSearchParams(search).get("homeId")?.trim() || null;
  const homesQuery = useQuery({
    queryKey: ["/api/homes", user?.id],
    enabled: isAuthenticated,
    queryFn: async () => collection<HomeSummary>(await apiRequest("GET", "/api/homes"), "homes"),
  });
  const homes = homesQuery.data || [];
  const selectedHomeId = requestedHomeId || homes[0]?.id || null;
  const view = resolveHomeView(search, selectedHomeId);

  if (!isAuthenticated) {
    if (isLoading) return <div className="ts-home-overview"><p role="status">Loading your property workspace…</p></div>;
    return <section className="ts-home-overview"><h1>Your property workspace</h1><p>Sign in to view your private property records.</p><Link className="home-action" href={`/login?next=${encodeURIComponent(`/homes${search ? `?${search}` : ""}`)}`}>Sign in</Link></section>;
  }

  if (view !== "overview") {
    return (
      <div className="ts-home-record-frame">
        <Link className="home-return-link" href={homeHref(selectedHomeId)}>← Property overview</Link>
        <Suspense fallback={<p role="status">Loading the property tools…</p>}>
          {view === "launch" ? <PropertyBlessingsLaunchWorkspace key={user!.id} /> : <HomeIdWorkspace key={`${user!.id}:${selectedHomeId || "new"}`} />}
        </Suspense>
      </div>
    );
  }

  return <HomeOverview
    key={`${user!.id}:${selectedHomeId || "none"}`}
    viewerId={user!.id}
    homeId={selectedHomeId}
    homes={homes}
    homesPending={homesQuery.isPending}
    homesError={homesQuery.isError}
    retryHomes={() => void homesQuery.refetch()}
    selectHome={(id) => navigate(homeHref(id))}
  />;
}
