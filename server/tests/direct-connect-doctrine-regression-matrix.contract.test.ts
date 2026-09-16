    const routes = read("server/routes/direct-connect.ts");
    expect(routes).toContain("homeownerContact: null");
    expect(routes).toContain(
      'canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved"'
    );
    const shareUtils = read("server/utils/workRequestShare.ts");
    expect(shareUtils).toContain("serializeDirectConnectCardContactGatePayload");
