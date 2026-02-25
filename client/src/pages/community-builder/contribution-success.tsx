import React from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ArrowRight } from "lucide-react";

export default function ContributionSuccessPage() {
  const [, params] = useRoute("/community-builder/contributions/:id/success");
  const [, navigate] = useLocation();
  const contributionId = params?.id;

  const { data: contribution } = useQuery({
    queryKey: ["contributionSuccess", contributionId],
    enabled: Boolean(contributionId),
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/contributions/${contributionId}`);
      if (!res.ok) throw new Error("Failed to load contribution");
      return res.json();
    },
  });

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="border-2 border-emerald-200">
          <CardHeader className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">Contribution Processed</CardTitle>
              <CardDescription>
                Your payment was received and the contribution is recorded.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="bg-emerald-100 text-emerald-800 flex items-center gap-1"
            >
              <CheckCircle className="w-4 h-4" />
              Success
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {contribution ? (
              <>
                <div>
                  <p className="text-lg font-semibold">{contribution.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{contribution.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-semibold capitalize">{contribution.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Value</p>
                    <p className="font-semibold">
                      ${contribution.actualValue || contribution.estimatedValue}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Verification</p>
                    <p className="font-semibold">
                      {contribution.verifiedAt ? "Verified" : "Pending audit"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vault Impact</p>
                    <p className="font-semibold">
                      ${contribution.actualValue || contribution.estimatedValue} added
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-gray-600">Loading contribution details...</p>
            )}
            <div className="flex flex-wrap gap-3 pt-4">
              <Button onClick={() => navigate("/community-builder/dashboard")}>
                Back to dashboard
              </Button>
              {contribution && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/community-builder/contributions/${contribution.id}`)}
                >
                  View details
                </Button>
              )}
              <Button variant="ghost" onClick={() => navigate("/county/transparency")}>
                View county impact <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
