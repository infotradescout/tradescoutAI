type ProvisionedProfileAccountControlCandidate = {
  emailVerified: unknown;
  provider: unknown;
  verificationStatus: unknown;
};

type PublicProfileAccountGateCandidate = ProvisionedProfileAccountControlCandidate & {
  profileVisibility: unknown;
};

/**
 * Confirms that a profile owner account is controlled by the intended person
 * before a boot provisioner or exceptional public-profile authority may use
 * it. A matching email address alone is never sufficient.
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

export function isPublicProfileAccountGateOpen(
  candidate: PublicProfileAccountGateCandidate
): boolean {
  const profileVisibility = String(candidate.profileVisibility || "")
    .trim()
    .toLowerCase();
  const verificationStatus = String(candidate.verificationStatus || "")
    .trim()
    .toLowerCase();

  return (
    profileVisibility === "public" &&
    !["rejected", "expired", "suspended"].includes(verificationStatus) &&
    isProvisionedProfileAccountControlConfirmed(candidate)
  );
}
