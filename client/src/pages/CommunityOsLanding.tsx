import { useState } from 'react';
import { ArrowRight, MessageCircle, Sparkles, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ScoutResponse {
  message: string;
  timestamp?: string;
}

const suggestionPrompts = [
  'Find a reliable plumber for a kitchen leak',
  'How much does it cost to paint a 12x12 room?',
  'Roof repair specialists near me',
  'Permits needed for a deck in Texas',
  'Best work van for HVAC technician',
  'Landscaping ideas for small backyards',
];

export default function CommunityOsLanding() {
  const { isAuthenticated, user } = useAuth();
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const addressParts = user?.address?.split(',').map((part: string) => part.trim()).filter(Boolean) || [];
  const addressDerivedCommunity = addressParts[1] || addressParts[0] || '';
  const rawCommunity = user?.city || user?.county || addressDerivedCommunity || user?.state || '';
  const communityLabel = rawCommunity.trim();
  const headlineCommunity = isAuthenticated && communityLabel ? communityLabel : 'Local Community';

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
      <div className="relative overflow-hidden rounded-2xl border border-tsBorder bg-slate-950/70 shadow-2xl shadow-black/40 px-5 sm:px-8 py-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,#0f1d3d,#020617_55%,#020617)] opacity-70" />
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-orange-500/15 blur-3xl" />
          <div className="absolute bottom-[-10%] right-1/4 w-96 h-96 bg-cyan-500/12 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.18em] uppercase text-tsAccentSoft shadow-lg shadow-orange-500/10">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              Community Operating System
            </div>
            <div className="flex items-center gap-2 text-xs text-tsTextMuted">
              <Sparkles className="w-4 h-4 text-tsAccent" />
              <span>Nationwide tools, local connection</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <h1 className="text-4xl sm:text-5xl font-black leading-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
              Empowering <span className="text-tsAccent">{headlineCommunity}</span>
            </h1>
            <p className="text-base sm:text-lg text-tsTextMuted max-w-3xl">
              Interact with neighbors, find verified local talent, and access real-time area intelligence.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.25fr,1fr]">
            <Card className="bg-slate-900/80 border border-tsBorder rounded-2xl shadow-xl shadow-black/30">
              <div className="p-4 sm:p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <label className="text-xs uppercase tracking-[0.18em] text-tsTextMuted">Ask Scout</label>
                  <textarea
                    className="w-full rounded-xl bg-[#0c1a33] border border-white/10 px-4 py-3 text-base text-white placeholder:text-white/55 focus:outline-none focus:ring-2 focus:ring-tsAccent/80 min-h-[96px]"
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
                      className="w-full sm:w-auto px-5 h-12 rounded-xl bg-gradient-to-r from-tsAccent to-orange-600 text-white font-semibold shadow-lg shadow-orange-600/30"
                    >
                      {isLoading ? 'Searching...' : 'Start Search'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <div className="flex items-center gap-3 text-xs text-tsTextMuted">
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
                  <div className="rounded-xl border border-tsBorder bg-slate-900/60 p-4 text-sm text-tsTextMain whitespace-pre-wrap shadow-inner shadow-black/20">
                    {error ? error : response}
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="bg-slate-900/80 border border-tsBorder rounded-2xl shadow-xl shadow-black/30 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-tsTextMain">Quick Start</div>
                  {!isAuthenticated && (
                    <a href="/signup" className="text-xs text-tsAccent hover:underline">Join</a>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestionPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                      className="px-3 py-2 rounded-full bg-slate-800 border border-tsBorder text-xs text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20"
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="bg-slate-900/80 border border-tsBorder rounded-2xl shadow-xl shadow-black/30 p-4 sm:p-5">
                <div className="text-sm font-semibold text-tsTextMain mb-3">Explore Community Tools</div>
                <div className="flex flex-wrap gap-2">
                  {suggestionPrompts.slice(3).map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setQuestion(prompt)}
                      className="px-3 py-2 rounded-full bg-slate-800 border border-tsBorder text-xs text-tsTextMain hover:border-tsAccent hover:text-white transition shadow-sm shadow-black/20"
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
