/** Public navigation only. Existing JW server authority owns private pricing. */
export function JwStoneFabricatorPortalLink() {
  return <div className="space-y-1 rounded-lg border border-white/10 p-3">
    <a href="/u/jw-stone?profileAccount=1&profileAccountMode=signin"
      data-testid="exchange-jw-fabricator-portal-link"
      className="inline-flex min-h-11 items-center text-sm font-medium text-ts-orange underline underline-offset-4">
      JW Stone Fabricator Portal
    </a>
    <p className="text-xs text-white/60">An approved business profile and active JW Stone membership are required for fabricator pricing.</p>
  </div>;
}
