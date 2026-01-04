export type RecentActivityEventType =
  | "ask_scout"
  | "navigate"
  | "click_sponsored"
  | "intro_shown"
  | "intro_dismissed"
  | "open_note"
  // County-gated surfaces & location telemetry
  | "county_gate_hit"
  | "county_gate_rehit_after_explained"
  | "county_gated_query_success"
  | "county_explained_followup_action"
  | "county_explained_shown"
  | "scout_confusion_location"
  | "settings_location_saved"
  // Decision Card (canonical pre-action contract)
  | "decision_card_shown"
  | "decision_card_choice"
  | "decision_card_override"
  // Community & County
  | "community.county_default"
  | "community.scope_override"
  | "dc.county_default_applied"
  | "dc.county_override"
  // Onboarding
  | "onboarding_skip"
  | "onboarding_answer";

export interface RecentActivityEvent {
  type: RecentActivityEventType;
  ts: string; // ISO
  path?: string;
  to?: string;
  label?: string;
  meta?: Record<string, unknown>;
}

const ACTIVITY_KEY = "ts:activity:recent:v1";
const MAX_EVENTS = 20;

export function getRecentActivity(): RecentActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentActivityEvent[]) : [];
  } catch {
    return [];
  }
}

export function recordActivity(event: RecentActivityEvent) {
  if (typeof window === "undefined") return;
  const next = [...getRecentActivity(), event].slice(-MAX_EVENTS);
  try {
    window.sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

/* --------------------------- Sponsored frequency -------------------------- */

const SEEN_ADS_KEY = "ts:scout:ads:seen:v1";
const MAX_ADS_PER_SESSION = 2;

const FIRST_ANSWER_SEEN_KEY = "ts:scout:firstAnswerSeen:v1";

export function getSeenAdIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SEEN_ADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((v) => String(v)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

export function canShowAnotherSponsored(): boolean {
  return getSeenAdIds().length < MAX_ADS_PER_SESSION;
}

export function markAdSeen(adId: string) {
  if (!adId || typeof window === "undefined") return;
  const seen = getSeenAdIds();
  if (seen.includes(adId)) return;
  const next = [...seen, adId].slice(-MAX_ADS_PER_SESSION);
  try {
    window.sessionStorage.setItem(SEEN_ADS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function hasSeenFirstAnswer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FIRST_ANSWER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markFirstAnswerSeen() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(FIRST_ANSWER_SEEN_KEY, "1");
  } catch {
    // ignore
  }
}
