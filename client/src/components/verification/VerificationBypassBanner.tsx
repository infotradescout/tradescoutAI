import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { VerificationBypassMetadata } from "@/hooks/useAuth";
import {
  getVerificationBypassReasonLabel,
  getVerificationBypassUserMessage,
  isPrivilegedVerificationBypass,
} from "@/lib/verificationBypass";

interface VerificationBypassBannerProps {
  bypass?: VerificationBypassMetadata | null;
  className?: string;
  context?: "global" | "direct_connect" | "verification";
  showPolicyLink?: boolean;
}

export function VerificationBypassBanner({
  bypass,
  className,
  context = "global",
  showPolicyLink = false,
}: VerificationBypassBannerProps) {
  if (!bypass?.active) return null;

  const reasonLabel = getVerificationBypassReasonLabel(bypass.reason);
  const summary = getVerificationBypassUserMessage(bypass, context);
  const privileged = isPrivilegedVerificationBypass(bypass);

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium text-amber-100">
            Verification bypass is active ({reasonLabel})
          </p>
          <p className="mt-1 text-amber-200/90">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {privileged ? (
              <span className="rounded-full border border-amber-300/50 bg-amber-400/15 px-2 py-0.5">
                Privileged override
              </span>
            ) : null}
            {bypass.directConnectDemoMode ? (
              <span className="rounded-full border border-amber-300/50 bg-amber-400/15 px-2 py-0.5">
                Direct Connect demo mode
              </span>
            ) : null}
            {showPolicyLink ? (
              <Link href="/admin/authority-policy" className="underline underline-offset-2">
                View policy details
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerificationBypassBanner;
