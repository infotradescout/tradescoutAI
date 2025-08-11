import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Users,
  MapPin,
  Flag,
  Scale,
  Shield
} from "lucide-react";
import type { ModerationReport, ModerationVote, UserModerationReputation } from "@shared/schema";

interface ModerationReportWithVotes extends ModerationReport {
  votes?: ModerationVote[];
  canVote?: boolean;
}

export default function ModerationCenter() {
  const [selectedContentType, setSelectedContentType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's moderation reputation
  const { data: userReputation } = useQuery<UserModerationReputation>({
    queryKey: ["/api/moderation/reputation"],
  });

  // Fetch moderation reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery<ModerationReportWithVotes[]>({
    queryKey: ["/api/moderation/reports", { 
      status: selectedStatus === "all" ? undefined : selectedStatus,
      contentType: selectedContentType === "all" ? undefined : selectedContentType
    }],
  });

  // Vote on report mutation
  const voteMutation = useMutation({
    mutationFn: async ({ reportId, vote }: { reportId: string; vote: string }) => {
      return apiRequest("POST", `/api/moderation/reports/${reportId}/vote`, { vote });
    },
    onSuccess: () => {
      toast({
        title: "Vote Submitted",
        description: "Your vote has been recorded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/moderation/reports"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Vote Failed",
        description: error.message || "Failed to submit vote",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "resolved": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "escalated": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case "contractor_profile": return <Users className="h-4 w-4" />;
      case "handmade_product": return <Shield className="h-4 w-4" />;
      case "food_listing": return <AlertTriangle className="h-4 w-4" />;
      case "social_post": return <Flag className="h-4 w-4" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getVoteIcon = (vote: string) => {
    switch (vote) {
      case "remove": return <XCircle className="h-4 w-4 text-red-500" />;
      case "keep": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "needs_review": return <Eye className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const handleVote = (reportId: string, vote: string) => {
    voteMutation.mutate({ reportId, vote });
  };

  if (!userReputation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Loading your moderation reputation...
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!userReputation.canVote) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            You are not currently eligible to participate in community moderation. 
            This may be due to account age, address verification status, or moderation history.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Community Moderation Center</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Help keep our community safe by reviewing and voting on reported content
        </p>
      </div>

      {/* User Reputation Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Your Moderation Reputation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{userReputation.reputationScore}</div>
              <div className="text-sm text-gray-500">Reputation Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{userReputation.totalVotesCast}</div>
              <div className="text-sm text-gray-500">Votes Cast</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{userReputation.totalReportsSubmitted}</div>
              <div className="text-sm text-gray-500">Reports Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {userReputation.totalReportsSubmitted > 0 
                  ? Math.round((userReputation.accurateReports / userReputation.totalReportsSubmitted) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-gray-500">Report Accuracy</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="mb-6">
        <Tabs defaultValue="pending" onValueChange={setSelectedStatus}>
          <TabsList>
            <TabsTrigger value="all">All Reports</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
            <TabsTrigger value="escalated">Escalated</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Reports List */}
      {reportsLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Reports Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              There are no reports to review in this category.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <Card key={report.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getContentTypeIcon(report.contentType)}
                    <div>
                      <CardTitle className="text-lg">
                        {report.contentType.replace('_', ' ').toUpperCase()} Report
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3" />
                        {report.contentCounty}, {report.contentState}
                        <Separator orientation="vertical" className="h-4" />
                        <Clock className="h-3 w-3" />
                        {new Date(report.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge className={getStatusColor(report.status)}>
                    {report.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4">
                  {/* Report Details */}
                  <div>
                    <h4 className="font-semibold mb-2">Reason for Report:</h4>
                    <p className="text-gray-700 dark:text-gray-300">{report.reason}</p>
                  </div>

                  {report.description && (
                    <div>
                      <h4 className="font-semibold mb-2">Additional Details:</h4>
                      <p className="text-gray-700 dark:text-gray-300">{report.description}</p>
                    </div>
                  )}

                  {/* Voting Statistics */}
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Community Votes</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-xl font-bold">{report.totalVotes}</div>
                        <div className="text-sm text-gray-500">Total Votes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-red-600">{report.removeVotes}</div>
                        <div className="text-sm text-gray-500">Remove</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-600">{report.keepVotes}</div>
                        <div className="text-sm text-gray-500">Keep</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-600">{report.reviewVotes}</div>
                        <div className="text-sm text-gray-500">Review</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>Progress to Decision</span>
                        <span>{report.totalVotes} / {report.votesRequired} votes</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${Math.min((report.totalVotes / report.votesRequired) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Voting Buttons */}
                  {report.status === "pending" && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">Cast Your Vote</h4>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVote(report.id, "remove")}
                          disabled={voteMutation.isPending}
                          className="flex items-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Remove Content
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVote(report.id, "keep")}
                          disabled={voteMutation.isPending}
                          className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Keep Content
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVote(report.id, "needs_review")}
                          disabled={voteMutation.isPending}
                          className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          <Eye className="h-4 w-4" />
                          Needs Review
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Final Action */}
                  {report.finalAction && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">Final Action:</span>
                        <Badge variant="secondary">{report.finalAction.replace('_', ' ')}</Badge>
                        {report.actionReason && (
                          <span className="text-gray-600">- {report.actionReason}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}