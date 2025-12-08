import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Link as LinkIcon } from 'lucide-react';

interface ProfileResponse {
  id: string;
  businessName?: string;
  description?: string;
  website?: string;
  payoutEmail?: string;
  bankAccountId?: string; // used for Stripe Connect account id
  currentRank: string;
  isVerified: boolean;
}

export default function BuilderProfileSetupPage() {
  const [, navigate] = useLocation();
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [payoutEmail, setPayoutEmail] = useState('');
  const [refreshUrl, setRefreshUrl] = useState('');
  const [returnUrl, setReturnUrl] = useState('');

  const { data: profile, refetch } = useQuery<ProfileResponse | null>({
    queryKey: ['builderProfileSetup'],
    queryFn: async () => {
      const res = await fetch('/api/community-builder/profile');
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('Failed to load profile');
      return res.json();
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/community-builder/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, description, profileImageUrl: '', website, payoutEmail }),
      });
      if (!res.ok) throw new Error('Failed to save profile');
      return res.json();
    },
    onSuccess: () => refetch(),
  });

  const onboard = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/community-builder/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshUrl, returnUrl }),
      });
      if (!res.ok) throw new Error('Failed to start onboarding');
      return res.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
  });

  const readyForPayouts = Boolean(profile?.bankAccountId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Builder Profile Setup</h1>
            <p className="text-gray-600">Complete your profile and connect payouts.</p>
          </div>
          {profile?.currentRank && (
            <Badge variant="outline" className="text-sm">Rank: {profile.currentRank}</Badge>
          )}
        </div>

        {profile?.isVerified ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Verified</AlertTitle>
            <AlertDescription>Your account is verified and eligible for payouts.</AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTitle>Verification Pending</AlertTitle>
            <AlertDescription>Complete profile and Connect onboarding to enable payouts.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Profile Basics</CardTitle>
            <CardDescription>Share how you contribute to the county.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Business or builder name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            <Textarea placeholder="Short bio / areas of focus" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input placeholder="Website or social link" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <Input placeholder="Payout email" value={payoutEmail} onChange={(e) => setPayoutEmail(e.target.value)} />
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? 'Saving...' : 'Save profile'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payouts (Stripe Connect)</CardTitle>
            <CardDescription>Onboard to receive payouts for verified contributions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Refresh URL" value={refreshUrl} onChange={(e) => setRefreshUrl(e.target.value)} />
            <Input placeholder="Return URL" value={returnUrl} onChange={(e) => setReturnUrl(e.target.value)} />
            <Button onClick={() => onboard.mutate()} variant="secondary" disabled={onboard.isPending}>
              <LinkIcon className="w-4 h-4 mr-2" />
              {readyForPayouts ? 'Resume onboarding' : 'Start Connect onboarding'}
            </Button>
            {readyForPayouts && <p className="text-sm text-green-700">Stripe account connected.</p>}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => navigate('/community-builder/dashboard')}>Back to dashboard</Button>
          <Button onClick={() => navigate('/community-builder/contributions/new')}>Create a contribution</Button>
        </div>
      </div>
    </div>
  );
}
