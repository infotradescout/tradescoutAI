          })),
          timeline: timelineItems,
          allowedRequesterActions: {
            canApproveContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canDenyContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved",
          },
          // Backward compatibility for older clients/tests.
          allowedHomeownerActions: {
            canApproveContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canDenyContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved",
          },
        });
      } catch (error) {
          dispatchOwner?.user_id || requestRow.createdByUserId || ""
        ).trim();
        const authOwnerMatch = ownerUserId.length > 0 && ownerUserId === userId;
        if (!authOwnerMatch) {
          return res
            .status(403)
            .json({ message: "Only the request owner can update contact approval" });
          ((dispatchRowResult.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );

        const allowedTransitions = new Set([
          "contractor_requested->user_approved",
          "user_approved->released",
          "contractor_requested->denied",
        ]);
        const transitionKey = `${currentState}->${nextState}`;
        if (currentState !== nextState && !allowedTransitions.has(transitionKey)) {
          return res.status(409).json({
        }

        await setDispatchContactGateState({ requestId, nextState });
        if (nextState === "released" && ownerUserId) {
          const candidateRows = await db.execute(sql`
            SELECT contractor_id, business_id, responder_user_id
            FROM direct_connect_dispatch_candidates
            WHERE request_id = ${requestId}
              AND eligibility_state = 'eligible'
            ORDER BY created_at ASC
            LIMIT 1
          `);
          const candidate = ((candidateRows.rows || []) as any[])[0] || null;
          const responseRows = await db.execute(sql`
            SELECT id
            FROM direct_connect_contractor_responses
            WHERE request_id = ${requestId}
            ORDER BY created_at DESC
            LIMIT 1
          `);
          const latestResponse = ((responseRows.rows || []) as any[])[0] || null;
          const dispatchRows = await db.execute(sql`
            SELECT category, county, city_area
            FROM direct_connect_dispatch_requests
            WHERE id = ${requestId}
            LIMIT 1
          `);
          const dispatch = ((dispatchRows.rows || []) as any[])[0] || null;
          const workspace = await createOrGetJobWorkspaceAtContactRelease({
            requestId,
            requesterUserId: ownerUserId,
            businessId: candidate?.business_id ? String(candidate.business_id) : null,
            contractorId: candidate?.contractor_id ? String(candidate.contractor_id) : null,
            contractorResponseId: latestResponse?.id ? String(latestResponse.id) : null,
            category: dispatch?.category ? String(dispatch.category) : null,
            county: dispatch?.county ? String(dispatch.county) : null,
            cityArea: dispatch?.city_area ? String(dispatch.city_area) : null,
          });
          if (workspace?.id) {
            await appendDispatchEvent({
              requestId,
              actorType: "system",
              actorId: null,
              eventType: "job_workspace_created",
              metadata: { workspaceId: String(workspace.id), source: "contact_released" },
            });
          }
        }
        const eventType =
          nextState === "user_approved"
            ? "contact_approved"
            : nextState === "denied"
              ? "contact_denied"
              : nextState === "released"
                ? "contact_released"
                : nextState === "contractor_requested"
                  ? "contact_requested"
                  : "request_shared";
        await appendDispatchEvent({
          requestId,
          actorType: "requester",
