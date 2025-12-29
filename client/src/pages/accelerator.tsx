import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Star, 
  Wrench, 
  DollarSign, 
  Users, 
  CheckCircle, 
  Calendar,
  Crown,
  TrendingUp,
  Shield,
  Award,
  Zap,
  Target
} from "lucide-react";

export default function Accelerator() {
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Crown className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            TradeScout <span className="text-purple-400">Accelerator Program</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Fast-track your contracting career with exclusive benefits, premium training, and elite networking opportunities
          </p>
        </div>

        {/* Main Program Card */}
        <Card className="bg-gradient-to-br from-purple-900/80 to-purple-800/60 border-purple-500 mb-8 backdrop-blur-sm">
          <CardContent className="p-8">
            {/* Program Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
              <div className="bg-purple-800/50 rounded-xl p-6 border border-purple-600/50 backdrop-blur-sm">
                <div className="flex items-center mb-4">
                  <Wrench className="h-7 w-7 text-purple-300 mr-3" />
                  <h3 className="text-xl font-semibold text-white">Premium Training</h3>
                </div>
                <p className="text-purple-200 mb-4">
                  Access exclusive workshops, certifications, and skill development programs from industry experts.
                </p>
                <ul className="text-purple-300 text-sm space-y-2">
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Advanced construction techniques</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Business management training</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Safety certification programs</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Technology integration workshops</li>
                </ul>
              </div>

              <div className="bg-purple-800/50 rounded-xl p-6 border border-purple-600/50 backdrop-blur-sm">
                <div className="flex items-center mb-4">
                  <Target className="h-7 w-7 text-purple-300 mr-3" />
                  <h3 className="text-xl font-semibold text-white">Connection Priority</h3>
                </div>
                <p className="text-purple-200 mb-4">
                  Get first access to high-value projects and premium client referrals in your area.
                </p>
                <ul className="text-purple-300 text-sm space-y-2">
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Priority connection routing</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Exclusive project opportunities</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Premium client matching</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Reduced competition on bids</li>
                </ul>
              </div>

              <div className="bg-purple-800/50 rounded-xl p-6 border border-purple-600/50 backdrop-blur-sm">
                <div className="flex items-center mb-4">
                  <Users className="h-7 w-7 text-purple-300 mr-3" />
                  <h3 className="text-xl font-semibold text-white">Elite Network</h3>
                </div>
                <p className="text-purple-200 mb-4">
                  Connect with top-tier contractors and industry leaders for collaboration and mentorship.
                </p>
                <ul className="text-purple-300 text-sm space-y-2">
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Monthly networking events</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Mentorship programs</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Partner contractor network</li>
                  <li className="flex items-center"><CheckCircle className="h-3 w-3 mr-2 text-green-400" />Industry insider access</li>
                </ul>
              </div>
            </div>

            {/* Comprehensive Benefits Section */}
            <div className="bg-gradient-to-r from-purple-900/70 to-purple-800/70 rounded-xl p-8 border border-purple-500/50 mb-8 backdrop-blur-sm">
              <h3 className="text-2xl font-semibold text-white mb-6 flex items-center">
                <Award className="h-6 w-6 text-purple-300 mr-3" />
                Comprehensive Program Benefits
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Priority project matching algorithm</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Free marketing materials & branding</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>24/7 priority support hotline</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Quarterly business check-ins</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Equipment financing programs</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Insurance discounts & group plans</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Featured contractor profile listings</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Advanced analytics dashboard</span>
                </div>
                <div className="flex items-center text-purple-200">
                  <Zap className="h-4 w-4 text-green-400 mr-3" />
                  <span>Exclusive industry reports</span>
                </div>
              </div>
            </div>

            {/* Free Platform Notice */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="bg-gradient-to-br from-green-800/80 to-green-700/60 rounded-xl p-8 border border-green-500 text-center backdrop-blur-sm">
                <Shield className="h-12 w-12 text-green-300 mx-auto mb-4" />
                <h3 className="text-3xl font-bold text-white mb-2">100% FREE</h3>
                <p className="text-green-200 text-lg">
                  TradeScout Platform
                </p>
                <p className="text-green-300 text-sm mt-2">
                  No fees • No commissions • Always free for contractors
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-800/80 to-purple-700/60 rounded-xl p-8 border border-purple-500 text-center backdrop-blur-sm">
                <TrendingUp className="h-12 w-12 text-purple-300 mx-auto mb-4" />
                <h3 className="text-3xl font-bold text-white mb-2">5-10x More</h3>
                <p className="text-purple-200 text-lg">
                  Project Opportunities
                </p>
                <p className="text-purple-300 text-sm mt-2">
                  Accelerator members get priority access to projects
                </p>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <Button 
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-10 py-4 text-lg font-semibold shadow-lg transform hover:scale-105 transition-all"
                  onClick={() => window.location.pathname = '/apply-accelerator'}
                >
                  <Crown className="h-5 w-5 mr-2" />
                  Apply Now
                </Button>
                <Button 
                  variant="outline" 
                  className="border-purple-600 text-purple-300 hover:bg-purple-800/50 px-10 py-4 text-lg font-semibold"
                  onClick={() => window.location.pathname = '/schedule-consultation'}
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Schedule Consultation
                </Button>
              </div>
              
              <div className="flex items-center justify-center space-x-4 text-purple-300 text-sm">
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  <span>Limited to 50 contractors per region</span>
                </div>
                <div className="hidden sm:block w-1 h-1 bg-purple-400 rounded-full"></div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  <span>Application review required</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Stories Teaser */}
        <div className="text-center">
          <p className="text-gray-400 text-lg">
            Join <span className="text-purple-400 font-semibold">200+ elite contractors</span> who have accelerated their business with TradeScout
          </p>
        </div>
      </div>
    </div>
  );
}