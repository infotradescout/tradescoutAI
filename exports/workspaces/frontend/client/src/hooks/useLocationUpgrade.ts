import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

/**
 * Auto-upgrade hook for existing users with legacy location data.
 *
 * If a user has legacy `state` and `county` fields but missing canonical
 * `stateCode`/`countyFips`, this hook will:
 * 1. Look up the county FIPS code from the /api/counties endpoint
 * 2. Update the user's profile with canonical fields
 * 3. Persist to localStorage for fast boot
 *
 * This happens once per session, silently in the background.
 */
export function useLocationUpgrade() {
  const { user, refetch } = useAuth();
  const upgradeAttempted = useRef(false);

  useEffect(() => {
    // Only run once per session
    if (upgradeAttempted.current) return;
    if (!user) return;

    // Check if user has legacy data but missing canonical fields
    const hasLegacyData = user.state && user.county;
    const missingCanonical = !user.stateCode || !user.countyFips;

    if (hasLegacyData && missingCanonical) {
      upgradeAttempted.current = true;
      upgradeLocation(user);
    }
  }, [user]);

  async function upgradeLocation(user: any) {
    try {
      const stateCode = user.state?.trim().toUpperCase();
      const countyName = user.county?.trim();

      if (!stateCode || !countyName) return;

      // Fetch counties for this state
      const response = await fetch(`/api/counties?state=${stateCode}`);
      if (!response.ok) return;

      const counties = await response.json();

      // Find matching county (case-insensitive, handle "County" suffix variations)
      const normalizedName = countyName.toLowerCase().replace(/\s+county\s*$/i, "");
      const match = counties.find((c: any) => {
        const cName = c.name?.toLowerCase().replace(/\s+county\s*$/i, "");
        return cName === normalizedName;
      });

      if (!match) {
        console.info("Could not find FIPS match for legacy county:", countyName);
        return;
      }

      // Update user profile with canonical fields
      const updatePayload = {
        stateCode: stateCode,
        countyFips: match.fips,
        countyName: match.name,
        city: user.city || undefined,
        zipCode: user.zipCode || user.zip || undefined,
      };

      await apiRequest("PUT", "/api/user/profile", updatePayload);

      // Persist to localStorage
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.setItem(
            "userLocation",
            JSON.stringify({
              stateCode: stateCode,
              countyFips: match.fips,
              countyName: match.name,
            })
          );
        }
      } catch (storageError) {
        // Storage quota issues or privacy mode - not critical
      }

      // Refresh user data to reflect the upgrade
      refetch?.();

      console.info("Location upgraded:", {
        from: { state: user.state, county: user.county },
        to: { stateCode, countyFips: match.fips, countyName: match.name },
      });
    } catch (error) {
      // Silent failure - user can continue with legacy data via fallback
      console.warn("Location upgrade failed (non-critical):", error);
    }
  }
}
