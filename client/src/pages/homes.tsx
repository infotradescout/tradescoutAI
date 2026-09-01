import { useQuery } from "@tanstack/react-query";
import HomeIdWorkspace from "./homeid/HomeIdWorkspace";
import PropertyBlessingsLaunchWorkspace from "./homeid/PropertyBlessingsLaunchWorkspace";

const PROPERTY_BLESSINGS_HOME_ID = "073b355c-1aa3-4658-a776-ebedaa6aaefc";

type HomesResponse = {
  homes?: Array<{ id?: string | null }>;
};

export default function Homes() {
  const homesQuery = useQuery<HomesResponse>({ queryKey: ["/api/homes"] });

  if (typeof window === "undefined") return <HomeIdWorkspace />;

  const params = new URLSearchParams(window.location.search);
  const requestedHomeId = params.get("homeId");
  const mode = params.get("mode");
  const firstHomeId = String(homesQuery.data?.homes?.[0]?.id || "");
  const selectedHomeId = requestedHomeId || firstHomeId;

  if (!requestedHomeId && homesQuery.isLoading) {
    return <div className="min-h-[50vh] bg-background" aria-label="Loading HomeID" />;
  }

  return selectedHomeId === PROPERTY_BLESSINGS_HOME_ID && mode !== "passport" ? (
    <PropertyBlessingsLaunchWorkspace />
  ) : (
    <HomeIdWorkspace />
  );
}
