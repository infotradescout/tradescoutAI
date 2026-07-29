/**
 * Fail-closed containment for Scout knowledge generated outside a reviewed,
 * provenance-preserving ingestion workflow.
 *
 * Keep these constants disabled until sanitation, source validation, approval,
 * and an auditable release mechanism exist. Environment variables are
 * intentionally not accepted as an override: production safety must not depend
 * on a deploy-time toggle that can silently re-enable unverified evidence.
 */
export const GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED = false;
export const AUTOMATIC_CHAT_CORPUS_WRITES_ENABLED = false;

export type ScoutCorpusContainmentStatus = {
  generatedCorpusRetrievalEnabled: false;
  automaticChatCorpusWritesEnabled: false;
  reason: "source_validation_and_sanitation_required";
};

export function getScoutCorpusContainmentStatus(): ScoutCorpusContainmentStatus {
  return {
    generatedCorpusRetrievalEnabled: GENERATED_SCOUT_CORPUS_RETRIEVAL_ENABLED,
    automaticChatCorpusWritesEnabled: AUTOMATIC_CHAT_CORPUS_WRITES_ENABLED,
    reason: "source_validation_and_sanitation_required",
  };
}
