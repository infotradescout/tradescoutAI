  const [dcBusy, setDcBusy] = useState(false);
  const dcCreateOperationRef = useRef<{
    fingerprint: string;
    operationId: string;
  } | null>(null);
  const [savedScoutThreads, setSavedScoutThreads] = useState<SavedScoutThread[]>([]);
  const [activeSavedThreadId, setActiveSavedThreadId] = useState<string | null>(null);

      <AlertDialog
        open={dcConfirmOpen}
        onOpenChange={(open) => {
          if (dcBusy) return;
          setDcConfirmOpen(open);
          if (!open) {
            setDcDraft(null);
            dcCreateOperationRef.current = null;
          }
        }}
      >
        <AlertDialogContent>
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
                if (!dcDraft || dcBusy) return;

                setDcBusy(true);
                try {
                  const payload: any = {
                    title: dcDraft.title,
                    description: dcDraft.description,
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
                  dcCreateOperationRef.current = { fingerprint, operationId };
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

                  const createdId =
                    typeof (res as any)?.id === "string" ? String((res as any).id) : null;
                  const msg: ScoutMessage = {
                    id: `a_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    role: "assistant",
                    content: "Saved. Want to review it before sharing?",
                    timestamp: new Date().toISOString(),
                    clusters: [
                      {
                        id: `dc-created-${Date.now()}`,
                        title: "Saved local request",
                        kind: "generic",
                        body: createdId
                          ? "Your request is saved. Review it before you share it locally."
                          : "Your request is saved. Review it before you share it locally.",
                        primaryAction: {
                          type: "NAVIGATE",
                          label: "Open local requests",
                          to: "/direct-connect",
                        },
                      },
                    ],
                  };

                  applyServerResponse(msg, [
                    { type: "NAVIGATE", label: "Open local requests", to: "/direct-connect" },
                  ]);

                  recordActivity({
                    type: "direct_connect_request_created",
                    ts: new Date().toISOString(),
                    path: location,
                    meta: { workRequestId: createdId || undefined },
                  } as any);
                  dcCreateOperationRef.current = null;
                  setDcConfirmOpen(false);
                  setDcDraft(null);
                } catch (err: any) {
                  const message = formatUserFacingErrorMessage(
                    err,
                    "Could not create the local request."
                  );
                  setError(message);
                } finally {
                  setDcBusy(false);
                }
              }}
            >
              {dcBusy ? "Saving..." : "Create request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
