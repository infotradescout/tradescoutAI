// ============================================================
// BetaNotificationPopup
// Design: centered modal, dark surface, orange accent
// — polished card layout with gradient header strip
// — "View recent updates" button → tradescoutinfo.us
// — security notice + feedback prompt
// ============================================================
import React, { useState, useEffect } from "react";
import { safeStorage } from "../utils/safeStorage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Rocket, Users, ShieldAlert, ExternalLink } from "lucide-react";
import { PRIMARY_SUPPORT_EMAIL } from "@shared/supportInbox";

const CHANGELOG_URL = "https://www.tradescoutinfo.us";

export function BetaNotificationPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = safeStorage.get("hasSeenBetaNotification");
      if (!seen) {
        const timer = setTimeout(() => setIsOpen(true), 2000);
        return () => clearTimeout(timer);
      }
    } catch (err) {
      console.error("BetaNotificationPopup localStorage error:", err);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    try {
      safeStorage.set("hasSeenBetaNotification", "true");
    } catch (err) {
      console.error("Failed to save beta notification state:", err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 overflow-hidden border-0 shadow-2xl"
        style={{
          maxWidth: 440,
          width: "calc(100vw - 2rem)",
          background: "#0e1318",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          /* Force true centering — override any template offset */
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* ── Gradient header strip ── */}
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(249,115,22,0.18) 0%, rgba(249,115,22,0.04) 100%)",
            borderBottom: "1px solid rgba(249,115,22,0.12)",
            padding: "20px 24px 16px",
          }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 36,
                height: 36,
                background: "rgba(249,115,22,0.15)",
                border: "1px solid rgba(249,115,22,0.25)",
              }}
            >
              <Rocket className="h-4 w-4" style={{ color: "#f97316" }} />
            </div>
            <div>
              <DialogTitle
                className="text-base font-bold leading-tight"
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: "rgba(255,255,255,0.95)",
                }}
              >
                You're in Beta
              </DialogTitle>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                TradeScout Early Access
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">
          {/* Security notice */}
          <div
            className="flex gap-3 rounded-xl p-3.5"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}
          >
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#f87171" }} />
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "#fca5a5" }}>
                Security Notice
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Do not enter real payment details or sensitive personal information. Use test data
                only during this beta period.
              </p>
            </div>
          </div>

          {/* Feedback row */}
          <div
            className="flex gap-3 rounded-xl p-3.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Users className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#f97316" }} />
            <div>
              <p
                className="text-xs font-semibold mb-0.5"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                Found a bug?
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                Screenshot it and email{" "}
                <a
                  href={`mailto:${PRIMARY_SUPPORT_EMAIL}`}
                  className="underline underline-offset-2 transition-colors"
                  style={{ color: "#f97316" }}
                >
                  {PRIMARY_SUPPORT_EMAIL}
                </a>{" "}
                — or use the suggestion form on the updates forum.
              </p>
            </div>
          </div>

          {/* Changelog link */}
          <a
            href={CHANGELOG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-xl px-4 py-3 transition-all group"
            style={{
              background: "rgba(249,115,22,0.06)",
              border: "1px solid rgba(249,115,22,0.18)",
              textDecoration: "none",
            }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: "#f97316" }}>
                View recent improvements
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                tradescoutinfo.us — auto-updated changelog
              </p>
            </div>
            <ExternalLink
              className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              style={{ color: "#f97316" }}
            />
          </a>

          <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            This notice appears once per session.
          </p>
        </div>

        {/* ── Footer actions ── */}
        <div
          className="px-6 pb-5 flex gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 16 }}
        >
          <Button
            onClick={handleClose}
            className="flex-1 font-semibold text-sm h-10"
            style={{
              background: "#f97316",
              color: "#fff",
              border: "none",
              borderRadius: 8,
            }}
          >
            Got it, let's go
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
