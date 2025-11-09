import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, Percent, Calendar, Target, Eye, DollarSign, Clock, TrendingUp } from 'lucide-react';

const Promotions = memo(function Promotions() {
  const [promoType, setPromoType] = useState('discount');

  const activePromotions = [
    {
      id: 1,
      title: "Spring Kitchen Special",
      type: "Discount",
      value: "15% off",
      status: "Active",
      views: 1247,
      clicks: 89,
      conversions: 12,
      budget: "$500",
      spent: "$287",
      endDate: "2024-04-15"
    },
    {
      id: 2,
      title: "Free Consultation",
      type: "Service",
      value: "Free",
      status: "Active",
      views: 892,
      clicks: 156,
      conversions: 23,
      budget: "$300",
      spent: "$145",
      endDate: "2024-04-30"
    },
    {
      id: 3,
      title: "Bathroom Bundle Deal",
      type: "Package",
      value: "$500 off",
      status: "Paused",
      views: 634,
      clicks: 67,
      conversions: 8,
      budget: "$400",
      spent: "$234",
      endDate: "2024-03-31"
    }
  ];

  const promoTemplates = [
    {
      title: "Seasonal Discount",
      description: "Percentage off for seasonal work",
      type: "discount",
      recommended: true
    },
    {
      title: "Free Consultation",
      description: "Complimentary initial consultation",
      type: "service",
      recommended: false
    },
    {
      title: "Bundle Package",
      description: "Multiple services at reduced rate",
      type: "package",
      recommended: false
    },
    {
      title: "Early Bird Special",
      description: "Discount for advance booking",
      type: "timing",
      recommended: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-emerald-600 hover:bg-emerald-700';
      case 'Paused': return 'bg-yellow-600 hover:bg-yellow-700';
      case 'Ended': return 'bg-red-600 hover:bg-red-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Promotion Manager</h1>
          <p className="text-xl text-gray-300">
            Create and manage promotional campaigns to attract more customers
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-[#1a2332]/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-600/20 rounded-lg">
                  <Eye className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">2,773</p>
                  <p className="text-gray-400 text-sm">Total Views</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332]/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-600/20 rounded-lg">
                  <Target className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">312</p>
                  <p className="text-gray-400 text-sm">Clicks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332]/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-600/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">43</p>
                  <p className="text-gray-400 text-sm">Conversions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1a2332]/50 border-slate-700">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-600/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">$666</p>
                  <p className="text-gray-400 text-sm">Total Spent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-[#1a2332]">
            <TabsTrigger value="active" className="data-[state=active]:bg-orange-600">Active Promotions</TabsTrigger>
            <TabsTrigger value="create" className="data-[state=active]:bg-orange-600">Create New</TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-orange-600">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-orange-500" />
                  Active Promotions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Monitor and manage your current promotional campaigns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activePromotions.map((promo) => (
                    <div key={promo.id} className="p-4 bg-slate-700/30 rounded-lg">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-white mb-1">{promo.title}</h3>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="border-orange-500 text-orange-400">
                              {promo.type}
                            </Badge>
                            <Badge className={getStatusColor(promo.status)}>
                              {promo.status}
                            </Badge>
                          </div>
                          <p className="text-gray-400 text-sm">
                            <Clock className="w-4 h-4 inline mr-1" />
                            Ends: {promo.endDate}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-orange-400">{promo.value}</p>
                          <p className="text-sm text-gray-400">Discount Value</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div className="text-center p-3 bg-[#1a2332]/50 rounded-lg">
                          <p className="text-lg font-bold text-blue-400">{promo.views}</p>
                          <p className="text-xs text-gray-400">Views</p>
                        </div>
                        <div className="text-center p-3 bg-[#1a2332]/50 rounded-lg">
                          <p className="text-lg font-bold text-orange-400">{promo.clicks}</p>
                          <p className="text-xs text-gray-400">Clicks</p>
                        </div>
                        <div className="text-center p-3 bg-[#1a2332]/50 rounded-lg">
                          <p className="text-lg font-bold text-emerald-400">{promo.conversions}</p>
                          <p className="text-xs text-gray-400">Conversions</p>
                        </div>
                        <div className="text-center p-3 bg-[#1a2332]/50 rounded-lg">
                          <p className="text-lg font-bold text-purple-400">{promo.spent}</p>
                          <p className="text-xs text-gray-400">Spent</p>
                        </div>
                        <div className="text-center p-3 bg-[#1a2332]/50 rounded-lg">
                          <p className="text-lg font-bold text-gray-400">{promo.budget}</p>
                          <p className="text-xs text-gray-400">Budget</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">Edit</Button>
                        <Button size="sm" variant="outline">Pause</Button>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">View Details</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="create">
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Create New Promotion</CardTitle>
                <CardDescription className="text-gray-400">
                  Set up a new promotional campaign to attract customers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="promo-title" className="text-gray-300">Promotion Title</Label>
                      <Input 
                        id="promo-title"
                        placeholder="e.g., Spring Kitchen Special"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="promo-type" className="text-gray-300">Promotion Type</Label>
                      <Select value={promoType} onValueChange={setPromoType}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="discount">Percentage Discount</SelectItem>
                          <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                          <SelectItem value="service">Free Service</SelectItem>
                          <SelectItem value="package">Package Deal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Promotion Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="promo-value" className="text-gray-300">
                        {promoType === 'discount' ? 'Discount Percentage' : 
                         promoType === 'fixed' ? 'Amount Off' : 'Value'}
                      </Label>
                      <Input 
                        id="promo-value"
                        placeholder={promoType === 'discount' ? '15' : promoType === 'fixed' ? '500' : 'Free'}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="start-date" className="text-gray-300">Start Date</Label>
                      <Input 
                        id="start-date"
                        type="date"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-gray-300">End Date</Label>
                      <Input 
                        id="end-date"
                        type="date"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label htmlFor="description" className="text-gray-300">Description</Label>
                    <Textarea 
                      id="description"
                      placeholder="Describe your promotion in detail. What services are included? Any limitations or requirements?"
                      className="bg-slate-700 border-slate-600 text-white"
                      rows={4}
                    />
                  </div>

                  {/* Budget and Targeting */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="budget" className="text-gray-300">Daily Budget</Label>
                      <Input 
                        id="budget"
                        placeholder="50"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label htmlFor="target-area" className="text-gray-300">Target Area</Label>
                      <Select>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue placeholder="Select area" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="all">All Service Areas</SelectItem>
                          <SelectItem value="la">Los Angeles County</SelectItem>
                          <SelectItem value="oc">Orange County</SelectItem>
                          <SelectItem value="riverside">Riverside County</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 bg-orange-600/10 border border-orange-600/20 rounded-lg">
                    <h4 className="font-semibold text-orange-400 mb-2">Promotion Preview</h4>
                    <div className="p-4 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="w-5 h-5 text-orange-400" />
                        <h3 className="font-bold text-white">Spring Kitchen Special</h3>
                      </div>
                      <p className="text-gray-300 text-sm mb-3">
                        Save 15% on all kitchen renovation projects booked this month
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-orange-600 hover:bg-orange-700">15% OFF</Badge>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                          Claim Offer
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button variant="outline" className="flex-1">
                      Save as Draft
                    </Button>
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
                      Launch Promotion
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Promotion Templates</CardTitle>
                <CardDescription className="text-gray-400">
                  Choose from proven promotion templates to get started quickly
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {promoTemplates.map((template, index) => (
                    <div 
                      key={index} 
                      className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                        template.recommended 
                          ? 'border-orange-500 bg-orange-500/10' 
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                      }`}
                    >
                      {template.recommended && (
                        <Badge className="mb-3 bg-orange-600 hover:bg-orange-700">
                          Recommended
                        </Badge>
                      )}
                      
                      <h3 className="text-lg font-semibold text-white mb-2">{template.title}</h3>
                      <p className="text-gray-400 text-sm mb-4">{template.description}</p>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <Badge variant="outline" className="border-gray-500 text-gray-400">
                          {template.type}
                        </Badge>
                      </div>
                      
                      <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700">
                        Use Template
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default Promotions;