import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Info, Users, CheckCircle, Clock, Phone, MapPin, TrendingUp, Zap, Shield } from "lucide-react";
import { PricingTooltip, ContextualTooltip } from "@/components/ui/contextual-tooltip";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { GuestGate } from "@/components/guest-gate";
import { StateCountySelector } from "@/components/state-county-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHead } from "@/components/PageHead";
import { ProgressFeedback } from "@/components/ProgressFeedback";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";

interface EstimateInputs {
  projectType: string;
  squareFootage: string;
  urgency: string;
  stateCode: string;
  countyFips: string;
}

export default function EstimateCalculator() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [inputs, setInputs] = useState<EstimateInputs>({
    projectType: '',
    squareFootage: '',
    urgency: 'planning',
    stateCode: '',
    countyFips: ''
  });
  const [estimate, setEstimate] = useState<any>(null);
  const [showLeadSuccess, setShowLeadSuccess] = useState(false);

  const calculateMutation = useMutation({
    mutationFn: async (data: EstimateInputs) => {
      // Enhanced calculation logic with project-specific pricing
      const projectPricing: Record<string, number> = {
        // Roofing & Exterior
        'roof-replacement': 15,
        'roof-repair': 8,
        'new-roof': 18,
        'gutter-installation': 6,
        'siding-replacement': 12,
        'window-replacement': 450, // per window, not sq ft
        'door-installation': 350,
        'deck-construction': 25,
        'fence-installation': 15,
        'concrete-work': 8,
        'masonry-work': 20,
        
        // Interior Renovations
        'kitchen-remodel': 100,
        'bathroom-remodel': 85,
        'basement-finishing': 30,
        'attic-conversion': 40,
        
        // Flooring
        'hardwood-flooring': 12,
        'carpet-installation': 6,
        'tile-installation': 15,
        'laminate-flooring': 8,
        
        // HVAC & Plumbing
        'hvac-installation': 25,
        'plumbing-repair': 150, // per hour
        'water-heater-installation': 1200,
        
        // Electrical
        'electrical-work': 120, // per hour
        'panel-upgrade': 2500,
        
        // Painting
        'interior-painting': 3,
        'exterior-painting': 4,
        
        // Default
        'general': 12
      };

      const baseRate = projectPricing[data.projectType] || 12;
      const sqft = parseInt(data.squareFootage) || 1000;
      
      // Special cases for per-unit pricing
      let basePrice;
      if (['window-replacement', 'door-installation'].includes(data.projectType)) {
        basePrice = baseRate * Math.max(1, Math.floor(sqft / 100)); // Estimate units based on sq ft
      } else if (['plumbing-repair', 'electrical-work'].includes(data.projectType)) {
        basePrice = baseRate * 8; // 8 hour estimate
      } else if (data.projectType === 'water-heater-installation') {
        basePrice = baseRate;
      } else if (data.projectType === 'panel-upgrade') {
        basePrice = baseRate;
      } else {
        basePrice = sqft * baseRate;
      }

      const urgencyMultiplier = data.urgency === 'urgent' ? 1.4 : data.urgency === 'soon' ? 1.15 : 1;
      
      const low = Math.round(basePrice * urgencyMultiplier * 0.75);
      const high = Math.round(basePrice * urgencyMultiplier * 1.35);
      
      return { 
        low, 
        high, 
        projectType: data.projectType,
        details: {
          baseRate,
          urgencyMultiplier,
          laborPercentage: 0.6,
          materialPercentage: 0.4
        }
      };
    },
    onSuccess: (data) => {
      setEstimate(data);
    },
    onError: (error) => {
      toast({
        title: "Calculation Error",
        description: "Failed to calculate estimate. Please try again.",
        variant: "destructive",
      });
    }
  });

  const leadMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/leads', data);
    },
    onSuccess: (response) => {
      toast({
        title: "Success!",
        description: "We're connecting you with the top 3 contractors in your area.",
      });
      setShowLeadSuccess(true);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleCalculate = () => {
    if (!inputs.projectType || !inputs.squareFootage || !inputs.stateCode || !inputs.countyFips) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields to calculate your estimate.",
        variant: "destructive",
      });
      return;
    }
    calculateMutation.mutate(inputs);
  };

  const handleGetEstimates = () => {
    if (!estimate) return;
    
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }

    const leadData = {
      projectType: inputs.projectType,
      description: `${inputs.squareFootage} sq ft ${inputs.projectType.replace('-', ' ')}`,
      tradeId: getTradeIdFromProjectType(inputs.projectType),
      countyId: inputs.countyFips,
      estimatedValue: (estimate.low + estimate.high) / 2,
      urgency: inputs.urgency,
      routingType: 'top3',
      calculatorData: { ...inputs, estimate }
    };
    
    leadMutation.mutate(leadData);
  };

  const getTradeIdFromProjectType = (projectType: string): string => {
    const tradeMap: Record<string, string> = {
      'roof-replacement': 'roofing-contractor',
      'roof-repair': 'roofing-contractor',
      'new-roof': 'roofing-contractor',
      'kitchen-remodel': 'kitchen-remodel',
      'bathroom-remodel': 'bathroom-remodel',
      'hvac-installation': 'hvac',
      'electrical-work': 'electrical',
      'plumbing-repair': 'plumbing',
      'hardwood-flooring': 'hardwood-flooring',
      'interior-painting': 'interior-painting',
      'exterior-painting': 'exterior-painting',
    };
    return tradeMap[projectType] || 'general-contractor';
  };

  const formatProjectType = (type: string): string => {
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (showLeadSuccess) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">Request Submitted Successfully!</h1>
            <p className="text-xl text-gray-300 mb-8">
              We've shared your project details with the top 3 contractors in your area. They will contact you directly with quotes.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-navy-600 p-6 rounded-lg">
                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Within 1 Hour</h3>
                <p className="text-gray-300 text-sm">Top 3 contractors receive your project details</p>
              </div>
              <div className="bg-navy-600 p-6 rounded-lg">
                <Phone className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Within 24 Hours</h3>
                <p className="text-gray-300 text-sm">Contractors will call you with personalized quotes</p>
              </div>
              <div className="bg-navy-600 p-6 rounded-lg">
                <MapPin className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Schedule Visits</h3>
                <p className="text-gray-300 text-sm">Choose your preferred contractors for on-site consultations</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <Link href="/contractors/board">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Browse All Contractors
                </Button>
              </Link>
              <div>
                <Button 
                  variant="outline" 
                  className="border-navy-400 text-gray-300 hover:bg-navy-600"
                  onClick={() => setShowLeadSuccess(false)}
                >
                  Calculate Another Estimate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStep = !inputs.projectType ? 0 : 
                     !inputs.squareFootage ? 1 :
                     !inputs.stateCode ? 2 : 
                     !estimate ? 3 : 4;

  const stepLabels = [
    "Select Project Type",
    "Enter Square Footage", 
    "Choose Location",
    "Calculate Estimate",
    "Connect with Contractors"
  ];

  // SEO structured data
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Quote Calculator', url: '/quote' }
  ];

  const quoteStructuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "TradeScout Quote Calculator",
    "description": "Free home improvement cost calculator and contractor quote generator",
    "url": window.location.href,
    "applicationCategory": "UtilityApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free project cost estimates and contractor quotes"
    }
  };

  return (
    <GuestGate action="get project estimates">
      <SEOHelmet 
        title="Free Home Improvement Cost Calculator & Quote Generator | TradeScout"
        description="Calculate accurate project costs instantly. Get free quotes from verified local contractors for roofing, flooring, kitchen remodels, and more. Licensed and insured professionals."
        keywords="home improvement calculator, project cost estimator, free contractor quotes, roofing cost calculator, kitchen remodel cost, flooring estimate"
        structuredData={quoteStructuredData}
      />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <PageHead 
          title="Get Your Project Estimate - TradeScout Calculator"
          description="Get instant estimates for your home improvement project. Regional pricing based on your county and project details. Connect with verified contractors for accurate quotes."
          keywords="project estimate, home improvement calculator, contractor quotes, regional pricing, project cost calculator"
        />
        
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-400">
            {breadcrumbItems.map((item, index) => (
              <li key={item.url} className="flex items-center">
                {index > 0 && <span className="mx-2 text-gray-500">/</span>}
                {index === breadcrumbItems.length - 1 ? (
                  <span className="text-orange-500 font-medium">{item.name}</span>
                ) : (
                  <Link href={item.url}>
                    <span className="hover:text-white transition-colors cursor-pointer">{item.name}</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Get Your Project Estimate</h1>
        <p className="text-xl text-gray-300 mb-6">Regional pricing based on your county and project details</p>
        <div className="flex justify-center gap-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            <span>Real-time market rates</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-orange-500" />
            <span>Instant calculations</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <span>Verified contractors only</span>
          </div>
        </div>
        </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calculator Form - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Card className="bg-navy-700 border-navy-600">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  Project Type *
                  <PricingTooltip>
                    <ContextualTooltip
                      title="Choosing Project Types"
                      content="Select the option that best matches your project scope. Different project types have varying material costs and labor requirements."
                      illustration="hammer"
                      variant="contractor"
                      size="sm"
                    />
                  </PricingTooltip>
                </Label>
                <Select value={inputs.projectType} onValueChange={(value) => setInputs(prev => ({ ...prev, projectType: value }))}>
                  <SelectTrigger className="form-field">
                    <SelectValue placeholder="Select your project type..." />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                    {/* ROOFING & EXTERIOR */}
                    <SelectItem value="roof-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Roof Replacement</SelectItem>
                    <SelectItem value="roof-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Roof Repair</SelectItem>
                    <SelectItem value="new-roof" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New Roof Installation</SelectItem>
                    <SelectItem value="gutter-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gutter Installation & Repair</SelectItem>
                    <SelectItem value="siding-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Siding Installation</SelectItem>
                    <SelectItem value="window-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Window Replacement</SelectItem>
                    <SelectItem value="door-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Door Installation</SelectItem>
                    <SelectItem value="deck-construction" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Deck & Patio</SelectItem>
                    <SelectItem value="fence-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fence Installation</SelectItem>
                    <SelectItem value="concrete-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Concrete Work</SelectItem>
                    
                    {/* INTERIOR RENOVATIONS */}
                    <SelectItem value="kitchen-remodel" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kitchen Remodeling</SelectItem>
                    <SelectItem value="bathroom-remodel" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bathroom Remodeling</SelectItem>
                    <SelectItem value="basement-finishing" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Basement Finishing</SelectItem>
                    <SelectItem value="attic-conversion" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Attic Conversion</SelectItem>
                    
                    {/* FLOORING */}
                    <SelectItem value="hardwood-flooring" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hardwood Flooring</SelectItem>
                    <SelectItem value="carpet-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Carpet Installation</SelectItem>
                    <SelectItem value="tile-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tile Installation</SelectItem>
                    <SelectItem value="laminate-flooring" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Laminate/Vinyl Flooring</SelectItem>
                    
                    {/* HVAC & PLUMBING */}
                    <SelectItem value="hvac-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">HVAC Installation</SelectItem>
                    <SelectItem value="plumbing-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Plumbing Services</SelectItem>
                    <SelectItem value="water-heater-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Water Heater Installation</SelectItem>
                    
                    {/* ELECTRICAL */}
                    <SelectItem value="electrical-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Electrical Services</SelectItem>
                    <SelectItem value="panel-upgrade" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Electrical Panel Upgrade</SelectItem>
                    
                    {/* PAINTING */}
                    <SelectItem value="interior-painting" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Interior Painting</SelectItem>
                    <SelectItem value="exterior-painting" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Exterior Painting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <StateCountySelector
                  selectedState={inputs.stateCode}
                  selectedCounty={inputs.countyFips}
                  onStateChange={(stateCode) => setInputs(prev => ({ ...prev, stateCode }))}
                  onCountyChange={(countyFips) => setInputs(prev => ({ ...prev, countyFips }))}
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  Project Size *
                  <ContextualTooltip
                    title="Accurate Measurements Matter"
                    content="Precise measurements lead to accurate estimates - like measuring lumber before cutting."
                    illustration="ruler"
                    variant="contractor"
                    size="sm"
                  />
                </Label>
                <Input
                  type="number"
                  placeholder="Enter square footage or project size"
                  value={inputs.squareFootage}
                  onChange={(e) => setInputs(prev => ({ ...prev, squareFootage: e.target.value }))}
                  className="form-field"
                />
                <p className="text-xs text-gray-400 mt-1">
                  For windows/doors: enter number of units. For hourly services: enter estimated hours.
                </p>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  Project Timeline
                  <ContextualTooltip
                    title="Timeline Affects Pricing"
                    content="Rush jobs cost more - like overtime rates for contractors. Planning ahead saves money."
                    illustration="drill"
                    variant="contractor"
                    size="sm"
                  />
                </Label>
                <Select value={inputs.urgency} onValueChange={(value) => setInputs(prev => ({ ...prev, urgency: value }))}>
                  <SelectTrigger className="form-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-navy-700 border-navy-600 text-white">
                    <SelectItem value="urgent" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Urgent (Emergency) - +40% pricing</SelectItem>
                    <SelectItem value="soon" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Within a month - +15% pricing</SelectItem>
                    <SelectItem value="planning" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Still planning - Standard pricing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleCalculate}
                disabled={!inputs.projectType || !inputs.squareFootage || !inputs.stateCode || !inputs.countyFips || calculateMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                size="lg"
              >
                {calculateMutation.isPending ? (
                  <>
                    <Calculator className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Estimate
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-1">
          <Card className="bg-navy-600 border-navy-500 sticky top-8">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Your Estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {estimate ? (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-gray-300 mb-2">Estimated Cost Range</p>
                    <div className="text-3xl font-bold text-white mb-2">
                      ${estimate.low.toLocaleString()} - ${estimate.high.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      {formatProjectType(estimate.projectType)} in your area
                    </p>
                    
                    {estimate.details && (
                      <div className="text-left bg-navy-700/50 p-4 rounded-lg text-xs text-gray-400 space-y-1">
                        <div className="flex justify-between">
                          <span>Labor (60%):</span>
                          <span>${Math.round(((estimate.low + estimate.high) / 2) * 0.6).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Materials (40%):</span>
                          <span>${Math.round(((estimate.low + estimate.high) / 2) * 0.4).toLocaleString()}</span>
                        </div>
                        {inputs.urgency !== 'planning' && (
                          <div className="flex justify-between text-orange-400 pt-1 border-t border-navy-600">
                            <span>Timeline adjustment:</span>
                            <span>+{inputs.urgency === 'urgent' ? '40%' : '15%'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Badge className="bg-amber-600 text-amber-100 mt-4">
                      <Info className="h-3 w-3 mr-1" />
                      Estimate only. Final pricing may vary.
                    </Badge>
                  </div>

                  <GuestGate
                    action="get free quotes"
                    title="Create Account to Get Quotes"
                    description="Connect with verified contractors for personalized quotes."
                  >
                    <div className="space-y-4">
                      <Button 
                        onClick={handleGetEstimates}
                        disabled={leadMutation.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect"
                        size="lg"
                      >
                        {leadMutation.isPending ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Get 3 Free Quotes
                          </>
                        )}
                      </Button>
                      
                      <div className="text-center text-gray-400 text-sm">or</div>
                      
                      <Link href="/contractors/board">
                        <Button 
                          variant="outline"
                          className="w-full border-navy-400 text-gray-300 hover:bg-navy-700"
                        >
                          Browse Contractors
                        </Button>
                      </Link>
                      
                      <div className="p-3 bg-navy-700/50 rounded-lg">
                        <p className="text-xs text-gray-400">
                          ✓ Licensed & verified contractors<br/>
                          ✓ Free quotes with no obligation<br/>
                          ✓ Top-rated in your area
                        </p>
                      </div>
                    </div>
                  </GuestGate>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">
                    Fill out the project details and click "Calculate Estimate" to get your pricing range.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Additional Information */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <MapPin className="h-8 w-8 text-orange-500 mx-auto mb-3" />
            <h4 className="text-white font-semibold mb-2">Regional Accuracy</h4>
            <p className="text-gray-300 text-sm">Estimates based on local labor costs and material pricing in your county.</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <Zap className="h-8 w-8 text-orange-500 mx-auto mb-3" />
            <h4 className="text-white font-semibold mb-2">Instant Results</h4>
            <p className="text-gray-300 text-sm">Get your estimate immediately with our advanced pricing algorithm.</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <Shield className="h-8 w-8 text-orange-500 mx-auto mb-3" />
            <h4 className="text-white font-semibold mb-2">No Commitment</h4>
            <p className="text-gray-300 text-sm">Free estimates with no obligation to hire. Compare quotes at your own pace.</p>
          </CardContent>
        </Card>
      </div>
      </main>
    </GuestGate>
  );
}