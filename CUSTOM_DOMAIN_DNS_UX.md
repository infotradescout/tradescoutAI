# Custom Domain DNS Verification UX

**Purpose**: User-facing flow to verify custom domains for public profiles without support friction.  
**Phase**: 1 (Apex domains only)  
**Status**: Draft (Documentation-only during Phase 5 Hold)

---

## Psychological Intent (Required)
- **Target belief**: “Connecting my domain is clear, reversible, and safe.”
- **Target behavior**: Users complete verification self-serve without opening support tickets.
- **Principles**: Expectation setting, progressive disclosure, error specificity, and safety framing (public content only, no cookies).
- **Risk prevented**: Misconfiguration churn, DNS leak confusion, and support load from ambiguous errors.

---

## UI Copy — Settings → “Connect your domain”

### Step 0 — Preconditions
- Title: **Before you start**
- Bullets:
  - “You must own this domain.”
  - “Public profile only. No login or admin pages on your domain.”
  - “SSL handled automatically (or marked as ‘coming soon’ if certs aren’t live yet).”

### Step 1 — Enter domain
- Label: **Your domain**
- Placeholder: `example.com`
- Helper text: “Apex domains only for now. Subdomains and www are coming in a later phase.”
- Inline warnings:
  - If user enters `www.example.com`: “Use apex only: example.com. www support is coming in a later phase.”
  - If user enters a subdomain: “Subdomains aren’t supported yet. Use the apex (example.com).”
  - If user enters an IP: “IP addresses are not allowed. Enter a domain you own.”

### Step 2 — Choose verification method
- Title: **Verification method**
- Default: **DNS TXT (recommended)**
- Options: DNS TXT, HTML file, Meta tag
- Helper tooltip per method:
  - DNS TXT: “Best for most registrars. No site changes needed.”
  - HTML file: “Use if you control hosting. Place a single file at a known path.”
  - Meta tag: “Use if you manage the homepage HTML.”

### Step 3 — Show instructions (method-specific)
Use the active method’s panel. Always show the exact token and record/path. Phase 1 supports apex domains only.

**DNS TXT (default)**
- Record name: `_tradescout-verify.{domain}` (e.g., `_tradescout-verify.example.com`)
- Record type: `TXT`
- Record value: `{verification_token}`
- TTL hint: “Use the lowest TTL available (e.g., 300s) for faster detection.”
- Reminder: “You don’t need to point the domain to TradeScout yet. Verification checks TXT only.”

**HTML file**
- Path: `https://{domain}/.well-known/tradescout-verify.txt`
- File content: `{verification_token}` (no extra whitespace)
- Reminder: “Ensure your site serves 200 OK for this file. Avoid redirects during verification.”

**Meta tag**
- Location: In the `<head>` of `https://{domain}/`
- Tag: `<meta name="tradescout-verify" content="{verification_token}">`
- Reminder: “Remove duplicate tags; keep only one verification tag.”

### Step 4 — Verify button
- Button: **Check verification**
- Progress text: “Checking… this can take up to 60 seconds.”
- Note: “DNS propagation varies by provider. If it fails, wait a few minutes and retry.”
- Non-leak policy: “We can verify TXT even if the domain isn’t pointed at TradeScout yet.”

### Step 5 — Success state
- Title: **Domain verified**
- Body:
  - “Now point your domain to TradeScout so visitors see your profile.”
  - “If you already pointed it, you’re all set.”
- Buttons:
  - **Preview** (opens `https://{domain}` in new tab)
  - **Done** (returns to settings)

---

## Error Messages (Failure → Message → Next Action)

| Failure type | Message | Next action |
|--------------|---------|-------------|
| DNS TXT not found | “We couldn’t find the TXT record yet.” | “Confirm the record name `_tradescout-verify.{domain}` and value, then retry after propagation.” |
| DNS TXT mismatch | “Record found, but the value doesn’t match.” | “Update the TXT value to the exact token shown, then retry.” |
| DNS timeout | “DNS lookup timed out. Try again in a few minutes.” | “Retry after a few minutes; lower TTL can help.” |
| HTML 404 | “We couldn’t find the verification file at /.well-known/tradescout-verify.txt.” | “Create the file with the exact token content and ensure it serves 200 OK.” |
| HTML content mismatch | “File found, but the token doesn’t match.” | “Replace the file content with the exact token.” |
| HTML redirect loop | “Your site redirects in a loop; fix redirects and retry.” | “Temporarily disable redirects for `/.well-known/tradescout-verify.txt` until verified.” |
| Meta tag missing | “Meta tag not detected.” | “Add `<meta name=\"tradescout-verify\" content=\"{verification_token}\">` to the `<head>`.” |
| Meta tag duplicate | “Multiple verification tags found; keep only one.” | “Remove extra tags and keep a single verification tag with the current token.” |
| www entered | “Use apex domain (example.com).” | “Enter the apex without www.” |
| Subdomain entered | “Subdomains are not supported yet.” | “Use the apex (example.com).” |
| IP address entered | “IP addresses are not allowed.” | “Enter a domain you own.” |

---

## Support Article Outline

**Title:** Connect Your Domain to Your TradeScout Profile

1) Overview
- What it does: Shows your public TradeScout profile at your domain (apex only in Phase 1).
- What it does NOT do: No login, no admin, no custom code, no cookies.

2) Step-by-step (DNS TXT recommended)
- Add TXT at `_tradescout-verify.{domain}` with value `{verification_token}`.
- Wait for propagation; TTL 300s suggested.
- Click **Check verification** in TradeScout.

3) Pointing your domain
- After verification, point the domain to TradeScout (CNAME or A guidance per provider; document in Phase 2 when routing is live).
- Note: No redirects required in Phase 1; edge renders directly.

4) Common issues & fixes
- TXT not found/mismatch → confirm name/value, wait for propagation.
- HTML 404/redirects → serve the file at `/.well-known/tradescout-verify.txt` without redirects.
- Meta tag missing/duplicate → ensure single tag in `<head>`.
- Cache/TTL → lower TTL to 300s for faster updates.

5) Security notes
- Public content only; no cookies set on your domain.
- Unverified or unknown domains return 404 (no leak of existence).
- Disabled/suspended domains show branded unavailable/suspended pages (noindex).

6) Contact support (after checklist)
- Provide domain, chosen method, and screenshot of DNS/HTML/meta configuration.
- Include last verification attempt time.

---

## Alignment with Edge Routing
- Non-leak policy preserved: unverified/unknown domains return 404 with generic copy.
- Apex-only scope matches Phase 1 routing; inline warnings prevent www/subdomain cache fragmentation.
- Instructions use the same verification endpoints/tokens as schema: `_tradescout-verify.{domain}` TXT, `/.well-known/tradescout-verify.txt`, `<meta name="tradescout-verify">`.

---

## Validation Plan
- **Belief/behavior check**: Usability test with 5 users; success = complete verification without support in <10 minutes.
- **Support deflection**: Track ticket volume and first-contact resolution; target <2% of domain attempts creating tickets.
- **Copy accuracy**: Cross-check against edge routing + verification services before launch; block release if divergence found.
