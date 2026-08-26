import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, DollarSign, TrendingUp, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  activateCommunityBuilder,
  CommunityBuilderActivationError,
} from "./communityBuilderActivation";

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
  prospect: "bg-white/5 text-white/70",
  bronze: "bg-ts-orange/10 text-ts-orange",
  silver: "bg-white/5 text-white/70",
  gold: "bg-yellow-100 text-yellow-800",
  platinum: "bg-cyan-100 text-cyan-800",
  diamond: "bg-purple-100 text-purple-800",
};

const rankThresholds: Array<{ rank: string; minValue: number }> = [
  { rank: "bronze", minValue: 1 },
  { rank: "silver", minValue: 1000 },
  { rank: "gold", minValue: 5000 },
  { rank: "platinum", minValue: 25000 },
  { rank: "diamond", minValue: 100000 },
];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function computeBuilderEvaluation(profile: BuilderProfile) {
  const totalValue = toNumber(profile.stats?.totalValue ?? profile.totalContributionValue);
  const completed = toNumber(profile.stats?.completedCount ?? profile.stats?.totalContributions);
  const verificationRate = clamp(toNumber(profile.stats?.verificationRate));
  const ratingScore = clamp((toNumber(profile.ratingScore) / 5) * 100);

  const valueScore = clamp((totalValue / 100000) * 100);
  const completionScore = clamp((completed / 100) * 100);
  const trustScore = clamp((verificationRate + ratingScore) / 2);

  const totalScore = clamp(
    Math.round(valueScore * 0.35 + completionScore * 0.25 + trustScore * 0.4)
  );

  const nextRank =
    rankThresholds.find((threshold) => totalValue < threshold.minValue) ||
    rankThresholds[rankThresholds.length - 1];

  return {
    totalScore,
    valueScore,
    completionScore,
    trustScore,
    totalValue,
    nextRank,
    remainingToNext: Math.max(0, nextRank.minValue - totalValue),
  };
}

export default function CommunityBuilderDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch Community Builder settings for this user
  const { data: profile, isLoading: profileLoading } = useQuery<BuilderProfile>({
    queryKey: ["builderProfile"],
    queryFn: async () => {
      const res = await fetch("/api/community-builder/profile");
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ["builderNotifications"],
    queryFn: async () => {
      const res = await fetch("/api/community-builder/notifications?unreadOnly=true");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
  });

  // Fetch contributions
  const { data: contributions = [] } = useQuery({
    queryKey: ["builderContributions"],
    queryFn: async () => {
      const res = await fetch("/api/community-builder/contributions");
      if (res.status === 404) return [];
      if (!res.ok) throw new Error("Failed to fetch contributions");
      return res.json();
    },
  });

  const evaluation = profile ? computeBuilderEvaluation(profile) : null;

  const activateProfileMutation = useMutation({
    mutationFn: () => activateCommunityBuilder(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["builderProfile"] });
      toast({
        title: "Community Builder activated",
        description: "Your Community Builder badge is active.",
      });
    },
    onError: (error: Error) => {
      const activationError =
        error instanceof CommunityBuilderActivationError ? error : undefined;
      toast({
        title: "Activation unavailable",
        description: activationError?.action || error.message,
        variant: "destructive",
      });
    },
  });

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await fetch(`/api/community-builder/notifications/${notificationId}/read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to mark notification as read");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["builderNotifications"] });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not update notification status.",
        variant: "destructive",
      });
    },
  });

  const markAllNotificationsRead = async () => {
    if (!notifications?.length) return;
    await Promise.all(
      notifications.map((notification: any) =>
        markNotificationReadMutation.mutateAsync(notification.id)
      )
    );
    toast({ title: "Updated", description: "All visible notifications marked as read." });
  };

  if (!profile) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <Card className="border-2 border-indigo-200">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Start Your Community Builder Journey</CardTitle>
              <CardDescription>
                Claim your Community Builder badge and help decide what causes your local vault
                funds.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-2">
                <p className="text-white/60">
                  Community Builders contribute time, expertise, and resources to strengthen their
                  communities. Your badge sets you apart and lets you send and vote on which causes
                  get funded from the community vault.
                </p>
                <p className="text-sm text-white/60">
                  Want to support the broader Community Builder Fund directly?{" "}
                  <a
                    href="https://buy.stripe.com/cNi28r74reaSg392IV8N200"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 font-semibold hover:underline"
                  >
                    Donate here
                  </a>
                  .
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => activateProfileMutation.mutate()}
                disabled={activateProfileMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {activateProfileMutation.isPending
                  ? "Activating Community Builder..."
                  : "Activate Your Community Builder Badge"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white">
                {profile.businessName || "Community Builder"}
              </h1>
              <p className="text-white/60 mt-1">Dashboard</p>
            </div>
            <Badge className={`${rankColors[profile.currentRank]} text-lg px-4 py-2`}>
              {profile.currentRank.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-white/60 mt-2">
            Help seed projects across all counties by supporting the{" "}
            <a
              href="https://buy.stripe.com/cNi28r74reaSg392IV8N200"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 font-semibold hover:underline"
            >
              Community Builder Fund
            </a>
            .
          </p>
        </div>

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <Card className="border-2 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-yellow-900">
                  <AlertCircle className="w-5 h-5" />
                  You have {notifications.length} unread notification(s)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllNotificationsRead}
                  disabled={markNotificationReadMutation.isPending}
                >
                  Mark all read
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif: any) => (
                  <div
                    key={notif.id}
                    className="text-sm text-yellow-800 flex items-start justify-between gap-3"
                  >
                    <p>
                      <strong>{notif.title}:</strong> {notif.message}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markNotificationReadMutation.mutate(notif.id)}
                      disabled={markNotificationReadMutation.isPending}
                    >
                      Mark read
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-green-600" />
                <span className="text-2xl font-bold">${profile.stats.totalValue}</span>
              </div>
              <p className="text-xs text-white/60 mt-2">Lifetime contribution</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Hours Donated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                <span className="text-2xl font-bold">{profile.stats.totalHours}</span>
              </div>
              <p className="text-xs text-white/60 mt-2">Service hours</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
                <span className="text-2xl font-bold">{profile.stats.completedCount}</span>
              </div>
              <p className="text-xs text-white/60 mt-2">Verified & complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white/60">Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-yellow-600" />
                <span className="text-2xl font-bold">{profile.ratingScore?.toFixed(1) || "-"}</span>
              </div>
              <p className="text-xs text-white/60 mt-2">Internal signal (0-5)</p>
            </CardContent>
          </Card>
        </div>

        {/* Verification Status */}
        {evaluation && (
          <Card className="border-2 border-indigo-200 bg-indigo-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                <TrendingUp className="w-5 h-5" />
                Evaluation Snapshot
              </CardTitle>
              <CardDescription className="text-indigo-800">
                Community Builder evaluation reflects trust, delivery consistency, and verified
                contribution impact.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-indigo-700">Current score</p>
                  <p className="text-3xl font-bold text-indigo-900">{evaluation.totalScore}/100</p>
                </div>
                <div className="text-right text-sm text-indigo-700">
                  <p>Current rank: {profile.currentRank.toUpperCase()}</p>
                  <p>
                    Next milestone: {evaluation.nextRank.rank.toUpperCase()} at $
                    {evaluation.nextRank.minValue.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Trust quality", value: evaluation.trustScore },
                  { label: "Contribution completion", value: evaluation.completionScore },
                  { label: "Verified value impact", value: evaluation.valueScore },
                ].map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-indigo-800">
                      <span>{metric.label}</span>
                      <span>{Math.round(metric.value)}%</span>
                    </div>
                    <div className="h-2 rounded bg-indigo-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${Math.round(metric.value)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {evaluation.remainingToNext > 0 ? (
                <p className="text-sm text-indigo-800">
                  ${evaluation.remainingToNext.toLocaleString()} remaining to unlock the next rank
                  threshold.
                </p>
              ) : (
                <p className="text-sm text-indigo-800">
                  You&apos;re already at the top threshold. Keep contributing to strengthen local
                  trust.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!profile.isVerified ? (
          <Card className="border-2 border-ts-orange/30 bg-ts-orange/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ts-orange">
                <AlertCircle className="w-5 h-5" />
                Verification Pending
              </CardTitle>
              <CardDescription className="text-ts-orange">
                Complete your verification to improve trust quality and ranking readiness.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/verification")}
                className="bg-ts-orange-dark hover:bg-ts-orange-dark"
              >
                Complete Verification
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-2 border-emerald-200 bg-emerald-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <CheckCircle className="w-5 h-5" />
                Verification Active
              </CardTitle>
              <CardDescription className="text-emerald-800">
                Your verification is active. Keep your evidence quality high to stay in strong
                standing.
              </CardDescription>
            </CardHeader>
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
                onClick={() => navigate("/community-builder/contributions/new")}
              >
                + New Contribution
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contributions.length === 0 ? (
              <div className="text-center py-8 text-white/60">
                <p>No contributions yet. Start making an impact!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {contributions.slice(0, 5).map((contrib: any) => (
                  <div
                    key={contrib.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-white/5 cursor-pointer"
                    onClick={() => navigate(`/community-builder/contributions/${contrib.id}`)}
                  >
                    <div className="flex-1">
                      <p className="font-semibold">{contrib.title}</p>
                      <p className="text-sm text-white/60">
                        {contrib.description.substring(0, 100)}...
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline">{contrib.status}</Badge>
                        <span className="text-sm text-white/60">${contrib.estimatedValue}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      {contrib.status === "verified" && (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      )}
                      {contrib.status === "proposed" && (
                        <Clock className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
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
