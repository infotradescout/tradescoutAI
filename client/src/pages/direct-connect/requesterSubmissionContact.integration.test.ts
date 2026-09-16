// implementation. The sandbox contains only one synthetic requester-card row.
function shellContactActions(request: Record<string, unknown>) {
  const source = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
  const marker = 'const contactGateState = normalizeDirectConnectContactState(r.contactGateState);';
  const start = source.indexOf(marker);
  const end = source.indexOf("const contactPanelState =", start);
  expect(start).toBeGreaterThan(-1);
  const result = runInNewContext(
    source.slice(start, end) +
      "JSON.stringify({canApproveContact, canDenyContact, canReleaseContact});",
    { r: Object.freeze({ ...request }), normalizeDirectConnectContactState },
    { timeout: 1000 }
  );
  return JSON.parse(result as string);
