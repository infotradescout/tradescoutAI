import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Phone, Mail, MapPin, Calendar, Clock, Shield, CheckCircle, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ChatButton } from "@/components/ChatButton";
import { RecommendationForm } from "@/components/RecommendationForm";
import type { Contractor, Recommendation } from "@shared/schema";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";

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
            <Link href="/contractors">
              <Button className="mt-4 bg-orange-500 hover:bg-orange-600">
                Back to Find Contractors
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contractor, recommendations = [], ratingSummary } = contractorData;
  const companyInitials = contractor.companyName?.split(' ').map((word: string) => word[0]).join('').slice(0, 2).toUpperCase() || 'CC';

  // SEO data generation
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'Find Contractors', url: '/contractors' },
    { name: contractor.companyName, url: `/contractors/${slug}` }
  ];

  const contractorStructuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": contractor.companyName,
    "description": contractor.about || `Professional contractor services by ${contractor.companyName}`,
    "url": window.location.href,
    "telephone": contractor.phone || undefined,
    "email": contractor.email || undefined,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US"
    },
    "aggregateRating": ratingSummary ? {
      "@type": "AggregateRating",
      "ratingValue": ratingSummary.average,
      "recommendationCount": ratingSummary.count
    } : undefined,
    "priceRange": "$$",
    "serviceType": "Home Improvement Contractor",
    "areaServed": "Local Area"
  };

  const seoTitle = `${contractor.companyName} - Verified Local Contractor | TradeScout`;
  const seoDescription = `Hire ${contractor.companyName} for quality home improvement services. ${ratingSummary ? `${ratingSummary.average} star rating` : 'Verified'} contractor${contractor.yearsInBusiness ? ` with ${contractor.yearsInBusiness} years experience` : ''}. Licensed and insured.`;

  return (
    <>
      <SEOHelmet 
        title={seoTitle}
        description={seoDescription}
        keywords={`${contractor.companyName}, local contractor, home improvement, verified contractor, licensed contractor, free quotes`}
        canonical={`https://www.thetradescout.com/contractor/${slug}`}
        structuredData={contractorStructuredData}
      />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center space-x-2 text-sm text-gray-400">
            {breadcrumbItems.map((item, index) => (
              <li key={item.url} className="flex items-center">
                {index > 0 && <span className="mx-2 text-gray-500">/</span>}
                {index === breadcrumbItems.length - 1 ? (
                  <span className="text-orange-500 font-medium">{item.name}</span>
                ) : (
                  <Link href={item.url}>
                    <span className="hover:text-white transition-colors cursor-pointer">{item.name}</span>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      {/* Profile Header */}
      <Card className="bg-navy-700 border-navy-600 mb-8">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <div className="w-24 h-24 bg-orange-500 rounded-xl flex items-center justify-center text-white text-3xl font-bold">
              {companyInitials}
            </div>
            
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white mb-2">{contractor.companyName}</h1>
              
              {/* Recommendation Statistics */}
              <div className="flex items-center space-x-6 mb-4">
                <div className="flex items-center space-x-2">
                  <ThumbsUp className="h-5 w-5 text-green-400" />
                  <span className="text-green-400 font-semibold text-lg">{contractor.positiveRecommendations || 0}</span>
                  <span className="text-gray-300 text-sm">recommends</span>
                </div>
                
                {(contractor.negativeRecommendations || 0) > 0 && (
                  <div className="flex items-center space-x-2">
                    <ThumbsDown className="h-5 w-5 text-red-400" />
                    <span className="text-red-400 font-semibold text-lg">{contractor.negativeRecommendations}</span>
                    <span className="text-gray-300 text-sm">doesn't recommend</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <span className="text-white font-semibold text-lg">
                    Net Score: +{(contractor.positiveRecommendations || 0) - (contractor.negativeRecommendations || 0)}
                  </span>
                  <span className="text-gray-300 text-sm">
                    ({contractor.totalRecommendations || 0} total)
                  </span>
                </div>
              </div>

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
              <ChatButton 
                contractorId={contractor.id}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300"
              />
              
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

          {/* Recent Recommendations */}
          {recommendations.length > 0 && (
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-6">Recent Recommendations</h3>
                <div className="space-y-6">
                  {recommendations.slice(0, 5).map((recommendation: any, index: number) => (
                    <div key={recommendation.id} className={`${index < recommendations.length - 1 ? 'border-b border-navy-600 pb-6' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {recommendation.recommendationType === 'positive' ? (
                            <div className="flex items-center text-green-400">
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              <span className="text-sm font-medium">Recommends</span>
                            </div>
                          ) : (
                            <div className="flex items-center text-red-400">
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              <span className="text-sm font-medium">Does not recommend</span>
                            </div>
                          )}
                          {recommendation.projectType && (
                            <Badge variant="outline" className="text-gray-300 border-gray-500">
                              {recommendation.projectType}
                            </Badge>
                          )}
                        </div>
                        <span className="text-gray-400 text-sm">
                          {new Date(recommendation.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {recommendation.comment && (
                        <p className="text-gray-300 mb-2">{recommendation.comment}</p>
                      )}
                      {recommendation.customerName && (
                        <p className="text-gray-400 text-sm">- {recommendation.customerName}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendation Form */}
          <RecommendationForm 
            contractorId={contractor.id}
            contractorName={contractor.companyName}
          />
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
      </main>
    </>
  );
}
