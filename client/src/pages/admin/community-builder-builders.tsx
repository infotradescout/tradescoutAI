import React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface BuilderRow {
  id: string;
  userId: string;
  businessName?: string;
  countyId: string;
  status: string;
  currentRank: string;
  totalContributionValue: string;
  completedContributionsCount: number;
  isVerified: boolean;
  bankAccountId?: string;
}

export default function AdminCommunityBuilderManagementPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user?.isAdmin) setLocation('/unauthorized');
  }, [user?.isAdmin, setLocation]);

  if (!user?.isAdmin) return null;
  const { data: builders = [], refetch } = useQuery<BuilderRow[]>({
    queryKey: ['cbBuilders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/community-builder/builders');
      if (!res.ok) throw new Error('Failed to load builders');
      return res.json();
    },
  });

  const toggle = async (id: string, action: 'suspend' | 'unsuspend') => {
    await fetch(`/api/admin/community-builder/builders/${id}/${action}`, { method: 'POST' });
    refetch();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Builder Management</h1>
            <p className="text-gray-600">Approve, suspend, and monitor builders.</p>
          </div>
          <Badge variant="secondary">{builders.length} builders</Badge>
        </div>

        {builders.some((b) => !b.isVerified) && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pending verification</AlertTitle>
            <AlertDescription>
              Some builders are unverified. Ensure verification before payouts.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
            <CardDescription>Status, rank, and payout readiness.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contribs</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Payouts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {builders.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.businessName || 'Builder'}</TableCell>
                    <TableCell>{b.countyId}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{b.currentRank}</Badge>
                    </TableCell>
                    <TableCell>
                      {b.status === 'active' ? (
                        <Badge className="bg-green-100 text-green-800 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1"><Ban className="w-3 h-3" /> {b.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{b.completedContributionsCount}</TableCell>
                    <TableCell className="text-right">${b.totalContributionValue}</TableCell>
                    <TableCell className="text-right">{b.bankAccountId ? 'Ready' : 'Not linked'}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {b.status === 'active' ? (
                        <Button size="sm" variant="outline" onClick={() => toggle(b.id, 'suspend')}>Suspend</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => toggle(b.id, 'unsuspend')}>Unsuspend</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
