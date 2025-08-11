import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { 
  Trophy, 
  Medal, 
  Award, 
  Star, 
  Users, 
  Calendar,
  TrendingUp,
  Crown
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  contractorId: string;
  companyName: string;
  slug: string;
  monthlyRecommendations?: number;
  lifetimeRecommendations: number;
  monthlyRating?: string;
  lifetimeRating: string;
}

export default function Leaderboard() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Fetch monthly leaderboard
  const { data: monthlyLeaderboard = [], isLoading: monthlyLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/monthly", { month: selectedMonth, year: selectedYear, limit: 20 }],
  });

  // Fetch lifetime leaderboard
  const { data: lifetimeLeaderboard = [], isLoading: lifetimeLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/lifetime", { limit: 20 }],
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const renderLeaderboardEntry = (entry: LeaderboardEntry, type: 'monthly' | 'lifetime') => {
    const recommendations = type === 'monthly' ? entry.monthlyRecommendations || 0 : entry.lifetimeRecommendations;
    const rating = type === 'monthly' ? entry.monthlyRating : entry.lifetimeRating;

    return (
      <div
        key={`${type}-${entry.contractorId}`}
        className={`flex items-center p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
          entry.rank <= 3 ? 'bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex items-center space-x-3">
            {getRankIcon(entry.rank)}
            <Badge className={getRankBadgeColor(entry.rank)}>
              #{entry.rank}
            </Badge>
          </div>

          <div className="flex-1">
            <Link href={`/contractors/${entry.slug}`}>
              <h3 className="font-semibold text-lg hover:text-orange-600 transition-colors cursor-pointer">
                {entry.companyName}
              </h3>
            </Link>
          </div>

          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{recommendations}</span>
              <span className="text-gray-500">recommendations</span>
            </div>

            {rating && (
              <div className="flex items-center space-x-2">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">{parseFloat(rating).toFixed(1)}</span>
                <span className="text-gray-500">avg rating</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-600 to-orange-400 bg-clip-text text-transparent">
          Top Investment Partners
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Meet the asset specialists who consistently deliver exceptional value and client returns
        </p>
      </div>

      <Tabs defaultValue="monthly" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList className="grid w-full sm:w-auto grid-cols-2">
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Monthly Leaders
            </TabsTrigger>
            <TabsTrigger value="lifetime" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              All-Time Champions
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Monthly Leaders - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
              <CardDescription>
                Rankings reset every month. Contractors are ranked by total recommendations received.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : monthlyLeaderboard.length > 0 ? (
                <div className="space-y-3">
                  {monthlyLeaderboard.map((entry) => renderLeaderboardEntry(entry, 'monthly'))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No recommendations yet this month</p>
                  <p>Be the first contractor to receive recommendations!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lifetime">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                All-Time Champions
              </CardTitle>
              <CardDescription>
                Hall of fame showing contractors with the most recommendations throughout their TradeScout journey.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lifetimeLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : lifetimeLeaderboard.length > 0 ? (
                <div className="space-y-3">
                  {lifetimeLeaderboard.map((entry) => renderLeaderboardEntry(entry, 'lifetime'))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Crown className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No lifetime recommendations yet</p>
                  <p>Start building your reputation on TradeScout!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 text-center">
        <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950 dark:to-yellow-950 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-2">Want to join the leaderboard?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Provide excellent service and earn recommendations from satisfied customers
            </p>
            <Link href="/contractors">
              <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white">
                Join as Contractor
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}