import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, Map, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";

export default function NotFound() {
  return (
    <>
      <SEOHelmet
        title="Page Not Found | TradeScout"
        description="The page you're looking for doesn't exist. Return to TradeScout home, explore counties, or get help."
        canonical="https://www.thetradescout.com/404"
      />
      <div
        className="min-h-screen w-full flex items-center justify-center px-4"
        style={{ backgroundColor: "var(--surface-app-bg)" }}
      >
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 pb-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-10 w-10 text-orange-500 flex-shrink-0" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Page Not Found</h1>
                <p className="text-sm text-gray-600 mt-1">We couldn't find the page you're looking for.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
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

            <p className="text-xs text-gray-500 mt-6 text-center">
              If you think this is an error, please <Link href="/contact" className="text-orange-600 hover:underline">contact support</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
