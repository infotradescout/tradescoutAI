const FAILURE_VALUE = /^(?:error|fail|failed|failure)$/i;
const BLOCKED_VALUE = /^(?:block|blocked)$/i;
const FAILURE_FLAG = /(?:^|[_-])(?:error|fail|failed|failure|suspect|invalid)(?:$|[_-])/i;

function valuesFrom(result) {
  return [result?.completion, result?.status, result?.result]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim());
}

function hasFailingAssertions(report) {
  const failures = report?.failingAssertions;
  if (typeof failures === "number") return failures > 0;
  return Array.isArray(failures) && failures.length > 0;
}

/**
 * Classify an agent result using proof supplied by the supervisor.
 *
 * The result is deliberately deny-by-default: an agent cannot promote its own
 * completion claim. Only a trusted, repository-backed audit may produce
 * "success".
 */
export function classifyAgentCompletion(result = {}, trustedAudit) {
  const values = valuesFrom(result);
  const artifactType =
    typeof result?.artifact?.type === "string" ? result.artifact.type : "";

  if (
    values.some((value) => BLOCKED_VALUE.test(value)) ||
    /-blocked$/i.test(artifactType)
  ) {
    return "blocked";
  }

  const flags = Array.isArray(result?.flags) ? result.flags : [];
  const failed =
    Boolean(result?.error) ||
    values.some((value) => FAILURE_VALUE.test(value)) ||
    flags.some(
      (flag) => typeof flag === "string" && FAILURE_FLAG.test(flag)
    ) ||
    hasFailingAssertions(result?.report) ||
    result?.report?.ok === false ||
    result?.report?.passed === false ||
    FAILURE_VALUE.test(String(result?.report?.status || ""));

  if (failed) return "failed";
  if (trustedAudit?.status === "failed") return "failed";
  if (trustedAudit?.status === "verified") return "success";
  return "unverified";
}
