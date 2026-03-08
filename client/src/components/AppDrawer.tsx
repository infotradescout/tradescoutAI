import React from "react";
import { X, Grid3x3, Shield } from "lucide-react";
import { Link } from "wouter";
import { NAV_SECTIONS } from "@/config/nav";

interface AppDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

export default function AppDrawer({ isOpen, onClose }: AppDrawerProps) {
  const sections = isAdmin
    ? [{ label: "Admin OS", href: "/admin" }, ...NAV_SECTIONS]
    : NAV_SECTIONS;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 bg-overlay/80 z-40 transition-opacity" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-tsCard shadow-lg transform transition-transform duration-300 ease-in-out z-50 flex flex-col overflow-hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="bg-tsCardHeader text-tsCardHeaderFg p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Grid3x3 className="w-6 h-6" />
            <h2 className="text-xl font-bold">TradeScout Sections</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-tsCard/20 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs uppercase text-muted-foreground tracking-wide mb-3">Sections</h3>
          <div className="space-y-1">
            {sections.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-foreground hover:bg-muted transition"
              >
                {item.href === "/admin" ? <Shield className="h-4 w-4" /> : null}
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-tsBg p-4 text-center text-sm text-muted-foreground">
          <p>TradeScout OS • Your Local Operating System</p>
        </div>
      </div>
    </>
  );
}
