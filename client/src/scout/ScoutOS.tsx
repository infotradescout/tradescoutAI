            <AlertDialogTitle>Create this local request?</AlertDialogTitle>
            <AlertDialogDescription>
              This posts your request to your county’s local request board. Scout will not
              automatically invite providers. Contact details stay gated.
            </AlertDialogDescription>
          </AlertDialogHeader>

                  const { submitScoutRequest } = await import("./scoutRequestCompletion");
                  const res: any = await submitScoutRequest(apiRequest, payload);

                  // The create API rejects prerequisites with HTTP 428. The
                  // adapter preserves guidance without treating it as a save.
                  if (res && typeof res === "object" && (res as any).verificationRequired) {
                    const msg: ScoutMessage = {

                          body: "Complete the required step, then return to your request.",
                          primaryAction:
                            Array.isArray((res as any).actions) && (res as any).actions.length > 0

                  if (!completion.replayed) {
                    recordActivity({
                      type: "direct_connect_request_created",
                      ts: new Date().toISOString(),
                      path: location,
                      meta: { workRequestId: createdId },
                    } as any);
                  }
                  void import("@/lib/queryClient").then(({ queryClient }) => Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["/api/scout/work"] }),
