import { useEffect, useState, type FormEvent } from "react";
import { selectedStoneAudienceSearch } from "./stonePublicUrls";

const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

/** Buyer eligibility is requested separately; it never gates public listing text, photographs or sharing. */
export function ExchangeListingMarketSelector({ listingPath, selectedSearch, navigate }: {
  listingPath: string; selectedSearch: string | null; navigate: (path: string) => void;
}) {
  const params = new URLSearchParams(selectedSearch || "");
  const [state, setState] = useState(params.get("audienceState") || "");
  const [city, setCity] = useState(params.get("audienceCity") || "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const selected = new URLSearchParams(selectedSearch || "");
    setState(selected.get("audienceState") || "");
    setCity(selected.get("audienceCity") || "");
    setMessage(null);
  }, [selectedSearch, listingPath]);
  async function apply(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams({ audienceState: state, audienceCountry: "US" });
    if (city.trim()) query.set("audienceCity", city.trim());
    const search = selectedStoneAudienceSearch(query.toString());
    if (!search) { setMessage("Choose a valid U.S. state and include the city for Florida."); return; }
    setPending(true); setMessage(null);
    try {
      // Reuse the existing buyer-market session binding; never use the globally readable projection as purchase authority.
      const response = await fetch(`/api/exchange/stone${search}`, { credentials: "include" });
      if (!response.ok) throw new Error("Purchase-area verification is temporarily unavailable.");
      const result = await response.json();
      if (result.audience !== "eligible") {
        setMessage("This listing is public, but TradeScout stone purchasing is not available for this area. Pensacola, Florida is excluded.");
        return;
      }
      navigate(listingPath + search);
      setMessage("Purchase area selected. Availability and final terms still require confirmation.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to verify purchase area."); }
    finally { setPending(false); }
  }
  return <details className="rounded-lg border border-white/15 p-3 text-sm" open={!selectedSearch}>
    <summary className="cursor-pointer min-h-11 py-2">{selectedSearch ? "Purchase area selected — change area" : "Select a purchase area to send a request"}</summary>
    <p className="mb-3 text-white/60">The listing is visible everywhere. Purchasing is available in eligible U.S. areas, excluding Pensacola, Florida.</p>
    <form onSubmit={apply} className="grid gap-2 sm:grid-cols-2">
      <label>State<select aria-label="Purchase state" className="block min-h-11 w-full rounded border border-white/20 bg-tsCard p-2" required value={state} onChange={event => setState(event.target.value)}><option value="">Select state</option>{[...new Set(STATES)].map(code => <option key={code} value={code}>{code}</option>)}</select></label>
      <label>City{state === "FL" ? " (required)" : ""}<input aria-label="Purchase city" className="block min-h-11 w-full rounded border border-white/20 bg-tsCard p-2" autoComplete="address-level2" maxLength={160} required={state === "FL"} value={city} onChange={event => setCity(event.target.value)} /></label>
      <button type="submit" disabled={pending} className="min-h-11 rounded bg-ts-orange px-3 py-2 font-semibold text-white sm:col-span-2">{pending ? "Checking area…" : "Use this purchase area"}</button>
    </form>
    {message && <p role="status" className="mt-2 text-white/75">{message}</p>}
  </details>;
}
