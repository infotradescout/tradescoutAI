import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Hammer, Loader2, MapPin, Plus, Shield, Timer, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Page, Section } from '@/components/layout/PagePrimitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

type BoardItem = {
  id: string;
  title: string;
  trade: string;
  location: string;
  budget: string;
  owner: string;
  status: 'Scoping' | 'Bidding' | 'In Progress' | 'Punchlist';
  priority: 'High' | 'Medium' | 'Low';
  updated: string;
};

const columns: Array<{ key: BoardItem['status']; label: string; icon: JSX.Element; tone: string }> = [
  { key: 'Scoping', label: 'Scoping', icon: <ClipboardList className="h-4 w-4" />, tone: 'border-amber-500/40 bg-amber-500/5' },
  { key: 'Bidding', label: 'Bidding', icon: <TrendingUp className="h-4 w-4" />, tone: 'border-blue-500/40 bg-blue-500/5' },
  { key: 'In Progress', label: 'In Progress', icon: <Hammer className="h-4 w-4" />, tone: 'border-emerald-500/40 bg-emerald-500/5' },
  { key: 'Punchlist', label: 'Punchlist', icon: <Shield className="h-4 w-4" />, tone: 'border-purple-500/40 bg-purple-500/5' },
];

function StatTile({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: JSX.Element }) {
  return (
    <Card className="border-slate-800 bg-slate-950/70">
      <CardContent className="flex items-center gap-3 py-4 px-5">
        <div className="rounded-xl bg-slate-900 text-orange-400 p-3">{icon}</div>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-[0.08em] text-slate-400">{label}</div>
          <div className="text-2xl font-semibold text-white">{value}</div>
          <div className="text-xs text-slate-500">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BoardCard({ item }: { item: BoardItem }) {
  const priorityTone = {
    High: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
    Medium: 'bg-amber-500/15 text-amber-100 border-amber-500/30',
    Low: 'bg-emerald-500/15 text-emerald-100 border-emerald-500/30',
  }[item.priority];

  return (
    <Card className="border-slate-800 bg-slate-950/70 shadow-lg shadow-black/30">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-200">{item.id}</Badge>
          <Badge className={`text-xs ${priorityTone}`}>{item.priority} priority</Badge>
        </div>
        <CardTitle className="text-lg text-white leading-tight">{item.title}</CardTitle>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Hammer className="h-4 w-4" />
          <span>{item.trade}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <MapPin className="h-4 w-4 text-orange-400" />
          <span>{item.location}</span>
        </div>
        <Separator className="bg-slate-800" />
        <div className="flex items-center justify-between text-sm text-slate-300">
          <div className="space-y-1">
            <div className="text-slate-500">Owner</div>
            <div className="font-medium text-white">{item.owner}</div>
          </div>
          <div className="text-right space-y-1">
            <div className="text-slate-500">Budget</div>
            <div className="font-semibold text-orange-300">{item.budget}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1">
            <Timer className="h-3.5 w-3.5" />
            <span>Updated {item.updated}</span>
          </div>
          <Button variant="secondary" size="sm" className="bg-orange-600 text-white hover:bg-orange-700">
            View lane
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const ContractorBoard = () => {
  const [query, setQuery] = useState('');
  const boardItems: BoardItem[] = useMemo(() => [], []);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return boardItems.filter((item) =>
      [item.title, item.trade, item.location, item.id].some((field) => field.toLowerCase().includes(q))
    );
  }, [boardItems, query]);

  return (
    <AppShell>
      <Page className="max-w-7xl">
        <Section
          title="Contractor board"
          subtitle="Track jobs, bids, and field execution from one board. Scout keeps the operators, budget, and status aligned."
          actions={
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by job, trade, or county"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-64 bg-slate-900 border-slate-700 text-white"
              />
              <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                New job
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatTile label="Active jobs" value={`${boardItems.length}`} hint="Across your lanes" icon={<Loader2 className="h-5 w-5" />} />
            <StatTile label="In progress" value={`${boardItems.filter(i => i.status === 'In Progress').length}`} hint="Crewed and scheduled" icon={<Hammer className="h-5 w-5" />} />
            <StatTile label="Bids out" value={`${boardItems.filter(i => i.status === 'Bidding').length}`} hint="Awaiting vendor responses" icon={<TrendingUp className="h-5 w-5" />} />
            <StatTile label="Punchlist" value={`${boardItems.filter(i => i.status === 'Punchlist').length}`} hint="Ready for sign-off" icon={<CheckCircle2 className="h-5 w-5" />} />
          </div>
        </Section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => (
            <div key={column.key} className="space-y-3">
              <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${column.tone} border-slate-800/70`}>
                <div className="flex items-center gap-2 text-slate-100">
                  {column.icon}
                  <span className="font-semibold">{column.label}</span>
                </div>
                <Badge variant="outline" className="border-slate-700 text-slate-200">
                  {filtered.filter((item) => item.status === column.key).length}
                </Badge>
              </div>

              <div className="space-y-3">
                {filtered.filter((item) => item.status === column.key).map((item) => (
                  <BoardCard key={item.id} item={item} />
                ))}
                {filtered.filter((item) => item.status === column.key).length === 0 && (
                  <Card className="border-dashed border-slate-800 bg-slate-950/50">
                    <CardContent className="py-6 text-center text-sm text-slate-500">No items in this lane yet.</CardContent>
                  </Card>
                )}
              </div>
            </div>
          ))}
        </div>
      </Page>
    </AppShell>
  );
};

export default ContractorBoard;