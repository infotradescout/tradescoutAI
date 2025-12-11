import { MessageCircle, User, Layout, SlidersHorizontal, Settings } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/hooks/useAuth';

export function RightToolsPanel() {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="space-y-4">
      {/* Personalized tools menu */}
      <div className="rounded-2xl border border-tsBorder bg-slate-950/80 p-4 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-[0.18em] text-tsAccentSoft">Your tools</div>
        </div>
        <div className="space-y-2 text-sm">
          <a
            href={ROUTES.DASHBOARD || '/dashboard'}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900 text-tsTextMain hover:text-white transition"
          >
            <Layout className="h-4 w-4 text-tsAccent" />
            <span>Dashboard</span>
          </a>
          <a
            href={ROUTES.CONVERSATIONS}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900 text-tsTextMain hover:text-white transition"
          >
            <MessageCircle className="h-4 w-4 text-tsAccent" />
            <span>Messages</span>
          </a>
          <a
            href={ROUTES.PROFILE || '/profile'}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900 text-tsTextMain hover:text-white transition"
          >
            <User className="h-4 w-4 text-tsAccent" />
            <span>Profile & identity</span>
          </a>
          <a
            href={ROUTES.SETTINGS || '/settings'}
            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-900 text-tsTextMain hover:text-white transition"
          >
            <SlidersHorizontal className="h-4 w-4 text-tsAccent" />
            <span>Personalization & settings</span>
          </a>
        </div>
      </div>

      {/* Small personalization summary */}
      <div className="rounded-2xl border border-tsBorder bg-slate-950/80 p-4 text-xs text-tsTextMuted/90">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-3 w-3 text-tsAccent" />
          <span className="uppercase tracking-[0.18em] text-tsAccentSoft">Profile signal</span>
        </div>
        {isAuthenticated && user ? (
          <p>
            Signed in as <span className="text-tsTextMain font-medium">{user.firstName || user.email}</span>. Scout tunes Marketplace,
            Community, and contractor matches to your role and county.
          </p>
        ) : (
          <p>
            You&apos;re browsing as a guest. Sign in to unlock personalized dashboards, saved searches, and local contractor matches.
          </p>
        )}
      </div>
    </div>
  );
}
