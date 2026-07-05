import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";

type RequirementField = "license" | "insurance" | "tax_id" | "business_registration";

interface ProfileVerificationRow {
  profile: {
    id: string;
    userId: string;
    userIntent: "person" | "business";
    businessType?: "service_provider" | "seller" | null;
    verificationRequirements?: Partial<Record<RequirementField, boolean>>;
    license_verified?: boolean;
    insurance_verified?: boolean;
    tax_id_verified?: boolean;
    business_registration_verified?: boolean;
    verificationSubmissions?: {
      licenseNumber?: string;
      licenseDocObjectKey?: string;
      taxId?: string;
      insuranceDocObjectKey?: string;
      businessRegistrationDocObjectKey?: string;
      submittedAt?: string;
    };
    verificationStatus?: string;
  };
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const FIELD_LABELS: Record<RequirementField, string> = {
  license: "License",
  insurance: "Insurance",
  tax_id: "Tax ID",
  business_registration: "Business Registration",
};

const FIELD_VERIFIED_KEY: Record<RequirementField, string> = {
  license: "license_verified",
  insurance: "insurance_verified",
  tax_id: "tax_id_verified",
  business_registration: "business_registration_verified",
};

const FIELD_SUBMISSION_SUMMARY = (
  row: ProfileVerificationRow["profile"],
  field: RequirementField
): string | null => {
  const s = row.verificationSubmissions || {};
  if (field === "license")
    return s.licenseNumber || (s.licenseDocObjectKey ? "Document uploaded" : null);
  if (field === "tax_id") return s.taxId || null;
  if (field === "insurance") return s.insuranceDocObjectKey ? "Document uploaded" : null;
  if (field === "business_registration")
    return s.businessRegistrationDocObjectKey ? "Document uploaded" : null;
  return null;
};

export default function AdminProfileVerifications() {
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rows, isLoading } = useQuery<ProfileVerificationRow[]>({
    queryKey: ["/api/admin/profile-verifications", statusFilter],
    queryFn: () => apiRequest("GET", `/api/admin/profile-verifications?status=${statusFilter}`),
  });

  const decisionMutation = useMutation({
    mutationFn: ({
      profileId,
      field,
      decision,
    }: {
      profileId: string;
      field: RequirementField;
      decision: "approved" | "rejected";
    }) => apiRequest("PUT", `/api/admin/profile-verifications/${profileId}`, { field, decision }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/profile-verifications"] });
      toast({ title: "Verification updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Update failed",
        description: formatUserFacingErrorMessage(error, "Failed to update verification."),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-[color:var(--text-secondary)]">
            Loading business verification submissions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ts-orange">Business Verifications</h1>
        <p className="text-[color:var(--text-secondary)] mt-2">
          Review self-reported license, insurance, tax ID, and business registration submissions.
          What's required differs per profile — a salon never needs a contractor license.
        </p>
      </div>

      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All with submissions</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>Approve or reject each required field independently.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Profile type</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Overall status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows?.map(({ profile, user }) => {
                  const requirements = profile.verificationRequirements || {};
                  const activeFields = (
                    ["license", "insurance", "tax_id", "business_registration"] as const
                  ).filter((f) => requirements[f]);

                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-[color:var(--text-secondary)]" />
                          <div>
                            <p className="font-medium">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-sm text-[color:var(--text-secondary)]">
                              {user?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm capitalize">
                          {profile.userIntent === "business"
                            ? profile.businessType?.replace("_", " ") || "business"
                            : "person"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {activeFields.length === 0 ? (
                          <span className="text-sm text-[color:var(--text-secondary)]">
                            No submission fields required
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {activeFields.map((field) => {
                              const verified = Boolean((profile as any)[FIELD_VERIFIED_KEY[field]]);
                              const summary = FIELD_SUBMISSION_SUMMARY(profile, field);
                              return (
                                <div key={field} className="flex items-center gap-2">
                                  {verified ? (
                                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                  ) : summary ? (
                                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-white/30 shrink-0" />
                                  )}
                                  <span className="text-sm w-40">{FIELD_LABELS[field]}</span>
                                  <span className="text-xs text-[color:var(--text-secondary)] flex-1 truncate">
                                    {summary || "Not submitted"}
                                  </span>
                                  {!verified && summary && (
                                    <div className="flex gap-1 shrink-0">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={decisionMutation.isPending}
                                        onClick={() =>
                                          decisionMutation.mutate({
                                            profileId: profile.id,
                                            field,
                                            decision: "approved",
                                          })
                                        }
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={decisionMutation.isPending}
                                        onClick={() =>
                                          decisionMutation.mutate({
                                            profileId: profile.id,
                                            field,
                                            decision: "rejected",
                                          })
                                        }
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            profile.verificationStatus === "approved"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {profile.verificationStatus || "pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {(!rows || rows.length === 0) && (
              <div className="text-center py-8">
                <p className="text-[color:var(--text-secondary)]">
                  No business verification submissions found.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
