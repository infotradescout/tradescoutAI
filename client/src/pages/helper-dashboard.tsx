import { useAuth } from "@/hooks/useAuth";
import { Page, Section } from "@/components/layout/PagePrimitives";

export default function HelperDashboard() {
  const { user } = useAuth();

  return (
    <Page className="max-w-7xl">
      <Section
        title="Helper Dashboard"
        subtitle="Manage your tasks and grow your reputation"
      >
        {user?.role !== "helper" && (
          <p className="text-white/50 text-sm">
            This dashboard is for helpers. Your current role is:{" "}
            <span className="text-white/80">{String(user?.role || "unknown")}</span>
          </p>
        )}
      </Section>
    </Page>
  );
}
