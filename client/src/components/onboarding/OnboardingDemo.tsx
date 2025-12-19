import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingTrigger } from "./OnboardingTrigger";
import { useOnboarding } from "./OnboardingProvider";
import { Lightbulb, Play, Users, Calculator, Search } from "lucide-react";

export function OnboardingDemo() {
  const { currentTour, isTourCompleted } = useOnboarding();

  return (
    <Card className="bg-navy-800 border-navy-600 text-white max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-orange-500" />
          Interactive Tours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-300 mb-4">
          Learn how to use TradeScout with interactive guided tours:
        </div>
        
        <div className="space-y-2">
          <OnboardingTrigger 
            tourKey="contractor-board-tour"
            variant="outline"
            className="w-full justify-start"
          >
            <Users className="h-4 w-4 mr-2" />
            Explore Contractor Board
          </OnboardingTrigger>
          
          <OnboardingTrigger 
            tourKey="feature-tour-search"
            variant="outline"
            className="w-full justify-start"
          >
            <Search className="h-4 w-4 mr-2" />
            Learn Search & Filters
          </OnboardingTrigger>
          
          <OnboardingTrigger 
            tourKey="feature-tour-quote-calculator"
            variant="outline"
            className="w-full justify-start"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Scout Estimates Tour
          </OnboardingTrigger>
        </div>

        {currentTour && (
          <div className="mt-4 p-3 bg-orange-500/20 rounded-lg border border-orange-500/30">
            <div className="text-sm text-orange-200">
              <strong>Tour Active:</strong> {currentTour}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}