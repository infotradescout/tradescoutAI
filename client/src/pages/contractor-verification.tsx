import { memo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Camera,
  Shield,
  Award,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ContractorVerification = memo(function ContractorVerification() {
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();

  const pendingVerifications = [
    {
      id: 1,
      name: "Mike Johnson",
      email: "mike@johnsonroofing.com",
      company: "Johnson Roofing LLC",
      trade: "Roofing",
      location: "Los Angeles County, CA",
      submittedDate: "2024-03-20",
      licenseNumber: "C-39-987654",
      documents: [
        { type: "License", status: "submitted", url: "/docs/license.pdf" },
        { type: "Insurance", status: "submitted", url: "/docs/insurance.pdf" },
        { type: "Bond", status: "submitted", url: "/docs/bond.pdf" },
      ],
      priority: "high",
    },
    {
      id: 2,
      name: "Sarah Martinez",
      email: "sarah@electricpro.com",
      company: "Electric Pro Solutions",
      trade: "Electrical",
      location: "Orange County, CA",
      submittedDate: "2024-03-18",
      licenseNumber: "C-10-123456",
      documents: [
        { type: "License", status: "submitted", url: "/docs/license2.pdf" },
        { type: "Insurance", status: "pending", url: null },
        { type: "Bond", status: "submitted", url: "/docs/bond2.pdf" },
      ],
      priority: "medium",
    },
  ];

  const approvedVerifications = [
    {
      id: 3,
      name: "David Chen",
      email: "david@chenplumbing.com",
      company: "Chen Plumbing Services",
      trade: "Plumbing",
      location: "San Diego County, CA",
      approvedDate: "2024-03-15",
      licenseNumber: "C-36-567890",
      verifiedBy: "Admin Team",
      status: "active",
    },
  ];

  const handleApprove = (verificationId: number) => {
    toast({
      title: "Contractor Approved",
      description: "The contractor verification has been approved successfully.",
    });
  };

  const handleReject = (verificationId: number) => {
    toast({
      title: "Contractor Rejected",
      description: "The contractor verification has been rejected.",
      variant: "destructive",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "submitted":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-white/60" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-600";
      case "medium":
        return "bg-yellow-600";
      case "low":
        return "bg-green-600";
      default:
        return "bg-white/10";
    }
  };

  return (
    <div className=" text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-ts-orange" />
            <h1 className="text-4xl font-bold text-white">Contractor Verification</h1>
          </div>
          <p className="text-white/70 text-lg">
            Review and approve contractor license and insurance verifications
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Pending Review</p>
                  <p className="text-2xl font-bold text-white">{pendingVerifications.length}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Approved Today</p>
                  <p className="text-2xl font-bold text-white">12</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Verified</p>
                  <p className="text-2xl font-bold text-white">847</p>
                </div>
                <Award className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Avg Review Time</p>
                  <p className="text-2xl font-bold text-white">2.3h</p>
                </div>
                <Briefcase className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-tsCard border-white/10">
            <TabsTrigger value="pending" className="data-[state=active]:bg-ts-orange-dark">
              Pending Review ({pendingVerifications.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-ts-orange-dark">
              Approved ({approvedVerifications.length})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="data-[state=active]:bg-ts-orange-dark">
              Rejected (3)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            {pendingVerifications.map((verification) => (
              <Card
                key={verification.id}
                className="bg-tsCard/50 border-white/10 backdrop-blur-sm"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${getPriorityColor(verification.priority)}`}
                      ></div>
                      <div>
                        <CardTitle className="text-white">{verification.name}</CardTitle>
                        <p className="text-white/60">
                          {verification.company} • {verification.trade}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-ts-orange/30 text-ts-orange">
                      {verification.priority.toUpperCase()} PRIORITY
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Contractor Info */}
                    <div className="space-y-4">
                      <h4 className="text-white font-medium">Contractor Information</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-white/60">Email:</span>
                          <span className="text-white">{verification.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Location:</span>
                          <span className="text-white">{verification.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">License #:</span>
                          <span className="text-white">{verification.licenseNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60">Submitted:</span>
                          <span className="text-white">{verification.submittedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Documents */}
                    <div className="space-y-4">
                      <h4 className="text-white font-medium">Submitted Documents</h4>
                      <div className="space-y-3">
                        {verification.documents.map((doc, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-tsCard rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(doc.status)}
                              <span className="text-white">{doc.type}</span>
                            </div>
                            {doc.url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
                              >
                                <FileText className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                      <h4 className="text-white font-medium">Review Actions</h4>
                      <div className="space-y-3">
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => handleApprove(verification.id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Contractor
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full border-red-600 text-red-400 hover:bg-red-600/20"
                          onClick={() => handleReject(verification.id)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject Application
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Request More Info
                        </Button>
                      </div>

                      <div className="mt-4">
                        <Label htmlFor="notes" className="text-white">
                          Admin Notes
                        </Label>
                        <Textarea
                          id="notes"
                          placeholder="Add verification notes..."
                          className="mt-2 bg-tsCard border-white/10 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="approved" className="space-y-6">
            {approvedVerifications.map((verification) => (
              <Card
                key={verification.id}
                className="bg-tsCard/50 border-white/10 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                      <div>
                        <h3 className="text-white font-medium">{verification.name}</h3>
                        <p className="text-white/60">
                          {verification.company} • {verification.trade}
                        </p>
                        <p className="text-sm text-white/60">
                          Approved on {verification.approvedDate}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-green-600 text-green-400">
                      VERIFIED
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-6">
            <div className="text-center py-12">
              <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-white text-xl mb-2">No Rejected Applications</h3>
              <p className="text-white/60">
                All contractor applications are currently approved or pending
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default ContractorVerification;
