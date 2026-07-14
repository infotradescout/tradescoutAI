// Fixed v1 role list for Property Lifecycle OS participants. Not free-form —
// keeping this closed keeps server-side permission enforcement predictable.

export const PROPERTY_PARTICIPANT_ROLES = [
  { value: "contractor", label: "Contractor" },
  { value: "realtor", label: "Realtor" },
  { value: "viewer", label: "Viewer" },
] as const;

export type PropertyParticipantRoleValue = (typeof PROPERTY_PARTICIPANT_ROLES)[number]["value"];

export type PropertyParticipantPermissions = {
  canAddEvents: boolean;
  canAddDocuments: boolean;
  canInviteParticipants: boolean;
};

// Owner/primary are structural roles (assigned automatically, not invite-selectable)
// and always get full access via requirePropertyProgramAccess's isOwnerLike check,
// so they don't need an entry here.
export const PROPERTY_PARTICIPANT_ROLE_PERMISSIONS: Record<
  PropertyParticipantRoleValue,
  PropertyParticipantPermissions
> = {
  contractor: { canAddEvents: true, canAddDocuments: true, canInviteParticipants: false },
  realtor: { canAddEvents: false, canAddDocuments: true, canInviteParticipants: false },
  viewer: { canAddEvents: false, canAddDocuments: false, canInviteParticipants: false },
};

export function isPropertyParticipantRole(value: string): value is PropertyParticipantRoleValue {
  return PROPERTY_PARTICIPANT_ROLES.some((role) => role.value === value);
}

export const BUILD_PHASES = [
  { value: "pre_construction", label: "Pre-Construction" },
  { value: "site_foundation", label: "Site/Foundation" },
  { value: "framing", label: "Framing" },
  { value: "rough_in_mep", label: "Rough-In (MEP)" },
  { value: "insulation_drywall", label: "Insulation/Drywall" },
  { value: "finishes", label: "Finishes" },
  { value: "final_co", label: "Final/CO" },
] as const;
