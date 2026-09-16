            <AlertDialogTitle>Create this local request?</AlertDialogTitle>
            <AlertDialogDescription>
              This request stays in review until you choose to share it with local pros.
            </AlertDialogDescription>
          </AlertDialogHeader>

                  const res: any = await apiRequest(
                    "POST",
                    "/api/direct-connect/requests",
                    payload
                  );

                  // Verification gate returns HTTP 200 with actions + retry metadata.
                  if (res && typeof res === "object" && (res as any).verificationRequired) {
                    const msg: ScoutMessage = {

                          body: "Complete verification, then retry posting the request.",
                          primaryAction:
                            Array.isArray((res as any).actions) && (res as any).actions.length > 0

                  recordActivity({
                    type: "direct_connect_request_created",
                    ts: new Date().toISOString(),
                    path: location,
                    meta: { workRequestId: createdId },
                  } as any);
                  void import("@/lib/queryClient").then(({ queryClient }) => Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["/api/scout/work"] }),
