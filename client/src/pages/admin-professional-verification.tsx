import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Home,
  Car,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Award,
  Building,
  CreditCard,
} from "lucide-react";

type ProfessionalServiceAreas =
  | string[]
  | {
      counties?: string[];
      cities?: string[];
      zipCodes?: string[];
    }
  | null;

type ProfessionalVerificationDocuments =
  | Record<string, string | string[] | null | undefined>
  | string[]
  | null;

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function serviceAreaLabels(value: ProfessionalServiceAreas): string[] {
  if (Array.isArray(value)) return stringValues(value);
  if (!value || typeof value !== "object") return [];
  return [
    ...stringValues(value.counties).map((item) => `County: ${item}`),
    ...stringValues(value.cities).map((item) => `City: ${item}`),
    ...stringValues(value.zipCodes).map((item) => `ZIP: ${item}`),
  ];
}

function documentLabels(value: ProfessionalVerificationDocuments): string[] {
  if (Array.isArray(value)) return stringValues(value).map((_, index) => `Document ${index + 1}`);
  if (!value || typeof value !== "object") return [];

  return Object.entries(value).flatMap(([key, item]) => {
    const values = typeof item === "string" ? [item.trim()].filter(Boolean) : stringValues(item);
    const label = key
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/^./, (character) => character.toUpperCase());
    return values.map((_, index) => (values.length > 1 ? `${label} ${index + 1}` : label));
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not provided" : parsed.toLocaleDateString();
}

interface RealtorProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  brokerageName: string;
  mlsId: string | null;
  specializations: string[] | null;
  yearsExperience: number | null;
  transactionsCompleted: number | null;
  averageTransactionValue: number | string | null;
  serviceAreas: ProfessionalServiceAreas;
  licenseState: string;
  licenseExpiration: string | null;
  verificationStatus: string;
  verificationDocuments: ProfessionalVerificationDocuments;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    role: string;
    createdAt: string;
  };
}

interface CarSalesmanProfile {
  id: string;
  userId: string;
  dealershipName: string;
  dealerLicense: string;
  salesmanLicense: string | null;
  specializations: string[] | null;
  yearsExperience: number | null;
  vehiclesSold: number | null;
  averageVehicleValue: number | string | null;
  brandsSpecialty: string[] | null;
  serviceAreas: ProfessionalServiceAreas;
  licenseState: string;
  licenseExpiration: string | null;
  verificationStatus: string;
  verificationDocuments: ProfessionalVerificationDocuments;
  isActive: boolean;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl?: string;
    role: string;
    createdAt: string;
  };
}

export default function AdminProfessionalVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("realtors");
  const [verificationNotes, setVerificationNotes] = useState<{ [key: string]: string }>({});

  interface PendingApplications {
    realtors: RealtorProfile[];
    carSalesmen: CarSalesmanProfile[];
  }

  // Fetch pending applications
  const { data: pendingApplications = { realtors: [], carSalesmen: [] }, isLoading } =
    useQuery<PendingApplications>({
      queryKey: ["/api/admin/professional/pending"],
      refetchInterval: 30000, // Refresh every 30 seconds
    });

  // Verification mutations
  const realtorVerificationMutation = useMutation({
    mutationFn: async ({
      profileId,
      approved,
      notes,
    }: {
      profileId: string;
      approved: boolean;
      notes: string;
    }) => {
      return apiRequest("POST", `/api/admin/realtor/verify/${profileId}`, { approved, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/professional/pending"] });
      toast({
        title: "Verification Updated",
        description: "Realtor verification status has been updated successfully.",
      });
      setVerificationNotes({});
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: formatUserFacingErrorMessage(error, "Failed to update verification status."),
        variant: "destructive",
      });
    },
  });

  const carSalesmanVerificationMutation = useMutation({
    mutationFn: async ({
      profileId,
      approved,
      notes,
    }: {
      profileId: string;
      approved: boolean;
      notes: string;
    }) => {
      return apiRequest("POST", `/api/admin/car-salesman/verify/${profileId}`, { approved, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/professional/pending"] });
      toast({
        title: "Verification Updated",
        description: "Car salesman verification status has been updated successfully.",
      });
      setVerificationNotes({});
    },
    onError: (error) => {
      toast({
        title: "Verification Failed",
        description: formatUserFacingErrorMessage(error, "Failed to update verification status."),
        variant: "destructive",
      });
    },
  });

  const handleRealtorVerification = (profileId: string, approved: boolean) => {
    const notes = verificationNotes[profileId] || "";
    realtorVerificationMutation.mutate({ profileId, approved, notes });
  };

  const handleCarSalesmanVerification = (profileId: string, approved: boolean) => {
    const notes = verificationNotes[profileId] || "";
    carSalesmanVerificationMutation.mutate({ profileId, approved, notes });
  };

  const formatCurrency = (amount: number | string | null) => {
    if (amount == null || amount === "") return "Not provided";
    const normalizedAmount = Number(amount);
    if (!Number.isFinite(normalizedAmount)) return "Not provided";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(normalizedAmount);
  };

  if (isLoading) {
    return (
      <div className=" p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-ts-orange/30 border-t-transparent rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  const realtors = pendingApplications?.realtors || [];
  const carSalesmen = pendingApplications?.carSalesmen || [];

  return (
    <div className=" p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-ts-orange mb-2">
            Professional Network Verification
          </h1>
          <p className="text-white/60 dark:text-white/60">
            Review and verify professional applications for marketplace access
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Home className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-white/60 dark:text-white/60">Pending Realtors</p>
                  <p className="text-2xl font-bold text-ts-orange">{realtors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                  <Car className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-white/60 dark:text-white/60">Pending Car Salesmen</p>
                  <p className="text-2xl font-bold text-ts-orange">{carSalesmen.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-ts-orange/10 dark:bg-ts-orange/10 rounded-lg">
                  <Clock className="h-6 w-6 text-ts-orange" />
                </div>
                <div>
                  <p className="text-sm text-white/60 dark:text-white/60">Total Pending</p>
                  <p className="text-2xl font-bold text-ts-orange">
                    {realtors.length + carSalesmen.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Applications */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="realtors" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Realtor Applications ({realtors.length})
            </TabsTrigger>
            <TabsTrigger value="car-salesmen" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Car Salesman Applications ({carSalesmen.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="realtors">
            {realtors.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Home className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-ts-orange mb-2">
                    No Pending Realtor Applications
                  </h3>
                  <p className="text-white/60 dark:text-white/60">
                    All realtor applications have been processed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {realtors.map((realtor: RealtorProfile) => (
                  <Card key={realtor.id} className="overflow-hidden">
                    <CardHeader className="bg-blue-50 dark:bg-blue-900/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Home className="h-5 w-5 text-blue-600" />
                            {realtor.user.firstName} {realtor.user.lastName}
                          </CardTitle>
                          <p className="text-sm text-white/60 dark:text-white/60 mt-1">
                            Applied {new Date(realtor.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-blue-200 text-blue-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Personal Info */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-ts-orange flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Personal Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-white/60" />
                              <span>{realtor.user.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-white/60" />
                              <span>{realtor.yearsExperience} years experience</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-white/60" />
                              <span>{realtor.transactionsCompleted} transactions completed</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-white/60" />
                              <span>
                                Avg. transaction: {formatCurrency(realtor.averageTransactionValue)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* License Info */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-ts-orange flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            License Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">License Number:</span>
                              <span className="ml-2">{realtor.licenseNumber}</span>
                            </div>
                            <div>
                              <span className="font-medium">License State:</span>
                              <span className="ml-2">{realtor.licenseState}</span>
                            </div>
                            <div>
                              <span className="font-medium">Expiration:</span>
                              <span className="ml-2">{formatDate(realtor.licenseExpiration)}</span>
                            </div>
                            <div>
                              <span className="font-medium">Brokerage:</span>
                              <span className="ml-2">{realtor.brokerageName}</span>
                            </div>
                            <div>
                              <span className="font-medium">MLS ID:</span>
                              <span className="ml-2">{realtor.mlsId}</span>
                            </div>
                          </div>
                        </div>

                        {/* Specializations & Service Areas */}
                        <div className="lg:col-span-2 space-y-4">
                          <div>
                            <h4 className="font-semibold text-ts-orange mb-2">Specializations</h4>
                            <div className="flex flex-wrap gap-2">
                              {stringValues(realtor.specializations).map((spec, index) => (
                                <Badge key={index} variant="secondary">
                                  {spec}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-ts-orange mb-2">Service Areas</h4>
                            <div className="flex flex-wrap gap-2">
                              {serviceAreaLabels(realtor.serviceAreas).map((area, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Verification Documents */}
                        {documentLabels(realtor.verificationDocuments).length > 0 && (
                          <div className="lg:col-span-2">
                            <h4 className="font-semibold text-ts-orange mb-2">
                              Verification Documents
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {documentLabels(realtor.verificationDocuments).map((doc, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  {doc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification Notes */}
                        <div className="lg:col-span-2">
                          <h4 className="font-semibold text-ts-orange mb-2">Verification Notes</h4>
                          <Textarea
                            placeholder="Add notes about this verification decision..."
                            value={verificationNotes[realtor.id] || ""}
                            onChange={(e) =>
                              setVerificationNotes((prev) => ({
                                ...prev,
                                [realtor.id]: e.target.value,
                              }))
                            }
                            className="min-h-[80px]"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="lg:col-span-2 flex gap-3 pt-4 border-t">
                          <Button
                            onClick={() => handleRealtorVerification(realtor.id, true)}
                            disabled={realtorVerificationMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Realtor
                          </Button>
                          <Button
                            onClick={() => handleRealtorVerification(realtor.id, false)}
                            disabled={realtorVerificationMutation.isPending}
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject Application
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="car-salesmen">
            {carSalesmen.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Car className="h-12 w-12 text-white/60 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-ts-orange mb-2">
                    No Pending Car Salesman Applications
                  </h3>
                  <p className="text-white/60 dark:text-white/60">
                    All car salesman applications have been processed.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {carSalesmen.map((salesman: CarSalesmanProfile) => (
                  <Card key={salesman.id} className="overflow-hidden">
                    <CardHeader className="bg-red-50 dark:bg-red-900/10">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Car className="h-5 w-5 text-red-600" />
                            {salesman.user.firstName} {salesman.user.lastName}
                          </CardTitle>
                          <p className="text-sm text-white/60 dark:text-white/60 mt-1">
                            Applied {new Date(salesman.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="border-red-200 text-red-700">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending Review
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Personal Info */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-ts-orange flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Personal Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-white/60" />
                              <span>{salesman.user.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-white/60" />
                              <span>{salesman.yearsExperience} years experience</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-white/60" />
                              <span>{salesman.vehiclesSold} vehicles sold</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-white/60" />
                              <span>
                                Avg. vehicle value: {formatCurrency(salesman.averageVehicleValue)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* License Info */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-ts-orange flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            License Information
                          </h4>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Dealer License:</span>
                              <span className="ml-2">{salesman.dealerLicense}</span>
                            </div>
                            <div>
                              <span className="font-medium">Salesman License:</span>
                              <span className="ml-2">{salesman.salesmanLicense}</span>
                            </div>
                            <div>
                              <span className="font-medium">License State:</span>
                              <span className="ml-2">{salesman.licenseState}</span>
                            </div>
                            <div>
                              <span className="font-medium">Expiration:</span>
                              <span className="ml-2">{formatDate(salesman.licenseExpiration)}</span>
                            </div>
                            <div>
                              <span className="font-medium">Dealership:</span>
                              <span className="ml-2">{salesman.dealershipName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Specializations & Brands */}
                        <div className="lg:col-span-2 space-y-4">
                          <div>
                            <h4 className="font-semibold text-ts-orange mb-2">Specializations</h4>
                            <div className="flex flex-wrap gap-2">
                              {stringValues(salesman.specializations).map((spec, index) => (
                                <Badge key={index} variant="secondary">
                                  {spec}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-ts-orange mb-2">Brand Specialties</h4>
                            <div className="flex flex-wrap gap-2">
                              {stringValues(salesman.brandsSpecialty).map((brand, index) => (
                                <Badge key={index} variant="outline">
                                  {brand}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold text-ts-orange mb-2">Service Areas</h4>
                            <div className="flex flex-wrap gap-2">
                              {serviceAreaLabels(salesman.serviceAreas).map((area, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  <MapPin className="h-3 w-3" />
                                  {area}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Verification Documents */}
                        {documentLabels(salesman.verificationDocuments).length > 0 && (
                          <div className="lg:col-span-2">
                            <h4 className="font-semibold text-ts-orange mb-2">
                              Verification Documents
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {documentLabels(salesman.verificationDocuments).map((doc, index) => (
                                <Badge
                                  key={index}
                                  variant="outline"
                                  className="flex items-center gap-1"
                                >
                                  <FileText className="h-3 w-3" />
                                  {doc}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification Notes */}
                        <div className="lg:col-span-2">
                          <h4 className="font-semibold text-ts-orange mb-2">Verification Notes</h4>
                          <Textarea
                            placeholder="Add notes about this verification decision..."
                            value={verificationNotes[salesman.id] || ""}
                            onChange={(e) =>
                              setVerificationNotes((prev) => ({
                                ...prev,
                                [salesman.id]: e.target.value,
                              }))
                            }
                            className="min-h-[80px]"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="lg:col-span-2 flex gap-3 pt-4 border-t">
                          <Button
                            onClick={() => handleCarSalesmanVerification(salesman.id, true)}
                            disabled={carSalesmanVerificationMutation.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve Salesman
                          </Button>
                          <Button
                            onClick={() => handleCarSalesmanVerification(salesman.id, false)}
                            disabled={carSalesmanVerificationMutation.isPending}
                            variant="destructive"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject Application
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
