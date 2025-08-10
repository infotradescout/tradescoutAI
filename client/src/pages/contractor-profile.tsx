import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Phone, Mail, MapPin, Calendar, Clock, Shield, CheckCircle, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Contractor, Recommendation } from "@shared/schema";

interface ContractorProfileData {
  contractor: Contractor;
  recommendations: Recommendation[];
  ratingSummary?: {
    average: number;
    count: number;
  };
}

export default function ContractorProfile() {
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();

  const { data: contractorData, isLoading, error } = useQuery<ContractorProfileData>({
    queryKey: [`/api/contractors/${slug}`],
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error || !contractorData) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="p-6 text-center">
            <p className="text-red-400">Contractor not found or failed to load.</p>
            <Link href="/contractors/board">
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600">
                Back to Contractor Board
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contractor, recommendations = [], ratingSummary } = contractorData;
  const companyInitials = contractor.companyName?.split(' ').map((word: string) => word[0]).join('').slice(0, 2).toUpperCase() || 'CC';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Profile Header */}
      <Card className="bg-navy-700 border-navy-600 mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <div className="w-24 h-24 bg-orange-500 rounded-xl flex items-center justify-center text-white text-3xl font-bold">
              {companyInitials}
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{contractor.companyName}</h1>
              
              {ratingSummary && ratingSummary.count > 0 && (
                <div className="flex items-center space-x-4 mb-4">
                  <div className="flex text-yellow-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`h-5 w-5 ${star <= Math.round(ratingSummary.average) ? 'fill-current' : ''}`}
                      />
                    ))}
                  </div>
                  <span className="text-white font-semibold">{ratingSummary.average.toFixed(1)}</span>
                  <span className="text-gray-300">({ratingSummary.count} recommendations)</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                {contractor.verifiedLicensed && (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Licensed
                  </Badge>
                )}
                {contractor.verifiedInsured && (
                  <Badge className="bg-green-600 hover:bg-green-600">
                    <Shield className="h-3 w-3 mr-1" />
                    Insured
                  </Badge>
                )}
                {contractor.lastVerified && (
                  <Badge className="bg-blue-600 hover:bg-blue-600">
                    <Calendar className="h-3 w-3 mr-1" />
                    Verified {new Date(contractor.lastVerified).getFullYear()}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              {contractor.phone && (
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold glow-effect transition-all duration-300">
                  <Phone className="h-4 w-4 mr-2" />
                  Call {contractor.phone}
                </Button>
              )}
              
              {contractor.email && (
                <Button variant="outline" className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white px-6 py-3">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* About */}
          {contractor.about && (
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">About</h3>
                <p className="text-gray-300 leading-relaxed">
                  {contractor.about}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recent Reviews */}
          {recommendations.length > 0 && (
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Recent Recommendations</h3>
                <div className="space-y-6">
                  {recommendations.slice(0, 3).map((recommendation: any, index: number) => (
                    <div key={recommendation.id} className={`${index < recommendations.length - 1 ? 'border-b border-navy-600 pb-6' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex text-yellow-400">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} className={`h-4 w-4 ${star <= recommendation.rating ? 'fill-current' : ''}`} />
                          ))}
                        </div>
                        <span className="text-gray-400 text-sm">
                          {new Date(recommendation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {recommendation.comment && (
                        <p className="text-gray-300 mb-2">{recommendation.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
                
                {!isAuthenticated && (
                  <div className="mt-6 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-orange-400 text-sm mb-2">Want to leave a recommendation?</p>
                    <Link href="/api/login">
                      <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                        Sign In to Recommend
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Services */}
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Services</h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-300">
                  <CheckCircle className="h-4 w-4 text-orange-500 mr-3" />
                  Residential Services
                </div>
                <div className="flex items-center text-gray-300">
                  <CheckCircle className="h-4 w-4 text-orange-500 mr-3" />
                  Commercial Services
                </div>
                <div className="flex items-center text-gray-300">
                  <CheckCircle className="h-4 w-4 text-orange-500 mr-3" />
                  Emergency Repairs
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card className="bg-navy-700 border-navy-600">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Business Info</h3>
              <div className="space-y-3">
                {contractor.yearsInBusiness && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Years in Business</span>
                    <span className="text-white">{contractor.yearsInBusiness}</span>
                  </div>
                )}
                
                {contractor.responseTimeSla && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Response Time</span>
                    <span className="text-white">{contractor.responseTimeSla} hours</span>
                  </div>
                )}
                
                {contractor.licenseNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">License #</span>
                    <span className="text-white">{contractor.licenseNumber}</span>
                  </div>
                )}
                
                {contractor.lastVerified && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Verified</span>
                    <span className="text-white">
                      {new Date(contractor.lastVerified).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Website Link */}
          {contractor.website && (
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <a 
                  href={contractor.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-orange-500 hover:text-orange-400 transition-colors"
                >
                  <span>Visit Website</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
