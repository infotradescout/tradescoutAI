import { useEffect, useId, useState } from "react";
import {
  EMPTY_FULFILLMENT_DETAILS, fulfillmentDetailsError, fulfillmentDetailsKey,
  localCalendarDate, parseFulfillmentDetails, type JwStoneFulfillmentDetails,
} from "./fulfillmentDetails";

type DraftState = {
  viewerId: string;
  details: JwStoneFulfillmentDetails;
  dirty: boolean;
  writable: boolean;
  storageError: string | null;
};
function readDraft(viewerId: string): DraftState {
  const base = { viewerId, details: EMPTY_FULFILLMENT_DETAILS, dirty: false, writable: true, storageError: null };
  try {
    const raw = window.localStorage.getItem(fulfillmentDetailsKey(viewerId));
    if (raw === null) return base;
    const details = parseFulfillmentDetails(raw);
    return details ? { ...base, details } : { ...base, writable: false,
      storageError: "Saved delivery details could not be read. The saved copy is unchanged; new edits are for this visit only." };
  } catch {
    return { ...base, writable: false,
      storageError: "Browser storage is unavailable. New delivery details are for this visit only." };
  }
}

export function useJwStoneFulfillmentDetails(viewerId: string) {
  const [state, setState] = useState(() => readDraft(viewerId));
  useEffect(() => { if (state.viewerId !== viewerId) setState(readDraft(viewerId)); }, [state.viewerId, viewerId]);
  useEffect(() => {
    if (state.viewerId !== viewerId || !state.dirty || !state.writable) return;
    try {
      window.localStorage.setItem(fulfillmentDetailsKey(viewerId), JSON.stringify({ schemaVersion: 1, details: state.details }));
      setState((current) => current === state ? { ...current, dirty: false, storageError: null } : current);
    } catch {
      setState((current) => current === state ? { ...current, dirty: false,
        storageError: "These delivery details could not be saved on this browser. Keep this cart open to include them in your request." } : current);
    }
  }, [state, viewerId]);
  const active = state.viewerId === viewerId;
  return {
    details: active ? state.details : EMPTY_FULFILLMENT_DETAILS,
    storageError: active ? state.storageError : null,
    update: (patch: Partial<JwStoneFulfillmentDetails>) => setState((current) => {
      if (current.viewerId !== viewerId) return current;
      return { ...current, details: { ...current.details, ...patch }, dirty: true };
    }),
  };
}

type Props = {
  method: "pickup" | "delivery";
  details: JwStoneFulfillmentDetails;
  onChange: (patch: Partial<JwStoneFulfillmentDetails>) => void;
  storageError: string | null;
};
const fieldClass = "mt-1 min-h-11 w-full border border-[var(--jw-border)] bg-[var(--jw-surface)] px-3 text-sm text-[var(--jw-ink)]";

export function JwStoneFulfillmentDetailsFields({ method, details, onChange, storageError }: Props) {
  const id = useId();
  const error = fulfillmentDetailsError(details, method);
  return <details className="mt-4 border-t border-[var(--jw-border)] pt-2" data-testid="jw-cart-fulfillment-details">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Timing and {method === "delivery" ? "delivery" : "pickup"} details (optional)</summary>
    <div className="space-y-3 pb-2">
      <p id={`${id}-timing-help`} className="text-xs leading-5 text-[var(--jw-muted)]">These are preferences, not a confirmed appointment. JW Stone will confirm availability and timing.</p>
      <label className="block text-sm">Requested {method} date
        <input type="date" aria-label={`Requested ${method} date`} min={localCalendarDate()} value={details.requestedDate}
          aria-describedby={`${id}-timing-help${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)}
          onChange={(event) => onChange({ requestedDate: event.target.value })} className={fieldClass} />
      </label>
      <label className="block text-sm">Preferred time of day
        <select aria-label="Preferred time of day" value={details.timePreference} onChange={(event) => onChange({ timePreference: event.target.value as JwStoneFulfillmentDetails["timePreference"] })} className={fieldClass}>
          <option value="flexible">Flexible</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option>
        </select>
      </label>
      {method === "delivery" ? <>
        <label className="block text-sm">Delivery destination
          <select aria-label="Delivery destination" value={details.destinationType} onChange={(event) => onChange({ destinationType: event.target.value as JwStoneFulfillmentDetails["destinationType"] })} className={fieldClass}>
            <option value="not_specified">Not specified yet</option><option value="business">Business / fabricator shop</option><option value="jobsite">Jobsite</option><option value="residential">Residential address</option>
          </select>
        </label>
        <label className="block text-sm">Street address
          <input aria-label="Delivery street address" autoComplete="shipping address-line1" maxLength={180} value={details.addressLine} onChange={(event) => onChange({ addressLine: event.target.value })} className={fieldClass} />
        </label>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
          <label className="block min-w-0 text-sm">City<input aria-label="Delivery city" autoComplete="shipping address-level2" maxLength={100} value={details.city} onChange={(event) => onChange({ city: event.target.value })} className={fieldClass} /></label>
          <label className="block text-sm">State<input aria-label="Delivery state" autoComplete="shipping address-level1" autoCapitalize="characters" maxLength={2} value={details.stateCode} onChange={(event) => onChange({ stateCode: event.target.value.toUpperCase() })} className={fieldClass} /></label>
        </div>
        <label className="block text-sm">Unloading arrangements
          <select aria-label="Unloading arrangements" value={details.unloading} onChange={(event) => onChange({ unloading: event.target.value as JwStoneFulfillmentDetails["unloading"] })} className={fieldClass}>
            <option value="not_specified">Not sure yet</option><option value="equipment_available">Equipment available — confirm requirements</option><option value="needs_arrangement">Need help arranging unloading</option>
          </select>
        </label>
      </> : null}
      <label className="block text-sm">{method === "delivery" ? "Delivery" : "Pickup"} notes
        <textarea aria-label={`${method === "delivery" ? "Delivery" : "Pickup"} notes`} maxLength={500} rows={3} value={details.notes}
          onChange={(event) => onChange({ notes: event.target.value })} placeholder="Access restrictions, receiving hours, or other details" className={`${fieldClass} py-2`} />
      </label>
      {error ? <p id={`${id}-error`} role="alert" className="text-xs">{error}</p> : null}
      {storageError ? <p role="status" className="text-xs">{storageError}</p> : null}
    </div>
  </details>;
}
