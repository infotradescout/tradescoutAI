import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Info, Users, CheckCircle, Clock, Phone, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { GuestGate } from "@/components/guest-gate";
import { StateCountySelector } from "@/components/state-county-selector";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

  // Remove the hardcoded counties query since StateCountySelector handles this

  const calculateMutation = useMutation({
    mutationFn: async (data: EstimateInputs) => {
      // Mock calculation - in production this would use real pricing data
      const basePrice = parseInt(data.squareFootage) * 12; // $12 per sq ft base for roofing
      const urgencyMultiplier = data.urgency === 'urgent' ? 1.3 : data.urgency === 'soon' ? 1.1 : 1;
      
      const low = Math.round(basePrice * urgencyMultiplier * 0.8);
      const high = Math.round(basePrice * urgencyMultiplier * 1.2);
      
      return { low, high, projectType: data.projectType };
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
      // Show success state with next steps
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

  const [showLeadSuccess, setShowLeadSuccess] = useState(false);

  const handleCalculate = () => {
    if (!inputs.projectType || !inputs.squareFootage || !inputs.stateCode || !inputs.countyFips) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields including your location.",
        variant: "destructive",
      });
      return;
    }
    calculateMutation.mutate(inputs);
  };

  const handleGetEstimates = async () => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }

    leadMutation.mutate({
      projectType: inputs.projectType,
      description: `${inputs.squareFootage} sq ft ${inputs.projectType.toLowerCase()}`,
      tradeId: getTradeIdFromProjectType(inputs.projectType),
      countyId: inputs.countyFips,
      estimatedValue: estimate ? (estimate.low + estimate.high) / 2 : null,
      urgency: inputs.urgency,
      routingType: 'top3',
      calculatorData: { ...inputs, estimate },
    });
  };

  const getTradeIdFromProjectType = (projectType: string): string => {
    const tradeMap: { [key: string]: string } = {
      // Roofing & Exterior
      'roof-repair': 'roofing',
      'roof-replacement': 'roofing',
      'new-roof': 'roofing',
      'gutter-installation': 'gutter-contractor',
      'siding-replacement': 'siding-contractor',
      'window-replacement': 'window-contractor',
      'door-installation': 'door-contractor',
      'deck-construction': 'deck-contractor',
      'fence-installation': 'fence-contractor',
      'concrete-work': 'concrete-contractor',
      'masonry-work': 'masonry-contractor',
      
      // Interior Renovations
      'kitchen-remodel': 'kitchen-remodel',
      'bathroom-remodel': 'bathroom-remodel',
      'basement-finishing': 'basement-finishing',
      'attic-conversion': 'attic-conversion',
      
      // Flooring
      'hardwood-flooring': 'hardwood-flooring',
      'carpet-installation': 'carpet-installation',
      'tile-installation': 'tile-contractor',
      'laminate-flooring': 'laminate-flooring',
      
      // Plumbing & HVAC
      'plumbing-repair': 'plumbing',
      'water-heater-installation': 'water-heater',
      'hvac-installation': 'hvac',
      'air-conditioning-repair': 'air-conditioning',
      'heating-system': 'heating-contractor',
      
      // Electrical
      'electrical-work': 'electrical',
      'panel-upgrade': 'panel-upgrade',
      'lighting-installation': 'lighting-contractor',
      'ceiling-fan-installation': 'ceiling-fan-installation',
      
      // Painting & Finishing
      'interior-painting': 'interior-painting',
      'exterior-painting': 'exterior-painting',
      'cabinet-painting': 'cabinet-painting',
      'drywall-work': 'drywall-contractor',
      
      // Landscaping & Outdoor
      'landscaping': 'landscaping',
      'lawn-care': 'lawn-care',
      'tree-service': 'tree-service',
      'irrigation-system': 'irrigation',
      'pool-installation': 'pool-contractor',
      
      // Specialty Services
      'insulation-installation': 'insulation-contractor',
      'solar-installation': 'solar-contractor',
      'security-system': 'security-systems',
      'smart-home-automation': 'smart-home',
      'garage-door-repair': 'garage-door',
      'chimney-services': 'chimney-services',
      
      // Maintenance & Cleaning
      'house-cleaning': 'house-cleaning',
      'carpet-cleaning': 'carpet-cleaning',
      'pressure-washing': 'pressure-washing',
      'pest-control': 'pest-control',
      'mold-remediation': 'mold-remediation',
      'handyman-services': 'handyman',
      
      // General Construction
      'home-addition': 'addition-contractor',
      'general-remodeling': 'remodeling-contractor',
      'custom-home-building': 'custom-home-builder',
    };
    return tradeMap[projectType] || 'general-contractor';
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
              We're connecting you with the top 3 contractors in your area for detailed quotes.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-navy-600 p-6 rounded-lg">
                <Clock className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Within 1 Hour</h3>
                <p className="text-gray-300 text-sm">Top contractors will review your project details</p>
              </div>
              <div className="bg-navy-600 p-6 rounded-lg">
                <Phone className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Within 24 Hours</h3>
                <p className="text-gray-300 text-sm">You'll receive calls with detailed quotes</p>
              </div>
              <div className="bg-navy-600 p-6 rounded-lg">
                <MapPin className="h-8 w-8 text-orange-500 mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2">Schedule Visits</h3>
                <p className="text-gray-300 text-sm">Arrange on-site consultations with your preferred contractors</p>
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Get Your Project Estimate</h1>
        <p className="text-xl text-gray-300">Regional pricing based on your county and project details</p>
      </div>

      <Card className="bg-navy-700 border-navy-600 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left: Calculator Form */}
            <div className="p-8 border-r border-navy-600">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Project Details
              </h3>
              
              <div className="space-y-6">
                <div>
                  <Label className="block text-sm font-medium text-gray-300 mb-2">Project Type</Label>
                  <Select value={inputs.projectType} onValueChange={(value) => setInputs(prev => ({ ...prev, projectType: value }))}>
                    <SelectTrigger className="form-field">
                      <SelectValue placeholder="Select project type..." />
                    </SelectTrigger>
                    <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                      {/* ROOFING & EXTERIOR */}
                      <SelectItem value="roof-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Roof Replacement</SelectItem>
                      <SelectItem value="roof-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Roof Repair</SelectItem>
                      <SelectItem value="new-roof" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New Roof Installation</SelectItem>
                      <SelectItem value="gutter-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gutter Installation & Repair</SelectItem>
                      <SelectItem value="siding-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Siding Installation & Repair</SelectItem>
                      <SelectItem value="window-replacement" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Window Replacement</SelectItem>
                      <SelectItem value="door-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Door Installation</SelectItem>
                      <SelectItem value="deck-construction" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Deck & Patio Construction</SelectItem>
                      <SelectItem value="fence-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fence Installation</SelectItem>
                      <SelectItem value="concrete-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Concrete Work</SelectItem>
                      <SelectItem value="masonry-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Masonry & Stonework</SelectItem>
                      
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
                      
                      {/* PLUMBING & HVAC */}
                      <SelectItem value="plumbing-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Plumbing Repair</SelectItem>
                      <SelectItem value="water-heater-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Water Heater Installation</SelectItem>
                      <SelectItem value="hvac-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">HVAC Installation</SelectItem>
                      <SelectItem value="air-conditioning-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">AC Repair & Installation</SelectItem>
                      <SelectItem value="heating-system" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Heating System Services</SelectItem>
                      
                      {/* ELECTRICAL */}
                      <SelectItem value="electrical-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Electrical Services</SelectItem>
                      <SelectItem value="panel-upgrade" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Electrical Panel Upgrade</SelectItem>
                      <SelectItem value="lighting-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lighting Installation</SelectItem>
                      <SelectItem value="ceiling-fan-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ceiling Fan Installation</SelectItem>
                      
                      {/* PAINTING & FINISHING */}
                      <SelectItem value="interior-painting" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Interior Painting</SelectItem>
                      <SelectItem value="exterior-painting" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Exterior Painting</SelectItem>
                      <SelectItem value="cabinet-painting" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cabinet Painting & Refinishing</SelectItem>
                      <SelectItem value="drywall-work" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Drywall Installation & Repair</SelectItem>
                      
                      {/* LANDSCAPING & OUTDOOR */}
                      <SelectItem value="landscaping" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Landscaping Services</SelectItem>
                      <SelectItem value="lawn-care" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lawn Care & Maintenance</SelectItem>
                      <SelectItem value="tree-service" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tree Services</SelectItem>
                      <SelectItem value="irrigation-system" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Irrigation & Sprinkler Systems</SelectItem>
                      <SelectItem value="pool-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pool Installation</SelectItem>
                      
                      {/* SPECIALTY SERVICES */}
                      <SelectItem value="insulation-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Insulation Services</SelectItem>
                      <SelectItem value="solar-installation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Solar Panel Installation</SelectItem>
                      <SelectItem value="security-system" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Security System Installation</SelectItem>
                      <SelectItem value="smart-home-automation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Smart Home Automation</SelectItem>
                      <SelectItem value="garage-door-repair" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Garage Door Services</SelectItem>
                      <SelectItem value="chimney-services" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Chimney Services</SelectItem>
                      
                      {/* MAINTENANCE & CLEANING */}
                      <SelectItem value="house-cleaning" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">House Cleaning</SelectItem>
                      <SelectItem value="carpet-cleaning" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Carpet Cleaning</SelectItem>
                      <SelectItem value="pressure-washing" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pressure Washing</SelectItem>
                      <SelectItem value="pest-control" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pest Control</SelectItem>
                      <SelectItem value="mold-remediation" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mold Remediation</SelectItem>
                      <SelectItem value="handyman-services" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Handyman Services</SelectItem>
                      
                      {/* GENERAL CONSTRUCTION */}
                      <SelectItem value="home-addition" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Home Addition</SelectItem>
                      <SelectItem value="general-remodeling" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">General Remodeling</SelectItem>
                      <SelectItem value="custom-home-building" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Custom Home Building</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Selector */}
                <div>
                  <StateCountySelector
                    selectedState={inputs.stateCode}
                    selectedCounty={inputs.countyFips}
                    onStateChange={(stateCode) => setInputs(prev => ({ ...prev, stateCode }))}
                    onCountyChange={(countyFips) => setInputs(prev => ({ ...prev, countyFips }))}
                  />
                </div>

                <div>
                  <Label className="block text-sm font-medium text-gray-300 mb-2">Square Footage</Label>
                  <Input
                    type="number"
                    placeholder="Enter square footage"
                    value={inputs.squareFootage}
                    onChange={(e) => setInputs(prev => ({ ...prev, squareFootage: e.target.value }))}
                    className="form-field"
                  />
                </div>

                <div>
                  <Label className="block text-sm font-medium text-gray-300 mb-2">Project Timeline</Label>
                  <Select value={inputs.urgency} onValueChange={(value) => setInputs(prev => ({ ...prev, urgency: value }))}>
                    <SelectTrigger className="form-field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (Emergency)</SelectItem>
                      <SelectItem value="soon">Within a month</SelectItem>
                      <SelectItem value="planning">Still planning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleCalculate}
                  disabled={!inputs.projectType || !inputs.squareFootage || !inputs.stateCode || !inputs.countyFips || calculateMutation.isPending}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                >
                  {calculateMutation.isPending ? 'Calculating...' : 'Calculate Estimate'}
                </Button>
              </div>
            </div>

            {/* Right: Estimate Results */}
            <div className="bg-navy-600 p-8 flex flex-col justify-center">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Your Estimate
              </h3>
              
              {estimate ? (
                <div>
                  <Card className="bg-navy-600 border-navy-500 mb-6">
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-300 mb-2">Estimated Cost Range</p>
                      <div className="text-3xl font-bold text-white mb-4">
                        ${estimate.low.toLocaleString()} - ${estimate.high.toLocaleString()}
                      </div>
                      <p className="text-sm text-gray-400 mb-4">
                        Based on selected location pricing for {estimate.projectType?.replace('-', ' ')}
                      </p>
                      <Badge className="bg-amber-600 text-amber-100">
                        <Info className="h-3 w-3 mr-1" />
                        This is an estimate. Final pricing may vary based on specific project requirements.
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* Get Quotes CTA */}
                  <GuestGate
                    action="get free quotes"
                    title="Create Account to Get Free Quotes"
                    description="Connect with verified contractors and receive personalized quotes based on your project."
                  >
                    <Card className="bg-orange-500/10 border-orange-500/30">
                      <CardContent className="p-6">
                        <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Get Accurate Estimates
                        </h4>
                        <p className="text-gray-300 text-sm mb-4">
                          Choose how you'd like to connect with verified contractors in your area.
                        </p>
                        
                        <div className="space-y-3">
                          <Button 
                            onClick={handleGetEstimates}
                            disabled={leadMutation.isPending}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                          >
                            {leadMutation.isPending ? 'Connecting...' : (
                              <>
                                <Users className="h-4 w-4 mr-2" />
                                Get 3 Free Quotes (Recommended)
                              </>
                            )}
                          </Button>
                          
                          <div className="text-center text-gray-400 text-sm">or</div>
                          
                          <Link href="/contractors/board">
                            <Button 
                              variant="outline"
                              className="w-full border-navy-400 text-gray-300 hover:bg-navy-600"
                            >
                              Browse All Contractors
                            </Button>
                          </Link>
                        </div>
                        
                        <div className="mt-4 p-3 bg-navy-600/50 rounded-lg">
                          <p className="text-xs text-gray-400">
                            ✓ All contractors are verified and licensed<br/>
                            ✓ Free quotes with no obligation<br/>
                            ✓ Top-rated contractors in your area
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </GuestGate>
                </div>
              ) : (
                <Card className="bg-navy-600 border-navy-500">
                  <CardContent className="p-6 text-center">
                    <Calculator className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">
                      Fill out the project details and click "Calculate Estimate" to get your pricing range.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <div className="text-orange-500 text-2xl mb-3">📍</div>
            <h4 className="text-white font-semibold mb-2">Regional Accuracy</h4>
            <p className="text-gray-300 text-sm">Estimates based on local labor costs and material pricing in your county.</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <div className="text-orange-500 text-2xl mb-3">⚡</div>
            <h4 className="text-white font-semibold mb-2">Instant Results</h4>
            <p className="text-gray-300 text-sm">Get your estimate immediately with our advanced pricing algorithm.</p>
          </CardContent>
        </Card>

        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-6 text-center">
            <div className="text-orange-500 text-2xl mb-3">🔒</div>
            <h4 className="text-white font-semibold mb-2">No Commitment</h4>
            <p className="text-gray-300 text-sm">Free estimates with no obligation to hire. Compare quotes at your own pace.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
