import { Card, CardContent } from "@/components/ui/card";

export default function ContractorCardSkeleton() {
  return (
    <Card className="bg-tsCard border-white/10 card-enhanced">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          {/* Avatar skeleton */}
          <div className="w-16 h-16 rounded-lg skeleton-enhanced" />
          
          {/* Rating skeleton */}
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <div key={star} className="w-4 h-4 skeleton-enhanced rounded" />
              ))}
            </div>
            <div className="w-8 h-4 skeleton-enhanced rounded" />
          </div>
        </div>

        {/* Company name skeleton */}
        <div className="w-48 h-6 mb-2 skeleton-enhanced rounded" />
        
        {/* Trade badges skeleton */}
        <div className="flex space-x-2 mb-3">
          <div className="w-16 h-6 rounded-full skeleton-enhanced" />
          <div className="w-20 h-6 rounded-full skeleton-enhanced" />
        </div>

        {/* Service areas skeleton */}
        <div className="w-full h-4 mb-4 skeleton-enhanced rounded" />

        {/* Business info skeleton */}
        <div className="flex justify-between mb-4">
          <div className="w-16 h-4 skeleton-enhanced rounded" />
          <div className="w-20 h-4 skeleton-enhanced rounded" />
          <div className="w-24 h-4 skeleton-enhanced rounded" />
        </div>

        {/* Verification badges skeleton */}
        <div className="flex space-x-2 mb-4">
          <div className="w-20 h-6 rounded-full skeleton-enhanced" />
          <div className="w-18 h-6 rounded-full skeleton-enhanced" />
        </div>

        {/* Action buttons skeleton */}
        <div className="flex space-x-2">
          <div className="flex-1 h-10 rounded-md skeleton-enhanced" />
          <div className="flex-1 h-10 rounded-md skeleton-enhanced" />
        </div>
      </CardContent>
    </Card>
  );
}