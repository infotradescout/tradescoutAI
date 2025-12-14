import { memo, useMemo } from 'react';
import { Wrench } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Page, Section } from '@/components/layout/PagePrimitives';
import FindContractors from '@/pages/find-contractors';

function getWorkLabelFromRole(role: string, roles: string[]): string {
  const normalized = (role || '').toLowerCase();
  const all = roles.map((r) => r.toLowerCase());

  const has = (needle: string) => normalized === needle || all.includes(needle);

  if (has('contractor') || has('contractor_user') || has('service_provider') || has('pro')) return 'Jobs';
  if (has('realtor') || has('broker')) return 'Listings / Transactions';
  if (has('insurance_agent') || has('inspector') || has('helper')) return 'Assignments';
  if (has('hoa_admin') || has('hoa_board') || has('hoa_manager') || has('community_builder')) return 'Projects';
  return 'My Projects';
}

const DashboardJobs = memo(function DashboardJobs() {
  const { user } = useAuth();

  const rawRoles: string[] = Array.isArray((user as any)?.roles)
    ? ((user as any).roles as string[])
    : user?.role
      ? [user.role]
      : [];

  const label = useMemo(
    () => getWorkLabelFromRole((user as any)?.activeRole || user?.role || 'homeowner', rawRoles),
    [rawRoles, user]
  );

  return (
    <Page className="max-w-7xl">
      <Section
        title={label}
        subtitle="One board surface, tailored to your role. Scout can route work, vendor search, and follow-ups from here."
      >
        <FindContractors title={label} />
      </Section>
    </Page>
  );
});

export default DashboardJobs;
