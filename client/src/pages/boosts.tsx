import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Zap, Eye, MousePointer, Target, Calendar, DollarSign, BarChart3 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Boost {
  id: string;
  title: string;
  description: string;
  boostType: string;
  targetRole: string;
  price: string;
  duration: number;
  multiplier: number;
  features: string[];
  isActive: boolean;
  categoryTags: string[];
}

interface UserBoost {
  id: string;
  userId: string;
  boostId: string;
  status: string;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  conversions: number;
  totalSpent: string;
}

export default function Boosts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedBoost, setSelectedBoost] = useState<string | null>(null);

  const { data: availableBoosts = [], isLoading: boostsLoading } = useQuery({
    queryKey: ['/api/boosts/available'],
  });

  const { data: userBoosts = [], isLoading: userBoostsLoading } = useQuery({
    queryKey: ['/api/boosts/user'],
  });

  const purchaseBoostMutation = useMutation({
    mutationFn: async (boostData: { boostId: string; paymentMethodId?: string }) => {
      const response = await fetch('/api/boosts/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boostData)
      });
      if (!response.ok) throw new Error('Failed to purchase boost');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Boost Activated!",
        description: "Your promotional boost is now active and driving more visibility.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/boosts/user'] });
    },
    onError: () => {
      toast({
        title: "Purchase Failed",
        description: "Unable to activate boost. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePurchaseBoost = (boostId: string) => {
    purchaseBoostMutation.mutate({ boostId });
  };

  const getTimeRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} days remaining` : 'Expired';
  };

  const getProgressPercentage = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  if (boostsLoading || userBoostsLoading) {
    return (
      <div className="min-h-screen gradient-bg p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-slate-400">Loading boost options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg p-6" data-testid="boosts-page">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white">Promotional Boosts</h1>
          </div>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Amplify your visibility and reach more customers with targeted promotional campaigns designed for {user?.role || 'professionals'}.
          </p>
        </div>

        {/* Active Boosts Section */}
        {userBoosts && userBoosts.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
              <Zap className="w-6 h-6 text-yellow-500" />
              <span>Your Active Boosts</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userBoosts.map((userBoost: UserBoost) => {
                const boost = availableBoosts?.find((b: Boost) => b.id === userBoost.boostId);
                const progress = getProgressPercentage(userBoost.startDate, userBoost.endDate);
                
                return (
                  <Card key={userBoost.id} className="bg-slate-800/50 border-slate-700 hover:border-orange-500/50 transition-all duration-300">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-lg">{boost?.title}</CardTitle>
                        <Badge variant={userBoost.status === 'active' ? 'default' : 'secondary'} className="bg-green-500/20 text-green-400">
                          {userBoost.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Progress value={progress} className="h-2" />
                        <p className="text-sm text-slate-400">{getTimeRemaining(userBoost.endDate)}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center space-x-1">
                            <Eye className="w-4 h-4 text-blue-400" />
                            <span className="text-lg font-bold text-white">{userBoost.impressions.toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-400">Views</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center space-x-1">
                            <MousePointer className="w-4 h-4 text-green-400" />
                            <span className="text-lg font-bold text-white">{userBoost.clicks}</span>
                          </div>
                          <p className="text-xs text-slate-400">Clicks</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center space-x-1">
                            <Target className="w-4 h-4 text-purple-400" />
                            <span className="text-lg font-bold text-white">{userBoost.conversions}</span>
                          </div>
                          <p className="text-xs text-slate-400">Leads</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full" data-testid={`analytics-${userBoost.id}`}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Analytics
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Boosts Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-orange-500" />
            <span>Available Boosts</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableBoosts?.map((boost: Boost) => (
              <Card 
                key={boost.id} 
                className={`bg-slate-800/50 border-slate-700 hover:border-orange-500/50 transition-all duration-300 cursor-pointer ${
                  selectedBoost === boost.id ? 'border-orange-500 ring-2 ring-orange-500/20' : ''
                }`}
                onClick={() => setSelectedBoost(selectedBoost === boost.id ? null : boost.id)}
                data-testid={`boost-card-${boost.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-white text-xl">{boost.title}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary" className="bg-orange-500/20 text-orange-400">
                          {boost.multiplier}x boost
                        </Badge>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {boost.duration} days
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-400">${boost.price}</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-slate-300 text-sm leading-relaxed">{boost.description}</p>
                  
                  <div className="space-y-2">
                    <h4 className="text-white font-medium text-sm">Features included:</h4>
                    <ul className="space-y-1">
                      {boost.features.map((feature, index) => (
                        <li key={index} className="text-slate-400 text-sm flex items-center space-x-2">
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Separator className="bg-slate-700" />
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePurchaseBoost(boost.id);
                    }}
                    disabled={purchaseBoostMutation.isPending}
                    data-testid={`purchase-boost-${boost.id}`}
                  >
                    {purchaseBoostMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Activate Boost
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Benefits Information */}
        <Card className="bg-slate-800/30 border-slate-700">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold text-white">Why Use Promotional Boosts?</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Eye className="w-8 h-8 text-blue-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">Increased Visibility</h4>
                  <p className="text-slate-400">Get up to 10x more views on your listings and services with premium placement.</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">Quality Leads</h4>
                  <p className="text-slate-400">Attract serious buyers and clients who are ready to make decisions.</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
                    <BarChart3 className="w-8 h-8 text-purple-400" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">Track Performance</h4>
                  <p className="text-slate-400">Monitor your ROI with detailed analytics and performance metrics.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}