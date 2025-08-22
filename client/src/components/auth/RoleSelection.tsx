import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Home, Wrench, Shield, MapPin, Users, Star } from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

interface RoleSelectionProps {
  onRoleSelect: (role: 'homeowner' | 'contractor') => void;
  userInfo?: {
    name?: string;
    email?: string;
    profileImage?: string;
  };
}

export function RoleSelection({ onRoleSelect, userInfo }: RoleSelectionProps) {
  const [selectedRole, setSelectedRole] = useState<'homeowner' | 'contractor' | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TradeScoutLogo size="xl" variant="gradient" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to TradeScout</h1>
          <p className="text-slate-400">Choose how you'd like to use our platform</p>
          {userInfo?.name && (
            <div className="mt-4 flex items-center justify-center gap-3 p-3 bg-slate-800/50 rounded-lg inline-flex">
              {userInfo.profileImage && (
                <img 
                  src={userInfo.profileImage} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="text-slate-200">Signed in as {userInfo.name}</span>
            </div>
          )}
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Homeowner Card */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 ${
              selectedRole === 'homeowner' 
                ? 'border-blue-500 bg-blue-900/20 shadow-lg shadow-blue-500/25' 
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70'
            }`}
            onClick={() => setSelectedRole('homeowner')}
            data-testid="role-homeowner"
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-4 rounded-full ${
                  selectedRole === 'homeowner' ? 'bg-blue-500/20' : 'bg-slate-700'
                }`}>
                  <Home className={`w-8 h-8 ${
                    selectedRole === 'homeowner' ? 'text-blue-400' : 'text-slate-400'
                  }`} />
                </div>
              </div>
              <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
                I'm a Homeowner
                {selectedRole === 'homeowner' && (
                  <CheckCircle className="w-5 h-5 text-blue-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-center">
                Find trusted contractors for your home improvement projects
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Find & Hire Contractors</div>
                    <div className="text-slate-400 text-sm">Browse verified local contractors</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Get Instant Quotes</div>
                    <div className="text-slate-400 text-sm">Request and compare estimates</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Write Recommendations</div>
                    <div className="text-slate-400 text-sm">Share experiences with neighbors</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/50 p-3 rounded-lg mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Verification Required</span>
                </div>
                <p className="text-xs text-slate-300">
                  ID and address verification needed to write recommendations (similar to Nextdoor)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contractor Card */}
          <Card 
            className={`cursor-pointer transition-all duration-300 border-2 ${
              selectedRole === 'contractor' 
                ? 'border-orange-500 bg-orange-900/20 shadow-lg shadow-orange-500/25' 
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70'
            }`}
            onClick={() => setSelectedRole('contractor')}
            data-testid="role-contractor"
          >
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-3">
                <div className={`p-4 rounded-full ${
                  selectedRole === 'contractor' ? 'bg-orange-500/20' : 'bg-slate-700'
                }`}>
                  <Wrench className={`w-8 h-8 ${
                    selectedRole === 'contractor' ? 'text-orange-400' : 'text-slate-400'
                  }`} />
                </div>
              </div>
              <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
                I'm a Contractor
                {selectedRole === 'contractor' && (
                  <CheckCircle className="w-5 h-5 text-orange-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-slate-300 text-center">
                Grow your business and connect with local homeowners
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Get Quality Leads</div>
                    <div className="text-slate-400 text-sm">Connect with local homeowners</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Build Your Reputation</div>
                    <div className="text-slate-400 text-sm">Earn recommendations and reviews</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium">Professional Network</div>
                    <div className="text-slate-400 text-sm">Join our verified contractor board</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-700/50 p-3 rounded-lg mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">Admin Verification</span>
                </div>
                <p className="text-xs text-slate-300">
                  Business verification required to appear on contractor board
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Continue Button */}
        <div className="text-center">
          <Button
            onClick={handleContinue}
            disabled={!selectedRole}
            size="lg"
            className={`px-8 py-3 font-semibold transition-all duration-300 ${
              selectedRole === 'homeowner' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : selectedRole === 'contractor'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
            data-testid="button-continue"
          >
            {selectedRole ? `Continue as ${selectedRole === 'homeowner' ? 'Homeowner' : 'Contractor'}` : 'Select a Role to Continue'}
          </Button>
          
          <p className="text-slate-500 text-sm mt-3">
            You can always change your role later in account settings
          </p>
        </div>
      </div>
    </div>
  );
}