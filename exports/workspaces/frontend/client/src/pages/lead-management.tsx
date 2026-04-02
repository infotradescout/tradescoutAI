import { useEffect } from "react";
import { useLocation } from "wouter";

// Legacy route: /lead-management
// Projects and job workflows now live inside Finances.
// This page simply forwards users (and any jobId/projectId query params)
// into /finances.

export default function ProjectTracker() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    try {
      const parts = location.split("?");
      const search = parts[1] ? `?${parts[1]}` : "";
      navigate(`/finances${search}`);
    } catch {
      navigate("/finances");
    }
  }, [location, navigate]);

  return (
    <div className="flex items-center justify-center text-white/70 px-4 py-24">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-base font-semibold">Projects moved to Finances</h1>
        <p className="text-xs text-white/60">
          Your jobs and workflow now live in Finances. We're sending you there automatically.
        </p>
      </div>
    </div>
  );
}
