import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotaryStatePolicy } from "@shared/legalNotary";

type NotaryStateSummary = Pick<
  NotaryStatePolicy,
  "stateCode" | "stateName" | "status" | "remoteOnlineNotaryAllowed" | "serviceSummary"
>;

export default function RemoteNotaryPage() {
  const [stateCode, setStateCode] = useState("LA");

  const { data: states = [], isLoading: statesLoading } = useQuery<NotaryStateSummary[]>({
    queryKey: ["/api/legal/notary/states"],
    queryFn: () => apiRequest("GET", "/api/legal/notary/states"),
  });

  const {
    data: policy,
    isLoading: policyLoading,
    refetch,
  } = useQuery<NotaryStatePolicy>({
    queryKey: ["/api/legal/notary/states", stateCode],
    queryFn: () => apiRequest("GET", `/api/legal/notary/states/${stateCode}`),
  });

  const selectedState = useMemo(
    () => states.find((item) => item.stateCode === stateCode),
    [stateCode, states]
  );

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Remote Notary Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            State-based remote legal notary support. Louisiana is enabled first and additional
            states can be added in policy configuration.
          </p>

          <div className="flex flex-col gap-2 md:max-w-xs">
            <label htmlFor="stateCode" className="text-sm font-medium">
              State
            </label>
            <select
              id="stateCode"
              className="border rounded-md p-2 bg-background"
              value={stateCode}
              onChange={(event) => setStateCode(event.target.value)}
              disabled={statesLoading}
            >
              {states.map((state) => (
                <option key={state.stateCode} value={state.stateCode}>
                  {state.stateName} ({state.stateCode})
                </option>
              ))}
            </select>
          </div>

          {selectedState && (
            <div className="flex items-center gap-2">
              <Badge variant={selectedState.status === "live" ? "default" : "secondary"}>
                {selectedState.status.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">{selectedState.serviceSummary}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Policy Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {policyLoading || !policy ? (
            <p className="text-sm text-muted-foreground">Loading policy...</p>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="text-sm">
                  <span className="font-medium">State:</span> {policy.stateName}
                </div>
                <div className="text-sm">
                  <span className="font-medium">RON Allowed:</span>{" "}
                  {policy.remoteOnlineNotaryAllowed ? "Yes" : "No"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Last Reviewed:</span> {policy.lastReviewedOn}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Allowed Service Types</h3>
                <div className="flex flex-wrap gap-2">
                  {policy.allowedServiceTypes.map((service) => (
                    <Badge key={service} variant="outline">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Restricted Document Types</h3>
                <div className="flex flex-wrap gap-2">
                  {policy.restrictedDocumentTypes.map((docType) => (
                    <Badge key={docType} variant="secondary">
                      {docType}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-2">Compliance Notes</h3>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {policy.complianceNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">{policy.disclaimer}</p>
            </>
          )}

          <Button variant="outline" onClick={() => refetch()}>
            Refresh
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
