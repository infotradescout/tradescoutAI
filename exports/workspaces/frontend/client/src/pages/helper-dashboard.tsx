import { useAuth } from "@/hooks/useAuth";

export default function HelperDashboard() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Helper Dashboard</h1>
          <p className="text-white/60 mt-2">Manage your tasks and grow your reputation</p>
          {user?.role !== "helper" && (
            <p className="text-white/50 mt-3 text-sm">
              This dashboard is for helpers. Your current role is:{" "}
              <span className="text-white/80">{String(user?.role || "unknown")}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
