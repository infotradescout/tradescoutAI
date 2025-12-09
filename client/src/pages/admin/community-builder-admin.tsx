import React, { useState } from 'react';
import { Navigate } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircle, 
  CheckCircle, 
  X,
  DollarSign,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface PendingContribution {
  id: string;
  title: string;
  description: string;
  builderId: string;
  estimatedValue: string;
  type: string;
  createdAt: string;
  builder?: {
    businessName?: string;
    userId?: string;
  };
}

export default function AdminCommunityBuilderDashboard() {
  const { user } = useAuth();
  if (!user?.isAdmin) {
    return <Navigate to="/unauthorized" />;
  }
  const { toast } = useToast();
  const [selectedContribution, setSelectedContribution] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Fetch pending contributions
  const { data: pendingContributions = [], refetch: refetchContributions } = useQuery<PendingContribution[]>({
    queryKey: ['adminPendingContributions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/community-builder/contributions/pending');
      if (!res.ok) throw new Error('Failed to fetch pending contributions');
      return res.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ contributionId, notes }: { contributionId: string; notes: string }) => {
      const res = await fetch(`/api/admin/community-builder/contributions/${contributionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to approve contribution');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Contribution approved' });
      setSelectedContribution(null);
      setApprovalNotes('');
      refetchContributions();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to approve contribution', variant: 'destructive' });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ contributionId, reason }: { contributionId: string; reason: string }) => {
      const res = await fetch(`/api/admin/community-builder/contributions/${contributionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error('Failed to reject contribution');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Contribution rejected' });
      setSelectedContribution(null);
      setApprovalNotes('');
      refetchContributions();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reject contribution', variant: 'destructive' });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Community Builder Admin</h1>
          <p className="text-gray-600 mt-1">Review and manage community builder contributions</p>
        </div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{pendingContributions.length}</span>
              <p className="text-xs text-gray-500 mt-1">Contributions awaiting approval</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Pending Value</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                ${pendingContributions.reduce((sum, c) => sum + parseFloat(c.estimatedValue || '0'), 0).toFixed(2)}
              </span>
              <p className="text-xs text-gray-500 mt-1">Total estimated value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Builders</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {new Set(pendingContributions.map(c => c.builderId)).size}
              </span>
              <p className="text-xs text-gray-500 mt-1">Unique builders</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending Contributions */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Contributions for Review</CardTitle>
            <CardDescription>
              {pendingContributions.length} contribution(s) awaiting approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingContributions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No pending contributions</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingContributions.map((contrib) => (
                  <div
                    key={contrib.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedContribution === contrib.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedContribution(contrib.id)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{contrib.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {contrib.description.substring(0, 150)}...
                          </p>
                        </div>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {contrib.type}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-semibold">
                          ${contrib.estimatedValue}
                        </span>
                        {contrib.builder?.businessName && (
                          <span className="text-gray-600">
                            Builder: {contrib.builder.businessName}
                          </span>
                        )}
                        <span className="text-gray-500">
                          {new Date(contrib.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Approval Controls - shown when selected */}
                    {selectedContribution === contrib.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div>
                          <label className="text-sm font-medium">Review Notes (Optional)</label>
                          <Textarea
                            placeholder="Add notes for the builder..."
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({
                              contributionId: contrib.id,
                              notes: approvalNotes,
                            })}
                            disabled={approveMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectMutation.mutate({
                              contributionId: contrib.id,
                              reason: approvalNotes || 'Not approved',
                            })}
                            disabled={rejectMutation.isPending}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedContribution(null);
                              setApprovalNotes('');
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guidelines */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Review Guidelines
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>✓ Check that contribution aligns with county needs</p>
            <p>✓ Verify estimated value is reasonable</p>
            <p>✓ Ensure builder has relevant experience/credentials</p>
            <p>✓ Look for red flags in description or builder profile</p>
            <p>✓ Add notes to help builder if additional info needed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
