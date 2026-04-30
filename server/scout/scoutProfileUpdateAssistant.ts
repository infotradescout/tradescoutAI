import type { ScoutActionContract, ScoutResponseContract } from "../../shared/types/scout";

type ProfilePatch = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  county?: string;
  countyName?: string;
};

type PreferencesPatch = {
  bio?: string;
  servicesDescription?: string;
};

export interface ScoutProfileUpdateDraft {
  profilePatch: ProfilePatch;
  preferencesPatch: PreferencesPatch;
  labels: string[];
}

const PROFILE_UPDATE_PATTERN =
  /\b(update|change|edit|set|add|save)\b[\s\S]{0,40}\b(profile|account|bio|name|phone|location|city|county|services?)\b|\b(profile|account|bio|name|phone|location|city|county|services?)\b[\s\S]{0,40}\b(update|change|edit|set|add|save)\b/i;

function cleanText(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function addLabel(labels: string[], label: string) {
  if (!labels.includes(label)) labels.push(label);
}

function parseName(message: string, draft: ScoutProfileUpdateDraft) {
  const match = message.match(
    /\b(?:my name is|set my name to|change my name to|call me)\s+([A-Za-z][A-Za-z .'-]{1,80})/i
  );
  if (!match) return;

  const cleaned = cleanText(match[1], 80).replace(/\b(on|in|for)\s+my\s+profile\b.*$/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return;

  draft.profilePatch.firstName = titleCase(parts[0]);
  if (parts.length > 1) draft.profilePatch.lastName = titleCase(parts.slice(1).join(" "));
  addLabel(draft.labels, "name");
}

function parsePhone(message: string, draft: ScoutProfileUpdateDraft) {
  const match = message.match(
    /\b(?:phone|phone number|number|call me at)\s*(?:is|to|:)?\s*(\+?[\d() .-]{7,24})/i
  );
  if (!match) return;

  const phone = cleanText(match[1], 24);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return;

  draft.profilePatch.phone = phone;
  addLabel(draft.labels, "phone");
}

function parseLocation(message: string, draft: ScoutProfileUpdateDraft) {
  const locationMatch = message.match(
    /\b(?:i live in|i am in|i'm in|set my location to|my city is|city is)\s+([A-Za-z .'-]{2,60})(?:,\s*([A-Za-z]{2}|[A-Za-z .'-]{3,40}))?/i
  );
  if (locationMatch) {
    draft.profilePatch.city = titleCase(cleanText(locationMatch[1], 60));
    if (locationMatch[2]) {
      const state = cleanText(locationMatch[2], 40);
      draft.profilePatch.state = state.length === 2 ? state.toUpperCase() : titleCase(state);
      if (/^[A-Za-z]{2}$/.test(state)) draft.profilePatch.stateCode = state.toUpperCase();
    }
    addLabel(draft.labels, "location");
  }

  const countyMatch = message.match(/\b(?:county is|in|for)\s+([A-Za-z .'-]{2,60})\s+county\b/i);
  if (countyMatch) {
    const countyName = `${titleCase(cleanText(countyMatch[1], 60))} County`;
    draft.profilePatch.county = countyName;
    draft.profilePatch.countyName = countyName;
    addLabel(draft.labels, "county");
  }
}

function parseBio(message: string, draft: ScoutProfileUpdateDraft) {
  const match = message.match(
    /\b(?:bio|about me|profile bio)\s*(?:to|is|:)\s*["“]?([^"”\n]{8,500})/i
  );
  if (!match) return;

  draft.preferencesPatch.bio = cleanText(match[1], 500);
  addLabel(draft.labels, "bio");
}

function parseServices(message: string, draft: ScoutProfileUpdateDraft) {
  const match = message.match(
    /\b(?:i offer|my services are|services include|add services?)\s+([^.\n]{3,500})/i
  );
  if (!match) return;

  draft.preferencesPatch.servicesDescription = cleanText(match[1], 500);
  addLabel(draft.labels, "services");
}

export function inferScoutProfileUpdateDraft(message: string): ScoutProfileUpdateDraft | null {
  const raw = String(message || "").trim();
  if (!raw || !PROFILE_UPDATE_PATTERN.test(raw)) return null;

  const draft: ScoutProfileUpdateDraft = {
    profilePatch: {},
    preferencesPatch: {},
    labels: [],
  };

  parseName(raw, draft);
  parsePhone(raw, draft);
  parseLocation(raw, draft);
  parseBio(raw, draft);
  parseServices(raw, draft);

  if (
    Object.keys(draft.profilePatch).length === 0 &&
    Object.keys(draft.preferencesPatch).length === 0
  ) {
    return draft;
  }

  return draft;
}

export function buildScoutProfileUpdateResponse(
  draft: ScoutProfileUpdateDraft
): ScoutResponseContract & { actions: ScoutActionContract[]; metadata: Record<string, unknown> } {
  const hasPatch =
    Object.keys(draft.profilePatch).length > 0 || Object.keys(draft.preferencesPatch).length > 0;

  if (!hasPatch) {
    return {
      message:
        "I can help update your profile. Tell me the exact field and value, or open profile settings.",
      suggestedActions: ["Open profile settings", "Tell Scout what to update"],
      actions: [
        {
          type: "NAVIGATE",
          label: "Open profile settings",
          to: "/profile-settings",
          path: "/profile-settings",
          primary: true,
        },
      ],
      metadata: {
        intent: "profile_update",
        sourceUsed: "decision_pipeline_profile_update",
        fallbackUsed: false,
        confidenceBand: "medium",
      },
    };
  }

  const fields = draft.labels.join(", ");
  return {
    message: `I drafted a profile update for ${fields}. Review it, then save it if it looks right.`,
    suggestedActions: ["Save profile update", "Open profile settings", "Change the draft"],
    actions: [
      {
        type: "SAVE_PROFILE",
        label: "Save profile update",
        primary: true,
        payload: {
          profilePatch: draft.profilePatch,
          preferencesPatch: draft.preferencesPatch,
          source: "scout",
        },
      },
      {
        type: "NAVIGATE",
        label: "Open profile settings",
        to: "/profile-settings",
        path: "/profile-settings",
      },
    ],
    metadata: {
      intent: "profile_update",
      sourceUsed: "decision_pipeline_profile_update",
      fallbackUsed: false,
      confidenceBand: "high",
      profileUpdateFields: draft.labels,
    },
  };
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = cleanText(value, maxLength);
  return cleaned ? cleaned : undefined;
}

export function sanitizeScoutProfileUpdatePayload(payload: unknown): {
  profilePatch: ProfilePatch;
  preferencesPatch: PreferencesPatch;
} {
  const source = safeRecord(payload);
  const rawProfile = safeRecord(source.profilePatch);
  const rawPreferences = safeRecord(source.preferencesPatch);

  const profilePatch: ProfilePatch = {};
  const preferencesPatch: PreferencesPatch = {};

  const firstName = safeString(rawProfile.firstName, 80);
  const lastName = safeString(rawProfile.lastName, 80);
  const phone = safeString(rawProfile.phone, 32);
  const city = safeString(rawProfile.city, 80);
  const state = safeString(rawProfile.state, 80);
  const stateCode = safeString(rawProfile.stateCode, 2);
  const county = safeString(rawProfile.county, 100);
  const countyName = safeString(rawProfile.countyName, 100);

  if (firstName) profilePatch.firstName = firstName;
  if (lastName) profilePatch.lastName = lastName;
  if (phone && phone.replace(/\D/g, "").length >= 7) profilePatch.phone = phone;
  if (city) profilePatch.city = city;
  if (state) profilePatch.state = state;
  if (stateCode && /^[A-Za-z]{2}$/.test(stateCode))
    profilePatch.stateCode = stateCode.toUpperCase();
  if (county) profilePatch.county = county;
  if (countyName) profilePatch.countyName = countyName;

  const bio = safeString(rawPreferences.bio, 500);
  const servicesDescription = safeString(rawPreferences.servicesDescription, 500);
  if (bio) preferencesPatch.bio = bio;
  if (servicesDescription) preferencesPatch.servicesDescription = servicesDescription;

  return { profilePatch, preferencesPatch };
}
