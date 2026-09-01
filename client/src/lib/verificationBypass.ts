import type { VerificationBypassMetadata } from "@/hooks/useAuth";

export function getVerificationBypassReasonLabel(
  reason: VerificationBypassMetadata["reason"]
): string {
  switch (reason) {
    case "role":
      return "staff role override";
    case "admin_flag":
      return "admin authority override";
    case "manual_direct_connect_override":
      return "manual admin override";
    case "direct_connect_demo_mode":
      return "direct connect demo mode";
    default:
      return "platform override";
  }
}

export function isPrivilegedVerificationBypass(
  bypass?: VerificationBypassMetadata | null
): boolean {
  if (!bypass?.active) return false;
  if (bypass.reason === "role" || bypass.reason === "admin_flag") return true;
  return bypass.reason === "manual_direct_connect_override" && bypass.privileged === true;
}

export function getVerificationBypassUserMessage(
  bypass?: VerificationBypassMetadata | null,
  context: "global" | "direct_connect" | "verification" = "global"
): string {
  if (!bypass?.active) return "";
  if (bypass.reason === "direct_connect_demo_mode") {
    return "Direct Connect demo mode is enabled, so requests can move live without standard verification checks.";
  }
  if (context === "direct_connect") {
    return "Your Direct Connect requests can continue while this override is active.";
  }
  if (context === "verification") {
    return "Your account can continue through protected flows while this override is active.";
  }
  return "Some trust gates are currently relaxed for this account while the override remains active.";
}
