import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import MarketplaceSingleListing from './marketplace-listing-single';
const MarketplaceBatchImport = lazy(() => import('./marketplace-batch-import'));

/** Preserve the existing single-listing form and route; offer batch as a second mode. */
export default function MarketplaceListing() {
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [busy, setBusy] = useState(false);
  return <>
    <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pt-4" role="group" aria-label="Listing upload mode">
      <Button type="button" variant={mode === 'single' ? 'default' : 'outline'} aria-pressed={mode === 'single'} disabled={busy} onClick={() => setMode('single')}>One listing</Button>
      <Button type="button" variant={mode === 'batch' ? 'default' : 'outline'} aria-pressed={mode === 'batch'} disabled={busy} onClick={() => setMode('batch')}>Batch upload CSV + photos</Button>
    </div>
    <div hidden={mode !== 'single'}><MarketplaceSingleListing /></div>
    {mode === 'batch' && <Suspense fallback={<p className="p-4" role="status">Loading batch upload…</p>}><MarketplaceBatchImport onBusyChange={setBusy} /></Suspense>}
  </>;
}
