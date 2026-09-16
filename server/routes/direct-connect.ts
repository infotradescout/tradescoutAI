          })),
          timeline: timelineItems,
          allowedRequesterActions: {
            canApproveContact: false,
            canDenyContact: false,
            canReleaseContact: false,
          },
          // Backward compatibility for older clients/tests.
          allowedHomeownerActions: {
            canApproveContact: false,
            canDenyContact: false,
            canReleaseContact: false,
          },
        });
      } catch (error) {
          dispatchOwner?.user_id || requestRow.createdByUserId || ""
        ).trim();
        const authOwnerMatch = ownerUserId.length > 0 && ownerUserId === userId;
        if (!authOwnerMatch || String(requestRow.createdByUserId || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can update contact approval" });
          ((dispatchRowResult.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );

        // Compatibility for older clients: submission already authorizes
        // request-related contact. A stale approval/release call must not grant
        // permission, create a workspace, expose contact, or send notifications.
        if (nextState === "user_approved" || nextState === "released") {
          if (requestRow.source !== "direct_connect") {
            return res.status(400).json({ code: "DIRECT_CONNECT_REQUEST_REQUIRED",
              message: "This action only applies to Direct Connect requests." });
          }
          const requestStatus = String(requestRow.status || "").toLowerCase();
          const display = serializeDirectConnectCardContactGatePayload({ contactGateState: currentState });
          if (!["open", "routed", "in_progress", "pending_outcome", "completed"].includes(requestStatus) ||
              !["request_submission", "released", "contact_released"].includes(display.contactGateState)) {
            return res.status(409).json({ code: "REQUEST_CONTACT_UNAVAILABLE",
              message: "This request is not available for new contact. Existing restrictions remain in place." });
          }
          res.setHeader("Cache-Control", "private, no-store");
          return res.status(200).json({ requestId,
            contactGateState: display.contactGateState,
            contactApprovalRequired: false,
            code: "CONTACT_APPROVAL_NOT_REQUIRED",
            message: "Sending this request already gives its receiving providers permission to contact you about the work." });
        }

        const allowedTransitions = new Set(["contractor_requested->denied"]);
        const transitionKey = `${currentState}->${nextState}`;
        if (currentState !== nextState && !allowedTransitions.has(transitionKey)) {
          return res.status(409).json({
        }

        await setDispatchContactGateState({ requestId, nextState });
        const eventType =
          nextState === "denied"
            ? "contact_denied"
            : nextState === "contractor_requested"
              ? "contact_requested"
              : "request_shared";
        await appendDispatchEvent({
          requestId,
          actorType: "requester",
