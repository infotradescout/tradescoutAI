        updatedFields: [
          ...Object.keys(profilePatch),
          ...Object.keys(preferencesPatch).map((key) => `preferences.${key}`),
        ],
        userId: user.id,
      };
    });

    if (result.ok) {
      if (actionTelemetry) {
        try {
          const { getScoutExecutionTelemetry } = await import("../scout/scoutExecutionTelemetry");
          const executionEvent = getScoutExecutionTelemetry(result.data);
          if (executionEvent) {
            await storage.logEvent(executionEvent.eventName, {
              userId: userId || null,
              requestId: (req as any).requestId || null,
              ownerModule: actionTelemetry.ownerModule,
              target: actionTelemetry.target,
              confidenceBand: actionTelemetry.confidenceBand,
              payloadCompleteness: actionTelemetry.payloadCompleteness,
              actionType: String(action?.type || "unknown"),
              ...(executionEvent.executionId ? { executionId: executionEvent.executionId } : {}),
            });
          }
        } catch (telemetryErr) {
          console.error("[Scout] failed to log outcome submission telemetry", telemetryErr);
        }
      }
      return res.json({
        success: true,
        authorized: true,
        executed: true,
        message: result.message || "Action completed",
        data: result.data,
        nextAction: (result as any).nextAction,
      });
    }

    // Action failed—return recovery guidance
    return res.status(400).json({
      success: false,
      message: result.error.userMessage,
      errorType: result.error.type,
      suggestedAction: result.error.suggestedAction,
      context: result.error.context,
    });
  } catch (err) {
