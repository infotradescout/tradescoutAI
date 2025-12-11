import { ReactNode, useState } from 'react';
import { LayoutGrid, MessageCircle, Users, Home, Compass, Sparkles, DollarSign, SlidersHorizontal, X } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { RightToolsPanel } from '@/components/layout/RightToolsPanel';

type NavItem = {
  label: string;
  href: string;
  icon?: ReactNode;
  badge?: string;
};

type AppShellProps = {
  children: ReactNode;
  primary?: NavItem[];
  secondary?: NavItem[];
  footer?: ReactNode;
};

const defaultPrimary: NavItem[] = [
  { label: 'Home', href: '/', icon: <Home className="h-4 w-4" /> },
  { label: 'Contractors', href: ROUTES.FIND_CONTRACTORS || ROUTES.CONTRACTORS, icon: <Compass className="h-4 w-4" /> },
  { label: 'Marketplace', href: ROUTES.MARKETPLACE, icon: <LayoutGrid className="h-4 w-4" /> },
  { label: 'Community', href: ROUTES.COMMUNITY, icon: <Users className="h-4 w-4" /> },
];

const defaultSecondary: NavItem[] = [
  { label: 'Pricing', href: ROUTES.PRICING, icon: <DollarSign className="h-4 w-4" /> },
  { label: 'Messages', href: ROUTES.CONVERSATIONS, icon: <MessageCircle className="h-4 w-4" /> },
  { label: 'Help', href: ROUTES.HELP, icon: <Sparkles className="h-4 w-4" /> },
];

export function AppShell({
  children,
  primary = defaultPrimary,
  secondary = defaultSecondary,
  footer,
}: AppShellProps) {
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-tsBg text-tsTextMain flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-tsBorder">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-tsAccent to-orange-600 shadow-lg shadow-orange-500/30" />
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">TradeScout</div>
                <div className="text-sm text-tsTextMuted">Connection without compromise</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mobile tools toggle for right-side menu */}
            <button
              type="button"
              onClick={() => setIsToolsOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-tsTextMain hover:bg-slate-800 md:hidden"
              aria-label="Open tools and personalization menu"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>

            <div className="hidden md:flex items-center gap-3 text-sm text-tsTextMuted">
              <a href={ROUTES.HELP} className="hover:text-tsAccent transition">Help</a>
              <a
                href={ROUTES.FIND_CONTRACTORS || ROUTES.CONTRACTORS}
                className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-white font-semibold shadow-orange-500/40 shadow hover:shadow-orange-500/60 transition"
              >
                Contractors
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main content with right-side tools/personalization menu */}
      <div className="flex-1 w-full bg-tsBg px-3 sm:px-4 md:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 min-w-0">
            {children}
          </div>
          {/* Desktop / large screens: persistent right tools panel */}
          <div className="hidden lg:block">
            <RightToolsPanel />
          </div>
        </div>
      </div>

      {/* Mobile overlay for tools panel */}
      {isToolsOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="flex-1 bg-black/50"
            aria-label="Close tools menu"
            onClick={() => setIsToolsOpen(false)}
          />
          <div className="w-4/5 max-w-xs bg-slate-950 border-l border-slate-800 p-4 shadow-xl shadow-black/50 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Tools & Personalization</span>
              <button
                type="button"
                onClick={() => setIsToolsOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800"
                aria-label="Close tools menu"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <RightToolsPanel />
          </div>
        </div>
      )}
    </div>
  );
}
