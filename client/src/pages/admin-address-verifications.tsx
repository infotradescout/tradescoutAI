import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Clock, FileText, Mail, Phone, UserCheck, Calendar } from "lucide-react";

interface AddressVerification {
  id: string;
  userId: string;
  fullAddress: string;
  city: string;
  state: string;
  zipCode: string;
  verificationMethod: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected' | 'expired';
  submittedAt?: string;
  reviewedAt?: string;
  approvedAt?: string;
  deadline: string;
  adminNotes?: string;
  postcardSentAt?: string;
  postcardVerifiedAt?: string;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  addressVerified: boolean;
}

interface VerificationWithUser {
  verification: AddressVerification;
  user: User;
}

export default function AdminAddressVerifications() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedVerification, setSelectedVerification] = useState<VerificationWithUser | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get address verifications
  const { data: verifications, isLoading } = useQuery({
    queryKey: ['/api/admin/address-verifications', statusFilter],
    queryFn: () => apiRequest(`/api/admin/address-verifications?status=${statusFilter}`),
  });

  // Update verification mutation
  const updateVerificationMutation = useMutation({
    mutationFn: async ({ id, status, adminNotes }: { id: string; status: string; adminNotes: string }) => {
      return await apiRequest(`/api/admin/address-verifications/${id}`, 'PUT', { status, adminNotes });
    },
    onSuccess: () => {
      toast({
        title: "Verification Updated",
        description: "The address verification has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/address-verifications'] });
      setSelectedVerification(null);
      setReviewStatus("");
      setAdminNotes("");
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update verification",
        variant: "destructive",
      });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'expired':
        return <XCircle className="w-4 h-4 text-ts-orange" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      submitted: "default",
      approved: "default",
      rejected: "destructive",
      expired: "destructive",
    } as const;

    const colors = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      expired: "bg-ts-orange/10 text-ts-orange dark:bg-ts-orange/10 dark:text-ts-orange",
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || colors.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'postcard':
        return <Mail className="w-4 h-4" />;
      case 'phone_verification':
        return <Phone className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining;
  };

  const handleReview = () => {
    if (!selectedVerification || !reviewStatus) return;
    
    updateVerificationMutation.mutate({
      id: selectedVerification.verification.id,
      status: reviewStatus,
      adminNotes,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white/60 dark:text-white/60">Loading address verifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ts-orange">Address Verifications</h1>
        <p className="text-white/60 dark:text-white/60 mt-2">
          Manage user address verification requests and monitor platform compliance.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {['pending', 'submitted', 'approved', 'rejected'].map((status) => {
          const count = verifications?.filter((v: VerificationWithUser) => v.verification.status === status).length || 0;
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/60 dark:text-white/60 capitalize">{status}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  {getStatusIcon(status)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Verifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Verifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Address Verification Requests</CardTitle>
          <CardDescription>
            Review and approve user address verification submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {verifications?.map((item: VerificationWithUser) => {
                  const { verification, user } = item;
                  const daysRemaining = getDaysRemaining(verification.deadline);
                  const isOverdue = daysRemaining < 0;
                  
                  return (
                    <TableRow key={verification.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-white/60" />
                          <div>
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-sm text-white/60">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="font-medium">{verification.fullAddress}</p>
                          <p className="text-sm text-white/60">
                            {verification.city}, {verification.state} {verification.zipCode}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getMethodIcon(verification.verificationMethod)}
                          <span className="capitalize">
                            {verification.verificationMethod?.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(verification.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-white/60" />
                          <div>
                            <p className="text-sm">{formatDate(verification.deadline)}</p>
                            <p className={`text-xs ${isOverdue ? 'text-red-600' : daysRemaining <= 3 ? 'text-ts-orange' : 'text-white/60'}`}>
                              {isOverdue ? `${Math.abs(daysRemaining)} days overdue` : `${daysRemaining} days left`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {verification.submittedAt ? formatDate(verification.submittedAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedVerification(item);
                                setReviewStatus(verification.status);
                                setAdminNotes(verification.adminNotes || "");
                              }}
                            >
                              Review
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader>
                              <DialogTitle>Review Address Verification</DialogTitle>
                              <DialogDescription>
                                Review and update the status of this address verification request.
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedVerification && (
                              <div className="space-y-4">
                                {/* User Info */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">User</Label>
                                    <p className="text-sm">
                                      {selectedVerification.user.firstName} {selectedVerification.user.lastName}
                                    </p>
                                    <p className="text-sm text-white/60">{selectedVerification.user.email}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Current Status</Label>
                                    <div className="mt-1">
                                      {getStatusBadge(selectedVerification.verification.status)}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Address Info */}
                                <div>
                                  <Label className="text-sm font-medium">Address</Label>
                                  <div
                                    className="mt-1 p-3 rounded-md"
                                    style={{ backgroundColor: "var(--surface-card)" }}
                                  >
                                    <p>{selectedVerification.verification.fullAddress}</p>
                                    <p className="text-sm text-white/60">
                                      {selectedVerification.verification.city}, {selectedVerification.verification.state} {selectedVerification.verification.zipCode}
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Verification Details */}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm font-medium">Method</Label>
                                    <p className="text-sm capitalize">
                                      {selectedVerification.verification.verificationMethod?.replace('_', ' ')}
                                    </p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium">Deadline</Label>
                                    <p className="text-sm">{formatDate(selectedVerification.verification.deadline)}</p>
                                  </div>
                                </div>
                                
                                {/* Review Form */}
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="status">Update Status</Label>
                                    <Select value={reviewStatus} onValueChange={setReviewStatus}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="approved">Approved</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  <div>
                                    <Label htmlFor="notes">Admin Notes</Label>
                                    <Textarea
                                      id="notes"
                                      placeholder="Add any notes about this verification..."
                                      value={adminNotes}
                                      onChange={(e) => setAdminNotes(e.target.value)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <DialogFooter>
                              <Button 
                                onClick={handleReview}
                                disabled={updateVerificationMutation.isPending || !reviewStatus}
                              >
                                {updateVerificationMutation.isPending ? 'Updating...' : 'Update Verification'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {(!verifications || verifications.length === 0) && (
              <div className="text-center py-8">
                <p className="text-white/60 dark:text-white/60">No address verifications found.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}