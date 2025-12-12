import { memo, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Zap, MapPin, Star, ThumbsUp, Briefcase, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StateCountySelector } from '@/components/state-county-selector';
import { sanitizeAreaLabel } from '@/lib/copyHelpers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';

const stats = [
  { label: 'Active Projects', value: '12' },
  { label: 'Avg. Rating', value: '4.8' },
  { label: 'Completed Jobs', value: '156' },
  { label: 'Monthly Revenue', value: '$45K' },
];

const quickActions = [
  { title: 'View Connections', desc: 'Check new project opportunities' },
  { title: 'Update Profile', desc: 'Keep your pro card current' },
  { title: 'Submit Quote', desc: 'Send pricing on new requests' },
];

type Contractor = {
  id: string;
  name?: string;
  businessName?: string;
  rating?: number;
  reviewCount?: number;
  recommendationCount?: number;
  trades?: string[];
  location?: string;
  county?: string;
  state?: string;
  licenseNumber?: string | null;
};

const FindContractors = memo(function FindContractors() {
  const [stateCode, setStateCode] = useState('');
  const [countyFips, setCountyFips] = useState('');
  const [tradeSlug, setTradeSlug] = useState('');

  const { data: trades = [] } = useQuery({
    queryKey: ['/api/trades'],
    queryFn: async () => apiRequest('GET', '/api/trades'),
  });

  const { data: topContractors = [], isLoading: topLoading } = useQuery<Contractor[]>({
    queryKey: ['/api/contractors/top', countyFips, tradeSlug],
    enabled: Boolean(countyFips && tradeSlug),
    queryFn: async () => {
      const params = new URLSearchParams({ county: countyFips, trade: tradeSlug, limit: '5' });
      return apiRequest('GET', `/api/contractors/top?${params.toString()}`);
    },
  });

  const ranked = useMemo(() => {
    return [...(topContractors || [])].sort((a, b) => {
      const aRec = (a.recommendationCount ?? a.reviewCount ?? 0);
      const bRec = (b.recommendationCount ?? b.reviewCount ?? 0);
      const aScore = (a.rating ?? 0) * 100 + aRec;
      const bScore = (b.rating ?? 0) * 100 + bRec;
      return bScore - aScore;
    });
  }, [topContractors]);

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-6xl mx-auto ts-surface px-4 py-6 md:px-10 md:py-8 space-y-10">
          <header className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 text-sm text-orange-200">
            <Zap className="h-4 w-4" />
            <span>Scout drives the workflow end-to-end</span>
          </div>
          <h1 className="text-4xl font-bold text-white">Find contractors and run your board</h1>
          <p className="text-gray-300 max-w-3xl">
            Search your county, browse pros, and manage work in one place. Scout automates the hunt while you stay in control of every tool.
          </p>
    </header>

    <div className="ts-section space-y-4">
          <div className="flex items-center gap-2 text-orange-300">
            <Search className="h-5 w-5" />
            <span className="font-semibold">Search contractors</span>
      </div>

          <StateCountySelector
            selectedState={stateCode}
            selectedCounty={countyFips}
            onStateChange={setStateCode}
            onCountyChange={setCountyFips}
            className="mt-2"
          />

          <div className="grid md:grid-cols-3 gap-4">
            <Select value={tradeSlug} onValueChange={setTradeSlug}>
              <SelectTrigger className="bg-navy-700 text-white border border-navy-600">
                <SelectValue placeholder="Select trade/occupation" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {trades.map((trade: any) => (
                  <SelectItem key={trade.slug} value={trade.slug}>
                    {trade.name || trade.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              disabled={!countyFips || !tradeSlug}
              className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 text-sm rounded-xl flex items-center gap-2 font-semibold transition-all border border-orange-400/30 focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              <Search className="h-4 w-4" />
              <span>Fetch top contractors</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-gray-300">
            <Badge variant="outline" className="border-orange-400/40 text-orange-200">Helper: Pick your state + county</Badge>
            <Badge variant="outline" className="border-blue-400/40 text-blue-200">Helper: Choose the trade (occupation)</Badge>
            <Badge variant="outline" className="border-emerald-400/40 text-emerald-200">Helper: Ranked by rating + recommendations</Badge>
          </div>
        </div>

    <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">Top contractors in your area</h2>
              <p className="text-sm text-gray-300">Ranked by rating and recommendations for the selected occupation.</p>
            </div>
            <Badge className="bg-orange-600 text-white">
              {countyFips && tradeSlug ? `${ranked.length} results` : 'Select location + trade'}
            </Badge>
          </div>

            {!countyFips || !tradeSlug ? (
              <div className="ts-tile p-6 text-sm text-gray-400">
              Choose your state, county, and occupation to see the top recommended contractors near you.
            </div>
            ) : topLoading ? (
              <div className="flex items-center gap-3 text-gray-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching ranked contractors…
            </div>
            ) : ranked.length === 0 ? (
              <div className="ts-tile p-6 text-sm text-gray-300">
              No contractors found for that occupation in the selected county yet.
            </div>
            ) : (
              <div className="grid gap-3">
                {ranked.map((contractor, idx) => (
                  <div
                    key={contractor.id}
                    className="ts-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                  <div className="flex items-center gap-3">
                    <Badge className="bg-orange-600 text-white text-sm px-3 py-1">#{idx + 1}</Badge>
                    <div>
                      <div className="text-lg font-semibold text-white">{contractor.businessName || contractor.name || 'Contractor'}</div>
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-orange-300" />
                        {(contractor.trades && contractor.trades.join(', ')) || 'Trade not listed'}
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-teal-300" />
                        {sanitizeAreaLabel(contractor.location || contractor.county || 'County selected')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-200">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400" />
                      <span>{contractor.rating ?? 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4 text-emerald-400" />
                      <span>{contractor.recommendationCount ?? contractor.reviewCount ?? 0} recs</span>
                    </div>
                    {contractor.licenseNumber && (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-100">Licensed</Badge>
                    )}
                  </div>
                </div>
                  ))}
                </div>
              )}
            </section>

            <section className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 ts-section">
            <div className="flex items-center gap-2 text-orange-300 mb-4">
              <Search className="h-5 w-5" />
              <span className="font-semibold">Search contractors</span>
            </div>
            </div>

            <div className="ts-section space-y-4">
            <div className="flex items-center gap-2 text-teal-200">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Board at a glance</span>
            </div>
                <div className="grid grid-cols-2 gap-3">
                  {stats.map((item) => (
                    <div key={item.label} className="ts-tile p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{item.label}</div>
                  <div className="text-2xl font-semibold text-orange-200">{item.value}</div>
                </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="ts-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Quick actions</h2>
            <span className="text-sm text-gray-400">For pros and homeowners</span>
          </div>
            <div className="grid md:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <div key={action.title} className="ts-card p-4">
                <h3 className="text-lg font-semibold text-orange-200">{action.title}</h3>
                <p className="text-gray-300 text-sm mt-2">{action.desc}</p>
              </div>
              ))}
            </div>
          </section>

          <section className="ts-section">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Featured contractors</h2>
            <span className="text-sm text-gray-400">Verified and community-backed</span>
          </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="ts-card p-5">
                <h3 className="text-xl font-semibold mb-2 text-orange-300">Professional Contractor {i}</h3>
                <p className="text-gray-300 mb-4">Verified contractor with 10+ years experience</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-400">★★★★★ 4.9</span>
                  <button className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg transition-colors">
                    View profile
                  </button>
                </div>
              </div>
              ))}
            </div>
          </section>

          <section className="ts-card bg-orange-500/10 shadow-[0_0_30px_rgba(255,140,0,0.2)] p-6 text-center space-y-3">
          <h3 className="text-xl font-semibold text-orange-100">Not sure where to start?</h3>
          <p className="text-gray-100 max-w-3xl mx-auto">
            Ask Scout to draft bids, verify licenses, or queue tasks on your board. Or jump in with search, quick actions, and the featured list—no waiting on chat.
          </p>
        </section>
      </div>
    </div>
  );
});

export default FindContractors;