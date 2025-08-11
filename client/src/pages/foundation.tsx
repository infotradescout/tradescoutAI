import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { 
  Heart, 
  DollarSign, 
  MapPin, 
  TrendingUp, 
  Users, 
  Gift,
  Target,
  CheckCircle,
  Calendar,
  PieChart,
  Settings,
  ArrowRight,
  Star,
  Globe,
  BookOpen,
  TreePine,
  Home,
  GraduationCap,
  Stethoscope,
  Utensils
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDistance } from "date-fns";

// Category icons mapping
const categoryIcons: { [key: string]: any } = {
  education: GraduationCap,
  environment: TreePine,
  health: Stethoscope,
  housing: Home,
  hunger: Utensils,
  community: Users,
  default: Heart
};

interface DonationFormProps {
  causeId?: string;
  isRoundup?: boolean;
  originalAmount?: number;
  onSuccess?: () => void;
}

const DonationForm = ({ causeId, isRoundup = false, originalAmount, onSuccess }: DonationFormProps) => {
  const [amount, setAmount] = useState(isRoundup && originalAmount ? 
    (Math.ceil(originalAmount) - originalAmount).toFixed(2) : "10.00");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorMessage, setDonorMessage] = useState("");
  const [selectedCause, setSelectedCause] = useState(causeId || "");
  const { toast } = useToast();

  const { data: causes = [] } = useQuery({
    queryKey: ["/api/foundation/causes"],
  });

  const donateMutation = useMutation({
    mutationFn: async (donationData: any) => {
      const response = await apiRequest("POST", "/api/foundation/donate", donationData);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Donation Successful",
        description: `Thank you for your $${amount} donation! You'll receive a receipt shortly.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/foundation"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Donation Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCause) {
      toast({
        title: "Please Select a Cause",
        description: "Choose a cause to support with your donation.",
        variant: "destructive",
      });
      return;
    }

    if (Number(amount) < 1) {
      toast({
        title: "Minimum Donation",
        description: "Minimum donation amount is $1.00",
        variant: "destructive",
      });
      return;
    }

    donateMutation.mutate({
      causeId: selectedCause,
      amount: Number(amount),
      type: isRoundup ? 'roundup' : 'one_time',
      isAnonymous,
      donorMessage: donorMessage.trim() || undefined,
      ...(isRoundup && originalAmount && {
        isRoundupDonation: true,
        originalAmount
      })
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          {isRoundup ? 'Round Up Donation' : 'Make a Donation'}
        </CardTitle>
        <CardDescription>
          {isRoundup 
            ? `Round up your $${originalAmount?.toFixed(2)} transaction to support local causes`
            : 'Support causes in communities across America'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cause Selection */}
          <div className="space-y-2">
            <Label htmlFor="cause">Select Cause</Label>
            <Select value={selectedCause} onValueChange={setSelectedCause}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a cause to support" />
              </SelectTrigger>
              <SelectContent>
                {causes.map((cause: any) => {
                  const IconComponent = categoryIcons[cause.category] || categoryIcons.default;
                  const progress = cause.targetAmount ? (Number(cause.raisedAmount) / Number(cause.targetAmount)) * 100 : 0;
                  
                  return (
                    <SelectItem key={cause.id} value={cause.id}>
                      <div className="flex items-center gap-3 w-full">
                        <IconComponent className="w-4 h-4" />
                        <div className="flex-1">
                          <div className="font-medium">{cause.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {cause.county?.name}, {cause.county?.state}
                            {cause.targetAmount && (
                              <span className="ml-auto">
                                ${Number(cause.raisedAmount).toLocaleString()} / ${Number(cause.targetAmount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Donation Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">
              Donation Amount {isRoundup && `(Rounds up from $${originalAmount?.toFixed(2)})`}
            </Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                placeholder="10.00"
              />
            </div>
            
            {!isRoundup && (
              <div className="flex gap-2 mt-2">
                {['5.00', '10.00', '25.00', '50.00', '100.00'].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAmount(preset)}
                    className="text-xs"
                  >
                    ${preset}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Share why this cause matters to you..."
              value={donorMessage}
              onChange={(e) => setDonorMessage(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <div className="text-xs text-gray-500">
              {donorMessage.length}/500 characters
            </div>
          </div>

          {/* Anonymous Donation Option */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="anonymous">Anonymous Donation</Label>
              <p className="text-sm text-gray-600">
                Hide your name from public donor lists
              </p>
            </div>
            <Switch
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
            />
          </div>

          {/* Tax Deductible Notice */}
          <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-800">Tax Deductible</p>
                <p className="text-green-700">
                  Your donation is tax-deductible. You'll receive an official receipt for your records.
                </p>
              </div>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={donateMutation.isPending}
          >
            {donateMutation.isPending ? (
              "Processing..."
            ) : (
              <>
                Donate ${amount}
                <Heart className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default function Foundation() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showDonationForm, setShowDonationForm] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Fetch foundation data
  const { data: foundationStats } = useQuery({
    queryKey: ["/api/foundation/stats"],
  });

  const { data: causes = [], isLoading: causesLoading } = useQuery({
    queryKey: ["/api/foundation/causes", { category: selectedCategory }],
  });

  const { data: userPreferences = {} } = useQuery({
    queryKey: ["/api/foundation/preferences"],
    enabled: isAuthenticated,
  });

  const { data: recentDonations = [] } = useQuery({
    queryKey: ["/api/foundation/recent-donations"],
  });

  const { data: impactReports = [] } = useQuery({
    queryKey: ["/api/foundation/impact-reports"],
  });

  const categories = [
    { id: 'all', name: 'All Causes', icon: Globe },
    { id: 'education', name: 'Education', icon: GraduationCap },
    { id: 'environment', name: 'Environment', icon: TreePine },
    { id: 'health', name: 'Healthcare', icon: Stethoscope },
    { id: 'housing', name: 'Housing', icon: Home },
    { id: 'hunger', name: 'Hunger Relief', icon: Utensils },
    { id: 'community', name: 'Community', icon: Users },
  ];

  const toggleRoundupPreference = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PUT", "/api/foundation/preferences", {
        enableRoundupDonations: enabled
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/foundation/preferences"] });
      toast({
        title: "Preferences Updated",
        description: "Your roundup donation preference has been updated.",
      });
    }
  });

  const { toast } = useToast();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 text-white">
        <div className="container mx-auto px-6 py-16">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              TradeScout Foundation
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">
              Supporting local causes in all 3,112 counties across America, one community at a time
            </p>
            
            {/* Foundation Stats */}
            {foundationStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
                <div className="text-center">
                  <div className="text-3xl font-bold">${((foundationStats as any)?.totalRaised || 0).toLocaleString()}</div>
                  <div className="text-sm opacity-80">Total Raised</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{((foundationStats as any)?.totalDonors || 0).toLocaleString()}</div>
                  <div className="text-sm opacity-80">Active Donors</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{(foundationStats as any)?.activeCauses || 0}</div>
                  <div className="text-sm opacity-80">Active Causes</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">{(foundationStats as any)?.countiesSupported || 0}</div>
                  <div className="text-sm opacity-80">Counties Supported</div>
                </div>
              </div>
            )}

            <div className="mt-8">
              <Button 
                size="lg" 
                className="bg-white text-blue-600 hover:bg-gray-100"
                onClick={() => setShowDonationForm(true)}
              >
                Make a Donation
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-12">
        <Tabs defaultValue="causes" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="causes">Browse Causes</TabsTrigger>
            <TabsTrigger value="impact">Impact Reports</TabsTrigger>
            <TabsTrigger value="donate">Donate Now</TabsTrigger>
            <TabsTrigger value="settings">My Preferences</TabsTrigger>
          </TabsList>

          {/* Browse Causes Tab */}
          <TabsContent value="causes" className="space-y-6">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className="flex items-center gap-2"
                  >
                    <IconComponent className="w-4 h-4" />
                    {category.name}
                  </Button>
                );
              })}
            </div>

            {/* Causes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {causesLoading ? (
                [...Array(6)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                    <CardContent className="p-4">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                causes?.map((cause: any) => {
                  const IconComponent = categoryIcons[cause.category] || categoryIcons.default;
                  const progress = cause.targetAmount ? 
                    Math.min(100, (Number(cause.raisedAmount) / Number(cause.targetAmount)) * 100) : 0;
                  
                  return (
                    <Card key={cause.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      {cause.imageUrl && (
                        <div className="h-48 overflow-hidden">
                          <img 
                            src={cause.imageUrl} 
                            alt={cause.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-5 h-5 text-blue-600" />
                            <Badge variant="outline">{cause.category}</Badge>
                          </div>
                          {cause.verifiedNonprofit && (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                        </div>
                        
                        <h3 className="font-semibold text-lg mb-2">{cause.name}</h3>
                        
                        <div className="flex items-center text-sm text-gray-600 mb-3">
                          <MapPin className="w-4 h-4 mr-1" />
                          {cause.county?.name}, {cause.county?.state}
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {cause.description}
                        </p>
                        
                        {cause.targetAmount && (
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span>${Number(cause.raisedAmount).toLocaleString()} raised</span>
                              <span>Goal: ${Number(cause.targetAmount).toLocaleString()}</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                            <div className="text-xs text-gray-500">
                              {progress.toFixed(1)}% complete
                            </div>
                          </div>
                        )}
                        
                        <Button className="w-full" size="sm">
                          <Gift className="w-4 h-4 mr-2" />
                          Donate Now
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Impact Reports Tab */}
          <TabsContent value="impact" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Community Impact</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                See how your donations are making a real difference in communities across America
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {impactReports?.map((report: any) => (
                <Card key={report.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      {report.cause?.name}
                    </CardTitle>
                    <CardDescription>
                      {report.reportingPeriod} • {report.cause?.county?.name}, {report.cause?.county?.state}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            ${Number(report.totalDonationsReceived).toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600">Donations Received</div>
                        </div>
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {report.totalBeneficiaries.toLocaleString()}
                          </div>
                          <div className="text-sm text-gray-600">People Helped</div>
                        </div>
                      </div>

                      {/* Impact Metrics */}
                      {report.impactMetrics && (
                        <div className="space-y-2">
                          <h4 className="font-medium">Impact Achieved:</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(report.impactMetrics as Record<string, any>).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="capitalize">{key.replace('_', ' ')}:</span>
                                <span className="font-medium">{value.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Story */}
                      {report.storytelling && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2">Impact Story:</h4>
                          <p className="text-sm text-gray-600 line-clamp-4">
                            {report.storytelling}
                          </p>
                        </div>
                      )}

                      <div className="text-xs text-gray-500">
                        Published {formatDistance(new Date(report.publishedAt), new Date(), { addSuffix: true })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Donate Now Tab */}
          <TabsContent value="donate" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <DonationForm onSuccess={() => setShowDonationForm(false)} />
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="settings" className="space-y-6">
            {!isAuthenticated ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Sign In Required</h3>
                  <p className="text-gray-600 mb-4">
                    Sign in to set up donation preferences and enable roundup donations.
                  </p>
                  <Button>
                    Sign In
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Roundup Donations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Roundup Donations
                    </CardTitle>
                    <CardDescription>
                      Automatically round up your on-platform transactions to support causes
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="enable-roundup" className="text-base font-medium">
                          Enable Roundup Donations
                        </Label>
                        <p className="text-sm text-gray-600">
                          Round up payments to the nearest dollar and donate the difference
                        </p>
                      </div>
                      <Switch
                        id="enable-roundup"
                        checked={(userPreferences as any)?.enableRoundupDonations || false}
                        onCheckedChange={(checked) => toggleRoundupPreference.mutate(checked)}
                      />
                    </div>

                    {(userPreferences as any)?.enableRoundupDonations && (
                      <div className="space-y-4 pt-4 border-t">
                        <div>
                          <Label htmlFor="roundup-threshold">Maximum Roundup Amount</Label>
                          <Input
                            id="roundup-threshold"
                            type="number"
                            step="0.01"
                            max="10.00"
                            defaultValue={(userPreferences as any)?.roundupThreshold || "1.00"}
                            className="mt-1"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Maximum amount to round up per transaction
                          </p>
                        </div>

                        <div>
                          <Label>Default Cause for Roundups</Label>
                          <Select 
                            defaultValue={(userPreferences as any)?.defaultCauseId || ""}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Choose default cause" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Let me choose each time</SelectItem>
                              {causes.map((cause: any) => (
                                <SelectItem key={cause.id} value={cause.id}>
                                  {cause.name} - {cause.county?.name}, {cause.county?.state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Notification Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Email Receipts</Label>
                        <p className="text-sm text-gray-600">Get email confirmations for donations</p>
                      </div>
                      <Switch defaultChecked={(userPreferences as any)?.emailReceipts || false} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Monthly Reports</Label>
                        <p className="text-sm text-gray-600">Receive monthly impact summaries</p>
                      </div>
                      <Switch defaultChecked={(userPreferences as any)?.monthlyReports || false} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Impact Updates</Label>
                        <p className="text-sm text-gray-600">Get updates when causes reach milestones</p>
                      </div>
                      <Switch defaultChecked={(userPreferences as any)?.impactUpdates || false} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}