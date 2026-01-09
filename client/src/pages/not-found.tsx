import { Button } from "@/components/ui/button";
import { AlertCircle, Home, Map, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ErrorState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <>
      <SEOHelmet
        title="Page Not Found | TradeScout"
        description="The page you're looking for doesn't exist. Return to TradeScout home, explore counties, or get help."
        canonical="https://www.thetradescout.com/404"
      />
      <div className="min-h-screen w-full flex items-center justify-center px-4 bg-background">
        <div className="max-w-md w-full space-y-6">
          <ErrorState
            icon={<AlertCircle />}
            title="Page Not Found"
            description="We couldn't find the page you're looking for."
          />
          <div className="space-y-3">
            <Link href="/">
              <Button className="w-full justify-start" variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </Link>
            <Link href="/county-directory">
              <Button className="w-full justify-start" variant="outline">
                <Map className="h-4 w-4 mr-2" />
                Browse Counties
              </Button>
            </Link>
            <Link href="/how-it-works">
              <Button className="w-full justify-start" variant="outline">
                <HelpCircle className="h-4 w-4 mr-2" />
                How TradeScout Works
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
