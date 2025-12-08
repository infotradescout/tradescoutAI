import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BuilderProfile {
  id: string;
  businessName?: string;
  description?: string;
  currentRank: string;
  totalContributionValue: string;
  totalHoursDonated: string;
  ratingScore: number;
  isVerified: boolean;
  stats: {
    totalContributions: number;
    totalValue: string;
    totalHours: string;
    completedCount: number;
    verificationRate: number;
  };
}

const rankColors: Record<string, string> = {
  prospect: 'bg-gray-100 text-gray-800',
  bronze: 'bg-orange-100 text-orange-800',
  silver: 'bg-slate-100 text-slate-800',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-cyan-100 text-cyan-800',
  diamond: 'bg-purple-100 text-purple-800',
};

export default function CommunityBuilderDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Fetch builder profile
  const { data: profile, isLoading: profileLoading } = useQuery<BuilderProfile>({
    queryKey: ['builderProfile'],
    queryFn: async () => {
      const res = await fetch('/api/community-builder/profile');
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) throw new Error('Failed to fetch profile');
      return res.json();
    },
  });

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ['builderNotifications'],
    queryFn: async () => {
      const res = await fetch('/api/community-builder/notifications?unreadOnly=true');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
  });

  // Fetch contributions
  const { data: contributions = [] } = useQuery({
    queryKey: ['builderContributions'],
    queryFn: async () => {
      const res = await fetch('/api/community-builder/contributions');
      if (res.status === 404) return [];
      if (!res.ok) throw new Error('Failed to fetch contributions');
      return res.json();
    },
  });

  // Fetch payouts
  const { data: payouts = [] } = useQuery({
    queryKey: ['builderPayouts'],
    queryFn: async () => {
      const res = await fetch('/api/community-builder/payouts');
      if (res.status === 404) return [];
      if (!res.ok) throw new Error('Failed to fetch payouts');
      return res.json();
    },
  });

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card className="border-2 border-indigo-200">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Start Your Community Builder Journey</CardTitle>
              <CardDescription>
                Join your county's community of builders and make a real impact
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-gray-600">
                  Community Builders contribute time, expertise, and resources to strengthen their communities.
                  In return, they earn recognition, rewards, and the satisfaction of making a difference.
                </p>
              </div>
              <Button 
                size="lg"
                onClick={() => navigate('/community-builder/setup')}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Create Your Builder Profile
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                {profile.businessName || 'Community Builder'}
              </h1>
              <p className="text-gray-600 mt-1">Dashboard</p>
            </div>
            <Badge className={`${rankColors[profile.currentRank]} text-lg px-4 py-2`}>
              {profile.currentRank.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <AlertCircle className="w-5 h-5" />
                You have {notifications.length} unread notification(s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif: any) => (
                  <p key={notif.id} className="text-sm text-yellow-800">
                    <strong>{notif.title}:</strong> {notif.message}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                <span className="text-2xl font-bold">${profile.stats.totalValue}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Lifetime contribution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Hours Donated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                <span className="text-2xl font-bold">{profile.stats.totalHours}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Service hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                <span className="text-2xl font-bold">{profile.stats.completedCount}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Verified & complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-yellow-600" />
                <span className="text-2xl font-bold">{profile.ratingScore?.toFixed(1) || '-'}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Out of 5 stars</p>
            </CardContent>
          </Card>
        </div>

        {/* Verification Status */}
        {!profile.isVerified && (
          <Card className="border-2 border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <AlertCircle className="w-5 h-5" />
                Verification Pending
              </CardTitle>
              <CardDescription className="text-orange-800">
                Complete your verification to unlock higher earning tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate('/community-builder/verify')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Complete Verification
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Contributions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Contributions</CardTitle>
                <CardDescription>Your latest submitted contributions</CardDescription>
              </div>
              <Button 
                variant="outline"
                onClick={() => navigate('/community-builder/contributions/new')}
              >
                + New Contribution
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contributions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No contributions yet. Start making an impact!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contributions.slice(0, 5).map((contrib: any) => (
                  <div 
                    key={contrib.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/community-builder/contributions/${contrib.id}`)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{contrib.title}</p>
                      <p className="text-sm text-gray-600">{contrib.description.substring(0, 100)}...</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline">{contrib.status}</Badge>
                        <span className="text-sm text-gray-500">${contrib.estimatedValue}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {contrib.status === 'verified' && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {contrib.status === 'proposed' && (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payouts */}
        <Card>
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>Your earnings and payouts</CardDescription>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No payouts yet. Complete and verify contributions to earn!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {payouts.map((payout: any) => (
                  <div 
                    key={payout.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">${payout.amount}</p>
                      <p className="text-sm text-gray-600">{payout.payoutType}</p>
                    </div>
                    <Badge variant="outline">{payout.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
