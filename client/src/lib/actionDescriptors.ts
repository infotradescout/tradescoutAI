import { FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT } from "@shared/governanceFlags";

export type ActionDescriptor = {
  actionId: string;
  whatItDoes: string; // One line
  then: string; // One line of "then" effect
};

const registry = new Map<string, ActionDescriptor>();
let suppressionLogged = false;

export function registerActionDescriptor(descriptor: ActionDescriptor) {
  registry.set(descriptor.actionId, {
    actionId: descriptor.actionId,
    whatItDoes: descriptor.whatItDoes.trim(),
    then: descriptor.then.trim(),
  });
}

export function getActionDescriptor(actionId: string): ActionDescriptor | undefined {
  return registry.get(actionId);
}

export function ensureDescriptor(actionId: string) {
  if (!FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT) return;
  if (process.env.NODE_ENV === "production") return;
  if (!registry.has(actionId)) {
    throw new Error(`Missing ActionDescriptor for ${actionId}`);
  }
}

export function listActionDescriptors(): ActionDescriptor[] {
  return Array.from(registry.values());
}

export function clearActionDescriptorsForTests() {
  registry.clear();
  suppressionLogged = false;
}

export function noteSuppressedExecution(actionId: string) {
  if (suppressionLogged) return;
  if (!FEATURE_ACTION_DESCRIPTOR_ENFORCEMENT) return;
  if (process.env.NODE_ENV === "production") return;
  console.warn(`Hold-to-explain suppressed click for ${actionId}`);
  suppressionLogged = true;
}
