type ProvisionedProfileAccountControlCandidate = {
  emailVerified: unknown;
  provider: unknown;
  verificationStatus: unknown;
};

/**
 * Confirms account control before a boot provisioner may adopt a user found by
 * email. A matching address alone is never ownership or custody authority.
 */
export function isProvisionedProfileAccountControlConfirmed(
  candidate: ProvisionedProfileAccountControlCandidate
): boolean {
  const provider = String(candidate.provider || "")
    .trim()
    .toLowerCase();
  const verificationStatus = String(candidate.verificationStatus || "")
    .trim()
    .toLowerCase();

  return (
    candidate.emailVerified === true ||
    provider === "admin_provisioned" ||
    verificationStatus === "approved"
  );
}
