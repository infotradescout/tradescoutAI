import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Home,
  Wrench,
  Shield,
  MapPin,
  Users,
  Star,
  Building,
  Car,
  Heart,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { TradeScoutLogo } from "@/components/TradeScoutIcons";

type UserRole =
  | "homeowner"
  | "contractor"
  | "realtor"
  | "car_salesman"
  | "dealer"
  | "insurance_agent"
  | "property_manager"
  | "mortgage_broker";

interface RoleSelectionProps {
  onRoleSelect: (role: UserRole) => void;
  userInfo?: {
    name?: string;
    email?: string;
    profileImage?: string;
  };
  initialType?: "homeowner" | "professional";
}

const professionalRoles = [
  {
    id: "contractor" as const,
    icon: Wrench,
    title: "Business",
    description: "Services, products, or local expertise",
    color: "orange",
  },
  {
    id: "realtor" as const,
    icon: Building,
    title: "Realtor",
    description: "Real estate agent or broker",
    color: "purple",
  },
  {
    id: "car_salesman" as const,
    icon: Car,
    title: "Car Dealer",
    description: "Auto sales professional",
    color: "blue",
  },
  {
    id: "insurance_agent" as const,
    icon: Shield,
    title: "Insurance Agent",
    description: "Home & property insurance",
    color: "green",
  },
  {
    id: "property_manager" as const,
    icon: Briefcase,
    title: "Property Manager",
    description: "Rental property management",
    color: "indigo",
  },
  {
    id: "mortgage_broker" as const,
    icon: DollarSign,
    title: "Mortgage Broker",
    description: "Home loan specialist",
    color: "emerald",
  },
];

export function RoleSelection({ onRoleSelect, userInfo, initialType }: RoleSelectionProps) {
  const [accountType, setAccountType] = useState<"homeowner" | "professional" | null>(
    initialType || null
  );
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleContinue = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  // If no account type selected, show homeowner vs professional choice
  if (!accountType) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <TradeScoutLogo size="xl" variant="gradient" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to TradeScout</h1>
            <p className="text-muted-foreground">How do you plan to participate locally?</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Personal use option (maps to homeowner role internally) */}
            <Card
              className="cursor-pointer transition-all duration-300 border-2 border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/25"
              onClick={() => {
                setAccountType("homeowner");
                setSelectedRole("homeowner");
              }}
              data-testid="type-homeowner"
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Home className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-foreground">
                  Use TradeScout for my own projects
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-center mb-4">
                  Find trusted local services, projects, and community activity around you
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="w-4 h-4 text-primary" />
                    Browse verified local services
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Heart className="w-4 h-4 text-primary" />
                    Get help and estimates for real projects
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    Join conversations in your local community
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Work / business option (maps to professional roles internally) */}
            <Card
              className="cursor-pointer transition-all duration-300 border-2 border-border bg-card hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/25"
              onClick={() => setAccountType("professional")}
              data-testid="type-professional"
            >
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-3">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Briefcase className="w-10 h-10 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-foreground">
                  Offer services or run a business
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-center mb-4">
                  Show your work, offer services, and connect with people and organizations nearby
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    Connect with local people, businesses, and organizations
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Star className="w-4 h-4 text-primary" />
                    Build your reputation
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="w-4 h-4 text-primary" />
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
  if (accountType === "homeowner") {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <TradeScoutLogo size="xl" variant="gradient" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, Homeowner!</h1>
            <p className="text-muted-foreground">Let's set up your account</p>
            {userInfo?.name && (
              <div className="mt-4 flex items-center justify-center gap-3 p-3 bg-muted rounded-lg inline-flex">
                {userInfo.profileImage && (
                  <img
                    src={userInfo.profileImage}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <span className="text-foreground">Signed in as {userInfo.name}</span>
              </div>
            )}
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
                <Home className="w-12 h-12 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Homeowner Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Find local businesses, get quotes, join your community
                  </p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <div className="flex items-start gap-3 mb-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Verification Required</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Address verification needed to write recommendations (similar to Nextdoor)
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-continue-homeowner"
              >
                Continue
              </Button>

              <button
                onClick={() => {
                  setAccountType(null);
                  setSelectedRole(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
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
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TradeScoutLogo size="xl" variant="gradient" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Select Your Professional Role</h1>
          <p className="text-muted-foreground">
            Choose the option that best describes your business
          </p>
          {userInfo?.name && (
            <div className="mt-4 flex items-center justify-center gap-3 p-3 bg-muted rounded-lg inline-flex">
              {userInfo.profileImage && (
                <img
                  src={userInfo.profileImage}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="text-foreground">Signed in as {userInfo.name}</span>
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
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/25"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                }`}
                onClick={() => setSelectedRole(role.id)}
                data-testid={`role-${role.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div
                      className={`p-3 rounded-full ${isSelected ? "bg-primary/20" : "bg-muted"}`}
                    >
                      <Icon
                        className={`w-8 h-8 ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center justify-center gap-2">
                        {role.title}
                        {isSelected && <CheckCircle className="w-4 h-4 text-primary" />}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center space-y-4">
          <div className="bg-muted border border-border rounded-lg p-4 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">Verification Required</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Business verification required to appear on professional boards. Platform is 100%
                  FREE - no access fees or commissions.
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
                ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            data-testid="button-continue-professional"
          >
            {selectedRole ? "Continue" : "Select a Role to Continue"}
          </Button>

          <button
            onClick={() => {
              setAccountType(null);
              setSelectedRole(null);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to account type
          </button>
        </div>
      </div>
    </div>
  );
}
