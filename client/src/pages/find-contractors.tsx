import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Star, 
  CheckCircle, 
  Search,
  Filter,
  ExternalLink,
  Building,
  Clock,
  Users,
  Award
} from "lucide-react";

interface Contractor {
  id: string;
  companyName: string;
  slug: string;
  phone: string;
  email: string;
  website?: string;
  about?: string;
  verifiedLicensed: boolean;
  verifiedInsured: boolean;
  isActive: boolean;
  yearsInBusiness?: number;
  responseTimeSla?: string;
  isGeneralContractor: boolean;
  isResidentialContractor: boolean;
}

export default function FindContractors() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  
  const { 
    activeTour, 
    startTour, 
    markTourCompleted, 
    skipTour, 
    tours, 
    shouldShowTour 
  } = useHelpSystem();

  // Auto-start tour for new users
  useEffect(() => {
    if (shouldShowTour('contractor-search')) {
      const timer = setTimeout(() => {
        startTour('contractor-search');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowTour, startTour]);

  // Fetch contractors
  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ['/api/contractors', searchTerm, selectedCounty, selectedTrade],
    queryFn: async () => {
      let url = '/api/contractors?limit=50';
      if (selectedCounty) url += `&county=${selectedCounty}`;
      if (selectedTrade) url += `&trade=${selectedTrade}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch contractors');
      return response.json();
    },
  });

  // Filter contractors based on search term
  const filteredContractors = contractors.filter((contractor: Contractor) =>
    contractor.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contractor.about?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getVerificationBadge = (contractor: Contractor) => {
    if (contractor.verifiedLicensed && contractor.verifiedInsured) {
      return <Badge className="bg-green-600 text-white">Fully Verified</Badge>;
    } else if (contractor.verifiedLicensed || contractor.verifiedInsured) {
      return <Badge className="bg-yellow-600 text-white">Partially Verified</Badge>;
    }
    return <Badge variant="outline" className="border-gray-500 text-gray-400">Unverified</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-900 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-navy-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Find Local Contractors
            </h1>

          </div>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Browse our directory of verified, professional contractors in your area. 
            Connect directly and get quotes for your next project.
          </p>
          <div className="mt-4 flex items-center justify-center space-x-2">
            <Badge className="bg-orange-500 text-white px-4 py-2 text-lg">
              {filteredContractors.length} contractors available
            </Badge>

          </div>
        </div>

        {/* Search and Filters */}
        <Card className="bg-navy-700 border-navy-600 mb-8 contractor-search-form">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Search & Filter</h2>

            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 search-filters">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contractors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-navy-800 border-navy-600 text-white placeholder-gray-400"
                  data-testid="contractor-search-input"
                />

              </div>

              {/* County Filter */}
              <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                  <SelectValue placeholder="Select County" />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="">All Counties</SelectItem>
                  <SelectItem value="los-angeles">Los Angeles County</SelectItem>
                  <SelectItem value="orange">Orange County</SelectItem>
                  <SelectItem value="san-diego">San Diego County</SelectItem>
                </SelectContent>
              </Select>

              {/* Trade Filter */}
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger className="bg-navy-800 border-navy-600 text-white">
                  <SelectValue placeholder="Select Trade" />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="">All Trades</SelectItem>
                  <SelectItem value="roofing">Roofing</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="painting">Painting</SelectItem>
                  <SelectItem value="general">General Contractor</SelectItem>
                </SelectContent>
              </Select>

              {/* Reset Filters */}
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCounty("");
                  setSelectedTrade("");
                }}
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contractor Listings */}
        {filteredContractors.length === 0 ? (
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-12 text-center">
              <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No contractors found</h3>
              <p className="text-gray-400">
                Try adjusting your search criteria or browse all available contractors.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredContractors.map((contractor: Contractor) => (
              <Card key={contractor.id} className="bg-navy-700 border-navy-600 hover:border-orange-500/50 transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-white flex items-center">
                        <Building className="h-5 w-5 mr-2 text-orange-500" />
                        {contractor.companyName}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {getVerificationBadge(contractor)}
                        {contractor.isGeneralContractor && (
                          <Badge variant="outline" className="border-blue-500 text-blue-400">
                            General Contractor
                          </Badge>
                        )}
                        {contractor.isResidentialContractor && (
                          <Badge variant="outline" className="border-green-500 text-green-400">
                            Residential
                          </Badge>
                        )}
                      </div>
                    </div>
                    {contractor.verifiedLicensed && contractor.verifiedInsured && (
                      <div className="flex items-center text-green-400">
                        <CheckCircle className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Description */}
                  {contractor.about && (
                    <p className="text-gray-300 leading-relaxed">
                      {contractor.about}
                    </p>
                  )}

                  {/* Contact Information */}
                  <div className="space-y-2">
                    {contractor.phone && (
                      <div className="flex items-center text-gray-300">
                        <Phone className="h-4 w-4 mr-3 text-orange-500" />
                        <a href={`tel:${contractor.phone}`} className="hover:text-orange-400 transition-colors">
                          {contractor.phone}
                        </a>
                      </div>
                    )}
                    
                    {contractor.email && (
                      <div className="flex items-center text-gray-300">
                        <Mail className="h-4 w-4 mr-3 text-orange-500" />
                        <a href={`mailto:${contractor.email}`} className="hover:text-orange-400 transition-colors">
                          {contractor.email}
                        </a>
                      </div>
                    )}
                    
                    {contractor.website && (
                      <div className="flex items-center text-gray-300">
                        <Globe className="h-4 w-4 mr-3 text-orange-500" />
                        <a 
                          href={contractor.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-orange-400 transition-colors flex items-center"
                        >
                          Visit Website
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button 
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => window.open(`tel:${contractor.phone}`, '_self')}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call Now
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex-1 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                      onClick={() => window.open(`mailto:${contractor.email}`, '_self')}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Call to Action */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-orange-500/50">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-white mb-4">
                Are You a Contractor?
              </h2>
              <p className="text-xl text-gray-300 mb-6 max-w-2xl mx-auto">
                Join our platform to connect with homeowners and grow your business.
              </p>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-lg">
                Join as a Contractor
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}