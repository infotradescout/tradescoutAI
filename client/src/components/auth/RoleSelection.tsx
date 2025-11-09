import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Home, Wrench, Shield, MapPin, Users, Star, Building, Car, Heart, DollarSign, Briefcase } from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

type UserRole = 'homeowner' | 'contractor' | 'realtor' | 'car_salesman' | 'dealer' | 'insurance_agent' | 'property_manager' | 'mortgage_broker';

interface RoleSelectionProps {
  onRoleSelect: (role: UserRole) => void;
  userInfo?: {
    name?: string;
    email?: string;
    profileImage?: string;
  };
  initialType?: 'homeowner' | 'professional';
}

const professionalRoles = [
  {
    id: 'contractor' as const,
    icon: Wrench,
    title: 'Contractor',
    description: 'Plumber, Electrician, HVAC, etc.',
    color: 'orange'
  },
  {
    id: 'realtor' as const,
    icon: Building,
    title: 'Realtor',
    description: 'Real estate agent or broker',
    color: 'purple'
  },
  {
    id: 'car_salesman' as const,
    icon: Car,
    title: 'Car Dealer',
    description: 'Auto sales professional',
    color: 'blue'
  },
  {
    id: 'insurance_agent' as const,
    icon: Shield,
    title: 'Insurance Agent',
    description: 'Home & property insurance',
    color: 'green'
  },
  {
    id: 'property_manager' as const,
    icon: Briefcase,
    title: 'Property Manager',
    description: 'Rental property management',
    color: 'indigo'
  },
  {
    id: 'mortgage_broker' as const,
    icon: DollarSign,
    title: 'Mortgage Broker',
    description: 'Home loan specialist',
    color: 'emerald'
  }
];

export function RoleSelection({ onRoleSelect, userInfo, initialType }: RoleSelectionProps) {
  const [accountType, setAccountType] = useState<'homeowner' | 'professional' | null>(initialType || null);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  // If no account type selected, show homeowner vs professional choice
  if (!accountType) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <TradeScoutLogo size="xl" variant="gradient" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to TradeScout</h1>
            <p className="text-slate-400">How would you like to get started?</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Homeowner Option */}
            <Card 
              className="cursor-pointer transition-all duration-300 border-2 border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-blue-900/20 hover:shadow-lg hover:shadow-blue-500/25"
              onClick={() => {
                setAccountType('homeowner');
                setSelectedRole('homeowner');
              }}
              data-testid="type-homeowner"
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className="p-4 rounded-full bg-blue-500/20">
                    <Home className="w-10 h-10 text-blue-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-white">I'm a Homeowner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-300 text-center mb-4">
                  Find trusted contractors and professionals for your home projects
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Star className="w-4 h-4 text-blue-400" />
                    Browse verified contractors
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Heart className="w-4 h-4 text-blue-400" />
                    Get instant quotes
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4 text-blue-400" />
                    Join your local community
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Option */}
            <Card 
              className="cursor-pointer transition-all duration-300 border-2 border-slate-700 bg-slate-800/50 hover:border-orange-500 hover:bg-orange-900/20 hover:shadow-lg hover:shadow-orange-500/25"
              onClick={() => setAccountType('professional')}
              data-testid="type-professional"
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className="p-4 rounded-full bg-orange-500/20">
                    <Briefcase className="w-10 h-10 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-white">I'm a Professional</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-300 text-center mb-4">
                  Grow your business and connect with local customers
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="w-4 h-4 text-orange-400" />
                    Connect with homeowners
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Star className="w-4 h-4 text-orange-400" />
                    Build your reputation
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <DollarSign className="w-4 h-4 text-orange-400" />
                    100% FREE - No fees
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // If homeowner selected, proceed directly
  if (accountType === 'homeowner') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <TradeScoutLogo size="xl" variant="gradient" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome, Homeowner!</h1>
            <p className="text-slate-400">Let's set up your account</p>
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

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <Home className="w-12 h-12 text-blue-400" />
                <div>
                  <h3 className="text-lg font-semibold text-white">Homeowner Account</h3>
                  <p className="text-sm text-slate-400">Find contractors, get quotes, join your community</p>
                </div>
              </div>

              <div className="bg-slate-700/50 p-4 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <MapPin className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-white">Verification Required</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Address verification needed to write recommendations (similar to Nextdoor)
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-continue-homeowner"
              >
                Continue
              </Button>

              <button
                onClick={() => {
                  setAccountType(null);
                  setSelectedRole(null);
                }}
                className="text-sm text-slate-400 hover:text-white transition-colors w-full"
              >
                ← Back to account type
              </button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // If professional selected, show professional role options
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TradeScoutLogo size="xl" variant="gradient" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Select Your Professional Role</h1>
          <p className="text-slate-400">Choose the option that best describes your business</p>
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {professionalRoles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            
            return (
              <Card 
                key={role.id}
                className={`cursor-pointer transition-all duration-300 border-2 ${
                  isSelected
                    ? `border-${role.color}-500 bg-${role.color}-900/20 shadow-lg shadow-${role.color}-500/25` 
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800/70'
                }`}
                onClick={() => setSelectedRole(role.id)}
                data-testid={`role-${role.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`p-3 rounded-full ${
                      isSelected ? `bg-${role.color}-500/20` : 'bg-slate-700'
                    }`}>
                      <Icon className={`w-8 h-8 ${
                        isSelected ? `text-${role.color}-400` : 'text-slate-400'
                      }`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white flex items-center justify-center gap-2">
                        {role.title}
                        {isSelected && <CheckCircle className={`w-4 h-4 text-${role.color}-400`} />}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">{role.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center space-y-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-white">Verification Required</p>
                <p className="text-xs text-slate-400 mt-1">
                  Business verification required to appear on professional boards. Platform is 100% FREE - no fees, subscriptions, or commissions.
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleContinue}
            disabled={!selectedRole}
            size="lg"
            className={`px-8 py-3 font-semibold transition-all duration-300 ${
              selectedRole
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
            data-testid="button-continue-professional"
          >
            {selectedRole ? 'Continue' : 'Select a Role to Continue'}
          </Button>
          
          <button
            onClick={() => {
              setAccountType(null);
              setSelectedRole(null);
            }}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            ← Back to account type
          </button>
        </div>
      </div>
    </div>
  );
}
