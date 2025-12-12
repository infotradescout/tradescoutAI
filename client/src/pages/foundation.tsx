import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  MapPin, 
  DollarSign, 
  Users, 
  Target,
  TrendingUp,
  Calendar,
  Gift,
  Shield,
  CheckCircle,
  Award,
  Building,
  School,
  Hospital,
  TreePine,
  Home,
  Utensils
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { sanitizeAreaLabel } from "@/lib/copyHelpers";

interface Cause {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  county: string;
  state: string;
  targetAmount: number;
  currentAmount: number;
  donorCount: number;
  organizationName: string;
  organizationVerified: boolean;
  imageUrl?: string;
  urgency: 'low' | 'medium' | 'high';
  endDate?: string;
  featured: boolean;
}

interface Donation {
  id: string;
  causeId: string;
  amount: number;
  anonymous: boolean;
  donorName?: string;
  message?: string;
  createdAt: string;
}

const CAUSE_CATEGORIES = [
  { id: 'education', name: 'Education', icon: School, description: 'Schools, scholarships, and educational programs' },
  { id: 'healthcare', name: 'Healthcare', icon: Hospital, description: 'Medical care, health programs, and wellness initiatives' },
  { id: 'environment', name: 'Environment', icon: TreePine, description: 'Conservation, sustainability, and environmental protection' },
  { id: 'housing', name: 'Housing', icon: Home, description: 'Affordable housing, homelessness prevention, and shelter' },
  { id: 'community', name: 'Community', icon: Building, description: 'Local infrastructure, community centers, and public spaces' },
  { id: 'food', name: 'Food Security', icon: Utensils, description: 'Food banks, nutrition programs, and hunger relief' },
  { id: 'youth', name: 'Youth Programs', icon: Users, description: 'Youth development, sports, and after-school programs' },
  { id: 'seniors', name: 'Senior Care', icon: Heart, description: 'Elder care, senior programs, and support services' },
  { id: 'emergency', name: 'Emergency Relief', icon: Shield, description: 'Disaster relief, emergency assistance, and crisis support' },
];

export default function Foundation() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("causes");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [sortBy, setSortBy] = useState("trending");
  const [donationAmount, setDonationAmount] = useState("");
  const [selectedCause, setSelectedCause] = useState<Cause | null>(null);

  // Fetch causes
  const { data: causes, isLoading: causesLoading } = useQuery<Cause[]>({
    queryKey: ['/api/foundation/causes', selectedCategory, selectedState, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedState) params.append('state', selectedState);
      if (sortBy) params.append('sort', sortBy);
      
      const response = await fetch(`/api/foundation/causes?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch causes');
      return response.json();
    },
    enabled: activeTab === "causes",
  });

  // Fetch user donations
  const { data: userDonations } = useQuery<Donation[]>({
    queryKey: ['/api/foundation/my-donations'],
    enabled: isAuthenticated && activeTab === "my-donations",
  });

  // Fetch impact stats
  const { data: impactStats } = useQuery({
    queryKey: ['/api/foundation/impact'],
    enabled: activeTab === "impact",
  });

  const { data: vaultSnapshot, isLoading: vaultLoading } = useQuery({
    queryKey: ['/api/vaults/my-county'],
    queryFn: async () => {
      const res = await fetch('/api/vaults/my-county');
      if (res.status === 400) return null;
      if (!res.ok) throw new Error('Failed to load vault');
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // Donation mutation
  const donateMutation = useMutation({
    mutationFn: async ({ causeId, amount, anonymous, message }: { 
      causeId: string; 
      amount: number; 
      anonymous: boolean; 
      message?: string; 
    }) => {
      return apiRequest('POST', `/api/foundation/donate`, { 
        causeId, 
        amount, 
        anonymous, 
        message 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/foundation/causes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/foundation/my-donations'] });
      toast({
        title: "Donation Successful",
        description: "Thank you for your contribution to the community!",
      });
      setSelectedCause(null);
      setDonationAmount("");
    },
    onError: (error) => {
      toast({
        title: "Donation Failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    },
  });

  const handleDonate = (cause: Cause) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign In Required",
        description: "Please sign in to make a donation.",
        variant: "destructive",
      });
      return;
    }
    setSelectedCause(cause);
  };

  const submitDonation = (anonymous: boolean, message?: string) => {
    if (!selectedCause || !donationAmount) return;
    
    const amount = parseFloat(donationAmount);
    if (amount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Minimum donation is $1.00",
        variant: "destructive",
      });
      return;
    }

    donateMutation.mutate({
      causeId: selectedCause.id,
      amount,
      anonymous,
      message,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = CAUSE_CATEGORIES.find(cat => cat.id === categoryId);
    return category ? category.icon : Heart;
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return <Badge className="bg-red-500">Urgent</Badge>;
      case 'medium':
        return <Badge className="bg-orange-500">Important</Badge>;
      case 'low':
        return <Badge className="bg-blue-500">Ongoing</Badge>;
      default:
        return <Badge variant="outline">Standard</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">TradeScout Foundation</h1>
        <p className="text-gray-300">Supporting communities across America through local charitable giving</p>
      </div>

      {isAuthenticated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Your Community Vault</p>
                  <h3 className="text-xl font-semibold text-white">
                    {vaultSnapshot?.county
                      ? `${sanitizeAreaLabel(vaultSnapshot.county.name)}, ${vaultSnapshot.county.stateCode}`
                      : "Add your area in profile"}
                  </h3>
                </div>
                <Badge className="bg-green-600 text-white">Transparent</Badge>
              </div>
              <p className="text-3xl font-bold text-white">
                {vaultLoading ? 'Loading…' : formatCurrency(vaultSnapshot?.vault?.currentBalance ?? 0)}
              </p>
              <p className="text-sm text-gray-400">Funds earmarked for your community</p>
              <div className="mt-4 flex items-center space-x-3 text-sm text-gray-300">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span>Last 30d inflow: {formatCurrency(vaultSnapshot?.last30dInflow ?? 0)}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {vaultSnapshot?.sourcesBreakdown && Object.keys(vaultSnapshot.sourcesBreakdown).length > 0 ? (
                  Object.entries(vaultSnapshot.sourcesBreakdown).map(([source, amount]) => (
                    <Badge key={source} variant="outline" className="border-slate-600 text-slate-200">
                      {source.replace(/_/g, ' ')} · {formatCurrency(amount as number)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">No contributions recorded yet</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-400">Community Builders</p>
                  <h3 className="text-xl font-semibold text-white">Fuel the vault</h3>
                </div>
                <Badge variant="outline" className="border-orange-500 text-orange-300">Give back</Badge>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                Donations, marketplace givebacks, and contractor programs all ladder into your community vault. Every dollar is traceable.
              </p>
              <div className="flex items-center space-x-3">
                <Button asChild className="bg-orange-500 hover:bg-orange-600">
                  <Link href="/community-builder">Join as Community Builder</Link>
                </Button>
                <Button asChild variant="outline" className="border-slate-600 text-white hover:border-orange-500">
                  <Link href="/foundation?tab=impact">View impact</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-orange-500 text-orange-300 hover:bg-orange-500/10"
                >
                  <a
                    href="https://buy.stripe.com/cNi28r74reaSg392IV8N200"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Support Builder Fund
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-800 border-slate-700">
          <TabsTrigger value="causes" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Local Causes
          </TabsTrigger>
          <TabsTrigger value="impact" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Our Impact
          </TabsTrigger>
          <TabsTrigger value="my-donations" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            My Donations
          </TabsTrigger>
          <TabsTrigger value="corporate" className="text-slate-300 data-[state=active]:text-white data-[state=active]:bg-slate-700">
            Corporate Program
          </TabsTrigger>
        </TabsList>

        <TabsContent value="causes" className="space-y-6">
          {/* Filters */}
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All Categories</SelectItem>
                    {CAUSE_CATEGORIES.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="State" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">All States</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="trending">Trending</SelectItem>
                    <SelectItem value="urgent">Most Urgent</SelectItem>
                    <SelectItem value="progress">Nearly Funded</SelectItem>
                    <SelectItem value="newest">Recently Added</SelectItem>
                  </SelectContent>
                </Select>

                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Gift className="h-4 w-4 mr-2" />
                  Suggest Cause
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Featured Causes */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Featured Causes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {causesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-slate-800 border-slate-700 animate-pulse">
                    <div className="h-48 bg-slate-700 rounded-t-lg"></div>
                    <CardContent className="p-6">
                      <div className="h-4 bg-slate-700 rounded mb-2"></div>
                      <div className="h-6 bg-slate-700 rounded mb-4"></div>
                      <div className="h-2 bg-slate-700 rounded mb-2"></div>
                      <div className="h-4 bg-slate-700 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))
              ) : (causes && causes.length > 0) ? (
                causes.map((cause) => {
                  const IconComponent = getCategoryIcon(cause.category);
                  const progressPercentage = getProgressPercentage(cause.currentAmount, cause.targetAmount);
                  
                  return (
                    <Card key={cause.id} className="bg-slate-800 border-slate-700 hover:border-orange-500/50 transition-colors">
                      <div className="relative">
                        <div className="h-48 bg-slate-700 rounded-t-lg flex items-center justify-center">
                          <IconComponent className="h-16 w-16 text-slate-500" />
                        </div>
                        {cause.featured && (
                          <Badge className="absolute top-2 right-2 bg-orange-500">
                            Featured
                          </Badge>
                        )}
                        <div className="absolute top-2 left-2">
                          {getUrgencyBadge(cause.urgency)}
                        </div>
                      </div>
                      
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="border-slate-600 text-slate-400">
                            {CAUSE_CATEGORIES.find(c => c.id === cause.category)?.name}
                          </Badge>
                          {cause.organizationVerified && (
                            <div className="flex items-center">
                              <Shield className="h-4 w-4 text-green-500 mr-1" />
                              <span className="text-xs text-green-400">Verified</span>
                            </div>
                          )}
                        </div>

                        <h3 className="font-semibold text-white mb-2 line-clamp-2">{cause.title}</h3>
                        <p className="text-gray-300 text-sm mb-4 line-clamp-3">{cause.description}</p>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Progress</span>
                            <span className="text-white font-medium">
                              {formatCurrency(cause.currentAmount)} of {formatCurrency(cause.targetAmount)}
                            </span>
                          </div>
                          <Progress value={progressPercentage} className="h-2" />
                          <div className="flex items-center justify-between text-xs text-gray-400">
                            <span>{Math.round(progressPercentage)}% funded</span>
                            <span>{cause.donorCount} donors</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center text-sm text-gray-400">
                            <MapPin className="h-4 w-4 mr-1" />
                            {cause.location}
                          </div>
                          <div className="text-sm text-gray-400">
                            by {cause.organizationName}
                          </div>
                        </div>

                        <Button 
                          onClick={() => handleDonate(cause)}
                          className="w-full bg-orange-500 hover:bg-orange-600"
                        >
                          <Heart className="h-4 w-4 mr-2" />
                          Donate Now
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-3 text-center py-12">
                  <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No causes found matching your criteria.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="impact" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">$2.4M</div>
                <div className="text-sm text-gray-400">Total Raised</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">15,847</div>
                <div className="text-sm text-gray-400">Active Donors</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <Target className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">3,112</div>
                <div className="text-sm text-gray-400">Counties Served</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-6 text-center">
                <Award className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">892</div>
                <div className="text-sm text-gray-400">Causes Funded</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Impact by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {CAUSE_CATEGORIES.slice(0, 6).map((category) => {
                  const IconComponent = category.icon;
                  const percentage = Math.floor(Math.random() * 40) + 10;
                  return (
                    <div key={category.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <IconComponent className="h-5 w-5 text-orange-500 mr-3" />
                        <span className="text-white">{category.name}</span>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Progress value={percentage} className="w-24 h-2" />
                        <span className="text-sm text-gray-400 w-12">{percentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="my-donations" className="space-y-6">
          {!isAuthenticated ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-12 text-center">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Sign in to view your donation history</p>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Sign In
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white">Your Donations</h2>
              <p className="text-center text-gray-400 py-8">
                Your donation history will appear here once you make your first contribution.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="corporate" className="space-y-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Corporate Matching Program</CardTitle>
              <p className="text-gray-400">Amplify your business impact through charitable giving</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Building className="h-8 w-8 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Employee Matching</h3>
                  <p className="text-gray-400 text-sm">Match employee donations to increase impact</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Tax Benefits</h3>
                  <p className="text-gray-400 text-sm">Maximize tax advantages for your business</p>
                </div>
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Award className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">Brand Recognition</h3>
                  <p className="text-gray-400 text-sm">Showcase your community commitment</p>
                </div>
              </div>
              
              <div className="text-center">
                <Button className="bg-orange-500 hover:bg-orange-600">
                  Learn More About Corporate Program
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Donation Modal */}
      {selectedCause && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-white">Donate to {selectedCause.title}</CardTitle>
              <p className="text-gray-400">Support this cause in {selectedCause.location}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Donation Amount</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
              </div>
              
              <div className="flex space-x-4">
                <Button 
                  onClick={() => submitDonation(false)}
                  disabled={donateMutation.isPending}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  Donate Publicly
                </Button>
                <Button 
                  onClick={() => submitDonation(true)}
                  disabled={donateMutation.isPending}
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  Donate Anonymously
                </Button>
              </div>
              
              <Button 
                onClick={() => setSelectedCause(null)}
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}