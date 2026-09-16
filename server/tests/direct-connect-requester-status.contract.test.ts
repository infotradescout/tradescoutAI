    expect(shareBlock).not.toContain("homeownerContact");
  });

  it("keeps contact release behind requester approval transitions", () => {
    const source = read("server/routes/direct-connect.ts");
    expect(source).toContain("contractor_requested->user_approved");
    expect(source).toContain("user_approved->released");
    expect(source).toContain("contractor_requested->denied");
    expect(source).toContain("CONTACT_RELEASE_REQUIRES_APPROVAL");
    expect(source).toContain("Invalid contact gate transition");
    expect(source).toContain("requester_viewed_response");
    expect(source).toContain("homeowner_viewed_request");
    expect(source).toContain("homeowner_viewed_response");
    expect(source).toContain("contact_approved");
    expect(source).toContain("contact_denied");
    expect(source).toContain("contact_released");
    expect(source).toContain("request_closed");
