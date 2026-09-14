import { z } from "zod";
import {
  recommendationSubmissionSchema,
  type RecommendationSubmission,
} from "@shared/recommendationSubmission";

const draftSchema = z.object({
  version: z.literal(1),
  contractorId: z.string().min(1).max(200),
  ownerUserId: z.string().nullable(),
  savedAt: z.number().finite(),
  readyToSubmit: z.boolean(),
  data: recommendationSubmissionSchema.extend({ comment: z.string().max(4000) }),
});
export type RecommendationDraft = z.infer<typeof draftSchema>;
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const HANDOFF_KEY = "tradescout:recommendation-auth-handoff:v1";
export function browserRecommendationHandoffStorage(): DraftStorage {
  try {
    return window.sessionStorage;
  } catch {
    return {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("Browser storage unavailable");
      },
    };
  }
}
export function beginRecommendationHandoff(
  storage: DraftStorage,
  contractorId: string,
  submissionId: string,
  returnPath: string,
  now = Date.now()
): boolean {
  try {
    storage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ contractorId, submissionId, returnPath, startedAt: now })
    );
    return true;
  } catch {
    return false;
  }
}
export function hasRecommendationHandoff(
  storage: DraftStorage,
  contractorId: string,
  submissionId: string,
  returnPath: string,
  now = Date.now()
): boolean {
  try {
    const value = JSON.parse(storage.getItem(HANDOFF_KEY) || "null");
    return (
      value?.contractorId === contractorId &&
      value?.submissionId === submissionId &&
      value?.returnPath === returnPath &&
      typeof value.startedAt === "number" &&
      value.startedAt <= now &&
      now - value.startedAt < 30 * 60 * 1000
    );
  } catch {
    return false;
  }
}
export function clearRecommendationHandoff(storage: DraftStorage): void {
  try {
    storage.removeItem(HANDOFF_KEY);
  } catch {
    /* One-use handoff expires independently. */
  }
}
export function browserRecommendationDraftStorage(): DraftStorage {
  try {
    return window.localStorage;
  } catch {
    return {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("Browser storage unavailable");
      },
    };
  }
}
function draftKey(contractorId: string, ownerUserId: string | null): string {
  return `tradescout:recommendation-draft:v1:${encodeURIComponent(contractorId)}:${encodeURIComponent(ownerUserId ?? "guest")}`;
}
export function readRecommendationDraft(
  storage: DraftStorage,
  contractorId: string,
  ownerUserId: string | null,
  now = Date.now()
): RecommendationDraft | null {
  try {
    const key = draftKey(contractorId, ownerUserId);
    const parsed = draftSchema.safeParse(JSON.parse(storage.getItem(key) || "null"));
    if (!parsed.success) return null;
    const draft = parsed.data;
    if (
      draft.contractorId !== contractorId ||
      draft.ownerUserId !== ownerUserId ||
      draft.savedAt > now + 60_000 ||
      now - draft.savedAt > 7 * 24 * 60 * 60 * 1000
    ) {
      storage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}
export function saveRecommendationDraft(
  storage: DraftStorage,
  draft: RecommendationDraft
): boolean {
  try {
    const parsed = draftSchema.parse(draft);
    storage.setItem(draftKey(parsed.contractorId, parsed.ownerUserId), JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}
export function clearRecommendationDraft(
  storage: DraftStorage,
  contractorId: string,
  ownerUserId: string | null
): void {
  try {
    storage.removeItem(draftKey(contractorId, ownerUserId));
  } catch {
    /* Server receipt is authoritative. */
  }
}
export function emptyRecommendation(): RecommendationSubmission {
  return { submissionId: crypto.randomUUID(), recommendationType: "positive", comment: "" };
}
