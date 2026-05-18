import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingTrigger } from "./OnboardingTrigger";
import { useOnboarding } from "./OnboardingProvider";
import { Lightbulb, Play, Users, Calculator, Search } from "lucide-react";

export function OnboardingDemo() {
  const { currentTour, isTourCompleted } = useOnboarding();

  return (
    <Card className="bg-tsCard border-white/10 text-white max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-ts-orange" />
          Interactive Tours
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-white/70 mb-4">
          Learn how to use TradeScout with interactive guided tours:
        </div>

        <div className="space-y-2">
          <OnboardingTrigger
            tourKey="contractor-board-tour"
            variant="outline"
            className="w-full justify-start"
          >
            <Users className="h-4 w-4 mr-2" />
            Explore Local Business Flow
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
          <div className="mt-4 p-3 bg-ts-orange/20 rounded-lg border border-ts-orange/30">
            <div className="text-sm text-ts-orange">
              <strong>Tour Active:</strong> {currentTour}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
