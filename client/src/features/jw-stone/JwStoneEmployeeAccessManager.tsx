import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/queryClient";
import type { JwStoneEmployeeAccount } from "@shared/jwStoneEmployeeAccess";

const BASE = "/api/u/jw-stone/receiving/staff";
const field = "mt-2 min-h-11 w-full rounded-lg border border-white/25 bg-stone-950 px-3 py-2 text-base text-white";
const button = "min-h-11 rounded-lg border border-white/25 px-4 py-2 disabled:opacity-50";
const message = (error: unknown) => error instanceof Error ? error.message : "Employee access is temporarily unavailable.";
const inherited = (account: JwStoneEmployeeAccount) => account.source === "owner" || account.source === "platform_admin";
function status(account: JwStoneEmployeeAccount): string {
  if (account.source === "owner") return "Business owner · access inherited";
  if (account.source === "platform_admin") return "Platform administrator · access inherited";
  if (account.allowed) return account.source === "server_configuration" ? "Inventory access · assigned in server settings" : "Inventory access enabled";
  return account.expired ? "Inventory access expired" : "No employee receiving access";
}
export default function JwStoneEmployeeAccessManager({ viewerId }: { viewerId: string }) {
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(false);
  const busy = useRef(false);
  const sequence = useRef(0);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [candidate, setCandidate] = useState<JwStoneEmployeeAccount | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; sequence.current++; }; }, []);
  const staff = useQuery<{ viewerId: string; accounts: JwStoneEmployeeAccount[]; truncated: boolean }>({
    queryKey: ["jw-stone", "employee-access", viewerId], enabled: open,
    queryFn: () => apiRequest("GET", BASE), staleTime: 0, gcTime: 0, retry: false,
  });
  const accounts = staff.data?.viewerId === viewerId ? staff.data.accounts : [];
  const denied = staff.error instanceof ApiError && (staff.error.status === 401 || staff.error.status === 403);
  const listReady = staff.data?.viewerId === viewerId && !staff.isError && !staff.isFetching;
  function show() { setOpen(true); dialog.current?.showModal(); }
  function close() { if (!busy.current) { dialog.current?.close(); setOpen(false); sequence.current++; setCandidate(null); setConfirmed(false); } }
  function handleDenied(cause: unknown) {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
      void queryClient.invalidateQueries({ queryKey: ["jw-stone", "receiving-access", viewerId] });
    }
  }
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || denied) return;
    busy.current = true; setSaving(true); setError(""); setNotice(""); setCandidate(null); setConfirmed(false);
    const epoch = ++sequence.current;
    try {
      const response = await apiRequest(`${BASE}/lookup`, { method: "POST", body: { email: email.trim() }, headers: { "X-JW-Receiving": "1" } }) as { viewerId: string; account: JwStoneEmployeeAccount };
      if (!alive.current || epoch !== sequence.current) return;
      if (response.viewerId !== viewerId) throw new Error("The account response changed. Sign in again before assigning access.");
      setCandidate(response.account);
    } catch (cause) { if (alive.current && epoch === sequence.current) { setError(message(cause)); handleDenied(cause); } }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }
  async function change(account: JwStoneEmployeeAccount, allowed: boolean) {
    if (busy.current || denied || inherited(account) || (allowed && (!confirmed || candidate?.userId !== account.userId))) return;
    if (!allowed && !window.confirm(`Remove JW Stone inventory access for ${account.email}? Customer membership and existing stock will not be deleted.`)) return;
    busy.current = true; setSaving(true); setError(""); setNotice("");
    const epoch = ++sequence.current;
    // Never reuse a possibly stale lookup after a timeout or conflicting manager edit.
    setCandidate(null); setConfirmed(false);
    try {
      const result = await apiRequest(BASE, { method: "PUT", body: { userId: account.userId, allowed, expectedRevision: account.revision, confirmed: true }, headers: { "X-JW-Receiving": "1" } }) as { viewerId: string; account: JwStoneEmployeeAccount };
      if (!alive.current || epoch !== sequence.current) return;
      if (result.viewerId !== viewerId || result.account.userId !== account.userId || result.account.allowed !== allowed) throw new Error("Refresh the employee list to confirm the saved access state.");
      setNotice(allowed ? `Inventory access enabled for ${account.email}. They can sign into JW Stone to receive stone.` : `Inventory access removed for ${account.email}. Subsequent employee requests are denied.`);
    } catch (cause) { if (alive.current && epoch === sequence.current) { setError(message(cause)); handleDenied(cause); } }
    finally {
      busy.current = false;
      if (alive.current) {
        setSaving(false);
        void queryClient.invalidateQueries({ queryKey: ["jw-stone", "employee-access", viewerId] });
      }
    }
  }
  return <>
    <div className="mx-auto max-w-[1600px] px-5 pb-4"><button type="button" onClick={show} className="min-h-11 rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white">Manage employee access</button></div>
    <dialog ref={dialog} aria-labelledby="jw-employee-access-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[95dvh] w-[calc(100%_-_1rem)] max-w-3xl overflow-y-auto rounded-2xl border border-white/20 bg-stone-950 p-5 text-white backdrop:bg-black/75 sm:p-8">
      <header className="flex items-start justify-between gap-4"><div><h2 id="jw-employee-access-title" className="text-2xl font-semibold">JW Stone employee access</h2><p className="mt-2 text-sm text-white/70">Assign existing accounts manually. Customer business membership does not make someone an employee.</p></div><button type="button" onClick={close} disabled={saving} className={button}>Close</button></header>
      {denied ? <p role="alert" className="mt-5">Your account no longer has permission to manage employee access.</p> : <>
        <form onSubmit={lookup} className="mt-6"><label className="font-semibold">Employee's exact sign-in email<input type="email" value={email} required autoComplete="off" maxLength={254} disabled={saving} onChange={event => { setEmail(event.target.value); setCandidate(null); setConfirmed(false); sequence.current++; }} className={field} /></label><button type="submit" disabled={saving || !email.trim()} className={`${button} mt-3`}>{saving ? "Working…" : "Find account"}</button></form>
        {candidate ? <section aria-label="Selected employee account" className="mt-5 rounded-lg border border-white/20 p-4"><h3 className="font-semibold">{candidate.name || candidate.email}</h3><p className="break-all text-sm">{candidate.email}</p><p className="mt-1 break-all text-xs text-white/60">Account ID: {candidate.userId}</p><p className="mt-2 text-sm">{status(candidate)}</p>{!candidate.allowed && !inherited(candidate) ? <><label className="mt-4 flex min-h-11 items-start gap-3"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" /><span className="text-sm">I have verified this person is authorized to receive and publish JW Stone inventory, view internal receipt costs and notes, and use inventory permissions.</span></label><button type="button" disabled={saving || !confirmed} onClick={() => void change(candidate, true)} className={`${button} mt-3`}>Grant inventory access</button></> : candidate.allowed && !inherited(candidate) ? <button type="button" disabled={saving} onClick={() => void change(candidate, false)} className={`${button} mt-3`}>Remove access</button> : null}</section> : null}
        <section className="mt-7 border-t border-white/20 pt-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Assigned accounts</h3><button type="button" disabled={saving || staff.isFetching} onClick={() => { setCandidate(null); setConfirmed(false); void staff.refetch(); }} className={button}>Refresh</button></div>{staff.isError ? <p role="alert" className="mt-3">{message(staff.error)}</p> : staff.isLoading ? <p role="status" className="mt-3">Loading employee accounts…</p> : <ul className="mt-3 space-y-3">{accounts.map(account => <li key={account.userId} className="rounded-lg border border-white/15 p-3"><p className="font-semibold">{account.name || account.email}</p><p className="break-all text-sm text-white/70">{account.email}</p><p className="mt-1 text-sm">{status(account)}</p>{account.allowed && !inherited(account) ? <button type="button" disabled={saving || !listReady} onClick={() => void change(account, false)} className={`${button} mt-3`}>Remove access</button> : null}</li>)}</ul>}{staff.data?.truncated ? <p className="mt-3 text-sm">Showing the first 500 accounts. Use exact-email lookup for another account.</p> : null}</section>
      </>}
      {error ? <p role="alert" className="mt-4 rounded-lg border border-red-400/40 p-3 text-red-100">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-lg border border-emerald-400/40 p-3 text-emerald-100">{notice}</p> : null}
      <p className="mt-6 text-xs text-white/60">Access changes are recorded. Removing access does not delete inventory, erase saved browser drafts, or cancel an upload that was already authorized. This screen does not grant business-member pricing or purchasing rights.</p>
    </dialog>
  </>;
}
