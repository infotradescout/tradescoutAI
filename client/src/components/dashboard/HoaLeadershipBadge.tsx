import { useQuery } from '@tanstack/react-query';
import { Shield, Home, LayoutDashboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

type HoaMembership = {
  hoaId: string;
  hoaName?: string;
  role: string;
};

type HoaMembershipsResponse = {
  memberships: HoaMembership[];
};

interface HoaLeadershipBadgeProps {
  className?: string;
}

export function HoaLeadershipBadge({ className }: HoaLeadershipBadgeProps) {
  const { data, isLoading, isError } = useQuery<HoaMembershipsResponse>({
    queryKey: ['/api/hoa'],
    queryFn: async () => {
      const res = await fetch('/api/hoa', { credentials: 'include' });
      if (res.status === 401 || res.status === 404 || res.status === 403) {
        return { memberships: [] };
      }
      if (!res.ok) {
        throw new Error('Failed to load HOA memberships');
      }
      return res.json();
    },
  });

  if (isLoading || isError) return null;

  const memberships = data?.memberships ?? [];
  if (!memberships.length) return null;

  const primary = memberships[0];

  const isLeadership = ['president', 'vice_president', 'treasurer', 'secretary', 'board_member'].includes(primary.role);

  return (
    <Card className={className ? `${className}` : ''}>
      <CardContent className="flex items-center justify-between py-3 px-4 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isLeadership ? (
            <Shield className="h-4 w-4 text-orange-500 shrink-0" />
          ) : (
            <Home className="h-4 w-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">HOA Role</p>
            <p className="text-sm font-medium text-slate-100 truncate">
              {primary.hoaName || 'Your HOA'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={isLeadership ? 'default' : 'secondary'} className="text-[0.65rem] px-2 py-0.5 whitespace-nowrap">
            {isLeadership ? 'HOA Leadership' : 'HOA Member'}
          </Badge>
          {isLeadership && (
            <Link href={primary.hoaId ? `/hoa-dashboard/${primary.hoaId}` : '/hoa-dashboard'}>
              <Button
                variant="outline"
                size="xs"
                className="h-7 px-2 text-[0.65rem] border-slate-600 text-slate-200 hover:border-orange-500 hover:text-white"
              >
                <LayoutDashboard className="h-3 w-3 mr-1" />
                Manage HOA
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
