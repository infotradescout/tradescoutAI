import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  MapPin, 
  Calendar, 
  Clock, 
  ThumbsUp, 
  Phone, 
  Mail,
  CheckCircle,
  Shield,
  ExternalLink
} from "lucide-react";
import type { Contractor } from "@shared/schema";

interface ContractorCardProps {
  contractor: Contractor;
  showCallToAction?: boolean;
  compact?: boolean;
}

export default function ContractorCard({ 
  contractor, 
  showCallToAction = true, 
  compact = false 
}: ContractorCardProps) {
  // Generate company initials for avatar
  const companyInitials = contractor.companyName
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'CC';

  // Mock data for demonstration - in production this would come from the API
  const mockRating = 4.8;
  const mockRecommendationCount = 42;
  const mockServiceAreas = ['Los Angeles', 'Orange', 'Ventura'];

  return (
    <Card className="bg-navy-700 border-navy-600 hover:bg-navy-600 transition-all duration-300 card-shadow">
      <CardContent className={`${compact ? 'p-4' : 'p-3 md:p-6'}`}>
        {/* Company Avatar */}
        <div className="flex items-start justify-between mb-4">
          <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold ${compact ? 'text-lg' : 'text-xl'}`}>
            {companyInitials}
          </div>

          {/* Rating */}
          <div className="flex items-center space-x-2">
            <div className="flex text-yellow-400">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} ${star <= Math.round(mockRating) ? 'fill-current' : ''}`}
                />
              ))}
            </div>
            <span className={`text-gray-300 ${compact ? 'text-xs' : 'text-sm'}`}>
              {mockRating}
            </span>
          </div>
        </div>

        {/* Company Name */}
        <Link href={`/contractors/${contractor.slug}`}>
          <h3 className={`font-semibold text-white mb-2 hover:text-orange-400 transition-colors cursor-pointer ${compact ? 'text-base' : 'text-lg'}`}>
            {contractor.companyName}
          </h3>
        </Link>

        {/* Trade Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Mock trades - in production this would come from contractor relationships */}
          <Badge variant="outline" className="bg-navy-600 text-orange-400 border-orange-400/30 text-xs">
            Roofing
          </Badge>
          <Badge variant="outline" className="bg-navy-600 text-orange-400 border-orange-400/30 text-xs">
            Siding
          </Badge>
        </div>

        {/* Service Areas */}
        <p className={`text-gray-300 mb-4 flex items-center ${compact ? 'text-xs' : 'text-sm'}`}>
          <MapPin className={`text-orange-500 mr-1 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
          {mockServiceAreas.slice(0, 2).join(', ')}
          {mockServiceAreas.length > 2 && ` +${mockServiceAreas.length - 2} more`}
        </p>

        {/* Business Info */}
        <div className={`flex items-center justify-between text-gray-300 mb-4 ${compact ? 'text-xs' : 'text-sm'}`}>
          <span className="flex items-center">
            <Calendar className={`text-orange-500 mr-1 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
            {contractor.yearsInBusiness || 15} years
          </span>
          <span className="flex items-center">
            <Clock className={`text-orange-500 mr-1 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
            {contractor.responseTimeSla || 2} hrs response
          </span>
          <span className="flex items-center">
            <ThumbsUp className={`text-orange-500 mr-1 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
            {mockRecommendationCount} recommendations
          </span>
        </div>

        {/* Verification Badges */}
        <div className="flex items-center space-x-2 mb-4">
          {contractor.verifiedLicensed && (
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Licensed
            </Badge>
          )}
          {contractor.verifiedInsured && (
            <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Insured
            </Badge>
          )}
          {contractor.lastVerified && (
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-xs">
              Verified {new Date(contractor.lastVerified).getFullYear()}
            </Badge>
          )}
        </div>

        {/* Action Buttons */}
        {showCallToAction && (
          <div className="flex space-x-2">
            {contractor.phone ? (
              <a href={`tel:${contractor.phone}`} className="flex-1">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white glow-effect transition-all duration-300">
                  <Phone className="h-4 w-4 mr-1" />
                  Call Now
                </Button>
              </a>
            ) : (
              <Link href={`/contractors/${contractor.slug}`} className="flex-1">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white glow-effect transition-all duration-300">
                  <Phone className="h-4 w-4 mr-1" />
                  Get Contact
                </Button>
              </Link>
            )}

            <Link href={`/contractors/${contractor.slug}`} className="flex-1">
              <Button variant="outline" className="w-full border-navy-500 text-white hover:bg-navy-500">
                <ExternalLink className="h-4 w-4 mr-1" />
                View Profile
              </Button>
            </Link>
          </div>
        )}

        {/* Compact mode - just view profile link */}
        {!showCallToAction && (
          <Link href={`/contractors/${contractor.slug}`}>
            <Button variant="outline" className="w-full border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white">
              View Full Profile
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}