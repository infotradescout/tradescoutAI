import { memo } from 'react';
import { Search, Compass, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const FindContractors = memo(function FindContractors() {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/50 bg-orange-500/10 px-3 py-1.5 text-sm text-orange-200">
            <Zap className="h-4 w-4" />
            <span>Use Scout or go manual — same full experience</span>
          </div>
          <h1 className="text-4xl font-bold text-white">Find contractors and run your board</h1>
          <p className="text-gray-300 max-w-3xl">
            Search your county, browse pros, and manage work in one place. Scout can automate the hunt, but every tool also works without the LLM.
          </p>
        </header>

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 text-orange-300 mb-4">
              <Search className="h-5 w-5" />
              <span className="font-semibold">Search contractors</span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="Enter your location"
                className="bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500"
              />
              <select className="bg-navy-700 text-white p-3 rounded border border-navy-600 focus:border-orange-500">
                <option>Select trade type</option>
                <option>Plumbing</option>
                <option>Electrical</option>
                <option>HVAC</option>
                <option>Roofing</option>
                <option>Flooring</option>
              </select>
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-orange-600 shadow-lg hover:from-orange-600 hover:to-orange-700 text-white px-6 py-3 text-sm rounded-xl flex items-center gap-2 font-semibold transition-all border border-orange-400/30 focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Button>
            </div>
            <div className="mt-4 text-sm text-gray-300 flex items-center gap-2">
              <Compass className="h-4 w-4 text-teal-200" />
              <span>Or ask Scout: "Find licensed roofers in Fulton County who start this week."</span>
            </div>
          </div>

          <div className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/20 space-y-4">
            <div className="flex items-center gap-2 text-teal-200">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Board at a glance</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-xl border border-navy-700 bg-navy-900/60 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{item.label}</div>
                  <div className="text-2xl font-semibold text-orange-200">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Quick actions</h2>
            <span className="text-sm text-gray-400">For pros and homeowners</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {quickActions.map((action) => (
              <div key={action.title} className="bg-navy-900/70 border border-navy-700 rounded-xl p-4 hover:border-orange-400/50 transition-colors">
                <h3 className="text-lg font-semibold text-orange-200">{action.title}</h3>
                <p className="text-gray-300 text-sm mt-2">{action.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-navy-700 bg-navy-800/80 p-6 shadow-xl shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">Featured contractors</h2>
            <span className="text-sm text-gray-400">Verified and community-backed</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-navy-900/70 border border-navy-700 p-5 rounded-xl">
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

        <section className="rounded-2xl border border-orange-400/40 bg-orange-500/10 p-6 text-center space-y-3">
          <h3 className="text-xl font-semibold text-orange-100">Not sure where to start?</h3>
          <p className="text-gray-100 max-w-3xl mx-auto">
            Ask Scout to draft bids, verify licenses, or queue tasks on your board. Prefer manual? Use the search, quick actions, and featured list without ever opening chat.
          </p>
        </section>
      </div>
    </div>
  );
});

export default FindContractors;