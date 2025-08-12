import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Trophy, 
  Star, 
  TrendingUp, 
  Award,
  Crown,
  Medal,
  MapPin,
  Calendar,
  Users,
  Target,
  CheckCircle
} from "lucide-react";

interface ContractorRanking {
  id: string;
  companyName: string;
  profileImage?: string;
  monthlyRecommendations: number;
  lifetimeRecommendations: number;
  averageRating: number;
  completedJobs: number;
  location: string;
  trades: string[];
  verificationStatus: 'verified' | 'pending' | 'unverified';
  rank: number;
  previousRank?: number;
  joinDate: string;
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState("monthly");
  const [selectedState, setSelectedState] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");

  // Fetch monthly rankings
  const { data: monthlyRankings, isLoading: monthlyLoading } = useQuery<ContractorRanking[]>({
    queryKey: ['/api/leaderboard/monthly', selectedState, selectedTrade],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState) params.append('state', selectedState);
      if (selectedTrade) params.append('trade', selectedTrade);
      
      const response = await fetch(`/api/leaderboard/monthly?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch monthly rankings');
      return response.json();
    },
    enabled: activeTab === "monthly",
  });

  // Fetch lifetime rankings
  const { data: lifetimeRankings, isLoading: lifetimeLoading } = useQuery<ContractorRanking[]>({
    queryKey: ['/api/leaderboard/lifetime', selectedState, selectedTrade],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState) params.append('state', selectedState);
      if (selectedTrade) params.append('trade', selectedTrade);
      
      const response = await fetch(`/api/leaderboard/lifetime?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch lifetime rankings');
      return response.json();
    },
    enabled: activeTab === "lifetime",
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-orange-600" />;
      default:
        return <span className="text-lg font-bold text-gray-400">#{rank}</span>;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      const colors = {
        1: 'bg-yellow-500',
        2: 'bg-gray-400',
        3: 'bg-orange-600'
      };
      return <Badge className={`${colors[rank as keyof typeof colors]} text-white`}>#{rank}</Badge>;
    }
    return <Badge variant="outline" className="border-slate-600 text-slate-400">#{rank}</Badge>;
  };

  const getTrendIcon = (rank: number, previousRank?: number) => {
    if (!previousRank) return null;
    
    if (rank < previousRank) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (rank > previousRank) {
      return <TrendingUp className="h-4 w-4 text-red-500 transform rotate-180" />;
    }
    return <div className="h-4 w-4" />; // Placeholder for no change
  };

  const formatJoinDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderRankingsList = (rankings: ContractorRanking[], isLoading: boolean) => {
    if (isLoading) {
      return Array.from({ length: 10 }).map((_, i) => (
        <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="w-6 h-6 bg-slate-600 rounded"></div>
              <div className="w-12 h-12 bg-slate-600 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-600 rounded mb-2"></div>
                <div className="h-3 bg-slate-600 rounded w-1/2"></div>
              </div>
              <div className="h-8 w-16 bg-slate-600 rounded"></div>
            </div>
          </CardContent>
        </Card>
      ));
    }

    if (!rankings || rankings.length === 0) {
      return (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-12 text-center">
            <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-400">No contractors found for the selected criteria.</p>
          </CardContent>
        </Card>
      );
    }

    return rankings.map((contractor) => (
      <Card key={contractor.id} className={`bg-slate-800 border-slate-700 hover:border-orange-500/50 transition-colors ${
        contractor.rank <= 3 ? 'border-orange-500/30' : ''
      }`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {getRankIcon(contractor.rank)}
                {getTrendIcon(contractor.rank, contractor.previousRank)}
              </div>
              
              <Avatar className="h-12 w-12">
                <AvatarImage src={contractor.profileImage} />
                <AvatarFallback className="bg-slate-600">
                  {contractor.companyName.split(' ').map(word => word[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-white">{contractor.companyName}</h3>
                  {contractor.verificationStatus === 'verified' && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  {getRankBadge(contractor.rank)}
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-400">
                  <div className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {contractor.location}
                  </div>
                  <div className="flex items-center">
                    <Star className="h-3 w-3 mr-1 text-yellow-500" />
                    {contractor.averageRating.toFixed(1)}
                  </div>
                  <div className="flex items-center">
                    <Target className="h-3 w-3 mr-1" />
                    {contractor.completedJobs} jobs
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  {contractor.trades.slice(0, 3).map((trade, index) => (
                    <Badge key={index} variant="outline" className="border-slate-600 text-slate-400 text-xs">
                      {trade}
                    </Badge>
                  ))}
                  {contractor.trades.length > 3 && (
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-xs">
                      +{contractor.trades.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-500 mb-1">
                {activeTab === "monthly" ? contractor.monthlyRecommendations : contractor.lifetimeRecommendations}
              </div>
              <div className="text-sm text-gray-400">
                {activeTab === "monthly" ? "This Month" : "All Time"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Since {formatJoinDate(contractor.joinDate)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Contractor Leaderboard</h1>
        <p className="text-gray-300">Top contractors by customer recommendations</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-800 border-slate-700">
          <TabsTrigger value="monthly" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            <Calendar className="h-4 w-4 mr-2" />
            Monthly Rankings
          </TabsTrigger>
          <TabsTrigger value="lifetime" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            <Trophy className="h-4 w-4 mr-2" />
            Lifetime Rankings
          </TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="">All States</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All Trades" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="">All Trades</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="roofing">Roofing</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="painting">Painting</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2 text-sm text-gray-400">
                <Users className="h-4 w-4" />
                <span>Updated hourly</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="monthly" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white mb-2">This Month's Leaders</h2>
            <p className="text-gray-400 text-sm">Rankings reset automatically on the 1st of each month</p>
          </div>
          {renderRankingsList(monthlyRankings || [], monthlyLoading)}
        </TabsContent>

        <TabsContent value="lifetime" className="space-y-4">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white mb-2">All-Time Champions</h2>
            <p className="text-gray-400 text-sm">Lifetime achievement rankings since joining TradeScout</p>
          </div>
          {renderRankingsList(lifetimeRankings || [], lifetimeLoading)}
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="bg-slate-800 border-slate-700 mt-8">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Trophy className="h-5 w-5 mr-2 text-orange-500" />
            How Rankings Work
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-300">
          <p>• Rankings are based on verified customer recommendations</p>
          <p>• Monthly rankings reset on the 1st of each month</p>
          <p>• Lifetime rankings track all-time performance</p>
          <p>• Only verified contractors with active status are included</p>
          <p>• Rankings are updated hourly to reflect recent recommendations</p>
        </CardContent>
      </Card>
    </div>
  );
}