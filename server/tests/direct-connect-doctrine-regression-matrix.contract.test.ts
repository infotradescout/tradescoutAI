    const routes = read("server/routes/direct-connect.ts");
    expect(routes).toContain("homeownerContact: null");
    expect(routes).toContain(
      'canReleaseContact: false'
    );
    const shareUtils = read("server/utils/workRequestShare.ts");
    expect(shareUtils).toContain("serializeDirectConnectCardContactGatePayload");
