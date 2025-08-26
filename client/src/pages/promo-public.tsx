import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Phone, Mail, Globe, Star, Shield, Calendar, DollarSign, MapPin, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

interface PromoData {
  promo: {
    id: string;
    title: string;
    description: string;
    offerDetails: string;
    discountType: string;
    discountValue: string;
    minimumJobValue?: string;
    promoCode?: string;
    expiresAt?: string;
    slug: string;
  };
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    phone?: string;
    email?: string;
    about?: string;
    photos?: string[];
    yearsInBusiness?: number;
    verifiedLicensed: boolean;
    verifiedInsured: boolean;
  };
}

export default function PromoPublic() {
  const [match, params] = useRoute("/promo/:slug");
  const slug = params?.slug;

  const { data: promoData, isLoading, error } = useQuery({
    queryKey: ["/promo", slug],
    queryFn: () => apiRequest(`/promo/${slug}`),
    enabled: !!slug,
  });

  const trackClick = useMutation({
    mutationFn: () => apiRequest(`/api/promo/${slug}/click`, { method: "POST" }),
  });

  const handleContactClick = (type: 'phone' | 'email') => {
    trackClick.mutate();
    // Analytics tracking for connection generation
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'promo_contact_click', {
        promo_id: promoData?.promo.id,
        contact_type: type,
        contractor_id: promoData?.contractor.id,
      });
    }
  };

  const formatDiscountValue = (discountType: string, discountValue: string) => {
    if (discountType === 'percentage') {
      return `${discountValue}% OFF`;
    } else if (discountType === 'fixed_amount') {
      return `$${discountValue} OFF`;
    } else if (discountType === 'free_service') {
      return 'FREE SERVICE';
    } else if (discountType === 'bundle_deal') {
      return 'SPECIAL BUNDLE';
    }
    return discountValue;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading special offer...</p>
        </div>
      </div>
    );
  }

  if (error || !promoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Promo Not Found</h1>
            <p className="text-gray-600 mb-4">
              This promotional offer may have expired or is no longer available.
            </p>
            <Button asChild>
              <a href="/">Return to TradeScout</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { promo, contractor } = promoData as PromoData;
  const isExpired = promo.expiresAt && new Date(promo.expiresAt) < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/" className="text-2xl font-bold text-orange-600">
              TradeScout
            </a>
            <Badge variant="outline" className="text-sm">
              Special Offer
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Promo Card */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden border-2 border-orange-200">
              <div className="bg-gradient-to-r from-orange-600 to-orange-700 text-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/20">
                    {formatDiscountValue(promo.discountType, promo.discountValue)}
                  </Badge>
                  {promo.expiresAt && (
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/20">
                      <Calendar className="h-3 w-3 mr-1" />
                      {isExpired ? "Expired" : `Expires ${new Date(promo.expiresAt).toLocaleDateString()}`}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold mb-2">{promo.title}</h1>
                <p className="text-orange-100 text-lg">{promo.description}</p>
              </div>
              
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <DollarSign className="h-5 w-5 mr-2 text-orange-600" />
                      Offer Details
                    </h3>
                    <p className="text-gray-700 leading-relaxed">{promo.offerDetails}</p>
                  </div>

                  {promo.minimumJobValue && (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>Minimum Job Value:</strong> ${promo.minimumJobValue}
                      </p>
                    </div>
                  )}

                  {promo.promoCode && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Promo Code:</strong>
                      </p>
                      <div className="flex items-center space-x-2">
                        <code className="bg-white px-3 py-2 rounded border text-lg font-mono">
                          {promo.promoCode}
                        </code>
                        <span className="text-sm text-gray-500">Mention this code when contacting</span>
                      </div>
                    </div>
                  )}

                  {isExpired && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                      <p className="text-red-800 font-medium">
                        This promotional offer has expired. Contact the contractor to see if similar deals are available.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contractor Info Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{contractor.companyName}</CardTitle>
                <CardDescription>Professional Contractor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {contractor.about && (
                  <p className="text-sm text-gray-600 leading-relaxed">{contractor.about}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {contractor.verifiedLicensed && (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Licensed
                    </Badge>
                  )}
                  {contractor.verifiedInsured && (
                    <Badge variant="outline" className="text-blue-600 border-blue-200">
                      <Award className="h-3 w-3 mr-1" />
                      Insured
                    </Badge>
                  )}
                  {contractor.yearsInBusiness && (
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      {contractor.yearsInBusiness} Years
                    </Badge>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Contact Information</h4>
                  
                  {contractor.phone && (
                    <Button 
                      asChild 
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleContactClick('phone')}
                    >
                      <a href={`tel:${contractor.phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call {contractor.phone}
                      </a>
                    </Button>
                  )}

                  {contractor.email && (
                    <Button 
                      variant="outline" 
                      asChild 
                      className="w-full"
                      onClick={() => handleContactClick('email')}
                    >
                      <a href={`mailto:${contractor.email}?subject=Inquiry about ${promo.title}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email Contractor
                      </a>
                    </Button>
                  )}

                  <Button variant="outline" asChild className="w-full">
                    <a href={`/contractors/${contractor.slug}`}>
                      <Star className="h-4 w-4 mr-2" />
                      View Full Profile
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Call to Action */}
            <Card className="bg-gradient-to-br from-orange-600 to-orange-700 text-white">
              <CardContent className="p-6 text-center">
                <h3 className="font-bold text-lg mb-2">Ready to Get Started?</h3>
                <p className="text-orange-100 text-sm mb-4">
                  Contact {contractor.companyName} now to claim this special offer and get your project started.
                </p>
                {contractor.phone && (
                  <Button 
                    variant="secondary" 
                    asChild 
                    className="w-full"
                    onClick={() => handleContactClick('phone')}
                  >
                    <a href={`tel:${contractor.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Call Now - {contractor.phone}
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* TradeScout Branding */}
            <Card className="bg-gray-50">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">
                  This offer is powered by
                </p>
                <a href="/" className="text-orange-600 font-bold text-sm hover:text-orange-700">
                  TradeScout
                </a>
                <p className="text-xs text-gray-400 mt-1">
                  Connecting homeowners with trusted local contractors
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}