import { useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getUserLocationLabel, getUserAudienceLabel } from '@/lib/copyHelpers';
import { formatCityOnly } from '@/utils/locationDisplay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ScoutResponse {
  message: string;
  timestamp?: string;
}

const suggestionPrompts = [
  'Trusted plumber — kitchen leak.',
  'Paint 12×12 room cost?',
  'Roof repair near me.',
  'Deck permits in Texas.',
  'Best HVAC work van.',
  'Small backyard ideas.',
];

export default function CommunityOsLanding() {
  const { isAuthenticated, user } = useAuth();
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const locationLabel = getUserLocationLabel(user as any);
  const audienceLabel = getUserAudienceLabel(user as any);
  const headlineCommunity = isAuthenticated && locationLabel
	? (formatCityOnly({ label: locationLabel }) || 'YOUR COMMUNITY')
    : 'YOUR COMMUNITY';

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setError('');
    setResponse('');

    try {
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: question,
          history: [],
        }),
      });

      if (!res.ok) {
        throw new Error('Scout request failed');
      }

      const data: ScoutResponse = await res.json();
      setResponse(data.message || '');
    } catch (err) {
      console.error(err);
      setError('Sorry, something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 shadow-2xl shadow-black/40 px-5 sm:px-8 py-8">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-70"
            style={{ backgroundColor: "var(--surface-app-bg)" }}
          />
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-ts-orange/15 blur-3xl" />
          <div className="absolute bottom-[-10%] right-1/4 w-96 h-96 bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.18em] uppercase text-ts-orange shadow-lg shadow-orange-500/10">
              <span className="w-2 h-2 rounded-full bg-ts-orange animate-pulse" />
              Community Operating System
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <Sparkles className="w-4 h-4 text-ts-orange" />
              <span>Nationwide tools, local connection</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <h1 className="text-4xl sm:text-5xl font-black leading-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              <span className="text-white">EMPOWERING </span>
              <span className="text-ts-orange">{headlineCommunity}</span>
            </h1>
            <p className="text-base sm:text-lg text-white/60 max-w-3xl">
              Interact with neighbors, find verified local talent, and access real-time area intelligence.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr,1fr]">
            <Card className="bg-tsCard/95 border border-white/10 rounded-2xl shadow-xl shadow-black/30">
              <div className="p-4 sm:p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <label className="text-xs uppercase tracking-[0.18em] text-white/60">Ask Scout</label>
                  <textarea
                    className="w-full rounded-xl border border-white/10 px-4 py-3 text-base text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-ts-orange/70/80 min-h-[96px]"
                    style={{ backgroundColor: "var(--surface-card)" }}
                    rows={3}
                    placeholder="Ask a question, find a pro, check local codes, or get advice..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={isLoading}
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button
                      onClick={handleSubmit}
                      disabled={!question.trim() || isLoading}
                      className="w-full sm:w-auto px-5 h-12 rounded-xl bg-gradient-to-r from-ts-orange to-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30"
                    >
                      {isLoading ? 'Searching...' : 'Start Search'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <div className="flex items-center gap-3 text-xs text-white/60">
                      <div className="flex items-center gap-1 text-cyan-300">
                        <Activity className="w-4 h-4" />
                        Scout Active
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        Real-time intelligence
                      </div>
                    </div>
                  </div>
                </div>

                {(response || error) && (
                  <div className="rounded-xl border border-white/10 bg-tsCard/95 p-4 text-sm text-white whitespace-pre-wrap shadow-inner shadow-black/20">
                    {error ? error : response}
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="bg-tsCard/95 border border-white/10 rounded-2xl shadow-xl shadow-black/30 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-white">Quick Start</div>
                  {!isAuthenticated && (
                    <a href="/signup" className="text-xs text-ts-orange hover:underline">Join</a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestionPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                      className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white hover:border-ts-orange hover:text-white transition shadow-sm shadow-black/20"
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="bg-tsCard/95 border border-white/10 rounded-2xl shadow-xl shadow-black/30 p-4 sm:p-5">
                <div className="text-sm font-semibold text-white mb-3">Explore Community Tools</div>
                <div className="flex flex-wrap gap-2">
                  {suggestionPrompts.slice(3).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                      className="px-3 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white hover:border-ts-orange hover:text-white transition shadow-sm shadow-black/20"
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
