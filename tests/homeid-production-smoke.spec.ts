import { test, expect } from "./fixtures/botArmy";

test.describe("HomeID manual browser production proof", () => {
  test.skip(
    !process.env.TEST_DATABASE_URL || process.env.RUN_HOMEID_PRODUCTION_SMOKE !== "1",
    "Set TEST_DATABASE_URL and RUN_HOMEID_PRODUCTION_SMOKE=1 to run HomeID browser production smoke"
  );

  test("proves HomeID -> Direct Connect -> HomeID enrichment -> Scout context flow", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const profileRes = await page.request.put("/api/user/profile", {
      data: {
        firstName: "HomeID",
        lastName: "Smoke",
        phone: "6025550100",
        stateCode: "AZ",
        countyFips: "04013",
      },
    });
    expect(profileRes.ok(), `profile update failed: ${profileRes.status()}`).toBeTruthy();

    const onboardingRes = await page.request.post("/api/user/complete-onboarding", { data: {} });
    expect(
      onboardingRes.ok() || onboardingRes.status() === 428,
      `onboarding failed unexpectedly: ${onboardingRes.status()}`
    ).toBeTruthy();

    const createdAt = new Date().toISOString();
    const createHomeIdRes = await page.request.post("/api/homeid/create", {
      data: {
        homeType: "single_family",
        creatorRole: "homeowner",
        nickname: `Slice24 ${Date.now()}`,
        address1: "101 Smoke Loop",
        city: "Phoenix",
        stateCode: "AZ",
        countyFips: "04013",
        zipCode: "85001",
        yearBuilt: 2006,
      },
    });
    expect(createHomeIdRes.ok(), `homeid create failed: ${createHomeIdRes.status()}`).toBeTruthy();
    const createHomeIdJson = (await createHomeIdRes.json()) as any;
    const homeId = String(createHomeIdJson?.home?.id || "");
    expect(homeId.length).toBeGreaterThan(0);

    const propertyDetailId = `detail_${Date.now()}`;
    const upsertPropertyRes = await page.request.put(
      `/api/homeid/${encodeURIComponent(homeId)}/property-details`,
      {
        data: {
          propertyDetails: [
            {
              id: propertyDetailId,
              category: "hvac",
              note: "HVAC serviced in March 2026",
              status: "known",
              createdAt,
              savedAt: createdAt,
            },
          ],
        },
      }
    );
    expect(
      upsertPropertyRes.ok(),
      `property details save failed: ${upsertPropertyRes.status()}`
    ).toBeTruthy();

    const componentId = `component_${Date.now()}`;
    const upsertComponentsRes = await page.request.put(
      `/api/homeid/${encodeURIComponent(homeId)}/components`,
      {
        data: {
          components: [
            {
              id: componentId,
              homeId,
              type: "hvac",
              label: "Main HVAC",
              status: "known",
              source: "user_added",
              linkedDirectConnectRequestIds: [],
              linkedHomePacketIds: [],
              createdAt,
              updatedAt: createdAt,
            },
          ],
        },
      }
    );
    expect(
      upsertComponentsRes.ok(),
      `components save failed: ${upsertComponentsRes.status()}`
    ).toBeTruthy();

    const evidenceId = `evidence_${Date.now()}`;
    const upsertEvidenceRes = await page.request.put(
      `/api/homeid/${encodeURIComponent(homeId)}/evidence`,
      {
        data: {
          evidence: [
            {
              id: evidenceId,
              homeId,
              componentId,
              evidenceType: "document",
              title: "HVAC service note",
              description: "Manual metadata proof for smoke flow",
              source: "user_uploaded",
              status: "pending",
              createdAt,
              updatedAt: createdAt,
            },
          ],
        },
      }
    );
    expect(
      upsertEvidenceRes.ok(),
      `evidence save failed: ${upsertEvidenceRes.status()}`
    ).toBeTruthy();

    const packetId = `packet_${Date.now()}`;
    const upsertPacketsRes = await page.request.put(
      `/api/homeid/${encodeURIComponent(homeId)}/request-packets`,
      {
        data: {
          requestPackets: [
            {
              id: packetId,
              requestType: "inspection",
              selectedDetailIds: [propertyDetailId],
              missingHelpfulInfo: [],
              missingHelpfulInfoCount: 0,
              status: "ready_for_handoff",
              createdAt,
              savedAt: createdAt,
            },
          ],
        },
      }
    );
    expect(
      upsertPacketsRes.ok(),
      `request packet save failed: ${upsertPacketsRes.status()}`
    ).toBeTruthy();

    const handoffPreviewRes = await page.request.post(
      `/api/homes/${encodeURIComponent(homeId)}/homeid/request-packet`,
      {
        data: {
          requestType: "inspection",
          selectedFields: ["hvac"],
        },
      }
    );
    expect(
      handoffPreviewRes.ok(),
      `handoff preview packet failed: ${handoffPreviewRes.status()}`
    ).toBeTruthy();

    const createDraftRes = await page.request.post("/api/direct-connect/requests", {
      data: {
        title: "inspection request for single_family",
        description: "Prepared from HomeID handoff preview.",
        category: "inspection",
        autoRoute: false,
        homeId,
        assetComponentType: "hvac",
        assetLabel: "hvac",
        homeContextIntent: "update_from_request",
        homePacketId: packetId,
        homePacketSelectedDetailIds: [propertyDetailId],
        homePacketReadinessState: "ready_for_handoff",
      },
    });
    expect(createDraftRes.ok(), `draft create failed: ${createDraftRes.status()}`).toBeTruthy();
    const createDraftJson = (await createDraftRes.json()) as any;
    const requestId = String(createDraftJson?.id || "");
    expect(requestId.length).toBeGreaterThan(0);

    const submitDraftRes = await page.request.post(
      `/api/direct-connect/requests/${encodeURIComponent(requestId)}/submit-homeid-draft`,
      {
        data: {
          homeId,
          homePacketId: packetId,
          selectedDetailIds: [propertyDetailId],
        },
      }
    );
    expect(submitDraftRes.ok(), `draft submit failed: ${submitDraftRes.status()}`).toBeTruthy();

    const requestDetailRes = await page.request.get(
      `/api/direct-connect/requests/${encodeURIComponent(requestId)}`
    );
    expect(
      requestDetailRes.ok(),
      `request detail failed: ${requestDetailRes.status()}`
    ).toBeTruthy();
    const requestDetailJson = (await requestDetailRes.json()) as any;
    const requestStatus = String(requestDetailJson?.status || "")
      .trim()
      .toLowerCase();
    const canComplete = requestStatus === "in_progress" || requestStatus === "pending_outcome";

    if (canComplete) {
      const completeRes = await page.request.post(
        `/api/direct-connect/requests/${encodeURIComponent(requestId)}/complete`,
        {
          data: {},
        }
      );
      expect(completeRes.ok(), `request complete failed: ${completeRes.status()}`).toBeTruthy();
    }

    const dashboardRes = await page.request.get(
      `/api/homes/${encodeURIComponent(homeId)}/homeid-dashboard?persona=homeowner`
    );
    expect(dashboardRes.ok(), `dashboard read failed: ${dashboardRes.status()}`).toBeTruthy();
    const dashboardJson = (await dashboardRes.json()) as any;
    const eventTitles = Array.isArray(dashboardJson?.overview?.recentEvents)
      ? dashboardJson.overview.recentEvents.map((row: any) => String(row?.title || ""))
      : [];
    expect(
      eventTitles.some((title: string) => title.includes("homeid:direct_connect_request_submitted"))
    ).toBeTruthy();
    if (canComplete) {
      expect(
        eventTitles.some((title: string) => title.includes("homeid:completed_work_enrichment"))
      ).toBeTruthy();
    }

    await page.goto("/scout");
    await expect(page).toHaveURL(/\/scout/i);
  });
});
