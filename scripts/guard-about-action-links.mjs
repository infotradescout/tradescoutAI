import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const aboutPath = path.join(root, "client", "src", "pages", "about-explainer-content.tsx");
const routesPath = path.join(root, "client", "src", "AppRoutes.tsx");
const source = fs.readFileSync(aboutPath, "utf8");
const appRoutes = fs.readFileSync(routesPath, "utf8");
const start = source.indexOf("const featureGroups = [");
const end = source.indexOf("\n];", start);
if (start < 0 || end < 0) throw new Error("About featureGroups declaration is missing");
const featureSource = source.slice(start, end);
const actions = [...featureSource.matchAll(/^\s*action:\s*"[^"]+",\s*$/gm)];
const hrefs = [...featureSource.matchAll(/^\s*href:\s*routes\.[A-Za-z0-9_]+,\s*$/gm)];

if (actions.length !== 69 || hrefs.length !== 69) {
  throw new Error(`About action contract drifted: actions=${actions.length} hrefs=${hrefs.length}`);
}

const exactDestinations = {
  Maps: ["maps", "/maps"],
  Leaderboard: ["leaderboard", "/leaderboard"],
  "Messages and quotes": ["messages", "/messages"],
  "Conversation search": ["messages", "/messages"],
  Connections: ["connections", "/connections"],
  Notes: ["notes", "/notes"],
  CRM: ["crm", "/crm"],
};

for (const [name, [routeKey, pathname]] of Object.entries(exactDestinations)) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = new RegExp(`name:\\s*"${escapedName}"[\\s\\S]{0,420}?href:\\s*routes\\.${routeKey},`);
  if (!block.test(featureSource)) throw new Error(`${name} does not use routes.${routeKey}`);
  if (!appRoutes.includes(`<Route path="${pathname}">`)) {
    throw new Error(`${name} points to an unrouted destination: ${pathname}`);
  }
}

for (const token of [
  "data-about-promise-id={promiseId}",
  "data-about-action-link={promiseId}",
  "<a href={feature.href}",
]) {
  if (!source.includes(token)) throw new Error(`About action renderer is missing ${token}`);
}

console.log("[guard:about-action-links] PASS actions=69 linked=69 exactDestinations=7");
