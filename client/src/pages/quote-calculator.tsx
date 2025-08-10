import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Info, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EstimateInputs {
  projectType: string;
  squareFootage: string;
  urgency: string;
}

export default function EstimateCalculator() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [inputs, setInputs] = useState<EstimateInputs>({
    projectType: '',
    squareFootage: '',
    urgency: 'planning'
  });
  const [estimate, setEstimate] = useState<any>(null);

  const { data: counties } = useQuery({
    queryKey: ['/api/counties?state=CA'],
  });

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
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "We'll connect you with up to 3 contractors for detailed quotes.",
      });
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
    if (!inputs.projectType || !inputs.squareFootage) {
      toast({
        title: "Missing Information",
        description: "Please fill in project type and square footage.",
        variant: "destructive",
      });
      return;
    }
    calculateMutation.mutate(inputs);
  };

  const handleGetEstimates = async () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }

    leadMutation.mutate({
      projectType: inputs.projectType,
      description: `${inputs.squareFootage} sq ft ${inputs.projectType.toLowerCase()}`,
      tradeId: 'roofing', // This would be dynamic based on project type
      countyId: '06037', // Los Angeles - would be dynamic
      estimatedValue: estimate ? (estimate.low + estimate.high) / 2 : null,
      urgency: inputs.urgency,
      routingType: 'top3',
      calculatorData: { ...inputs, estimate },
    });
  };

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
                    <SelectContent>
                      <SelectItem value="roof-replacement">Roof Replacement</SelectItem>
                      <SelectItem value="roof-repair">Roof Repair</SelectItem>
                      <SelectItem value="new-roof">New Roof Installation</SelectItem>
                      <SelectItem value="roof-maintenance">Roof Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
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
                  disabled={calculateMutation.isPending}
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
                        Based on Los Angeles County pricing for {estimate.projectType?.replace('-', ' ')}
                      </p>
                      <Badge className="bg-amber-600 text-amber-100">
                        <Info className="h-3 w-3 mr-1" />
                        This is an estimate. Final pricing may vary based on specific project requirements.
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* Get Quotes CTA */}
                  <Card className="bg-orange-500/10 border-orange-500/30">
                    <CardContent className="p-6">
                      <h4 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Get Accurate Estimates
                      </h4>
                      <p className="text-gray-300 text-sm mb-4">
                        Connect with verified contractors in your area for detailed, personalized estimates.
                      </p>
                      <Button 
                        onClick={handleGetEstimates}
                        disabled={leadMutation.isPending}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold glow-effect transition-all duration-300"
                      >
                        {leadMutation.isPending ? 'Submitting...' : (
                          <>
                            <Users className="h-4 w-4 mr-2" />
                            Get 3 Free Quotes
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
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
