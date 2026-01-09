import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Calculator, Users, ArrowRight } from "lucide-react";
import { AdDisplay, useUserLocation } from "@/components/AdDisplay";
import { AuthButtons } from "@/components/auth-buttons";
import { AuthModal } from "@/components/auth-modal";
import { ProofMetricsSnapshot } from "@/components/ProofMetricsSnapshot";
import { TestingErrorReportButton } from "@/components/TestingErrorReportButton";
import { BugReportButton } from "@/components/BugReportButton";
import {
  SEOHelmet,
  createWebsiteStructuredData,
  createOrganizationStructuredData,
  createFAQStructuredData,
} from "@/components/SEOHelmet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useLocationContext } from "@/hooks/useLocationContext";
import { useContextualCopy } from "@/hooks/useContextualCopy";

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [, setLocation] = useLocation();
  const userLocation = useUserLocation();
  const locationCtx = useLocationContext();

  const addressParts =
    user?.address
      ?.split(",")
      .map((part: string) => part.trim())
      .filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const heroCommunity = isAuthenticated && communityLabel ? communityLabel : "Your Community";
  const ownerName = user?.firstName || user?.lastName || "you";

  const { line: contextualHeroLine } = useContextualCopy({
    stateCode: locationCtx.stateCode,
    countyFips: locationCtx.countyFips,
    interest: "auto_dealers",
    timeframe: "7d",
    fallback:
      "New local activity will show up here as TradeScout onboards more neighbors in your area.",
  });

  const handleGuestContinue = () => {
    setIsGuestMode(true);
    localStorage.setItem("guestMode", "true");
    setLocation("/contractors/board");
  };

  // FAQ structured data for the landing page
  const faqData = [
    {
      question: "How do I find contractors in my area?",
      answer:
        "Simply select your state and area on TradeScout, then browse verified contractors near you. You can filter by service type, read RECOMMENDATIONS, and get instant quotes.",
    },
    {
      question: "Are all contractors on TradeScout verified?",
      answer:
        "Yes, all contractors on TradeScout go through a comprehensive verification process including background checks, license verification, and insurance confirmation.",
    },
    {
      question: "How many free quotes can I get?",
      answer:
        "You can get up to 3 free quotes from different contractors for your project, allowing you to compare prices and choose the best fit for your needs.",
    },
    {
      question: "What types of home improvement services are available?",
      answer:
        "TradeScout covers 75+ contractor specialties including roofing, plumbing, electrical, HVAC, flooring, kitchen remodeling, bathroom renovation, and general contracting.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      createWebsiteStructuredData(),
      createOrganizationStructuredData(),
      createFAQStructuredData(faqData),
    ],
  };

  return (
    <ScrollArea
      className="h-full"
      headerHeight={64}
      pageHeight={window.innerHeight}
      scrollToTop={true}
      onScrollChange={(scrollTop) => {
        // Parallax effect for hero section
        const heroElement = document.querySelector(".hero-section") as HTMLElement;
        if (heroElement) {
          heroElement.style.transform = `translateY(${scrollTop * 0.5}px)`;
        }
      }}
    >
      <div className="min-h-full gradient-bg w-full max-w-full overflow-x-hidden">
        <SEOHelmet
          title="Find Trusted Local Contractors | TradeScout"
          description="Connect with verified local contractors. Get 3 free quotes, read recommendations, and hire with confidence. Local pros for roofing, plumbing, electrical, and more."
          keywords="local contractors, home improvement, verified contractors, free quotes, trusted contractors, roofing contractors, plumbing contractors, electrical contractors, kitchen remodeling, bathroom renovation"
          canonical="https://www.thetradescout.com"
          structuredData={structuredData}
        />

        {/* Development Notice */}
        <div className="bg-orange-500 text-white text-center py-2 px-4">
          <p className="text-sm font-medium">
            🚧 Development Environment - Testing features and functionality
          </p>
        </div>

        {/* Hero Section */}
        <section className="hero-section py-6 md:py-12 w-full max-w-full">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full">
            <div className="text-center mb-8 md:mb-16">
              <h1 className="text-2xl md:text-4xl lg:text-6xl font-bold text-white mb-4 md:mb-6 leading-tight">
                Local trust + routing — decisions before contact.
              </h1>
              <div className="max-w-2xl mx-auto mb-6 md:mb-8">
                <ul className="text-base md:text-lg text-gray-300 space-y-2">
                  <li>• Contact is gated by Decision Cards.</li>
                  <li>• Claims can be verified (VAC) where available.</li>
                  <li>• Routing favors proof, not ads.</li>
                </ul>
              </div>

              <ProofMetricsSnapshot />

              {/* County Search */}
              <div className="max-w-2xl mx-auto">
                <Card className="bg-surface border-subtle">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                          State
                        </label>
                        <Select value={selectedState} onValueChange={setSelectedState}>
                          <SelectTrigger className="form-field">
                            <SelectValue placeholder="Select State" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface border-subtle text-primary max-h-[300px] overflow-y-auto">
                            <SelectItem
                              value="AL"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Alabama
                            </SelectItem>
                            <SelectItem
                              value="AK"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Alaska
                            </SelectItem>
                            <SelectItem
                              value="AZ"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Arizona
                            </SelectItem>
                            <SelectItem
                              value="AR"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Arkansas
                            </SelectItem>
                            <SelectItem
                              value="CA"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              California
                            </SelectItem>
                            <SelectItem
                              value="CO"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Colorado
                            </SelectItem>
                            <SelectItem
                              value="CT"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Connecticut
                            </SelectItem>
                            <SelectItem
                              value="DE"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Delaware
                            </SelectItem>
                            <SelectItem
                              value="DC"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              District of Columbia
                            </SelectItem>
                            <SelectItem
                              value="FL"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Florida
                            </SelectItem>
                            <SelectItem
                              value="GA"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Georgia
                            </SelectItem>
                            <SelectItem
                              value="HI"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Hawaii
                            </SelectItem>
                            <SelectItem
                              value="ID"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Idaho
                            </SelectItem>
                            <SelectItem
                              value="IL"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Illinois
                            </SelectItem>
                            <SelectItem
                              value="IN"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Indiana
                            </SelectItem>
                            <SelectItem
                              value="IA"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Iowa
                            </SelectItem>
                            <SelectItem
                              value="KS"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Kansas
                            </SelectItem>
                            <SelectItem
                              value="KY"
                              className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                            >
                              Kentucky
                            </SelectItem>
                            <SelectItem
                              value="LA"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Louisiana
                            </SelectItem>
                            <SelectItem
                              value="ME"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Maine
                            </SelectItem>
                            <SelectItem
                              value="MD"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Maryland
                            </SelectItem>
                            <SelectItem
                              value="MA"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Massachusetts
                            </SelectItem>
                            <SelectItem
                              value="MI"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Michigan
                            </SelectItem>
                            <SelectItem
                              value="MN"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Minnesota
                            </SelectItem>
                            <SelectItem
                              value="MS"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Mississippi
                            </SelectItem>
                            <SelectItem
                              value="MO"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Missouri
                            </SelectItem>
                            <SelectItem
                              value="MT"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Montana
                            </SelectItem>
                            <SelectItem
                              value="NE"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Nebraska
                            </SelectItem>
                            <SelectItem
                              value="NV"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Nevada
                            </SelectItem>
                            <SelectItem
                              value="NH"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              New Hampshire
                            </SelectItem>
                            <SelectItem
                              value="NJ"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              New Jersey
                            </SelectItem>
                            <SelectItem
                              value="NM"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              New Mexico
                            </SelectItem>
                            <SelectItem
                              value="NY"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              New York
                            </SelectItem>
                            <SelectItem
                              value="NC"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              North Carolina
                            </SelectItem>
                            <SelectItem
                              value="ND"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              North Dakota
                            </SelectItem>
                            <SelectItem
                              value="OH"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Ohio
                            </SelectItem>
                            <SelectItem
                              value="OK"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Oklahoma
                            </SelectItem>
                            <SelectItem
                              value="OR"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Oregon
                            </SelectItem>
                            <SelectItem
                              value="PA"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Pennsylvania
                            </SelectItem>
                            <SelectItem
                              value="RI"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Rhode Island
                            </SelectItem>
                            <SelectItem
                              value="SC"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              South Carolina
                            </SelectItem>
                            <SelectItem
                              value="SD"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              South Dakota
                            </SelectItem>
                            <SelectItem
                              value="TN"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Tennessee
                            </SelectItem>
                            <SelectItem
                              value="TX"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Texas
                            </SelectItem>
                            <SelectItem
                              value="UT"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Utah
                            </SelectItem>
                            <SelectItem
                              value="VT"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Vermont
                            </SelectItem>
                            <SelectItem
                              value="VA"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Virginia
                            </SelectItem>
                            <SelectItem
                              value="WA"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Washington
                            </SelectItem>
                            <SelectItem
                              value="WV"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              West Virginia
                            </SelectItem>
                            <SelectItem
                              value="WI"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Wisconsin
                            </SelectItem>
                            <SelectItem
                              value="WY"
                              className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white"
                            >
                              Wyoming
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                          County
                        </label>
                        <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                          <SelectTrigger className="form-field">
                            <SelectValue placeholder="Select County" />
                          </SelectTrigger>
                          <SelectContent className="bg-surface border-subtle text-primary max-h-[300px] overflow-y-auto">
                            {selectedState === "CA" && (
                              <>
                                <SelectItem
                                  value="06001"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Alameda County
                                </SelectItem>
                                <SelectItem
                                  value="06003"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Alpine County
                                </SelectItem>
                                <SelectItem
                                  value="06005"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Amador County
                                </SelectItem>
                                <SelectItem
                                  value="06007"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Butte County
                                </SelectItem>
                                <SelectItem
                                  value="06009"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Calaveras County
                                </SelectItem>
                                <SelectItem
                                  value="06011"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Colusa County
                                </SelectItem>
                                <SelectItem
                                  value="06013"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Contra Costa County
                                </SelectItem>
                                <SelectItem
                                  value="06015"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Del Norte County
                                </SelectItem>
                                <SelectItem
                                  value="06017"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  El Dorado County
                                </SelectItem>
                                <SelectItem
                                  value="06019"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fresno County
                                </SelectItem>
                                <SelectItem
                                  value="06021"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Glenn County
                                </SelectItem>
                                <SelectItem
                                  value="06023"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Humboldt County
                                </SelectItem>
                                <SelectItem
                                  value="06025"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Imperial County
                                </SelectItem>
                                <SelectItem
                                  value="06027"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Inyo County
                                </SelectItem>
                                <SelectItem
                                  value="06029"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kern County
                                </SelectItem>
                                <SelectItem
                                  value="06031"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kings County
                                </SelectItem>
                                <SelectItem
                                  value="06033"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lake County
                                </SelectItem>
                                <SelectItem
                                  value="06035"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lassen County
                                </SelectItem>
                                <SelectItem
                                  value="06037"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Los Angeles County
                                </SelectItem>
                                <SelectItem
                                  value="06039"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Madera County
                                </SelectItem>
                                <SelectItem
                                  value="06041"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Marin County
                                </SelectItem>
                                <SelectItem
                                  value="06043"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mariposa County
                                </SelectItem>
                                <SelectItem
                                  value="06045"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mendocino County
                                </SelectItem>
                                <SelectItem
                                  value="06047"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Merced County
                                </SelectItem>
                                <SelectItem
                                  value="06049"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Modoc County
                                </SelectItem>
                                <SelectItem
                                  value="06051"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mono County
                                </SelectItem>
                                <SelectItem
                                  value="06053"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Monterey County
                                </SelectItem>
                                <SelectItem
                                  value="06055"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Napa County
                                </SelectItem>
                                <SelectItem
                                  value="06057"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nevada County
                                </SelectItem>
                                <SelectItem
                                  value="06059"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Orange County
                                </SelectItem>
                                <SelectItem
                                  value="06061"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Placer County
                                </SelectItem>
                                <SelectItem
                                  value="06063"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Plumas County
                                </SelectItem>
                                <SelectItem
                                  value="06065"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Riverside County
                                </SelectItem>
                                <SelectItem
                                  value="06067"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sacramento County
                                </SelectItem>
                                <SelectItem
                                  value="06069"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Benito County
                                </SelectItem>
                                <SelectItem
                                  value="06071"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Bernardino County
                                </SelectItem>
                                <SelectItem
                                  value="06073"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Diego County
                                </SelectItem>
                                <SelectItem
                                  value="06075"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Francisco County
                                </SelectItem>
                                <SelectItem
                                  value="06077"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Joaquin County
                                </SelectItem>
                                <SelectItem
                                  value="06079"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Luis Obispo County
                                </SelectItem>
                                <SelectItem
                                  value="06081"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Mateo County
                                </SelectItem>
                                <SelectItem
                                  value="06083"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Santa Barbara County
                                </SelectItem>
                                <SelectItem
                                  value="06085"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Santa Clara County
                                </SelectItem>
                                <SelectItem
                                  value="06087"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Santa Cruz County
                                </SelectItem>
                                <SelectItem
                                  value="06089"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Shasta County
                                </SelectItem>
                                <SelectItem
                                  value="06091"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sierra County
                                </SelectItem>
                                <SelectItem
                                  value="06093"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Siskiyou County
                                </SelectItem>
                                <SelectItem
                                  value="06095"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Solano County
                                </SelectItem>
                                <SelectItem
                                  value="06097"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sonoma County
                                </SelectItem>
                                <SelectItem
                                  value="06099"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Stanislaus County
                                </SelectItem>
                                <SelectItem
                                  value="06101"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sutter County
                                </SelectItem>
                                <SelectItem
                                  value="06103"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tehama County
                                </SelectItem>
                                <SelectItem
                                  value="06105"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Trinity County
                                </SelectItem>
                                <SelectItem
                                  value="06107"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tulare County
                                </SelectItem>
                                <SelectItem
                                  value="06109"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tuolumne County
                                </SelectItem>
                                <SelectItem
                                  value="06111"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ventura County
                                </SelectItem>
                                <SelectItem
                                  value="06113"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Yolo County
                                </SelectItem>
                                <SelectItem
                                  value="06115"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Yuba County
                                </SelectItem>
                              </>
                            )}
                            {selectedState === "TX" && (
                              <>
                                <SelectItem
                                  value="48001"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Anderson County
                                </SelectItem>
                                <SelectItem
                                  value="48003"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Andrews County
                                </SelectItem>
                                <SelectItem
                                  value="48005"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Angelina County
                                </SelectItem>
                                <SelectItem
                                  value="48007"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Aransas County
                                </SelectItem>
                                <SelectItem
                                  value="48009"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Archer County
                                </SelectItem>
                                <SelectItem
                                  value="48011"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Armstrong County
                                </SelectItem>
                                <SelectItem
                                  value="48013"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Atascosa County
                                </SelectItem>
                                <SelectItem
                                  value="48015"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Austin County
                                </SelectItem>
                                <SelectItem
                                  value="48017"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bailey County
                                </SelectItem>
                                <SelectItem
                                  value="48019"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bandera County
                                </SelectItem>
                                <SelectItem
                                  value="48021"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bastrop County
                                </SelectItem>
                                <SelectItem
                                  value="48023"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Baylor County
                                </SelectItem>
                                <SelectItem
                                  value="48025"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bee County
                                </SelectItem>
                                <SelectItem
                                  value="48027"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bell County
                                </SelectItem>
                                <SelectItem
                                  value="48029"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bexar County
                                </SelectItem>
                                <SelectItem
                                  value="48031"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Blanco County
                                </SelectItem>
                                <SelectItem
                                  value="48033"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Borden County
                                </SelectItem>
                                <SelectItem
                                  value="48035"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bosque County
                                </SelectItem>
                                <SelectItem
                                  value="48037"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bowie County
                                </SelectItem>
                                <SelectItem
                                  value="48039"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brazoria County
                                </SelectItem>
                                <SelectItem
                                  value="48041"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brazos County
                                </SelectItem>
                                <SelectItem
                                  value="48043"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brewster County
                                </SelectItem>
                                <SelectItem
                                  value="48045"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Briscoe County
                                </SelectItem>
                                <SelectItem
                                  value="48047"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brooks County
                                </SelectItem>
                                <SelectItem
                                  value="48049"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brown County
                                </SelectItem>
                                <SelectItem
                                  value="48051"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Burleson County
                                </SelectItem>
                                <SelectItem
                                  value="48053"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Burnet County
                                </SelectItem>
                                <SelectItem
                                  value="48055"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Caldwell County
                                </SelectItem>
                                <SelectItem
                                  value="48057"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Calhoun County
                                </SelectItem>
                                <SelectItem
                                  value="48059"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Callahan County
                                </SelectItem>
                                <SelectItem
                                  value="48061"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cameron County
                                </SelectItem>
                                <SelectItem
                                  value="48063"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Camp County
                                </SelectItem>
                                <SelectItem
                                  value="48065"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Carson County
                                </SelectItem>
                                <SelectItem
                                  value="48067"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cass County
                                </SelectItem>
                                <SelectItem
                                  value="48069"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Castro County
                                </SelectItem>
                                <SelectItem
                                  value="48071"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Chambers County
                                </SelectItem>
                                <SelectItem
                                  value="48073"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cherokee County
                                </SelectItem>
                                <SelectItem
                                  value="48075"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Childress County
                                </SelectItem>
                                <SelectItem
                                  value="48077"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Clay County
                                </SelectItem>
                                <SelectItem
                                  value="48079"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cochran County
                                </SelectItem>
                                <SelectItem
                                  value="48081"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Coke County
                                </SelectItem>
                                <SelectItem
                                  value="48083"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Coleman County
                                </SelectItem>
                                <SelectItem
                                  value="48085"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Collin County
                                </SelectItem>
                                <SelectItem
                                  value="48087"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Collingsworth County
                                </SelectItem>
                                <SelectItem
                                  value="48089"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Colorado County
                                </SelectItem>
                                <SelectItem
                                  value="48091"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Comal County
                                </SelectItem>
                                <SelectItem
                                  value="48093"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Comanche County
                                </SelectItem>
                                <SelectItem
                                  value="48095"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Concho County
                                </SelectItem>
                                <SelectItem
                                  value="48097"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cooke County
                                </SelectItem>
                                <SelectItem
                                  value="48099"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Coryell County
                                </SelectItem>
                                <SelectItem
                                  value="48101"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cottle County
                                </SelectItem>
                                <SelectItem
                                  value="48103"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Crane County
                                </SelectItem>
                                <SelectItem
                                  value="48105"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Crockett County
                                </SelectItem>
                                <SelectItem
                                  value="48107"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Crosby County
                                </SelectItem>
                                <SelectItem
                                  value="48109"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Culberson County
                                </SelectItem>
                                <SelectItem
                                  value="48111"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dallam County
                                </SelectItem>
                                <SelectItem
                                  value="48113"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dallas County
                                </SelectItem>
                                <SelectItem
                                  value="48115"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dawson County
                                </SelectItem>
                                <SelectItem
                                  value="48117"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Deaf Smith County
                                </SelectItem>
                                <SelectItem
                                  value="48119"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Delta County
                                </SelectItem>
                                <SelectItem
                                  value="48121"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Denton County
                                </SelectItem>
                                <SelectItem
                                  value="48123"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  DeWitt County
                                </SelectItem>
                                <SelectItem
                                  value="48125"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dickens County
                                </SelectItem>
                                <SelectItem
                                  value="48127"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dimmit County
                                </SelectItem>
                                <SelectItem
                                  value="48129"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Donley County
                                </SelectItem>
                                <SelectItem
                                  value="48131"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Duval County
                                </SelectItem>
                                <SelectItem
                                  value="48133"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Eastland County
                                </SelectItem>
                                <SelectItem
                                  value="48135"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ector County
                                </SelectItem>
                                <SelectItem
                                  value="48137"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Edwards County
                                </SelectItem>
                                <SelectItem
                                  value="48139"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ellis County
                                </SelectItem>
                                <SelectItem
                                  value="48141"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  El Paso County
                                </SelectItem>
                                <SelectItem
                                  value="48143"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Erath County
                                </SelectItem>
                                <SelectItem
                                  value="48145"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Falls County
                                </SelectItem>
                                <SelectItem
                                  value="48147"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fannin County
                                </SelectItem>
                                <SelectItem
                                  value="48149"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fayette County
                                </SelectItem>
                                <SelectItem
                                  value="48151"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fisher County
                                </SelectItem>
                                <SelectItem
                                  value="48153"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Floyd County
                                </SelectItem>
                                <SelectItem
                                  value="48155"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Foard County
                                </SelectItem>
                                <SelectItem
                                  value="48157"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fort Bend County
                                </SelectItem>
                                <SelectItem
                                  value="48159"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Franklin County
                                </SelectItem>
                                <SelectItem
                                  value="48161"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Freestone County
                                </SelectItem>
                                <SelectItem
                                  value="48163"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Frio County
                                </SelectItem>
                                <SelectItem
                                  value="48165"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gaines County
                                </SelectItem>
                                <SelectItem
                                  value="48167"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Galveston County
                                </SelectItem>
                                <SelectItem
                                  value="48169"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Garza County
                                </SelectItem>
                                <SelectItem
                                  value="48171"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gillespie County
                                </SelectItem>
                                <SelectItem
                                  value="48173"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Glasscock County
                                </SelectItem>
                                <SelectItem
                                  value="48175"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Goliad County
                                </SelectItem>
                                <SelectItem
                                  value="48177"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gonzales County
                                </SelectItem>
                                <SelectItem
                                  value="48179"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gray County
                                </SelectItem>
                                <SelectItem
                                  value="48181"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Grayson County
                                </SelectItem>
                                <SelectItem
                                  value="48183"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gregg County
                                </SelectItem>
                                <SelectItem
                                  value="48185"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Grimes County
                                </SelectItem>
                                <SelectItem
                                  value="48187"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Guadalupe County
                                </SelectItem>
                                <SelectItem
                                  value="48189"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hale County
                                </SelectItem>
                                <SelectItem
                                  value="48191"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hall County
                                </SelectItem>
                                <SelectItem
                                  value="48193"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hamilton County
                                </SelectItem>
                                <SelectItem
                                  value="48195"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hansford County
                                </SelectItem>
                                <SelectItem
                                  value="48197"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hardeman County
                                </SelectItem>
                                <SelectItem
                                  value="48199"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hardin County
                                </SelectItem>
                                <SelectItem
                                  value="48201"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Harris County
                                </SelectItem>
                                <SelectItem
                                  value="48203"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Harrison County
                                </SelectItem>
                                <SelectItem
                                  value="48205"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hartley County
                                </SelectItem>
                                <SelectItem
                                  value="48207"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Haskell County
                                </SelectItem>
                                <SelectItem
                                  value="48209"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hays County
                                </SelectItem>
                                <SelectItem
                                  value="48211"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hemphill County
                                </SelectItem>
                                <SelectItem
                                  value="48213"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Henderson County
                                </SelectItem>
                                <SelectItem
                                  value="48215"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hidalgo County
                                </SelectItem>
                                <SelectItem
                                  value="48217"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hill County
                                </SelectItem>
                                <SelectItem
                                  value="48219"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hockley County
                                </SelectItem>
                                <SelectItem
                                  value="48221"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hood County
                                </SelectItem>
                                <SelectItem
                                  value="48223"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hopkins County
                                </SelectItem>
                                <SelectItem
                                  value="48225"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Houston County
                                </SelectItem>
                                <SelectItem
                                  value="48227"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Howard County
                                </SelectItem>
                                <SelectItem
                                  value="48229"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hudspeth County
                                </SelectItem>
                                <SelectItem
                                  value="48231"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hunt County
                                </SelectItem>
                                <SelectItem
                                  value="48233"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hutchinson County
                                </SelectItem>
                                <SelectItem
                                  value="48235"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Irion County
                                </SelectItem>
                                <SelectItem
                                  value="48237"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jack County
                                </SelectItem>
                                <SelectItem
                                  value="48239"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jackson County
                                </SelectItem>
                                <SelectItem
                                  value="48241"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jasper County
                                </SelectItem>
                                <SelectItem
                                  value="48243"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jeff Davis County
                                </SelectItem>
                                <SelectItem
                                  value="48245"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jefferson County
                                </SelectItem>
                                <SelectItem
                                  value="48247"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jim Hogg County
                                </SelectItem>
                                <SelectItem
                                  value="48249"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jim Wells County
                                </SelectItem>
                                <SelectItem
                                  value="48251"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Johnson County
                                </SelectItem>
                                <SelectItem
                                  value="48253"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jones County
                                </SelectItem>
                                <SelectItem
                                  value="48255"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Karnes County
                                </SelectItem>
                                <SelectItem
                                  value="48257"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kaufman County
                                </SelectItem>
                                <SelectItem
                                  value="48259"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kendall County
                                </SelectItem>
                                <SelectItem
                                  value="48261"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kenedy County
                                </SelectItem>
                                <SelectItem
                                  value="48263"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kent County
                                </SelectItem>
                                <SelectItem
                                  value="48265"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kerr County
                                </SelectItem>
                                <SelectItem
                                  value="48267"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kimble County
                                </SelectItem>
                                <SelectItem
                                  value="48269"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  King County
                                </SelectItem>
                                <SelectItem
                                  value="48271"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kinney County
                                </SelectItem>
                                <SelectItem
                                  value="48273"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kleberg County
                                </SelectItem>
                                <SelectItem
                                  value="48275"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Knox County
                                </SelectItem>
                                <SelectItem
                                  value="48277"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lamar County
                                </SelectItem>
                                <SelectItem
                                  value="48279"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lamb County
                                </SelectItem>
                                <SelectItem
                                  value="48281"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lampasas County
                                </SelectItem>
                                <SelectItem
                                  value="48283"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  La Salle County
                                </SelectItem>
                                <SelectItem
                                  value="48285"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lavaca County
                                </SelectItem>
                                <SelectItem
                                  value="48287"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lee County
                                </SelectItem>
                                <SelectItem
                                  value="48289"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Leon County
                                </SelectItem>
                                <SelectItem
                                  value="48291"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Liberty County
                                </SelectItem>
                                <SelectItem
                                  value="48293"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Limestone County
                                </SelectItem>
                                <SelectItem
                                  value="48295"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lipscomb County
                                </SelectItem>
                                <SelectItem
                                  value="48297"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Live Oak County
                                </SelectItem>
                                <SelectItem
                                  value="48299"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Llano County
                                </SelectItem>
                                <SelectItem
                                  value="48301"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Loving County
                                </SelectItem>
                                <SelectItem
                                  value="48303"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lubbock County
                                </SelectItem>
                                <SelectItem
                                  value="48305"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lynn County
                                </SelectItem>
                                <SelectItem
                                  value="48307"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  McCulloch County
                                </SelectItem>
                                <SelectItem
                                  value="48309"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  McLennan County
                                </SelectItem>
                                <SelectItem
                                  value="48311"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  McMullen County
                                </SelectItem>
                                <SelectItem
                                  value="48313"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Madison County
                                </SelectItem>
                                <SelectItem
                                  value="48315"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Marion County
                                </SelectItem>
                                <SelectItem
                                  value="48317"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Martin County
                                </SelectItem>
                                <SelectItem
                                  value="48319"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mason County
                                </SelectItem>
                                <SelectItem
                                  value="48321"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Matagorda County
                                </SelectItem>
                                <SelectItem
                                  value="48323"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Maverick County
                                </SelectItem>
                                <SelectItem
                                  value="48325"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Medina County
                                </SelectItem>
                                <SelectItem
                                  value="48327"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Menard County
                                </SelectItem>
                                <SelectItem
                                  value="48329"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Midland County
                                </SelectItem>
                                <SelectItem
                                  value="48331"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Milam County
                                </SelectItem>
                                <SelectItem
                                  value="48333"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mills County
                                </SelectItem>
                                <SelectItem
                                  value="48335"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Mitchell County
                                </SelectItem>
                                <SelectItem
                                  value="48337"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Montague County
                                </SelectItem>
                                <SelectItem
                                  value="48339"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Montgomery County
                                </SelectItem>
                                <SelectItem
                                  value="48341"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Moore County
                                </SelectItem>
                                <SelectItem
                                  value="48343"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Morris County
                                </SelectItem>
                                <SelectItem
                                  value="48345"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Motley County
                                </SelectItem>
                                <SelectItem
                                  value="48347"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nacogdoches County
                                </SelectItem>
                                <SelectItem
                                  value="48349"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Navarro County
                                </SelectItem>
                                <SelectItem
                                  value="48351"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Newton County
                                </SelectItem>
                                <SelectItem
                                  value="48353"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nolan County
                                </SelectItem>
                                <SelectItem
                                  value="48355"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nueces County
                                </SelectItem>
                                <SelectItem
                                  value="48357"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ochiltree County
                                </SelectItem>
                                <SelectItem
                                  value="48359"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Oldham County
                                </SelectItem>
                                <SelectItem
                                  value="48361"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Orange County
                                </SelectItem>
                                <SelectItem
                                  value="48363"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Palo Pinto County
                                </SelectItem>
                                <SelectItem
                                  value="48365"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Panola County
                                </SelectItem>
                                <SelectItem
                                  value="48367"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Parker County
                                </SelectItem>
                                <SelectItem
                                  value="48369"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Parmer County
                                </SelectItem>
                                <SelectItem
                                  value="48371"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Pecos County
                                </SelectItem>
                                <SelectItem
                                  value="48373"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Polk County
                                </SelectItem>
                                <SelectItem
                                  value="48375"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Potter County
                                </SelectItem>
                                <SelectItem
                                  value="48377"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Presidio County
                                </SelectItem>
                                <SelectItem
                                  value="48379"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Rains County
                                </SelectItem>
                                <SelectItem
                                  value="48381"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Randall County
                                </SelectItem>
                                <SelectItem
                                  value="48383"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Reagan County
                                </SelectItem>
                                <SelectItem
                                  value="48385"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Real County
                                </SelectItem>
                                <SelectItem
                                  value="48387"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Red River County
                                </SelectItem>
                                <SelectItem
                                  value="48389"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Reeves County
                                </SelectItem>
                                <SelectItem
                                  value="48391"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Refugio County
                                </SelectItem>
                                <SelectItem
                                  value="48393"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Roberts County
                                </SelectItem>
                                <SelectItem
                                  value="48395"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Robertson County
                                </SelectItem>
                                <SelectItem
                                  value="48397"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Rockwall County
                                </SelectItem>
                                <SelectItem
                                  value="48399"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Runnels County
                                </SelectItem>
                                <SelectItem
                                  value="48401"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Rusk County
                                </SelectItem>
                                <SelectItem
                                  value="48403"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sabine County
                                </SelectItem>
                                <SelectItem
                                  value="48405"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Augustine County
                                </SelectItem>
                                <SelectItem
                                  value="48407"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Jacinto County
                                </SelectItem>
                                <SelectItem
                                  value="48409"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Patricio County
                                </SelectItem>
                                <SelectItem
                                  value="48411"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  San Saba County
                                </SelectItem>
                                <SelectItem
                                  value="48413"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Schleicher County
                                </SelectItem>
                                <SelectItem
                                  value="48415"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Scurry County
                                </SelectItem>
                                <SelectItem
                                  value="48417"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Shackelford County
                                </SelectItem>
                                <SelectItem
                                  value="48419"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Shelby County
                                </SelectItem>
                                <SelectItem
                                  value="48421"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sherman County
                                </SelectItem>
                                <SelectItem
                                  value="48423"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Smith County
                                </SelectItem>
                                <SelectItem
                                  value="48425"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Somervell County
                                </SelectItem>
                                <SelectItem
                                  value="48427"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Starr County
                                </SelectItem>
                                <SelectItem
                                  value="48429"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Stephens County
                                </SelectItem>
                                <SelectItem
                                  value="48431"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sterling County
                                </SelectItem>
                                <SelectItem
                                  value="48433"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Stonewall County
                                </SelectItem>
                                <SelectItem
                                  value="48435"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sutton County
                                </SelectItem>
                                <SelectItem
                                  value="48437"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Swisher County
                                </SelectItem>
                                <SelectItem
                                  value="48439"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tarrant County
                                </SelectItem>
                                <SelectItem
                                  value="48441"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Taylor County
                                </SelectItem>
                                <SelectItem
                                  value="48443"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Terrell County
                                </SelectItem>
                                <SelectItem
                                  value="48445"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Terry County
                                </SelectItem>
                                <SelectItem
                                  value="48447"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Throckmorton County
                                </SelectItem>
                                <SelectItem
                                  value="48449"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Titus County
                                </SelectItem>
                                <SelectItem
                                  value="48451"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tom Green County
                                </SelectItem>
                                <SelectItem
                                  value="48453"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Travis County
                                </SelectItem>
                                <SelectItem
                                  value="48455"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Trinity County
                                </SelectItem>
                                <SelectItem
                                  value="48457"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tyler County
                                </SelectItem>
                                <SelectItem
                                  value="48459"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Upshur County
                                </SelectItem>
                                <SelectItem
                                  value="48461"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Upton County
                                </SelectItem>
                                <SelectItem
                                  value="48463"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Uvalde County
                                </SelectItem>
                                <SelectItem
                                  value="48465"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Val Verde County
                                </SelectItem>
                                <SelectItem
                                  value="48467"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Van Zandt County
                                </SelectItem>
                                <SelectItem
                                  value="48469"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Victoria County
                                </SelectItem>
                                <SelectItem
                                  value="48471"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Walker County
                                </SelectItem>
                                <SelectItem
                                  value="48473"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Waller County
                                </SelectItem>
                                <SelectItem
                                  value="48475"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ward County
                                </SelectItem>
                                <SelectItem
                                  value="48477"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Washington County
                                </SelectItem>
                                <SelectItem
                                  value="48479"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Webb County
                                </SelectItem>
                                <SelectItem
                                  value="48481"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wharton County
                                </SelectItem>
                                <SelectItem
                                  value="48483"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wheeler County
                                </SelectItem>
                                <SelectItem
                                  value="48485"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wichita County
                                </SelectItem>
                                <SelectItem
                                  value="48487"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wilbarger County
                                </SelectItem>
                                <SelectItem
                                  value="48489"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Willacy County
                                </SelectItem>
                                <SelectItem
                                  value="48491"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Williamson County
                                </SelectItem>
                                <SelectItem
                                  value="48493"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wilson County
                                </SelectItem>
                                <SelectItem
                                  value="48495"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Winkler County
                                </SelectItem>
                                <SelectItem
                                  value="48497"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wise County
                                </SelectItem>
                                <SelectItem
                                  value="48499"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wood County
                                </SelectItem>
                                <SelectItem
                                  value="48501"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Yoakum County
                                </SelectItem>
                                <SelectItem
                                  value="48503"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Young County
                                </SelectItem>
                                <SelectItem
                                  value="48505"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Zapata County
                                </SelectItem>
                                <SelectItem
                                  value="48507"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Zavala County
                                </SelectItem>
                              </>
                            )}
                            {selectedState === "FL" && (
                              <>
                                <SelectItem
                                  value="12001"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Alachua County
                                </SelectItem>
                                <SelectItem
                                  value="12003"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Baker County
                                </SelectItem>
                                <SelectItem
                                  value="12005"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bay County
                                </SelectItem>
                                <SelectItem
                                  value="12007"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bradford County
                                </SelectItem>
                                <SelectItem
                                  value="12009"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Brevard County
                                </SelectItem>
                                <SelectItem
                                  value="12011"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Broward County
                                </SelectItem>
                                <SelectItem
                                  value="12013"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Calhoun County
                                </SelectItem>
                                <SelectItem
                                  value="12015"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Charlotte County
                                </SelectItem>
                                <SelectItem
                                  value="12017"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Citrus County
                                </SelectItem>
                                <SelectItem
                                  value="12019"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Clay County
                                </SelectItem>
                                <SelectItem
                                  value="12021"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Collier County
                                </SelectItem>
                                <SelectItem
                                  value="12023"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Columbia County
                                </SelectItem>
                                <SelectItem
                                  value="12025"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Miami-Dade County
                                </SelectItem>
                                <SelectItem
                                  value="12027"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  DeSoto County
                                </SelectItem>
                                <SelectItem
                                  value="12029"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dixie County
                                </SelectItem>
                                <SelectItem
                                  value="12031"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Duval County
                                </SelectItem>
                                <SelectItem
                                  value="12033"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Escambia County
                                </SelectItem>
                                <SelectItem
                                  value="12035"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Flagler County
                                </SelectItem>
                                <SelectItem
                                  value="12037"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Franklin County
                                </SelectItem>
                                <SelectItem
                                  value="12039"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gadsden County
                                </SelectItem>
                                <SelectItem
                                  value="12041"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gilchrist County
                                </SelectItem>
                                <SelectItem
                                  value="12043"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Glades County
                                </SelectItem>
                                <SelectItem
                                  value="12045"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Gulf County
                                </SelectItem>
                                <SelectItem
                                  value="12047"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hamilton County
                                </SelectItem>
                                <SelectItem
                                  value="12049"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hardee County
                                </SelectItem>
                                <SelectItem
                                  value="12051"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hendry County
                                </SelectItem>
                                <SelectItem
                                  value="12053"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hernando County
                                </SelectItem>
                                <SelectItem
                                  value="12055"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Highlands County
                                </SelectItem>
                                <SelectItem
                                  value="12057"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hillsborough County
                                </SelectItem>
                                <SelectItem
                                  value="12059"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Holmes County
                                </SelectItem>
                                <SelectItem
                                  value="12061"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Indian River County
                                </SelectItem>
                                <SelectItem
                                  value="12063"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jackson County
                                </SelectItem>
                                <SelectItem
                                  value="12065"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jefferson County
                                </SelectItem>
                                <SelectItem
                                  value="12067"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lafayette County
                                </SelectItem>
                                <SelectItem
                                  value="12069"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lake County
                                </SelectItem>
                                <SelectItem
                                  value="12071"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lee County
                                </SelectItem>
                                <SelectItem
                                  value="12073"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Leon County
                                </SelectItem>
                                <SelectItem
                                  value="12075"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Levy County
                                </SelectItem>
                                <SelectItem
                                  value="12077"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Liberty County
                                </SelectItem>
                                <SelectItem
                                  value="12079"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Madison County
                                </SelectItem>
                                <SelectItem
                                  value="12081"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Manatee County
                                </SelectItem>
                                <SelectItem
                                  value="12083"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Marion County
                                </SelectItem>
                                <SelectItem
                                  value="12085"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Martin County
                                </SelectItem>
                                <SelectItem
                                  value="12087"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Monroe County
                                </SelectItem>
                                <SelectItem
                                  value="12089"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nassau County
                                </SelectItem>
                                <SelectItem
                                  value="12091"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Okaloosa County
                                </SelectItem>
                                <SelectItem
                                  value="12093"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Okeechobee County
                                </SelectItem>
                                <SelectItem
                                  value="12095"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Orange County
                                </SelectItem>
                                <SelectItem
                                  value="12097"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Osceola County
                                </SelectItem>
                                <SelectItem
                                  value="12099"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Palm Beach County
                                </SelectItem>
                                <SelectItem
                                  value="12101"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Pasco County
                                </SelectItem>
                                <SelectItem
                                  value="12103"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Pinellas County
                                </SelectItem>
                                <SelectItem
                                  value="12105"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Polk County
                                </SelectItem>
                                <SelectItem
                                  value="12107"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Putnam County
                                </SelectItem>
                                <SelectItem
                                  value="12109"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  St. Johns County
                                </SelectItem>
                                <SelectItem
                                  value="12111"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  St. Lucie County
                                </SelectItem>
                                <SelectItem
                                  value="12113"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Santa Rosa County
                                </SelectItem>
                                <SelectItem
                                  value="12115"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sarasota County
                                </SelectItem>
                                <SelectItem
                                  value="12117"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Seminole County
                                </SelectItem>
                                <SelectItem
                                  value="12119"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sumter County
                                </SelectItem>
                                <SelectItem
                                  value="12121"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Suwannee County
                                </SelectItem>
                                <SelectItem
                                  value="12123"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Taylor County
                                </SelectItem>
                                <SelectItem
                                  value="12125"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Union County
                                </SelectItem>
                                <SelectItem
                                  value="12127"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Volusia County
                                </SelectItem>
                                <SelectItem
                                  value="12129"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wakulla County
                                </SelectItem>
                                <SelectItem
                                  value="12131"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Walton County
                                </SelectItem>
                                <SelectItem
                                  value="12133"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Washington County
                                </SelectItem>
                              </>
                            )}
                            {selectedState === "NY" && (
                              <>
                                <SelectItem
                                  value="36001"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Albany County
                                </SelectItem>
                                <SelectItem
                                  value="36003"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Allegany County
                                </SelectItem>
                                <SelectItem
                                  value="36005"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Bronx County
                                </SelectItem>
                                <SelectItem
                                  value="36007"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Broome County
                                </SelectItem>
                                <SelectItem
                                  value="36009"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cattaraugus County
                                </SelectItem>
                                <SelectItem
                                  value="36011"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cayuga County
                                </SelectItem>
                                <SelectItem
                                  value="36013"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Chautauqua County
                                </SelectItem>
                                <SelectItem
                                  value="36015"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Chemung County
                                </SelectItem>
                                <SelectItem
                                  value="36017"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Chenango County
                                </SelectItem>
                                <SelectItem
                                  value="36019"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Clinton County
                                </SelectItem>
                                <SelectItem
                                  value="36021"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Columbia County
                                </SelectItem>
                                <SelectItem
                                  value="36023"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Cortland County
                                </SelectItem>
                                <SelectItem
                                  value="36025"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Delaware County
                                </SelectItem>
                                <SelectItem
                                  value="36027"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Dutchess County
                                </SelectItem>
                                <SelectItem
                                  value="36029"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Erie County
                                </SelectItem>
                                <SelectItem
                                  value="36031"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Essex County
                                </SelectItem>
                                <SelectItem
                                  value="36033"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Franklin County
                                </SelectItem>
                                <SelectItem
                                  value="36035"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Fulton County
                                </SelectItem>
                                <SelectItem
                                  value="36037"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Genesee County
                                </SelectItem>
                                <SelectItem
                                  value="36039"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Greene County
                                </SelectItem>
                                <SelectItem
                                  value="36041"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Hamilton County
                                </SelectItem>
                                <SelectItem
                                  value="36043"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Herkimer County
                                </SelectItem>
                                <SelectItem
                                  value="36045"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Jefferson County
                                </SelectItem>
                                <SelectItem
                                  value="36047"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Kings County
                                </SelectItem>
                                <SelectItem
                                  value="36049"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Lewis County
                                </SelectItem>
                                <SelectItem
                                  value="36051"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Livingston County
                                </SelectItem>
                                <SelectItem
                                  value="36053"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Madison County
                                </SelectItem>
                                <SelectItem
                                  value="36055"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Monroe County
                                </SelectItem>
                                <SelectItem
                                  value="36057"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Montgomery County
                                </SelectItem>
                                <SelectItem
                                  value="36059"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Nassau County
                                </SelectItem>
                                <SelectItem
                                  value="36061"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  New York County
                                </SelectItem>
                                <SelectItem
                                  value="36063"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Niagara County
                                </SelectItem>
                                <SelectItem
                                  value="36065"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Oneida County
                                </SelectItem>
                                <SelectItem
                                  value="36067"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Onondaga County
                                </SelectItem>
                                <SelectItem
                                  value="36069"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ontario County
                                </SelectItem>
                                <SelectItem
                                  value="36071"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Orange County
                                </SelectItem>
                                <SelectItem
                                  value="36073"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Orleans County
                                </SelectItem>
                                <SelectItem
                                  value="36075"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Oswego County
                                </SelectItem>
                                <SelectItem
                                  value="36077"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Otsego County
                                </SelectItem>
                                <SelectItem
                                  value="36079"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Putnam County
                                </SelectItem>
                                <SelectItem
                                  value="36081"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Queens County
                                </SelectItem>
                                <SelectItem
                                  value="36083"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Rensselaer County
                                </SelectItem>
                                <SelectItem
                                  value="36085"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Richmond County
                                </SelectItem>
                                <SelectItem
                                  value="36087"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Rockland County
                                </SelectItem>
                                <SelectItem
                                  value="36089"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  St. Lawrence County
                                </SelectItem>
                                <SelectItem
                                  value="36091"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Saratoga County
                                </SelectItem>
                                <SelectItem
                                  value="36093"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Schenectady County
                                </SelectItem>
                                <SelectItem
                                  value="36095"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Schoharie County
                                </SelectItem>
                                <SelectItem
                                  value="36097"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Schuyler County
                                </SelectItem>
                                <SelectItem
                                  value="36099"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Seneca County
                                </SelectItem>
                                <SelectItem
                                  value="36101"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Steuben County
                                </SelectItem>
                                <SelectItem
                                  value="36103"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Suffolk County
                                </SelectItem>
                                <SelectItem
                                  value="36105"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Sullivan County
                                </SelectItem>
                                <SelectItem
                                  value="36107"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tioga County
                                </SelectItem>
                                <SelectItem
                                  value="36109"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Tompkins County
                                </SelectItem>
                                <SelectItem
                                  value="36111"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Ulster County
                                </SelectItem>
                                <SelectItem
                                  value="36113"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Warren County
                                </SelectItem>
                                <SelectItem
                                  value="36115"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Washington County
                                </SelectItem>
                                <SelectItem
                                  value="36117"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wayne County
                                </SelectItem>
                                <SelectItem
                                  value="36119"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Westchester County
                                </SelectItem>
                                <SelectItem
                                  value="36121"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Wyoming County
                                </SelectItem>
                                <SelectItem
                                  value="36123"
                                  className="text-primary hover:bg-surface-hover focus:bg-surface-hover focus:text-primary"
                                >
                                  Yates County
                                </SelectItem>
                              </>
                            )}
                            {!selectedState && (
                              <SelectItem value="none" className="text-muted-foreground">
                                Select a state first
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                          Trade
                        </label>
                        <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                          <SelectTrigger className="form-field">
                            <SelectValue placeholder="All Trades" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plumbing">Plumbing</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="roofing">Roofing</SelectItem>
                            <SelectItem value="hvac">HVAC</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-semibold mt-6 glow-effect transition-all duration-300"
                      onClick={() => setShowAuthModal(true)}
                    >
                      Find Contractors
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
              <Card className="bg-surface border-border">
                <CardContent className="p-6">
                  <div className="text-primary text-3xl mb-4">
                    <Shield className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-3">Verified Contractors</h3>
                  <p className="text-muted-foreground">
                    Contractors undergo license verification and insurance documentation review.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardContent className="p-6">
                  <div className="text-primary text-3xl mb-4">
                    <Calculator className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-3">Regional Pricing</h3>
                  <p className="text-muted-foreground">
                    Cost estimates are provided based on county location and project specifications.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                <CardContent className="p-6">
                  <div className="text-primary text-3xl mb-4">
                    <Users className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary mb-3">
                    Community Recommendations
                  </h3>
                  <p className="text-muted-foreground">
                    View recommendations from homeowners in your local area.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Targeted Advertisement */}
            <div className="mb-8">
              <AdDisplay className="max-w-lg mx-auto" userLocation={userLocation} />
            </div>

            {/* CTA Section */}
            <div className="text-center">
              <Card className="bg-gradient-to-r from-primary/20 to-primary/20 border-primary/30 max-w-2xl mx-auto">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-primary mb-4">
                    Ready to find your contractor?
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    Join thousands of homeowners who have found trusted contractors through
                    TradeScout.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/contractors">
                      <Button className="bg-surface hover:bg-surface-hover text-primary px-8 py-3 rounded-lg font-semibold border border-border">
                        Browse Contractors
                      </Button>
                    </Link>
                    <Link href="/scout?intent=estimate">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold glow-effect">
                        Get 3 Free Quotes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contractor CTA Section */}
            <div className="text-center mt-12">
              <Card className="bg-surface border-border max-w-2xl mx-auto">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-primary mb-4">Are you a contractor?</h3>
                  <p className="text-muted-foreground mb-6">
                    Join our verified network and connect with homeowners in your area.
                  </p>
                  <Link href="/contractors/signup">
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold">
                      Join as Contractor
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Testing Bug Report System */}
        <TestingErrorReportButton variant="banner" />

        {/* Authentication Modal */}
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Join TradeScout Today"
          description="Connect with verified contractors or grow your business"
          trigger="landing_page"
          showGuestOption={true}
          onGuestContinue={handleGuestContinue}
        />
      </div>
    </ScrollArea>
  );
}
