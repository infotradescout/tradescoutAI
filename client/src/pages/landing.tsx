import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Calculator, Users, ArrowRight } from "lucide-react";
import { AdDisplay, useUserLocation } from "@/components/AdDisplay";
import { AuthButtons } from "@/components/auth-buttons";
import { AuthModal } from "@/components/auth-modal";
import { TestingErrorReportButton } from "@/components/TestingErrorReportButton";
import { BugReportButton } from "@/components/BugReportButton";
import { SEOHelmet, createWebsiteStructuredData, createOrganizationStructuredData, createFAQStructuredData } from "@/components/SEOHelmet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { user, isAuthenticated } = useAuth();
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [, setLocation] = useLocation();
  const userLocation = useUserLocation();

  const addressParts = user?.address?.split(',').map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || "";
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || "";
  const communityLabel = rawCommunity.trim();
  const heroCommunity = isAuthenticated && communityLabel ? communityLabel : "Your Community";
  const ownerName = user?.firstName || user?.lastName || "you";

  const handleGuestContinue = () => {
    setIsGuestMode(true);
    localStorage.setItem('guestMode', 'true');
    setLocation('/contractors/board');
  };

  // FAQ structured data for the landing page
  const faqData = [
    {
      question: "How do I find contractors in my area?",
      answer: "Simply select your state and area on TradeScout, then browse verified contractors near you. You can filter by service type, read reviews, and get instant quotes."
    },
    {
      question: "Are all contractors on TradeScout verified?",
      answer: "Yes, all contractors on TradeScout go through a comprehensive verification process including background checks, license verification, and insurance confirmation."
    },
    {
      question: "How many free quotes can I get?",
      answer: "You can get up to 3 free quotes from different contractors for your project, allowing you to compare prices and choose the best fit for your needs."
    },
    {
      question: "What types of home improvement services are available?",
      answer: "TradeScout covers 75+ contractor specialties including roofing, plumbing, electrical, HVAC, flooring, kitchen remodeling, bathroom renovation, and general contracting."
    }
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      createWebsiteStructuredData(),
      createOrganizationStructuredData(),
      createFAQStructuredData(faqData)
    ]
  };

  return (
    <ScrollArea 
      className="min-h-screen" 
      headerHeight={64}
      pageHeight={window.innerHeight}
      scrollToTop={true}
      onScrollChange={(scrollTop) => {
        // Parallax effect for hero section
        const heroElement = document.querySelector('.hero-section') as HTMLElement;
        if (heroElement) {
          heroElement.style.transform = `translateY(${scrollTop * 0.5}px)`;
        }
      }}
    >
      <div className="min-h-screen gradient-bg w-full max-w-full overflow-x-hidden">
      <SEOHelmet 
        title="TradeScout - Find Trusted Local Contractors | Get 3 Free Quotes"
        description="Connect with verified local contractors. Get 3 free quotes, read reviews, and hire with confidence. Local pros for roofing, plumbing, electrical, and more."
        keywords="local contractors, home improvement, verified contractors, free quotes, trusted contractors, roofing contractors, plumbing contractors, electrical contractors, kitchen remodeling, bathroom renovation"
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
              Find Trusted Contractors
              <span className="text-orange-500"> In {heroCommunity}</span>
            </h1>
            <p className="text-base md:text-xl text-gray-300 mb-6 md:mb-8 max-w-3xl mx-auto px-2">
              {isAuthenticated
                ? `${ownerName}, this workspace is yours—connect with verified pros and run projects for ${heroCommunity}.`
                : "Connect with verified, local contractors. Get quotes, read recommendations, and hire with confidence."}
            </p>

            {/* County Search */}
            <div className="max-w-2xl mx-auto">
              <Card className="bg-navy-700 border-navy-600">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
                      <Select value={selectedState} onValueChange={setSelectedState}>
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                          <SelectItem value="AL" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Alabama</SelectItem>
                          <SelectItem value="AK" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Alaska</SelectItem>
                          <SelectItem value="AZ" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Arizona</SelectItem>
                          <SelectItem value="AR" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Arkansas</SelectItem>
                          <SelectItem value="CA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">California</SelectItem>
                          <SelectItem value="CO" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Colorado</SelectItem>
                          <SelectItem value="CT" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Connecticut</SelectItem>
                          <SelectItem value="DE" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Delaware</SelectItem>
                          <SelectItem value="DC" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">District of Columbia</SelectItem>
                          <SelectItem value="FL" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Florida</SelectItem>
                          <SelectItem value="GA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Georgia</SelectItem>
                          <SelectItem value="HI" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hawaii</SelectItem>
                          <SelectItem value="ID" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Idaho</SelectItem>
                          <SelectItem value="IL" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Illinois</SelectItem>
                          <SelectItem value="IN" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Indiana</SelectItem>
                          <SelectItem value="IA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Iowa</SelectItem>
                          <SelectItem value="KS" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kansas</SelectItem>
                          <SelectItem value="KY" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kentucky</SelectItem>
                          <SelectItem value="LA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Louisiana</SelectItem>
                          <SelectItem value="ME" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Maine</SelectItem>
                          <SelectItem value="MD" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Maryland</SelectItem>
                          <SelectItem value="MA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Massachusetts</SelectItem>
                          <SelectItem value="MI" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Michigan</SelectItem>
                          <SelectItem value="MN" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Minnesota</SelectItem>
                          <SelectItem value="MS" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mississippi</SelectItem>
                          <SelectItem value="MO" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Missouri</SelectItem>
                          <SelectItem value="MT" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Montana</SelectItem>
                          <SelectItem value="NE" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nebraska</SelectItem>
                          <SelectItem value="NV" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nevada</SelectItem>
                          <SelectItem value="NH" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New Hampshire</SelectItem>
                          <SelectItem value="NJ" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New Jersey</SelectItem>
                          <SelectItem value="NM" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New Mexico</SelectItem>
                          <SelectItem value="NY" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New York</SelectItem>
                          <SelectItem value="NC" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">North Carolina</SelectItem>
                          <SelectItem value="ND" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">North Dakota</SelectItem>
                          <SelectItem value="OH" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ohio</SelectItem>
                          <SelectItem value="OK" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Oklahoma</SelectItem>
                          <SelectItem value="OR" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Oregon</SelectItem>
                          <SelectItem value="PA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pennsylvania</SelectItem>
                          <SelectItem value="RI" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rhode Island</SelectItem>
                          <SelectItem value="SC" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">South Carolina</SelectItem>
                          <SelectItem value="SD" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">South Dakota</SelectItem>
                          <SelectItem value="TN" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tennessee</SelectItem>
                          <SelectItem value="TX" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Texas</SelectItem>
                          <SelectItem value="UT" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Utah</SelectItem>
                          <SelectItem value="VT" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Vermont</SelectItem>
                          <SelectItem value="VA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Virginia</SelectItem>
                          <SelectItem value="WA" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Washington</SelectItem>
                          <SelectItem value="WV" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">West Virginia</SelectItem>
                          <SelectItem value="WI" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wisconsin</SelectItem>
                          <SelectItem value="WY" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wyoming</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">County</label>
                      <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select County" />
                        </SelectTrigger>
                        <SelectContent className="bg-navy-700 border-navy-600 text-white max-h-[300px] overflow-y-auto">
                          {selectedState === "CA" && (
                            <>
                              <SelectItem value="06001" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Alameda County</SelectItem>
                              <SelectItem value="06003" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Alpine County</SelectItem>
                              <SelectItem value="06005" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Amador County</SelectItem>
                              <SelectItem value="06007" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Butte County</SelectItem>
                              <SelectItem value="06009" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Calaveras County</SelectItem>
                              <SelectItem value="06011" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Colusa County</SelectItem>
                              <SelectItem value="06013" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Contra Costa County</SelectItem>
                              <SelectItem value="06015" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Del Norte County</SelectItem>
                              <SelectItem value="06017" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">El Dorado County</SelectItem>
                              <SelectItem value="06019" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fresno County</SelectItem>
                              <SelectItem value="06021" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Glenn County</SelectItem>
                              <SelectItem value="06023" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Humboldt County</SelectItem>
                              <SelectItem value="06025" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Imperial County</SelectItem>
                              <SelectItem value="06027" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Inyo County</SelectItem>
                              <SelectItem value="06029" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kern County</SelectItem>
                              <SelectItem value="06031" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kings County</SelectItem>
                              <SelectItem value="06033" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lake County</SelectItem>
                              <SelectItem value="06035" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lassen County</SelectItem>
                              <SelectItem value="06037" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Los Angeles County</SelectItem>
                              <SelectItem value="06039" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Madera County</SelectItem>
                              <SelectItem value="06041" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Marin County</SelectItem>
                              <SelectItem value="06043" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mariposa County</SelectItem>
                              <SelectItem value="06045" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mendocino County</SelectItem>
                              <SelectItem value="06047" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Merced County</SelectItem>
                              <SelectItem value="06049" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Modoc County</SelectItem>
                              <SelectItem value="06051" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mono County</SelectItem>
                              <SelectItem value="06053" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Monterey County</SelectItem>
                              <SelectItem value="06055" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Napa County</SelectItem>
                              <SelectItem value="06057" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nevada County</SelectItem>
                              <SelectItem value="06059" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Orange County</SelectItem>
                              <SelectItem value="06061" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Placer County</SelectItem>
                              <SelectItem value="06063" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Plumas County</SelectItem>
                              <SelectItem value="06065" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Riverside County</SelectItem>
                              <SelectItem value="06067" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sacramento County</SelectItem>
                              <SelectItem value="06069" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Benito County</SelectItem>
                              <SelectItem value="06071" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Bernardino County</SelectItem>
                              <SelectItem value="06073" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Diego County</SelectItem>
                              <SelectItem value="06075" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Francisco County</SelectItem>
                              <SelectItem value="06077" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Joaquin County</SelectItem>
                              <SelectItem value="06079" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Luis Obispo County</SelectItem>
                              <SelectItem value="06081" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Mateo County</SelectItem>
                              <SelectItem value="06083" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Santa Barbara County</SelectItem>
                              <SelectItem value="06085" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Santa Clara County</SelectItem>
                              <SelectItem value="06087" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Santa Cruz County</SelectItem>
                              <SelectItem value="06089" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Shasta County</SelectItem>
                              <SelectItem value="06091" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sierra County</SelectItem>
                              <SelectItem value="06093" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Siskiyou County</SelectItem>
                              <SelectItem value="06095" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Solano County</SelectItem>
                              <SelectItem value="06097" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sonoma County</SelectItem>
                              <SelectItem value="06099" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Stanislaus County</SelectItem>
                              <SelectItem value="06101" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sutter County</SelectItem>
                              <SelectItem value="06103" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tehama County</SelectItem>
                              <SelectItem value="06105" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Trinity County</SelectItem>
                              <SelectItem value="06107" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tulare County</SelectItem>
                              <SelectItem value="06109" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tuolumne County</SelectItem>
                              <SelectItem value="06111" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ventura County</SelectItem>
                              <SelectItem value="06113" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Yolo County</SelectItem>
                              <SelectItem value="06115" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Yuba County</SelectItem>
                            </>
                          )}
                          {selectedState === "TX" && (
                            <>
                              <SelectItem value="48001" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Anderson County</SelectItem>
                              <SelectItem value="48003" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Andrews County</SelectItem>
                              <SelectItem value="48005" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Angelina County</SelectItem>
                              <SelectItem value="48007" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Aransas County</SelectItem>
                              <SelectItem value="48009" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Archer County</SelectItem>
                              <SelectItem value="48011" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Armstrong County</SelectItem>
                              <SelectItem value="48013" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Atascosa County</SelectItem>
                              <SelectItem value="48015" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Austin County</SelectItem>
                              <SelectItem value="48017" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bailey County</SelectItem>
                              <SelectItem value="48019" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bandera County</SelectItem>
                              <SelectItem value="48021" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bastrop County</SelectItem>
                              <SelectItem value="48023" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Baylor County</SelectItem>
                              <SelectItem value="48025" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bee County</SelectItem>
                              <SelectItem value="48027" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bell County</SelectItem>
                              <SelectItem value="48029" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bexar County</SelectItem>
                              <SelectItem value="48031" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Blanco County</SelectItem>
                              <SelectItem value="48033" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Borden County</SelectItem>
                              <SelectItem value="48035" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bosque County</SelectItem>
                              <SelectItem value="48037" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bowie County</SelectItem>
                              <SelectItem value="48039" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brazoria County</SelectItem>
                              <SelectItem value="48041" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brazos County</SelectItem>
                              <SelectItem value="48043" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brewster County</SelectItem>
                              <SelectItem value="48045" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Briscoe County</SelectItem>
                              <SelectItem value="48047" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brooks County</SelectItem>
                              <SelectItem value="48049" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brown County</SelectItem>
                              <SelectItem value="48051" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Burleson County</SelectItem>
                              <SelectItem value="48053" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Burnet County</SelectItem>
                              <SelectItem value="48055" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Caldwell County</SelectItem>
                              <SelectItem value="48057" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Calhoun County</SelectItem>
                              <SelectItem value="48059" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Callahan County</SelectItem>
                              <SelectItem value="48061" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cameron County</SelectItem>
                              <SelectItem value="48063" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Camp County</SelectItem>
                              <SelectItem value="48065" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Carson County</SelectItem>
                              <SelectItem value="48067" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cass County</SelectItem>
                              <SelectItem value="48069" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Castro County</SelectItem>
                              <SelectItem value="48071" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Chambers County</SelectItem>
                              <SelectItem value="48073" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cherokee County</SelectItem>
                              <SelectItem value="48075" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Childress County</SelectItem>
                              <SelectItem value="48077" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Clay County</SelectItem>
                              <SelectItem value="48079" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cochran County</SelectItem>
                              <SelectItem value="48081" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Coke County</SelectItem>
                              <SelectItem value="48083" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Coleman County</SelectItem>
                              <SelectItem value="48085" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Collin County</SelectItem>
                              <SelectItem value="48087" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Collingsworth County</SelectItem>
                              <SelectItem value="48089" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Colorado County</SelectItem>
                              <SelectItem value="48091" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Comal County</SelectItem>
                              <SelectItem value="48093" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Comanche County</SelectItem>
                              <SelectItem value="48095" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Concho County</SelectItem>
                              <SelectItem value="48097" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cooke County</SelectItem>
                              <SelectItem value="48099" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Coryell County</SelectItem>
                              <SelectItem value="48101" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cottle County</SelectItem>
                              <SelectItem value="48103" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Crane County</SelectItem>
                              <SelectItem value="48105" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Crockett County</SelectItem>
                              <SelectItem value="48107" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Crosby County</SelectItem>
                              <SelectItem value="48109" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Culberson County</SelectItem>
                              <SelectItem value="48111" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dallam County</SelectItem>
                              <SelectItem value="48113" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dallas County</SelectItem>
                              <SelectItem value="48115" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dawson County</SelectItem>
                              <SelectItem value="48117" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Deaf Smith County</SelectItem>
                              <SelectItem value="48119" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Delta County</SelectItem>
                              <SelectItem value="48121" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Denton County</SelectItem>
                              <SelectItem value="48123" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">DeWitt County</SelectItem>
                              <SelectItem value="48125" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dickens County</SelectItem>
                              <SelectItem value="48127" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dimmit County</SelectItem>
                              <SelectItem value="48129" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Donley County</SelectItem>
                              <SelectItem value="48131" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Duval County</SelectItem>
                              <SelectItem value="48133" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Eastland County</SelectItem>
                              <SelectItem value="48135" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ector County</SelectItem>
                              <SelectItem value="48137" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Edwards County</SelectItem>
                              <SelectItem value="48139" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ellis County</SelectItem>
                              <SelectItem value="48141" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">El Paso County</SelectItem>
                              <SelectItem value="48143" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Erath County</SelectItem>
                              <SelectItem value="48145" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Falls County</SelectItem>
                              <SelectItem value="48147" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fannin County</SelectItem>
                              <SelectItem value="48149" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fayette County</SelectItem>
                              <SelectItem value="48151" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fisher County</SelectItem>
                              <SelectItem value="48153" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Floyd County</SelectItem>
                              <SelectItem value="48155" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Foard County</SelectItem>
                              <SelectItem value="48157" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fort Bend County</SelectItem>
                              <SelectItem value="48159" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Franklin County</SelectItem>
                              <SelectItem value="48161" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Freestone County</SelectItem>
                              <SelectItem value="48163" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Frio County</SelectItem>
                              <SelectItem value="48165" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gaines County</SelectItem>
                              <SelectItem value="48167" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Galveston County</SelectItem>
                              <SelectItem value="48169" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Garza County</SelectItem>
                              <SelectItem value="48171" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gillespie County</SelectItem>
                              <SelectItem value="48173" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Glasscock County</SelectItem>
                              <SelectItem value="48175" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Goliad County</SelectItem>
                              <SelectItem value="48177" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gonzales County</SelectItem>
                              <SelectItem value="48179" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gray County</SelectItem>
                              <SelectItem value="48181" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Grayson County</SelectItem>
                              <SelectItem value="48183" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gregg County</SelectItem>
                              <SelectItem value="48185" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Grimes County</SelectItem>
                              <SelectItem value="48187" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Guadalupe County</SelectItem>
                              <SelectItem value="48189" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hale County</SelectItem>
                              <SelectItem value="48191" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hall County</SelectItem>
                              <SelectItem value="48193" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hamilton County</SelectItem>
                              <SelectItem value="48195" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hansford County</SelectItem>
                              <SelectItem value="48197" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hardeman County</SelectItem>
                              <SelectItem value="48199" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hardin County</SelectItem>
                              <SelectItem value="48201" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Harris County</SelectItem>
                              <SelectItem value="48203" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Harrison County</SelectItem>
                              <SelectItem value="48205" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hartley County</SelectItem>
                              <SelectItem value="48207" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Haskell County</SelectItem>
                              <SelectItem value="48209" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hays County</SelectItem>
                              <SelectItem value="48211" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hemphill County</SelectItem>
                              <SelectItem value="48213" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Henderson County</SelectItem>
                              <SelectItem value="48215" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hidalgo County</SelectItem>
                              <SelectItem value="48217" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hill County</SelectItem>
                              <SelectItem value="48219" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hockley County</SelectItem>
                              <SelectItem value="48221" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hood County</SelectItem>
                              <SelectItem value="48223" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hopkins County</SelectItem>
                              <SelectItem value="48225" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Houston County</SelectItem>
                              <SelectItem value="48227" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Howard County</SelectItem>
                              <SelectItem value="48229" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hudspeth County</SelectItem>
                              <SelectItem value="48231" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hunt County</SelectItem>
                              <SelectItem value="48233" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hutchinson County</SelectItem>
                              <SelectItem value="48235" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Irion County</SelectItem>
                              <SelectItem value="48237" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jack County</SelectItem>
                              <SelectItem value="48239" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jackson County</SelectItem>
                              <SelectItem value="48241" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jasper County</SelectItem>
                              <SelectItem value="48243" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jeff Davis County</SelectItem>
                              <SelectItem value="48245" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jefferson County</SelectItem>
                              <SelectItem value="48247" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jim Hogg County</SelectItem>
                              <SelectItem value="48249" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jim Wells County</SelectItem>
                              <SelectItem value="48251" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Johnson County</SelectItem>
                              <SelectItem value="48253" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jones County</SelectItem>
                              <SelectItem value="48255" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Karnes County</SelectItem>
                              <SelectItem value="48257" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kaufman County</SelectItem>
                              <SelectItem value="48259" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kendall County</SelectItem>
                              <SelectItem value="48261" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kenedy County</SelectItem>
                              <SelectItem value="48263" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kent County</SelectItem>
                              <SelectItem value="48265" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kerr County</SelectItem>
                              <SelectItem value="48267" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kimble County</SelectItem>
                              <SelectItem value="48269" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">King County</SelectItem>
                              <SelectItem value="48271" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kinney County</SelectItem>
                              <SelectItem value="48273" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kleberg County</SelectItem>
                              <SelectItem value="48275" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Knox County</SelectItem>
                              <SelectItem value="48277" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lamar County</SelectItem>
                              <SelectItem value="48279" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lamb County</SelectItem>
                              <SelectItem value="48281" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lampasas County</SelectItem>
                              <SelectItem value="48283" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">La Salle County</SelectItem>
                              <SelectItem value="48285" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lavaca County</SelectItem>
                              <SelectItem value="48287" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lee County</SelectItem>
                              <SelectItem value="48289" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Leon County</SelectItem>
                              <SelectItem value="48291" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Liberty County</SelectItem>
                              <SelectItem value="48293" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Limestone County</SelectItem>
                              <SelectItem value="48295" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lipscomb County</SelectItem>
                              <SelectItem value="48297" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Live Oak County</SelectItem>
                              <SelectItem value="48299" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Llano County</SelectItem>
                              <SelectItem value="48301" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Loving County</SelectItem>
                              <SelectItem value="48303" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lubbock County</SelectItem>
                              <SelectItem value="48305" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lynn County</SelectItem>
                              <SelectItem value="48307" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">McCulloch County</SelectItem>
                              <SelectItem value="48309" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">McLennan County</SelectItem>
                              <SelectItem value="48311" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">McMullen County</SelectItem>
                              <SelectItem value="48313" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Madison County</SelectItem>
                              <SelectItem value="48315" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Marion County</SelectItem>
                              <SelectItem value="48317" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Martin County</SelectItem>
                              <SelectItem value="48319" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mason County</SelectItem>
                              <SelectItem value="48321" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Matagorda County</SelectItem>
                              <SelectItem value="48323" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Maverick County</SelectItem>
                              <SelectItem value="48325" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Medina County</SelectItem>
                              <SelectItem value="48327" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Menard County</SelectItem>
                              <SelectItem value="48329" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Midland County</SelectItem>
                              <SelectItem value="48331" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Milam County</SelectItem>
                              <SelectItem value="48333" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mills County</SelectItem>
                              <SelectItem value="48335" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Mitchell County</SelectItem>
                              <SelectItem value="48337" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Montague County</SelectItem>
                              <SelectItem value="48339" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Montgomery County</SelectItem>
                              <SelectItem value="48341" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Moore County</SelectItem>
                              <SelectItem value="48343" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Morris County</SelectItem>
                              <SelectItem value="48345" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Motley County</SelectItem>
                              <SelectItem value="48347" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nacogdoches County</SelectItem>
                              <SelectItem value="48349" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Navarro County</SelectItem>
                              <SelectItem value="48351" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Newton County</SelectItem>
                              <SelectItem value="48353" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nolan County</SelectItem>
                              <SelectItem value="48355" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nueces County</SelectItem>
                              <SelectItem value="48357" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ochiltree County</SelectItem>
                              <SelectItem value="48359" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Oldham County</SelectItem>
                              <SelectItem value="48361" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Orange County</SelectItem>
                              <SelectItem value="48363" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Palo Pinto County</SelectItem>
                              <SelectItem value="48365" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Panola County</SelectItem>
                              <SelectItem value="48367" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Parker County</SelectItem>
                              <SelectItem value="48369" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Parmer County</SelectItem>
                              <SelectItem value="48371" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pecos County</SelectItem>
                              <SelectItem value="48373" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Polk County</SelectItem>
                              <SelectItem value="48375" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Potter County</SelectItem>
                              <SelectItem value="48377" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Presidio County</SelectItem>
                              <SelectItem value="48379" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rains County</SelectItem>
                              <SelectItem value="48381" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Randall County</SelectItem>
                              <SelectItem value="48383" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Reagan County</SelectItem>
                              <SelectItem value="48385" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Real County</SelectItem>
                              <SelectItem value="48387" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Red River County</SelectItem>
                              <SelectItem value="48389" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Reeves County</SelectItem>
                              <SelectItem value="48391" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Refugio County</SelectItem>
                              <SelectItem value="48393" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Roberts County</SelectItem>
                              <SelectItem value="48395" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Robertson County</SelectItem>
                              <SelectItem value="48397" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rockwall County</SelectItem>
                              <SelectItem value="48399" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Runnels County</SelectItem>
                              <SelectItem value="48401" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rusk County</SelectItem>
                              <SelectItem value="48403" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sabine County</SelectItem>
                              <SelectItem value="48405" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Augustine County</SelectItem>
                              <SelectItem value="48407" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Jacinto County</SelectItem>
                              <SelectItem value="48409" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Patricio County</SelectItem>
                              <SelectItem value="48411" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">San Saba County</SelectItem>
                              <SelectItem value="48413" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Schleicher County</SelectItem>
                              <SelectItem value="48415" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Scurry County</SelectItem>
                              <SelectItem value="48417" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Shackelford County</SelectItem>
                              <SelectItem value="48419" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Shelby County</SelectItem>
                              <SelectItem value="48421" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sherman County</SelectItem>
                              <SelectItem value="48423" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Smith County</SelectItem>
                              <SelectItem value="48425" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Somervell County</SelectItem>
                              <SelectItem value="48427" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Starr County</SelectItem>
                              <SelectItem value="48429" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Stephens County</SelectItem>
                              <SelectItem value="48431" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sterling County</SelectItem>
                              <SelectItem value="48433" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Stonewall County</SelectItem>
                              <SelectItem value="48435" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sutton County</SelectItem>
                              <SelectItem value="48437" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Swisher County</SelectItem>
                              <SelectItem value="48439" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tarrant County</SelectItem>
                              <SelectItem value="48441" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Taylor County</SelectItem>
                              <SelectItem value="48443" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Terrell County</SelectItem>
                              <SelectItem value="48445" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Terry County</SelectItem>
                              <SelectItem value="48447" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Throckmorton County</SelectItem>
                              <SelectItem value="48449" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Titus County</SelectItem>
                              <SelectItem value="48451" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tom Green County</SelectItem>
                              <SelectItem value="48453" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Travis County</SelectItem>
                              <SelectItem value="48455" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Trinity County</SelectItem>
                              <SelectItem value="48457" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tyler County</SelectItem>
                              <SelectItem value="48459" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Upshur County</SelectItem>
                              <SelectItem value="48461" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Upton County</SelectItem>
                              <SelectItem value="48463" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Uvalde County</SelectItem>
                              <SelectItem value="48465" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Val Verde County</SelectItem>
                              <SelectItem value="48467" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Van Zandt County</SelectItem>
                              <SelectItem value="48469" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Victoria County</SelectItem>
                              <SelectItem value="48471" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Walker County</SelectItem>
                              <SelectItem value="48473" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Waller County</SelectItem>
                              <SelectItem value="48475" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ward County</SelectItem>
                              <SelectItem value="48477" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Washington County</SelectItem>
                              <SelectItem value="48479" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Webb County</SelectItem>
                              <SelectItem value="48481" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wharton County</SelectItem>
                              <SelectItem value="48483" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wheeler County</SelectItem>
                              <SelectItem value="48485" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wichita County</SelectItem>
                              <SelectItem value="48487" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wilbarger County</SelectItem>
                              <SelectItem value="48489" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Willacy County</SelectItem>
                              <SelectItem value="48491" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Williamson County</SelectItem>
                              <SelectItem value="48493" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wilson County</SelectItem>
                              <SelectItem value="48495" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Winkler County</SelectItem>
                              <SelectItem value="48497" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wise County</SelectItem>
                              <SelectItem value="48499" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wood County</SelectItem>
                              <SelectItem value="48501" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Yoakum County</SelectItem>
                              <SelectItem value="48503" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Young County</SelectItem>
                              <SelectItem value="48505" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Zapata County</SelectItem>
                              <SelectItem value="48507" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Zavala County</SelectItem>
                            </>
                          )}
                          {selectedState === "FL" && (
                            <>
                              <SelectItem value="12001" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Alachua County</SelectItem>
                              <SelectItem value="12003" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Baker County</SelectItem>
                              <SelectItem value="12005" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bay County</SelectItem>
                              <SelectItem value="12007" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bradford County</SelectItem>
                              <SelectItem value="12009" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Brevard County</SelectItem>
                              <SelectItem value="12011" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Broward County</SelectItem>
                              <SelectItem value="12013" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Calhoun County</SelectItem>
                              <SelectItem value="12015" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Charlotte County</SelectItem>
                              <SelectItem value="12017" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Citrus County</SelectItem>
                              <SelectItem value="12019" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Clay County</SelectItem>
                              <SelectItem value="12021" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Collier County</SelectItem>
                              <SelectItem value="12023" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Columbia County</SelectItem>
                              <SelectItem value="12025" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Miami-Dade County</SelectItem>
                              <SelectItem value="12027" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">DeSoto County</SelectItem>
                              <SelectItem value="12029" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dixie County</SelectItem>
                              <SelectItem value="12031" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Duval County</SelectItem>
                              <SelectItem value="12033" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Escambia County</SelectItem>
                              <SelectItem value="12035" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Flagler County</SelectItem>
                              <SelectItem value="12037" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Franklin County</SelectItem>
                              <SelectItem value="12039" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gadsden County</SelectItem>
                              <SelectItem value="12041" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gilchrist County</SelectItem>
                              <SelectItem value="12043" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Glades County</SelectItem>
                              <SelectItem value="12045" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Gulf County</SelectItem>
                              <SelectItem value="12047" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hamilton County</SelectItem>
                              <SelectItem value="12049" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hardee County</SelectItem>
                              <SelectItem value="12051" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hendry County</SelectItem>
                              <SelectItem value="12053" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hernando County</SelectItem>
                              <SelectItem value="12055" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Highlands County</SelectItem>
                              <SelectItem value="12057" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hillsborough County</SelectItem>
                              <SelectItem value="12059" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Holmes County</SelectItem>
                              <SelectItem value="12061" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Indian River County</SelectItem>
                              <SelectItem value="12063" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jackson County</SelectItem>
                              <SelectItem value="12065" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jefferson County</SelectItem>
                              <SelectItem value="12067" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lafayette County</SelectItem>
                              <SelectItem value="12069" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lake County</SelectItem>
                              <SelectItem value="12071" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lee County</SelectItem>
                              <SelectItem value="12073" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Leon County</SelectItem>
                              <SelectItem value="12075" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Levy County</SelectItem>
                              <SelectItem value="12077" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Liberty County</SelectItem>
                              <SelectItem value="12079" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Madison County</SelectItem>
                              <SelectItem value="12081" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Manatee County</SelectItem>
                              <SelectItem value="12083" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Marion County</SelectItem>
                              <SelectItem value="12085" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Martin County</SelectItem>
                              <SelectItem value="12087" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Monroe County</SelectItem>
                              <SelectItem value="12089" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nassau County</SelectItem>
                              <SelectItem value="12091" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Okaloosa County</SelectItem>
                              <SelectItem value="12093" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Okeechobee County</SelectItem>
                              <SelectItem value="12095" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Orange County</SelectItem>
                              <SelectItem value="12097" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Osceola County</SelectItem>
                              <SelectItem value="12099" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Palm Beach County</SelectItem>
                              <SelectItem value="12101" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pasco County</SelectItem>
                              <SelectItem value="12103" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Pinellas County</SelectItem>
                              <SelectItem value="12105" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Polk County</SelectItem>
                              <SelectItem value="12107" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Putnam County</SelectItem>
                              <SelectItem value="12109" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">St. Johns County</SelectItem>
                              <SelectItem value="12111" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">St. Lucie County</SelectItem>
                              <SelectItem value="12113" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Santa Rosa County</SelectItem>
                              <SelectItem value="12115" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sarasota County</SelectItem>
                              <SelectItem value="12117" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Seminole County</SelectItem>
                              <SelectItem value="12119" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sumter County</SelectItem>
                              <SelectItem value="12121" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Suwannee County</SelectItem>
                              <SelectItem value="12123" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Taylor County</SelectItem>
                              <SelectItem value="12125" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Union County</SelectItem>
                              <SelectItem value="12127" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Volusia County</SelectItem>
                              <SelectItem value="12129" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wakulla County</SelectItem>
                              <SelectItem value="12131" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Walton County</SelectItem>
                              <SelectItem value="12133" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Washington County</SelectItem>
                            </>
                          )}
                          {selectedState === "NY" && (
                            <>
                              <SelectItem value="36001" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Albany County</SelectItem>
                              <SelectItem value="36003" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Allegany County</SelectItem>
                              <SelectItem value="36005" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Bronx County</SelectItem>
                              <SelectItem value="36007" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Broome County</SelectItem>
                              <SelectItem value="36009" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cattaraugus County</SelectItem>
                              <SelectItem value="36011" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cayuga County</SelectItem>
                              <SelectItem value="36013" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Chautauqua County</SelectItem>
                              <SelectItem value="36015" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Chemung County</SelectItem>
                              <SelectItem value="36017" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Chenango County</SelectItem>
                              <SelectItem value="36019" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Clinton County</SelectItem>
                              <SelectItem value="36021" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Columbia County</SelectItem>
                              <SelectItem value="36023" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Cortland County</SelectItem>
                              <SelectItem value="36025" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Delaware County</SelectItem>
                              <SelectItem value="36027" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Dutchess County</SelectItem>
                              <SelectItem value="36029" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Erie County</SelectItem>
                              <SelectItem value="36031" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Essex County</SelectItem>
                              <SelectItem value="36033" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Franklin County</SelectItem>
                              <SelectItem value="36035" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Fulton County</SelectItem>
                              <SelectItem value="36037" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Genesee County</SelectItem>
                              <SelectItem value="36039" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Greene County</SelectItem>
                              <SelectItem value="36041" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Hamilton County</SelectItem>
                              <SelectItem value="36043" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Herkimer County</SelectItem>
                              <SelectItem value="36045" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Jefferson County</SelectItem>
                              <SelectItem value="36047" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Kings County</SelectItem>
                              <SelectItem value="36049" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Lewis County</SelectItem>
                              <SelectItem value="36051" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Livingston County</SelectItem>
                              <SelectItem value="36053" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Madison County</SelectItem>
                              <SelectItem value="36055" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Monroe County</SelectItem>
                              <SelectItem value="36057" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Montgomery County</SelectItem>
                              <SelectItem value="36059" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Nassau County</SelectItem>
                              <SelectItem value="36061" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">New York County</SelectItem>
                              <SelectItem value="36063" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Niagara County</SelectItem>
                              <SelectItem value="36065" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Oneida County</SelectItem>
                              <SelectItem value="36067" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Onondaga County</SelectItem>
                              <SelectItem value="36069" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ontario County</SelectItem>
                              <SelectItem value="36071" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Orange County</SelectItem>
                              <SelectItem value="36073" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Orleans County</SelectItem>
                              <SelectItem value="36075" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Oswego County</SelectItem>
                              <SelectItem value="36077" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Otsego County</SelectItem>
                              <SelectItem value="36079" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Putnam County</SelectItem>
                              <SelectItem value="36081" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Queens County</SelectItem>
                              <SelectItem value="36083" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rensselaer County</SelectItem>
                              <SelectItem value="36085" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Richmond County</SelectItem>
                              <SelectItem value="36087" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Rockland County</SelectItem>
                              <SelectItem value="36089" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">St. Lawrence County</SelectItem>
                              <SelectItem value="36091" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Saratoga County</SelectItem>
                              <SelectItem value="36093" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Schenectady County</SelectItem>
                              <SelectItem value="36095" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Schoharie County</SelectItem>
                              <SelectItem value="36097" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Schuyler County</SelectItem>
                              <SelectItem value="36099" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Seneca County</SelectItem>
                              <SelectItem value="36101" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Steuben County</SelectItem>
                              <SelectItem value="36103" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Suffolk County</SelectItem>
                              <SelectItem value="36105" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Sullivan County</SelectItem>
                              <SelectItem value="36107" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tioga County</SelectItem>
                              <SelectItem value="36109" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Tompkins County</SelectItem>
                              <SelectItem value="36111" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Ulster County</SelectItem>
                              <SelectItem value="36113" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Warren County</SelectItem>
                              <SelectItem value="36115" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Washington County</SelectItem>
                              <SelectItem value="36117" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wayne County</SelectItem>
                              <SelectItem value="36119" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Westchester County</SelectItem>
                              <SelectItem value="36121" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Wyoming County</SelectItem>
                              <SelectItem value="36123" className="text-white hover:bg-navy-600 focus:bg-navy-600 focus:text-white">Yates County</SelectItem>
                            </>
                          )}
                          {!selectedState && (
                            <SelectItem value="none" className="text-gray-400">Select a state first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Trade</label>
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
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold mt-6 glow-effect transition-all duration-300"
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
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Shield className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Verified Contractors</h3>
                <p className="text-gray-300">Contractors undergo license verification and insurance documentation review.</p>
              </CardContent>
            </Card>

            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Calculator className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Regional Pricing</h3>
                <p className="text-gray-300">Cost estimates are provided based on county location and project specifications.</p>
              </CardContent>
            </Card>

            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Community Recommendations</h3>
                <p className="text-gray-300">View recommendations from homeowners in your local area.</p>
              </CardContent>
            </Card>
          </div>

          {/* Targeted Advertisement */}
          <div className="mb-8">
            <AdDisplay 
              className="max-w-lg mx-auto"
              userLocation={userLocation}
            />
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-white mb-4">Ready to find your contractor?</h3>
                <p className="text-gray-300 mb-6">
                  Join thousands of homeowners who have found trusted contractors through TradeScout.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contractors/board">
                    <Button 
                      className="bg-navy-600 hover:bg-navy-500 text-white px-8 py-3 rounded-lg font-semibold border border-navy-500"
                    >
                      Browse Contractors
                    </Button>
                  </Link>
                  <Link href="/quote-calculator">
                    <Button 
                      className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold glow-effect"
                    >
                      Get 3 Free Quotes
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Contractor CTA Section */}
          <div className="text-center mt-12">
            <Card className="bg-gradient-to-r from-green-500/20 to-green-600/20 border-green-500/30 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-white mb-4">Are you a contractor?</h3>
                <p className="text-gray-300 mb-6">
                  Join our verified network and connect with homeowners in your area.
                </p>
                <Link href="/contractors/signup">
                  <Button className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-lg font-semibold">
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