import { pathToFileURL } from 'node:url';

/** Aggregate-only read. Stored timestamps are UTC; the runner pins its session timezone. */
export const REQUEST_STAGES_SQL = `
WITH bounds AS (
  SELECT $1::timestamptz AS first_at, $2::timestamptz AS last_at
), requests AS (
  SELECT w.id, w.created_at
  FROM public.work_requests w, bounds b
  WHERE w.created_at >= b.first_at AND w.created_at < b.last_at
), raw_links AS (
  SELECT DISTINCT w.id AS request_id,
    nullif(trim(e.metadata->>'entryRequestId'),'') AS entry_id,
    nullif(lower(trim(e.metadata->>'businessSlug')),'') AS business_slug
  FROM requests w JOIN public.work_request_events e ON e.work_request_id=w.id
  CROSS JOIN bounds b
  WHERE e.type='created' AND e.created_at >= w.created_at AND e.created_at < b.last_at
), unique_links AS (
  SELECT request_id,min(entry_id) AS entry_id,min(business_slug) AS business_slug
  FROM raw_links GROUP BY request_id
  HAVING count(*)=1 AND min(entry_id) IS NOT NULL AND min(business_slug) IS NOT NULL
), landings AS (
  SELECT e.id,e.created_at,e.data,
    nullif(trim(e.data->>'entryRequestId'),'') AS entry_id,
    nullif(lower(trim(e.data->>'businessSlug')),'') AS business_slug
  FROM public.events e,bounds b
  WHERE e.event_type='discovery_landing'
    AND e.created_at >= b.first_at - interval '30 days' AND e.created_at < b.last_at
), linked AS (
  SELECT DISTINCT ON(w.id) w.id AS request_id,w.created_at,
    l.entry_id,l.business_slug,l.data AS landing_data
  FROM requests w JOIN unique_links k ON k.request_id=w.id
  JOIN landings l ON l.entry_id=k.entry_id AND l.business_slug=k.business_slug
    AND l.created_at <= w.created_at AND l.created_at >= w.created_at - interval '30 days'
  ORDER BY w.id,l.created_at DESC,l.id
), sourced AS (
  SELECT l.*,
    CASE
      WHEN lower(trim(coalesce(landing_data->>'sourceHint',''))) IN ('google','google.com','bing','bing.com','duckduckgo','duckduckgo.com') THEN 'search_labeled'
      WHEN lower(trim(coalesce(landing_data->>'sourceHint',''))) IN ('chatgpt','chatgpt.com','openai','openai.com','perplexity','perplexity.ai','claude','claude.ai') THEN 'ai_labeled'
      WHEN nullif(trim(landing_data->>'sourceHint'),'') IS NOT NULL THEN 'other_labeled'
      WHEN lower(trim(coalesce(landing_data->>'referrerHost',''))) ~ '(^|\\.)(google\\.com|google\\.co\\.uk|bing\\.com|duckduckgo\\.com)\\.?$' THEN 'search_labeled'
      WHEN lower(trim(coalesce(landing_data->>'referrerHost',''))) ~ '(^|\\.)(chatgpt\\.com|openai\\.com|perplexity\\.ai|claude\\.ai)\\.?$' THEN 'ai_labeled'
      WHEN nullif(trim(landing_data->>'referrerHost'),'') IS NOT NULL THEN 'other_labeled'
      ELSE 'direct_or_unknown'
    END AS source_group
  FROM linked l
), actions AS (
  SELECT s.request_id,a.created_at,a.data
  FROM sourced s JOIN public.events a ON a.data->>'workRequestId'=s.request_id
  CROSS JOIN bounds b
  WHERE a.event_type='discovery_action' AND a.data->>'stage'='request_submitted'
    AND a.data->>'evidenceStrength'='direct_server_observed'
    AND a.data->>'entryLinkage'='server_observed_match'
    AND a.data->>'journeyId'='dc:'||s.request_id
    AND a.data->>'entryRequestId'=s.entry_id
    AND lower(a.data#>>'{entity,slug}')=s.business_slug
    AND a.data#>>'{entity,type}' IN ('business','profile')
    AND nullif(a.data->>'entityKey','') IS NOT NULL
    AND a.created_at >= s.created_at AND a.created_at < b.last_at
), outcomes AS (
  SELECT DISTINCT a.request_id,
    o.data->>'outcomeKind' AS kind,o.data->>'outcomeState' AS state,
    o.data->>'actorAuthority' AS authority
  FROM actions a JOIN public.events o ON o.data->>'workRequestId'=a.request_id
  CROSS JOIN bounds b
  WHERE o.event_type='discovery_outcome'
    AND o.data->>'evidenceStrength'='direct_server_observed'
    AND o.data->>'entryLinkage'='server_observed_match'
    AND o.data->>'journeyId'=a.data->>'journeyId'
    AND o.data->>'entityKey'=a.data->>'entityKey'
    AND o.data->'entity'=a.data->'entity'
    AND o.created_at >= a.created_at AND o.created_at < b.last_at
), stages AS (
  SELECT s.request_id,s.source_group,
    EXISTS(SELECT 1 FROM actions a WHERE a.request_id=s.request_id) AS submitted,
    EXISTS(SELECT 1 FROM outcomes o WHERE o.request_id=s.request_id
      AND o.kind='provider_response' AND nullif(trim(o.state),'') IS NOT NULL
      AND o.authority='authenticated_assigned_provider') AS provider_response,
    EXISTS(SELECT 1 FROM outcomes o WHERE o.request_id=s.request_id
      AND o.kind='requester_verified_complete' AND o.state='completed'
      AND o.authority='authenticated_requester') AS requester_completed
  FROM sourced s
), source_totals AS (
  SELECT source_group,count(*)::int AS linked_created_requests,
    count(*) FILTER(WHERE submitted)::int AS linked_submitted_requests,
    count(*) FILTER(WHERE provider_response)::int AS requests_with_provider_response,
    count(*) FILTER(WHERE requester_completed)::int AS requester_confirmed_completions
  FROM stages GROUP BY source_group
)
SELECT jsonb_build_object(
  'schema_version',1,
  'created_requests',(SELECT count(*) FROM requests),
  'linked_created_requests',(SELECT count(*) FROM stages),
  'unlinked_created_requests',(SELECT count(*) FROM requests)-(SELECT count(*) FROM stages),
  'requests_with_conflicting_creation_attribution',(SELECT count(*) FROM (SELECT request_id FROM raw_links GROUP BY request_id HAVING count(*)>1) c),
  'linked_submitted_requests',(SELECT count(*) FROM stages WHERE submitted),
  'requests_with_provider_response',(SELECT count(*) FROM stages WHERE provider_response),
  'requester_confirmed_completions',(SELECT count(*) FROM stages WHERE requester_completed),
  'source_groups',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY source_group) FROM source_totals s),'[]'::jsonb),
  'qualified_requests',NULL,
  'verified_unique_people',NULL,
  'search_console_impressions',NULL,
  'search_console_clicks',NULL
) AS report;
`;

export function validateWindow(from, to) {
  const pattern=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if(typeof from!=='string'||typeof to!=='string'||!pattern.test(from)||!pattern.test(to)) throw new Error('Use explicit UTC ISO --from and --to; to is exclusive.');
  const first=new Date(from),last=new Date(to);
  if(!Number.isFinite(first.getTime())||!Number.isFinite(last.getTime())||first.toISOString().slice(0,19)!==from.slice(0,19)||last.toISOString().slice(0,19)!==to.slice(0,19)) throw new Error('Invalid calendar timestamp.');
  const days=(last-first)/86400000;
  if(days<=0||days>90)throw new Error('Window must be positive and no longer than 90 days.');
  return {from:first.toISOString(),to:last.toISOString()};
}

export async function reportRequestStages(client, from, to) {
  const window=validateWindow(from,to);
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout='8s'");
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const result=await client.query(REQUEST_STAGES_SQL,[window.from,window.to]);
    if(!result.rows?.[0]?.report)throw new Error('Acquisition report unavailable.');
    await client.query('COMMIT');
    return {
      window, ...result.rows[0].report,
      definitions:{
        cohort:'Work requests created in the window; activity observed by the exclusive window end. Landing lookback is at most 30 days.',
        linked_created_requests:'One unambiguous creation attribution, matching stored landing entry and business, before request creation. Counts requests, not entry IDs.',
        linked_submitted_requests:'Matching direct-server request_submitted record with the same request, journey, entry and business. Not qualified automatically.',
        requests_with_provider_response:'A matching, later, assigned-provider response record. May include declined responses; not a hire or completed job.',
        requester_confirmed_completions:'Matching later completed requester_verified_complete event attributed to the authenticated requester. Not independently verified work or revenue.',
        qualification:'No approved qualification rule is inferred from creation, notification delivery, current status or a click.',
        source_groups:'Stored source labels only. Not proven organic causation, search clicks or unique humans. No traffic-quality filtering is asserted.',
      },
      privacy:'Aggregate output only; no request IDs, customer text, profile identifiers, query values, IPs or user agents.'
    };
  } catch(error) {await client.query('ROLLBACK').catch(()=>{});throw error;}
}

async function main(){
  const options=new Map(process.argv.slice(2).map(arg=>{const i=arg.indexOf('=');if(i<1)throw new Error('Arguments must use --name=value.');return [arg.slice(0,i),arg.slice(i+1)];}));
  for(const name of options.keys())if(!['--from','--to'].includes(name))throw new Error('Unknown argument '+name);
  validateWindow(options.get('--from'),options.get('--to'));
  if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for the read-only report.');
  const {Pool}=await import('@neondatabase/serverless');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1});
  let client;
  try{client=await pool.connect();console.log(JSON.stringify(await reportRequestStages(client,options.get('--from'),options.get('--to')),null,2));}
  finally{client?.release();await pool.end();}
}
// Bundled modules share the server entry URL. Require the actual CLI filename too.
if(process.argv[1]&&/(?:^|[\\/])report-discovery-request-stages\.mjs$/.test(process.argv[1])&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(()=>{console.error('Acquisition report failed; verify the window, database access and schema. No data was modified.');process.exitCode=1;});
}
