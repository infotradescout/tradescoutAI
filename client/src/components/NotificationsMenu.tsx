import React from "react";
import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useNotifications } from "@/hooks/useNotifications";

type NotificationsMenuProps = {
  className?: string;
};

export function NotificationsMenu({ className }: NotificationsMenuProps) {
  const { summary, unreadCount, isLoading, isError } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const [, navigate] = useLocation();

  const unreadThreads = summary?.unreadThreads ?? 0;
  const openHoaVotes = summary?.openHoaVotes ?? 0;

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  const goToMessages = () => {
    navigate("/messages");
    close();
  };

  const goToHoaDashboard = () => {
    navigate("/hoa-dashboard");
    close();
  };

  return (
    <div
      className={`relative ${className ?? ""}`}
      data-testid="notifications-menu"
    >
      {/* Bell button */}
      <button
        type="button"
        onClick={toggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        data-testid="notifications-bell"
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-slate-950"
            data-testid="notifications-badge"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-slate-800 bg-slate-950/95 p-3 shadow-xl shadow-black/60"
          data-testid="notifications-panel"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Notifications
            </span>
            {isLoading && (
              <span className="text-[10px] text-slate-500">Syncing...</span>
            )}
          </div>

          {isError && (
            <div className="rounded-xl bg-red-950/40 px-2 py-2 text-[11px] text-red-300">
              Couldn’t load notifications.
            </div>
          )}

          {!isError && (
            <div className="space-y-1 text-xs text-slate-200">
              <button
                type="button"
                onClick={goToMessages}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-slate-900"
                data-testid="notifications-messages-link"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">Messages</span>
                  <span className="text-[11px] text-slate-500">
                    Unread conversations in your inbox
                  </span>
                </span>
                <span className="ml-2 rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-100">
                  {unreadThreads}
                </span>
              </button>

              <button
                type="button"
                onClick={goToHoaDashboard}
                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-slate-900"
                data-testid="notifications-hoa-link"
              >
                <span className="flex flex-col">
                  <span className="font-semibold">HOA votes</span>
                  <span className="text-[11px] text-slate-500">
                    Open votes waiting on you
                  </span>
                </span>
                <span className="ml-2 rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-100">
                  {openHoaVotes}
                </span>
              </button>
            </div>
          )}

          {unreadCount === 0 && !isLoading && !isError && (
            <div
              className="mt-2 rounded-xl bg-slate-900/70 px-2 py-2 text-[11px] text-slate-400"
              data-testid="notifications-empty-state"
            >
              You’re all caught up.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
