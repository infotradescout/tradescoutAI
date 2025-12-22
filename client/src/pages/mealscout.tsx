import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { PageLoadingSpinner } from '../components/LoadingSpinner';

type SsoState = 'idle' | 'requesting-token' | 'performing-sso' | 'ready' | 'error';

export default function MealScoutPage() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<SsoState>('idle');
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(
    () =>
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MEALSCOUT_BASE_URL) ||
      'https://mealscout.yourdomain.com',
    [],
  );

  useEffect(() => {
    let cancelled = false;

    async function runSso() {
      try {
        setState('requesting-token');
        setError(null);

        const tokenRes = await fetch('/api/mealscout/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        if (!tokenRes.ok) {
          throw new Error('Failed to get MealScout SSO token');
        }

        const { token } = (await tokenRes.json()) as { token?: string };
        if (!token) {
          throw new Error('MealScout SSO token missing in response');
        }

        setState('performing-sso');

        const ssoRes = await fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/tradescout/sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        });

        if (!ssoRes.ok) {
          throw new Error(`MealScout SSO failed with status ${ssoRes.status}`);
        }

        if (cancelled) return;
        setState('ready');

        // Optional: handle any queued MEALSCOUT_COMMAND payload
        try {
          const raw = window.localStorage.getItem('mealscout:pending-command');
          if (raw) {
            const payload = JSON.parse(raw);
            window.localStorage.removeItem('mealscout:pending-command');

            if (payload && typeof payload === 'object') {
              const params = new URLSearchParams();
              if (typeof payload.intent === 'string') params.set('intent', payload.intent);
              if (typeof payload.query === 'string') params.set('q', payload.query);
              const url = `${baseUrl.replace(/\/$/, '')}/?${params.toString()}`;
              window.location.href = url;
              return;
            }
          }
        } catch {
          // Best-effort only; fall back to simple redirect
        }
      } catch (err: any) {
        console.error('MealScout SSO failed', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to initialize MealScout');
          setState('error');
        }
      }
    }

    void runSso();

    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  if (state === 'idle' || state === 'requesting-token' || state === 'performing-sso') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <PageLoadingSpinner message="Connecting you securely to MealScout..." />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-50">MealScout is temporarily unavailable</h1>
        <p className="text-sm text-slate-300 max-w-md">
          {error || 'Something went wrong while creating your secure MealScout session.'}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            className="inline-flex items-center rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800/60"
            onClick={() => navigate('/scout')}
          >
            Back to Scout
          </button>
        </div>
      </div>
    );
  }

  // READY: session established; open MealScout in this tab
  const targetUrl = `${baseUrl.replace(/\/$/, '')}/`;
  window.location.href = targetUrl;

  return (
    <div className="flex flex-1 items-center justify-center">
      <PageLoadingSpinner message="Launching MealScout..." />
    </div>
  );
}
