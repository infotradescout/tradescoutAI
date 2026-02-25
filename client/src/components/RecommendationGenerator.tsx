import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  TrendingUp,
  Target,
  Users,
  Mail,
  Star,
  ChevronRight,
  Lightbulb,
  Trophy,
  ArrowUp,
} from "lucide-react";

interface RecommendationInsight {
  contractorId: string;
  totalRecommendations: number;
  positiveRecommendations: number;
  negativeRecommendations: number;
  averageRating: string;
  topStrengths: string[];
  improvementAreas: string[];
  suggestedActions: Array<{
    action: string;
    priority: "high" | "medium" | "low";
    impact: string;
    difficulty: string;
  }>;
  profileViews: number;
  inquiryRate: string;
  responseRate: string;
  marketPosition: "top_performer" | "above_average" | "average" | "below_average";
  competitorComparison: {
    totalContractors: number;
    betterThan: number;
    percentile: number;
  };
  aiRecommendations: Array<{
    category: string;
    suggestion: string;
    impact: "high" | "medium" | "low";
    timeframe: string;
  }>;
}

interface RecommendationGoal {
  id: string;
  contractorId: string;
  targetRecommendations: number;
  targetRating: number;
  targetTimeframe: string;
  startingRecommendations: number;
  currentProgress: string;
  isActive: boolean;
  createdAt: string;
}

interface RecommendationCampaign {
  id: string;
  contractorId: string;
  name: string;
  description?: string;
  campaignType: "email_followup" | "text_reminder" | "personal_ask" | "incentive_offer";
  targetCustomers: Array<{
    projectType?: string;
    projectValue?: number;
    completionDate?: string;
    email?: string;
    phone?: string;
  }>;
  frequency?: string;
  emailTemplate?: string;
  textTemplate?: string;
  incentiveOffer?: string;
  isActive: boolean;
  createdAt: string;
}

export default function RecommendationGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("insights");
  const [showNewGoalDialog, setShowNewGoalDialog] = useState(false);
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);

  // Fetch insights
  const {
    data: insights,
    isLoading: insightsLoading,
    refetch: refetchInsights,
  } = useQuery<RecommendationInsight>({
    queryKey: [`/api/contractors/${user?.id}/insights`],
    enabled: !!user?.id,
  });

  // Fetch goals
  const { data: goals = [], isLoading: goalsLoading } = useQuery<RecommendationGoal[]>({
    queryKey: [`/api/contractors/${user?.id}/goals`],
    enabled: !!user?.id,
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<RecommendationCampaign[]>({
    queryKey: [`/api/contractors/${user?.id}/campaigns`],
    enabled: !!user?.id,
  });

  // Refresh insights mutation
  const refreshInsightsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/contractors/${user?.id}/insights/refresh`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contractors/${user?.id}/insights`] });
      toast({
        title: "Insights Updated",
        description: "Your recommendation insights have been refreshed with the latest data.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: {
      targetRecommendations: number;
      targetRating: number;
      targetTimeframe: string;
    }) => {
      return await apiRequest("POST", `/api/contractors/${user?.id}/goals`, goalData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contractors/${user?.id}/goals`] });
      setShowNewGoalDialog(false);
      toast({
        title: "Goal Created",
        description: "Your new recommendation goal has been set successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create goal. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: {
      name: string;
      description?: string;
      campaignType: string;
      targetCustomers: any[];
      frequency?: string;
      emailTemplate?: string;
      textTemplate?: string;
      incentiveOffer?: string;
    }) => {
      return await apiRequest("POST", `/api/contractors/${user?.id}/campaigns`, campaignData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/contractors/${user?.id}/campaigns`] });
      setShowNewCampaignDialog(false);
      toast({
        title: "Campaign Created",
        description: "Your recommendation campaign has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getMarketPositionColor = (position: string) => {
    switch (position) {
      case "top_performer":
        return "text-green-600";
      case "above_average":
        return "text-blue-600";
      case "average":
        return "text-yellow-600";
      case "below_average":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const getMarketPositionLabel = (position: string) => {
    switch (position) {
      case "top_performer":
        return "Top Performer";
      case "above_average":
        return "Above Average";
      case "average":
        return "Average";
      case "below_average":
        return "Needs Improvement";
      default:
        return "Unknown";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!user) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
        <p className="text-gray-600">Please log in to access the recommendation generator.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="recommendation-generator">
      <div className="flex justify-between items-center">
        <div>
          <h1
            className="text-3xl font-bold text-gray-900"
            data-testid="title-recommendation-generator"
          >
            Smart Recommendation Generator
          </h1>
          <p className="text-gray-600 mt-2">
            Strengthen your business with data-driven insights and automated recommendation
            campaigns
          </p>
        </div>
        <Button
          onClick={() => refreshInsightsMutation.mutate()}
          disabled={refreshInsightsMutation.isPending}
          data-testid="button-refresh-insights"
        >
          {refreshInsightsMutation.isPending ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
          <TabsTrigger value="insights" data-testid="tab-insights">
            Performance Insights
          </TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">
            Goals & Progress
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            Outreach Campaigns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
          {insightsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : insights ? (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card data-testid="card-total-recommendations">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Recommendations</CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-recommendations">
                      {insights.totalRecommendations}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {insights.positiveRecommendations} positive,{" "}
                      {insights.negativeRecommendations} concerns
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-average-rating">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-average-rating">
                      {parseFloat(insights.averageRating).toFixed(1)}/5.0
                    </div>
                    <p className="text-xs text-muted-foreground">Based on customer feedback</p>
                  </CardContent>
                </Card>

                <Card data-testid="card-market-position">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Market Position</CardTitle>
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${getMarketPositionColor(insights.marketPosition)}`}
                      data-testid="text-market-position"
                    >
                      {getMarketPositionLabel(insights.marketPosition)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {insights.competitorComparison.percentile}th percentile
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-profile-views">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Profile Views</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-profile-views">
                      {insights.profileViews.toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>
              </div>

              {/* Strengths and Improvement Areas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card data-testid="card-top-strengths">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUp className="h-5 w-5 text-green-600" />
                      Top Strengths
                    </CardTitle>
                    <CardDescription>Your competitive advantages</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.topStrengths.length > 0 ? (
                        insights.topStrengths.map((strength, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-green-100 text-green-800"
                          >
                            {strength}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          Keep building your reputation to unlock strengths!
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-improvement-areas">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-600" />
                      Growth Opportunities
                    </CardTitle>
                    <CardDescription>Areas to focus on for better results</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {insights.improvementAreas.length > 0 ? (
                        insights.improvementAreas.map((area, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="border-yellow-200 text-yellow-800"
                          >
                            {area}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">
                          Great job! No immediate improvement areas identified.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Recommendations */}
              <Card data-testid="card-ai-recommendations">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                    AI-Powered Recommendations
                  </CardTitle>
                  <CardDescription>Smart suggestions to grow your business</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.aiRecommendations.map((rec, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{rec.category}</h4>
                          <Badge
                            variant={
                              rec.impact === "high"
                                ? "default"
                                : rec.impact === "medium"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {rec.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{rec.suggestion}</p>
                        <p className="text-xs text-gray-500">Timeframe: {rec.timeframe}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Suggested Actions */}
              <Card data-testid="card-suggested-actions">
                <CardHeader>
                  <CardTitle>Recommended Actions</CardTitle>
                  <CardDescription>
                    Prioritized steps to improve your recommendation rate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {insights.suggestedActions.map((action, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{action.action}</h4>
                          <Badge className={getPriorityColor(action.priority)}>
                            {action.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">Impact: {action.impact}</p>
                        <p className="text-xs text-gray-500">Difficulty: {action.difficulty}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
                <p className="text-gray-600 mb-4">
                  We need some recommendation data to generate insights.
                </p>
                <Button onClick={() => refreshInsightsMutation.mutate()}>
                  Generate Initial Insights
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Recommendation Goals</h2>
              <p className="text-gray-600">Set and track your recommendation targets</p>
            </div>
            <Dialog open={showNewGoalDialog} onOpenChange={setShowNewGoalDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-goal">
                  <Target className="h-4 w-4 mr-2" />
                  Set New Goal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Goal</DialogTitle>
                  <DialogDescription>
                    Set a specific target to track your recommendation growth
                  </DialogDescription>
                </DialogHeader>
                <NewGoalForm onSubmit={(data) => createGoalMutation.mutate(data)} />
              </DialogContent>
            </Dialog>
          </div>

          {goalsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
                    <div className="h-2 bg-gray-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : goals.length > 0 ? (
            <div className="space-y-4">
              {goals.map((goal) => (
                <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold">
                          {goal.targetRecommendations} Recommendations Goal
                        </h3>
                        <p className="text-sm text-gray-600">
                          Target Rating: {goal.targetRating}/5.0 • Timeframe: {goal.targetTimeframe}
                        </p>
                      </div>
                      <Badge variant={goal.isActive ? "default" : "secondary"}>
                        {goal.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{goal.currentProgress}%</span>
                      </div>
                      <Progress value={parseFloat(goal.currentProgress)} className="w-full" />
                      <p className="text-xs text-gray-500">
                        Started with {goal.startingRecommendations} recommendations
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Goals Set</h3>
                <p className="text-gray-600 mb-4">
                  Create your first recommendation goal to start tracking progress.
                </p>
                <Button onClick={() => setShowNewGoalDialog(true)}>Set Your First Goal</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Outreach Campaigns</h2>
              <p className="text-gray-600">
                Automated campaigns to request recommendations from customers
              </p>
            </div>
            <Dialog open={showNewCampaignDialog} onOpenChange={setShowNewCampaignDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-campaign">
                  <Mail className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                  <DialogDescription>
                    Set up an automated campaign to reach out to customers for recommendations
                  </DialogDescription>
                </DialogHeader>
                <NewCampaignForm onSubmit={(data) => createCampaignMutation.mutate(data)} />
              </DialogContent>
            </Dialog>
          </div>

          {campaignsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : campaigns.length > 0 ? (
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <p className="text-sm text-gray-600">{campaign.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{campaign.campaignType.replace("_", " ")}</Badge>
                        <Badge variant={campaign.isActive ? "default" : "secondary"}>
                          {campaign.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <p>Target Customers: {campaign.targetCustomers.length}</p>
                      {campaign.frequency && <p>Frequency: {campaign.frequency}</p>}
                      <p>Created: {new Date(campaign.createdAt).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaigns Created</h3>
                <p className="text-gray-600 mb-4">
                  Create your first outreach campaign to start gathering recommendations.
                </p>
                <Button onClick={() => setShowNewCampaignDialog(true)}>
                  Create First Campaign
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// New Goal Form Component
function NewGoalForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    targetRecommendations: 10,
    targetRating: 4.5,
    targetTimeframe: "90_days",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="targetRecommendations">Target Recommendations</Label>
        <Input
          id="targetRecommendations"
          type="number"
          min="1"
          value={formData.targetRecommendations}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, targetRecommendations: parseInt(e.target.value) }))
          }
          data-testid="input-target-recommendations"
        />
      </div>

      <div>
        <Label htmlFor="targetRating">Target Average Rating</Label>
        <Input
          id="targetRating"
          type="number"
          min="1"
          max="5"
          step="0.1"
          value={formData.targetRating}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, targetRating: parseFloat(e.target.value) }))
          }
          data-testid="input-target-rating"
        />
      </div>

      <div>
        <Label htmlFor="targetTimeframe">Timeframe</Label>
        <Select
          value={formData.targetTimeframe}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, targetTimeframe: value }))}
        >
          <SelectTrigger data-testid="select-target-timeframe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30_days">30 Days</SelectItem>
            <SelectItem value="90_days">90 Days</SelectItem>
            <SelectItem value="6_months">6 Months</SelectItem>
            <SelectItem value="1_year">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" data-testid="button-create-goal">
        Create Goal
      </Button>
    </form>
  );
}

// New Campaign Form Component
function NewCampaignForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    campaignType: "email_followup",
    frequency: "once",
    emailTemplate: "",
    textTemplate: "",
    incentiveOffer: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      targetCustomers: [], // Would be populated from customer selection
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="campaignName">Campaign Name</Label>
        <Input
          id="campaignName"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g., Winter Follow-up Campaign"
          required
          data-testid="input-campaign-name"
        />
      </div>

      <div>
        <Label htmlFor="campaignDescription">Description</Label>
        <Textarea
          id="campaignDescription"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Brief description of the campaign..."
          data-testid="textarea-campaign-description"
        />
      </div>

      <div>
        <Label htmlFor="campaignType">Campaign Type</Label>
        <Select
          value={formData.campaignType}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, campaignType: value }))}
        >
          <SelectTrigger data-testid="select-campaign-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="email_followup">Email Follow-up</SelectItem>
            <SelectItem value="text_reminder">Text Reminder</SelectItem>
            <SelectItem value="personal_ask">Personal Ask</SelectItem>
            <SelectItem value="incentive_offer">Incentive Offer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="frequency">Frequency</Label>
        <Select
          value={formData.frequency}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, frequency: value }))}
        >
          <SelectTrigger data-testid="select-frequency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">One-time</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.campaignType === "email_followup" && (
        <div>
          <Label htmlFor="emailTemplate">Email Template</Label>
          <Textarea
            id="emailTemplate"
            value={formData.emailTemplate}
            onChange={(e) => setFormData((prev) => ({ ...prev, emailTemplate: e.target.value }))}
            placeholder="Enter your email template here..."
            rows={4}
            data-testid="textarea-email-template"
          />
        </div>
      )}

      {formData.campaignType === "text_reminder" && (
        <div>
          <Label htmlFor="textTemplate">Text Message Template</Label>
          <Textarea
            id="textTemplate"
            value={formData.textTemplate}
            onChange={(e) => setFormData((prev) => ({ ...prev, textTemplate: e.target.value }))}
            placeholder="Enter your text message template here..."
            rows={3}
            data-testid="textarea-text-template"
          />
        </div>
      )}

      {formData.campaignType === "incentive_offer" && (
        <div>
          <Label htmlFor="incentiveOffer">Incentive Offer</Label>
          <Input
            id="incentiveOffer"
            value={formData.incentiveOffer}
            onChange={(e) => setFormData((prev) => ({ ...prev, incentiveOffer: e.target.value }))}
            placeholder="e.g., 10% off next service"
            data-testid="input-incentive-offer"
          />
        </div>
      )}

      <Button type="submit" className="w-full" data-testid="button-create-campaign">
        Create Campaign
      </Button>
    </form>
  );
}
