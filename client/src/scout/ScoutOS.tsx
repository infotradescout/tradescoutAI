          <AlertDialogHeader>
            <AlertDialogTitle>Create this local request?</AlertDialogTitle>
            <AlertDialogDescription>
              This request stays in review until you choose to share it with local pros.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-3 rounded-md border p-3 text-sm">
            <div className="font-medium">{dcDraft?.title || "New request"}</div>
            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
              {dcDraft?.description ? String(dcDraft.description).slice(0, 600) : ""}
              {dcDraft?.description && String(dcDraft.description).length > 600 ? "..." : ""}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={dcBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={dcBusy || !dcDraft}
              onClick={async (e) => {
                e.preventDefault();
                if (!dcDraft || dcBusy || dcCreateOperationRef.current?.pending) return;

                setDcBusy(true);
                try {
                  const payload: any = {
                    title: dcDraft.title,
                    description: dcDraft.description,
                    autoRoute: false,
                    ...(dcDraft.tradeId ? { tradeId: dcDraft.tradeId } : {}),
                    ...(typeof dcDraft.budgetMin === "number"
                      ? { budgetMin: dcDraft.budgetMin }
                      : {}),
                    ...(typeof dcDraft.budgetMax === "number"
                      ? { budgetMax: dcDraft.budgetMax }
                      : {}),
                    ...(dcDraft.countyFips ? { countyFips: dcDraft.countyFips } : {}),
                    ...(dcDraft.stateCode ? { stateCode: dcDraft.stateCode } : {}),
                  };
                  const fingerprint = JSON.stringify(payload);
                  const operationId =
                    dcCreateOperationRef.current?.fingerprint === fingerprint
                      ? dcCreateOperationRef.current.operationId
                      : createClientOperationId("dc-scout");
                  // Claim synchronously; React's busy state alone cannot exclude
                  // a second click before the next render.
                  dcCreateOperationRef.current = { fingerprint, operationId, pending: true };
                  payload.operationId = operationId;

                  const res: any = await apiRequest(
                    "POST",
                    "/api/direct-connect/requests",
                    payload
                  );

                  // Verification gate returns HTTP 200 with actions + retry metadata.
                  if (res && typeof res === "object" && (res as any).verificationRequired) {
                    const msg: ScoutMessage = {
                      id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      role: "assistant",
                      content:
                        typeof (res as any).message === "string" && (res as any).message.trim()
                          ? String((res as any).message)
                          : "Before I can post that request, you need to verify a requirement.",
                      timestamp: new Date().toISOString(),
                      clusters: [
                        {
                          id: `dc-verify-${Date.now()}`,
                          title: "Next step",
                          kind: "generic",
                          body: "Complete verification, then retry posting the request.",
                          primaryAction:
                            Array.isArray((res as any).actions) && (res as any).actions.length > 0
                              ? ((res as any).actions[0] as any)
                              : {
                                  type: "NAVIGATE",
                                  label: "Open verification",
                                  to: "/verification",
                                },
                        } as any,
                      ],
                    };

                    applyServerResponse(
                      msg,
                      Array.isArray((res as any).actions) ? (res as any).actions : []
                    );
                    setDcConfirmOpen(false);
                    return;
                  }

                  const { resolveScoutRequestCompletion } = await import("./scoutRequestCompletion");
                  const completion = resolveScoutRequestCompletion(res, dcDraft.countyFips);
                  const createdId = completion.requestId;
                  const msg: ScoutMessage = {
                    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    role: "assistant",
                    content: completion.acknowledgement,
                    timestamp: new Date().toISOString(),
                    clusters: [
                      {
                        id: `dc-created-${Date.now()}`,
                        title: "Saved local request",
                        kind: "generic",
                        body: completion.summary,
                        primaryAction: {
                          type: "NAVIGATE",
                          label: "Open saved request",
                          to: completion.to,
                        },
                      },
                    ],
                  };

                  applyServerResponse(msg, [
                    { type: "NAVIGATE", label: "Open saved request", to: completion.to },
                  ]);

                  recordActivity({
                    type: "direct_connect_request_created",
                    ts: new Date().toISOString(),
                    path: location,
                    meta: { workRequestId: createdId },
                  } as any);
                  void import("@/lib/queryClient").then(({ queryClient }) => Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["/api/scout/work"] }),
                    queryClient.invalidateQueries({ queryKey: ["/api/direct-connect/requests"] }),
                  ])).catch(() => undefined);
                  dcCreateOperationRef.current = null;
                  setDcConfirmOpen(false);
                  setDcDraft(null);
                } catch (err: any) {
                  const message = formatUserFacingErrorMessage(
                    err,
                    "Scout could not confirm this action. Check its current status before trying again."
                  );
                  setError(message);
                } finally {
                  if (dcCreateOperationRef.current) dcCreateOperationRef.current.pending = false;
                  setDcBusy(false);
                }
              }}
            >
              {dcBusy ? "Saving..." : "Create request"}
            </AlertDialogAction>
          </AlertDialogFooter>
