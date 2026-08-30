import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const registrar = read("server/routes/direct-connect/admin-rescue.ts");
const routes = read("server/routes/direct-connect.ts");
const detail = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");
const test = read("server/tests/direct-connect-admin-rescue.test.ts");

const failures = [];
const requireText = (source, value, label) => {
  if (!source.includes(value)) failures.push(`${label}: missing ${JSON.stringify(value)}`);
};
const forbidText = (source, value, label) => {
  if (source.includes(value)) failures.push(`${label}: forbidden ${JSON.stringify(value)}`);
};

requireText(routes, "registerDirectConnectAdminRescueRoute(app, {", "route registration");
requireText(registrar, '"/api/admin/direct-connect/requests/:id/rescue"', "staff endpoint");
requireText(registrar, "isAuthenticated,", "authentication gate");
requireText(registrar, "isStaff,", "staff gate");
requireText(registrar, "reason: z.string().trim().min(10).max(500)", "audited reason");
requireText(registrar, 'status !== "open" && status !== "routed"', "lifecycle gate");
requireText(registrar, 'contactGateState || "locked"', "contact gate read");
requireText(registrar, '["accepted", "completed"]', "selected-provider guard");
requireText(registrar, "expandReach: true", "bounded expansion");
requireText(registrar, "bypassVerificationGate: false", "verification gate");
requireText(registrar, 'action: "admin_direct_connect_routing_rescue"', "admin audit");
requireText(registrar, "contactGateUnchanged: true", "contact invariant response");
forbidText(registrar, "resolveDirectConnectVerificationBypass", "no bypass resolver");
forbidText(registrar, "setDispatchContactGateState", "no contact mutation");
forbidText(registrar, "targetProviderIds", "no arbitrary target");
requireText(detail, 'data-testid="admin-direct-connect-routing-rescue"', "staff UI");
requireText(detail, "Expand eligible routing", "staff action");
requireText(detail, "requester ownership", "authority copy");
requireText(test, "DIRECT_CONNECT_RESCUE_CONTACT_SEQUENCE_ACTIVE", "contact-state proof");
requireText(test, "DIRECT_CONNECT_RESCUE_PROVIDER_SELECTED", "selected-provider proof");

if (failures.length) {
  console.error("Direct Connect admin-rescue guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Direct Connect admin-rescue guard passed (20 bounded-authority checks).");
