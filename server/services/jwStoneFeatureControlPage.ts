import type { StoredFeatures } from "./jwStoneFeatureStore";
import { JW_STONE_FEATURE_ADMIN_PATH } from "../../shared/jwStoneFeaturePolicy";
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
/** No client-side secrets, scripts, third-party requests, or automatic billing enforcement. */
export function renderJwStoneFeatureControl(state: StoredFeatures, operationId: string): string {
  const label = state.enabled ? "Sales enhancements on" : "Base site only";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>JW Stone feature access | TradeScout</title>
<style>body{font:16px/1.55 system-ui,sans-serif;margin:0;background:#111827;color:#f9fafb}main{max-width:760px;margin:auto;padding:32px 20px}section,fieldset{border:1px solid #4b5563;border-radius:12px;padding:20px;margin:20px 0}h1{font-size:1.75rem}h2{font-size:1.15rem}label{display:block;margin:14px 0}textarea{box-sizing:border-box;display:block;width:100%;min-height:90px;padding:12px;font:inherit}button{padding:12px 24px;font:inherit;font-weight:600;cursor:pointer}a{color:#fdba74}.muted{color:#d1d5db}table{width:100%;border-collapse:collapse}td,th{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid #4b5563;overflow-wrap:anywhere}code{overflow-wrap:anywhere}</style></head><body><main>
<a href="/admin">TradeScout administration</a><h1>JW Stone feature access</h1><p><strong>Current mode: ${label}</strong> · Revision ${state.revision}</p>
<section><h2>Always available</h2><p>The paid website, branding, public catalog, contact functions, accounts, Direct Connect portal and existing request history are not controlled by this switch.</p><p>Saved projects, quotes, carts and inventory records are retained. This does not cancel orders, charge anyone or change source prices.</p></section>
<form method="post" action="${JW_STONE_FEATURE_ADMIN_PATH}/form">
<input type="hidden" name="operationId" value="${escapeHtml(operationId)}"><input type="hidden" name="expectedRevision" value="${state.revision}">
<fieldset><legend>Additional sales tools</legend><p class="muted">JW Stone builders and visualization, BidRock, private pricing/cart, bundles, offers and add-on inventory/sales tools. Final release requires complete endpoint coverage.</p>
<label><input type="radio" name="mode" value="enabled" ${state.enabled ? "checked" : ""} required> Sales enhancements on</label>
<label><input type="radio" name="mode" value="base" ${state.enabled ? "" : "checked"} required> Base site only</label>
<label for="reason">Private reason for this change</label><textarea id="reason" name="note" minlength="3" maxlength="500" required></textarea>
<label><input type="checkbox" name="preserveBaseServices" value="true" required> Keep the paid base site, contact functions and Direct Connect available.</label>
<button type="submit">Save JW Stone access</button><p class="muted">Only TradeScout super administrators can save changes. The reason is never included in the public feature response. Refresh after an uncertain response rather than submitting a new operation.</p></fieldset></form>
<section><h2>Change history</h2><table><thead><tr><th>Revision / time</th><th>Mode / actor / private note</th></tr></thead><tbody>${state.audit.slice(-25).reverse().map(item => `<tr><td>${item.revision}<br>${escapeHtml(item.changedAt)}</td><td>${item.enabled ? "Enhancements on" : "Base site only"}<br><code>${escapeHtml(item.actorUserId)}</code><br>${escapeHtml(item.note)}</td></tr>`).join("") || '<tr><td colspan="2">No saved changes. Existing availability has not been changed.</td></tr>'}</tbody></table></section>
</main></body></html>`;
}
