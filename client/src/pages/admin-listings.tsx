import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, User, MapPin, DollarSign, Calendar } from "lucide-react";

export default function AdminListings() {
  const { toast } = useToast();
  const [selectedListing, setSelectedListing] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch pending listings
  interface PendingListing {
    id: string;
    title: string;
    description?: string;
    price: string | number;
    city?: string | null;
    state?: string | null;
    createdAt: string | Date;
    [key: string]: any;
  }

  const { data: pendingListings = [] as PendingListing[], isLoading } = useQuery<PendingListing[]>({
    queryKey: ["/api/admin/marketplace/pending"],
  });

  // Approve listing mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest("POST", `/api/admin/marketplace/listings/${id}/approve`, { notes });
    },
    onSuccess: () => {
      toast({
        title: "Listing Approved",
        description: "The listing has been approved and is now live.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pending"] });
      setSelectedListing(null);
      setNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve listing",
        variant: "destructive",
      });
    },
  });

  // Reject listing mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason, notes }: { id: string; reason: string; notes?: string }) => {
      return apiRequest("POST", `/api/admin/marketplace/listings/${id}/reject`, { reason, notes });
    },
    onSuccess: () => {
      toast({
        title: "Listing Rejected",
        description: "The listing has been rejected and the seller will be notified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/marketplace/pending"] });
      setSelectedListing(null);
      setNotes("");
      setRejectionReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject listing",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (listing: any) => {
    approveMutation.mutate({ id: listing.id, notes });
  };

  const handleReject = (listing: any) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a reason for rejecting this listing.",
        variant: "destructive",
      });
      return;
    }
    rejectMutation.mutate({ 
      id: listing.id, 
      reason: rejectionReason, 
      notes 
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-orange-500 mb-2">
          Pending Listings Approval
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve marketplace listings before they go live
        </p>
      </div>

      {!pendingListings || pendingListings.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-orange-500 mb-2">
              No Pending Listings
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              All marketplace listings have been reviewed and approved.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Listings List */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-orange-500">
              Pending Approval ({pendingListings.length})
            </h2>
            
            {pendingListings.map((listing: any) => (
              <Card 
                key={listing.id} 
                className={`cursor-pointer transition-all ${
                  selectedListing?.id === listing.id 
                    ? 'ring-2 ring-blue-500 border-blue-500' 
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedListing(listing)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-orange-500 line-clamp-2">
                      {listing.title}
                    </h3>
                    <Badge variant="outline" className="ml-2">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      ${parseFloat(listing.price).toLocaleString()}
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      {listing.city}, {listing.state}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date(listing.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Listing Details */}
          <div className="sticky top-8">
            {selectedListing ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Review Listing</span>
                    <Badge variant="outline">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending Approval
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Listing Details */}
                  <div>
                    <h3 className="font-medium text-orange-500 mb-2">
                      {selectedListing.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                      {selectedListing.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Price:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        ${parseFloat(selectedListing.price).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Condition:</span>
                      <p className="text-gray-600 dark:text-gray-400 capitalize">
                        {selectedListing.condition?.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Location:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {selectedListing.city}, {selectedListing.state}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Created:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {new Date(selectedListing.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Admin Notes (Optional)
                    </label>
                    <Textarea
                      placeholder="Add any notes about this approval/rejection..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  {/* Rejection Reason */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Rejection Reason (Required if rejecting)
                    </label>
                    <Textarea
                      placeholder="Provide a clear reason for rejection that will be shown to the seller..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleApprove(selectedListing)}
                      disabled={approveMutation.isPending}
                      className="flex-1"
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {approveMutation.isPending ? "Approving..." : "Approve"}
                    </Button>
                    <Button
                      onClick={() => handleReject(selectedListing)}
                      disabled={rejectMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-orange-500 mb-2">
                    Select a Listing
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Choose a listing from the left to review and approve or reject it.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}