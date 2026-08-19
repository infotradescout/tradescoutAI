import HomeIdWorkspace from "./homeid/HomeIdWorkspace";
import PropertyBlessingsLaunchWorkspace from "./homeid/PropertyBlessingsLaunchWorkspace";

const PROPERTY_BLESSINGS_HOME_ID = "073b355c-1aa3-4658-a776-ebedaa6aaefc";

export default function Homes() {
  if (typeof window === "undefined") return <HomeIdWorkspace />;

  const params = new URLSearchParams(window.location.search);
  const homeId = params.get("homeId");
  const mode = params.get("mode");

  return homeId === PROPERTY_BLESSINGS_HOME_ID && mode !== "passport" ? (
    <PropertyBlessingsLaunchWorkspace />
  ) : (
    <HomeIdWorkspace />
  );
}
