import { ReactNode, useState } from 'react';
import { Menu, X, LayoutGrid, MessageCircle, Users, Home, Compass, Sparkles, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/routes';

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
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-tsBg text-tsTextMain flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-tsBorder">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-tsBorder text-tsTextMuted"
              onClick={() => setOpen(!open)}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-tsAccent to-orange-600 shadow-lg shadow-orange-500/30" />
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-tsAccentSoft">TradeScout</div>
                <div className="text-sm text-tsTextMuted">Connection without compromise</div>
              </div>
            </div>
          </div>

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
      </header>

      <div className="flex-1 flex w-full">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-950/95 backdrop-blur-md border-r border-tsBorder shadow-2xl shadow-black/40 transform transition-transform',
            open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <nav className="p-4 space-y-8 overflow-y-auto h-full">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-tsTextMuted/80">Navigate</div>
              {primary.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-tsTextMain hover:bg-slate-900 hover:text-white transition"
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-orange-500/20 text-orange-200 text-[11px] px-2 py-0.5">{item.badge}</span>
                  )}
                </a>
              ))}
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-tsTextMuted/80">More</div>
              {secondary.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-tsTextMain hover:bg-slate-900 hover:text-white transition"
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </a>
              ))}
            </div>

            {footer && <div className="pt-4 border-t border-tsBorder/60 text-sm text-tsTextMuted">{footer}</div>}
          </nav>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 bg-tsBg px-3 sm:px-4 md:px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
