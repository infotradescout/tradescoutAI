# Integrating Bot Crawl Demand Signals into LISA and Admin Livestream

## Objective
Enable TradeScout's LISA (Live Indexed Signal Adapter) and the admin observability livestream to surface actionable bot crawl demand signals alongside marketplace, contractor, and community signals.

---

## 1. Log Instrumentation

**Expand your request logging to include:**
- timestamp
- request_id
- ip
- user_agent
- method
- host
- path
- query_string
- status_code
- response_time_ms
- response_bytes
- referer
- accept_language
- cache_status
- route_name
- is_bot
- bot_family
- canonical_url
- matched_template

**Minimum viable fields:**
- path
- query_string
- status_code
- referer
- method
- bot_family

---

## 2. Data Storage

**Create a `bot_observation_events` table:**
```sql
CREATE TABLE bot_observation_events (
  timestamp TIMESTAMP,
  bot_family TEXT,
  path TEXT,
  route_family TEXT,
  status_code INT,
  response_bytes INT,
  response_time_ms INT,
  referer TEXT,
  is_first_seen_url BOOLEAN,
  is_recrawl BOOLEAN,
  content_type TEXT,
  canonical_url TEXT,
  county TEXT,
  state TEXT,
  trade TEXT,
  entity_type TEXT,
  entity_slug TEXT
);
```

**Aggregate daily:**
```sql
CREATE TABLE bot_observation_daily_agg AS
SELECT
  DATE(timestamp) AS date,
  route_family,
  county,
  state,
  trade,
  bot_family,
  COUNT(*) AS hits,
  COUNT(DISTINCT path) AS unique_urls,
  AVG(response_time_ms) AS avg_response_time_ms,
  AVG(response_bytes) AS avg_response_bytes,
  SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) AS status_200_count,
  SUM(CASE WHEN status_code = 404 THEN 1 ELSE 0 END) AS status_404_count,
  SUM(is_recrawl::int) AS recrawl_urls,
  SUM(is_first_seen_url::int) AS first_seen_urls
FROM bot_observation_events
GROUP BY 1,2,3,4,5,6;
```

---

## 3. LISA Integration

**Extend LISA's data synthesis pipeline:**
- Add a new signal category: `bot_crawl_signals`.
- In the LISA feed generator (e.g., `getLisaFeed()`), query the daily aggregates and synthesize insights such as:
  - Top crawled route families
  - Top crawled counties/trades
  - Fastest recrawled pages
  - New URLs discovered by bots
  - Heavily crawled 404s (missing content)
- Example LISA feed item:
```json
{
  "id": "bot-demand-2026-03-13-county-AL-Mobile",
  "priority": "high",
  "scopeType": "county",
  "scopeRef": "AL-Mobile",
  "sourceKind": "bot_crawl_signals",
  "headline": "High bot crawl demand for concrete contractors in Mobile County, AL",
  "narrative": "Bingbot and Googlebot recrawled /alabama/mobile/concrete-contractors 12 times in the last 24h, indicating strong search demand.",
  "evidence": ["/alabama/mobile/concrete-contractors", "bot_family: Bingbot, Googlebot"],
  "freshnessMinutes": 15
}
```

---

## 4. Admin Livestream Display

- Update the admin observability UI (e.g., `admin-observability.tsx`) to:
  - Display `bot_crawl_signals` alongside other LISA feed items.
  - Allow filtering or highlighting by signal type (marketplace, contractor, community, bot_crawl).
  - Show top crawled routes, counties, and trades in real time.

---

## 5. Example Signal Synthesis Logic (Pseudo-code)

```js
// In getLisaFeed()
const botSignals = await getBotCrawlAggregates({ since: '24h' });
const feedItems = botSignals.map(signal => ({
  id: `bot-demand-${signal.date}-${signal.route_family}-${signal.county}`,
  priority: signal.hits > 10 ? 'high' : 'medium',
  scopeType: 'county',
  scopeRef: signal.county,
  sourceKind: 'bot_crawl_signals',
  headline: `High bot crawl demand for ${signal.route_family} in ${signal.county}`,
  narrative: `${signal.bot_family} recrawled ${signal.route_family} ${signal.hits} times in the last 24h.`,
  evidence: [signal.route_family, `bot_family: ${signal.bot_family}`],
  freshnessMinutes: 15
}));
```

---

## 6. Next Steps
1. Instrument request logging with the required fields.
2. Build the `bot_observation_events` and daily aggregate tables.
3. Extend LISA's feed generator to include bot crawl signals.
4. Update the admin livestream UI to surface these signals.

---

**Result:**
Your admin livestream will now show real-time bot crawl demand signals, giving you and your team actionable insight into what search engines believe is most important and where emerging demand is surfacing on your platform.
