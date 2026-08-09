# Historical Discovery Performance Baseline

Status: historical pre-release baseline. This is not a release result.

- Window: `2026-07-09T18:29:33.584Z` through `2026-08-08T17:36:32.672607Z` UTC
- Release: `6a63fd41e86811815184905c0626cf64e6a904a7`
- Production activation: `2026-08-08T17:36:32.672607Z` UTC
- Published profile rows: 13
- Publicly exposable profiles: 9
- Excluded published profiles: 4
- Publicly exposable profiles crawled: 9
- Bot crawl requests to publicly exposable profiles: 5,343
- Human profile views: 1,135 across 5 publicly exposable profiles
- Discovery landing events: 38 across the historical window
- Signed attribution: not applicable before release
- Discovery conversion: not applicable before release
- Request distribution by profile: not applicable before release

## Public-exposure exclusions

- Internal admin profiles: TradeScout Admin (`tradescout-admin`) and Super Admin (`super-admin`)
- Visibility not public: Concrete Craft (`concrete-craft`)
- Trust gate not satisfied: Moulding & Millwork Supply (`moulding-millwork-supply`)

Crawler requests to excluded routes do not make those profiles publicly exposable and are not included in public discovery totals. Custom-domain HTML routes are mapped to their sole published profile; custom-domain asset requests are excluded.

## Coverage gaps among publicly exposable profiles

- Uncrawled profiles: none
- Unvisited profiles (4):
  - Pensacola Crypto (`pensacola-crypto`)
  - Ernesto Garcia (`ernesto-garcia`)
  - Jessica Gomez (`jessica-gomez`)
  - Justin Mullins (`justin-mullins`)

## Crawl request distribution by profile and crawler family

| Profile | Total | Crawler-family distribution |
| --- | ---: | --- |
| JW Stone LLC (`jw-stone`) | 5,194 | CrawlerBot 2,824; FacebookExternalHit 1,503; Googlebot 355; ChatGPT-User 123; GoogleOther 102; Bingbot 63; GPTBot 50; MetaExternalAgent 46; OAI-SearchBot 44; Google-InspectionTool 29; DuckDuckBot 26; YandexBot 8; PetalBot 5; Applebot 4; BaiduSpider 4; PerplexityBot 3; Claude-User 2; Yahoo Slurp 2; TwitterBot 1 |
| ISSA Build (`issa-build`) | 44 | PetalBot 22; Googlebot 15; ChatGPT-User 6; CrawlerBot 1 |
| Precision Aerial Services (`precision-aerial-services`) | 17 | PetalBot 16; FacebookExternalHit 1 |
| JR's Auto Glass (`jrs-auto-glass`) | 39 | PetalBot 33; Googlebot 5; CrawlerBot 1 |
| LA Plumbing Solutions (`la-plumbing-solutions`) | 35 | PetalBot 29; Googlebot 3; CrawlerBot 2; FacebookExternalHit 1 |
| Pensacola Crypto (`pensacola-crypto`) | 5 | OAI-SearchBot 3; ChatGPT-User 1; CrawlerBot 1 |
| Ernesto Garcia (`ernesto-garcia`) | 3 | Googlebot 2; Bingbot 1 |
| Jessica Gomez (`jessica-gomez`) | 3 | Bingbot 1; CrawlerBot 1; PetalBot 1 |
| Justin Mullins (`justin-mullins`) | 3 | Bingbot 1; CrawlerBot 1; Googlebot 1 |

## Aggregate crawler-family totals

| Crawler family | Requests |
| --- | ---: |
| CrawlerBot | 2,831 |
| FacebookExternalHit | 1,505 |
| Googlebot | 381 |
| ChatGPT-User | 130 |
| PetalBot | 106 |
| GoogleOther | 102 |
| Bingbot | 66 |
| GPTBot | 50 |
| OAI-SearchBot | 47 |
| MetaExternalAgent | 46 |
| Google-InspectionTool | 29 |
| DuckDuckBot | 26 |
| YandexBot | 8 |
| Applebot | 4 |
| BaiduSpider | 4 |
| PerplexityBot | 3 |
| Claude-User | 2 |
| Yahoo Slurp | 2 |
| TwitterBot | 1 |

These are aggregate crawler categories, not search impressions. ChatGPT search reporting begins after the release boundary and is limited to `OAI-SearchBot` crawl activity plus verified visits with `utm_source=chatgpt.com`. Google Search Console remains the source for impressions, clicks, queries, and pages.

No raw IP addresses, full user agents, email addresses, request content, signed envelopes, secrets, private production identifiers, or observed URL query strings are included.
