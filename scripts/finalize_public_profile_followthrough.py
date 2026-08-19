from pathlib import Path
import subprocess

ROOT = Path(".")


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise AssertionError(f"target not found in {path}: {old[:160]!r}")
    write(path, text.replace(old, new, 1))


def restore_from_branch_head(path: str) -> None:
    content = subprocess.check_output(["git", "show", f"HEAD:{path}"])
    (ROOT / path).write_bytes(content)


# The anonymous hydration route had a second legacy owner-verification check
# after the canonical exposure resolver. Carry the same reusable managed-
# business authority through that final viewer gate.
replace_once(
    "server/routes/profiles.ts",
    '''  canExposePublishedProfilePublicly,
  hasTradeScoutPendingOwnerCustody,
  isOwnerConfirmedDirectProfile,
''',
    '''  canExposePublishedProfilePublicly,
  hasOperatorConfirmedManagedBusinessAuthority,
  hasTradeScoutPendingOwnerCustody,
  isOwnerConfirmedDirectProfile,
''',
)
replace_once(
    "server/routes/profiles.ts",
    '''  let ownerConfirmedDirectProfile = false;
  let unlistedSteelHomeDirectProfile = false;
''',
    '''  let ownerConfirmedDirectProfile = false;
  let operatorConfirmedManagedBusinessProfile = false;
  let unlistedSteelHomeDirectProfile = false;
''',
)
replace_once(
    "server/routes/profiles.ts",
    '''    ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile(directProfileCandidate);
    unlistedSteelHomeDirectProfile =
''',
    '''    ownerConfirmedDirectProfile = isOwnerConfirmedDirectProfile(directProfileCandidate);
    operatorConfirmedManagedBusinessProfile =
      hasOperatorConfirmedManagedBusinessAuthority(directProfileCandidate);
    unlistedSteelHomeDirectProfile =
''',
)
replace_once(
    "server/routes/profiles.ts",
    '''        ownerConfirmedDirectProfile: ownerConfirmedDirectProfile || unlistedSteelHomeDirectProfile,
''',
    '''        ownerConfirmedDirectProfile:
          ownerConfirmedDirectProfile ||
          operatorConfirmedManagedBusinessProfile ||
          unlistedSteelHomeDirectProfile,
''',
)
replace_once(
    "server/routes/profiles.ts",
    '''        ...((business.tradePartner === true || ownerConfirmedDirectProfile) &&
        directConnectOwnerUserId
''',
    '''        ...((business.tradePartner === true ||
          ownerConfirmedDirectProfile ||
          operatorConfirmedManagedBusinessProfile) &&
        directConnectOwnerUserId
''',
)

# These two old broad contract files contain unrelated stale assertions against
# current main. Restore them byte-for-byte and cover this lane with a focused
# contract instead of rewriting historical UI expectations.
restore_from_branch_head("server/tests/moulding-millwork-profile.contract.test.ts")
restore_from_branch_head("server/tests/issa-build-profile.contract.test.ts")

focused_test = r'''import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
  OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
} from "@shared/publicProfileExposureRegistry";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import { PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS } from "@shared/precisionAerialProfile";
import {
  derivePublishedProfileExposure,
  hasOperatorConfirmedManagedBusinessAuthority,
} from "../services/ownerConfirmedDirectProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function managedCandidate(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    businessId: "business-1",
    profileSlug: "managed-business",
    profileStatus: "published",
    profileOwnerUserId: "owner-1",
    ownerVerifiedBadge: false,
    ownerVerificationStatus: "pending",
    ownerProvider: "admin_provisioned",
    ownerPreferences: { publicProfileIds: ["profile-1"] },
    businessStatus: "active",
    businessOwnerUserId: "owner-1",
    publicDiscoveryEnabled: true,
    businessSources: [OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE],
    businessClaimStatus: "claimed",
    ...overrides,
  };
}

describe("public profile followthrough", () => {
  it("uses a reusable operator-confirmed managed-business authority without inventing verification", () => {
    const candidate = managedCandidate();
    expect(hasOperatorConfirmedManagedBusinessAuthority(candidate)).toBe(true);
    expect(derivePublishedProfileExposure(candidate)).toEqual({
      mode: "public",
      reason: "public",
    });

    expect(
      hasOperatorConfirmedManagedBusinessAuthority(
        managedCandidate({
          businessSources: [
            OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE,
            OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE,
          ],
        })
      )
    ).toBe(false);
    expect(
      hasOperatorConfirmedManagedBusinessAuthority(
        managedCandidate({ ownerProvider: "local" })
      )
    ).toBe(false);
    expect(
      hasOperatorConfirmedManagedBusinessAuthority(
        managedCandidate({ businessOwnerUserId: "different-owner" })
      )
    ).toBe(false);
  });

  it("makes Moulding public and requestable through confirmed management authority", () => {
    const provisioner = read("server/services/mouldingMillworkProfileProvisioning.ts");
    const route = read("server/routes/profiles.ts");
    const search = read("server/repositories/profileRepository.ts");

    expect(provisioner).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE");
    expect(provisioner).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_REVOKED_SOURCE");
    expect(provisioner).toContain('profile_authority_scope: "public_profile_and_request_routing"');
    expect(provisioner).toContain('label: "Start a Request"');
    expect(provisioner).toContain("publicProfileIds: releasedProfileIds");
    expect(provisioner).not.toContain("verifiedLicensed: true");
    expect(provisioner).not.toContain("verifiedInsured: true");
    expect(route).toContain("operatorConfirmedManagedBusinessProfile");
    expect(route).toContain("hasOperatorConfirmedManagedBusinessAuthority");
    expect(search).toContain("OPERATOR_CONFIRMED_MANAGED_PROFILE_SOURCE");
  });

  it("makes ISSA the one full-service operator and keeps one request funnel", () => {
    const provisioner = read("server/services/issaBuildProfileProvisioning.ts");
    const publicCopy = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);

    expect(provisioner).toContain('label: "Start a Request"');
    expect(provisioner).not.toContain('label: "Discuss a project"');
    expect(provisioner).toContain(
      "ISSA Build handles material selection, customization, backlighting, and installation"
    );
    expect(publicCopy).toContain(
      "Send the room once. ISSA Build handles material selection, customization, backlighting, and installation."
    );
    expect(publicCopy).toContain("Honey Onyx");
    expect(publicCopy).toContain("Multi Green Onyx");
  });

  it("publishes only supported Precision Aerial facts and keeps thermal work planned", () => {
    const provisioner = read("server/services/precisionAerialProfileProvisioning.ts");
    const publicCopy = JSON.stringify(PRECISION_AERIAL_PROFILE_CONTENT_BLOCKS);

    expect(publicCopy).toContain("real estate");
    expect(publicCopy).toContain("construction progress");
    expect(publicCopy).toContain("land");
    expect(publicCopy).toContain("FPV");
    expect(publicCopy).toContain("Thermal imaging — planned");
    expect(publicCopy.toLowerCase()).not.toContain("licensed");
    expect(publicCopy.toLowerCase()).not.toContain("insured");
    expect(publicCopy).not.toMatch(/\b\d{3}[-.)\s]+\d{3}[-.\s]+\d{4}\b/);
    expect(provisioner).toContain('label: "Start a Request"');
    expect(provisioner).toContain('notificationEmail: "contact@thetradescout.com"');
    expect(provisioner).toContain('requestRouting: "tradescout_managed"');
  });
});
'''
write("server/tests/public-profile-followthrough.contract.test.ts", focused_test)

for source_path in [
    "server/routes/profiles.ts",
    "server/services/mouldingMillworkProfileProvisioning.ts",
    "server/services/issaBuildProfileProvisioning.ts",
    "server/services/precisionAerialProfileProvisioning.ts",
    "server/tests/public-profile-followthrough.contract.test.ts",
]:
    if not (ROOT / source_path).exists():
        raise AssertionError(f"missing required followthrough file: {source_path}")
