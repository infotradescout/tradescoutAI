import { useAuth } from "@/hooks/useAuth";
import HomeownerDashboard from "./homeowner-dashboard";
import ContractorDashboard from "./contractor-dashboard";
import RealtorDashboard from "./realtor-dashboard";
import CarSalesmanDashboard from "./car-salesman-dashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { User, Briefcase, Settings } from "lucide-react";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-navy-600/50 rounded-md w-1/4"></div>
          <div className="h-4 bg-navy-600/50 rounded-md w-1/2"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-navy-600/50 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-700 border-navy-600 text-center">
          <CardContent className="p-12">
            <User className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to TradeScout</h2>
            <p className="text-gray-300 mb-6">Please sign in to access your dashboard</p>
            <div className="space-y-3">
              <Link href="/login">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600">
                  Create Account
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show role-specific onboarding if user hasn't completed it
  if (!user.onboardingCompleted) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-700 border-navy-600">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-orange-500/20 rounded-lg flex items-center justify-center mx-auto mb-6">
              {user.role === 'contractor_user' ? (
                <Briefcase className="h-8 w-8 text-orange-500" />
              ) : (
                <User className="h-8 w-8 text-orange-500" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Welcome to TradeScout!</h2>
            <p className="text-gray-300 mb-6">
              Let's complete your profile to get the most out of your {user.role === 'contractor_user' ? 'contractor' : 'homeowner'} experience.
            </p>
            
            {user.role === 'contractor_user' ? (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  As a contractor, you'll be able to receive leads, build your reputation, and grow your business.
                </p>
                <Link href="/contractors/apply">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    Complete Contractor Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  As a homeowner, you can find contractors, get estimates, and manage your projects.
                </p>
                <div className="flex gap-3 justify-center">
                  <Link href="/contractors/board">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                      Find Contractors
                    </Button>
                  </Link>
                  <Link href="/quote-calculator">
                    <Button variant="outline" className="border-navy-500 text-gray-300 hover:bg-navy-600">
                      Get Estimate
                    </Button>
                  </Link>
                </div>
              </div>
            )}
            
            <div className="mt-6 pt-6 border-t border-navy-600">
              <Button
                variant="ghost"
                className="text-gray-400 hover:text-white"
                onClick={() => {
                  // Mark onboarding as completed without additional setup
                  window.location.reload();
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Route to appropriate dashboard based on user role
  if (user.role === 'contractor_user' || user.role === 'accelerator_member') {
    return <ContractorDashboard />;
  }
  
  if (user.role === 'realtor') {
    return <RealtorDashboard />;
  }
  
  if (user.role === 'car_salesman') {
    return <CarSalesmanDashboard />;
  }
  
  return <HomeownerDashboard />;
}