/** Read-only shape verification for the two canonical TradeScout retail migrations.
 * A ledger marker or a same-named table is not proof of its constraints.
 */
export const STONE_TABLES = ['exchange_stone_funnel_events', 'exchange_stone_inquiry_receipts'];
const [events, receipts] = STONE_TABLES;
export const STONE_COLUMNS = {
  [events]: { event_key: 'text', evidence_family: 'text', evidence_id: 'text', stage: 'text', environment: 'text', payload: 'jsonb', fingerprint: 'text', created_at: 'timestamp with time zone' },
  [receipts]: { buyer_id: 'character varying', request_key: 'text', decision_card_id: 'character varying', listing_id: 'character varying', seller_id: 'character varying', fingerprint: 'text', inquiry_id: 'character varying', response: 'jsonb', created_at: 'timestamp with time zone' },
};
// PostgreSQL canonical CHECK definitions, verified on PostgreSQL 17.8. Preserve
// grouping and literal contents; only display whitespace and ::text casts normalize.
export const STONE_CHECKS = {
  [events]: [
    "CHECK ((((stage = ANY (ARRAY['listing_view'::text, 'inquiry_started'::text])) AND (evidence_family = 'browser'::text)) OR ((stage = ANY (ARRAY['inquiry_submitted'::text, 'callback_requested'::text])) AND (evidence_family = 'saved_inquiry'::text)) OR ((stage = 'call_connected'::text) AND (evidence_family = 'connected_call'::text)) OR ((stage = 'quote_sent'::text) AND (evidence_family = 'saved_quote'::text)) OR ((stage = 'order_paid'::text) AND (evidence_family = 'settled_payment'::text))))",
    "CHECK ((environment = ANY (ARRAY['production'::text, 'test'::text])))",
    "CHECK ((evidence_family = ANY (ARRAY['browser'::text, 'saved_inquiry'::text, 'connected_call'::text, 'saved_quote'::text, 'settled_payment'::text])))",
    "CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text))",
    "CHECK ((jsonb_typeof(payload) = 'object'::text))",
    "CHECK ((stage = ANY (ARRAY['listing_view'::text, 'inquiry_started'::text, 'inquiry_submitted'::text, 'callback_requested'::text, 'call_connected'::text, 'quote_sent'::text, 'order_paid'::text])))",
  ],
  [receipts]: [
    "CHECK (((buyer_id)::text <> (seller_id)::text))",
    "CHECK ((fingerprint ~ '^[a-f0-9]{64}$'::text))",
    "CHECK (((length(request_key) >= 1) AND (length(request_key) <= 200)))",
    "CHECK ((jsonb_typeof(response) = 'object'::text))",
  ],
};
export const STONE_KEYS = [
  { table: events, kind: 'p', columns: ['event_key'] },
  { table: events, kind: 'u', columns: ['environment', 'evidence_family', 'evidence_id', 'stage'] },
  { table: receipts, kind: 'p', columns: ['buyer_id', 'request_key'] },
  { table: receipts, kind: 'u', columns: ['decision_card_id'] },
];
export const STONE_FOREIGN_KEYS = [
  ['buyer_id', 'users'], ['seller_id', 'users'], ['decision_card_id', 'decision_cards'],
  ['listing_id', 'marketplace_listings'], ['inquiry_id', 'marketplace_inquiries'],
];
export const STONE_SCHEMA_QUERY = `
SELECT
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'column', a.attname, 'type', format_type(a.atttypid,a.atttypmod),
    'notNull', a.attnotnull, 'default', pg_get_expr(d.adbin,d.adrelid)))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND c.relkind='r'), '[]'::jsonb) AS columns,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', k.conname, 'kind', k.contype,
    'validated', k.convalidated, 'deferrable', k.condeferrable,
    'definition', pg_get_constraintdef(k.oid),
    'columns', ARRAY(SELECT a.attname FROM unnest(k.conkey) WITH ORDINALITY v(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=v.attnum ORDER BY v.ord),
    'targetTable', target.relname, 'targetSchema', tn.nspname,
    'targetColumns', ARRAY(SELECT a.attname FROM unnest(k.confkey) WITH ORDINALITY v(attnum,ord)
      JOIN pg_attribute a ON a.attrelid=target.oid AND a.attnum=v.attnum ORDER BY v.ord),
    'onDelete', k.confdeltype, 'onUpdate', k.confupdtype))
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_class target ON target.oid=k.confrelid LEFT JOIN pg_namespace tn ON tn.oid=target.relnamespace
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[])), '[]'::jsonb) AS constraints,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'name', ic.relname, 'unique', i.indisunique,
    'valid', i.indisvalid, 'ready', i.indisready, 'immediate', i.indimmediate,
    'method', am.amname, 'predicate', pg_get_expr(i.indpred,i.indrelid),
    'columns', ARRAY(SELECT pg_get_indexdef(i.indexrelid,p,true) FROM generate_series(1,i.indnkeyatts) p),
    'descending', ARRAY(SELECT (i.indoption[p-1] & 1) = 1 FROM generate_series(1,i.indnkeyatts) p)))
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_class ic ON ic.oid=i.indexrelid JOIN pg_am am ON am.oid=ic.relam
    WHERE n.nspname=$1 AND c.relname=ANY($2::text[])), '[]'::jsonb) AS indexes`;

const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
// Ignore display whitespace/casts outside SQL literals, never inside them.
const normalizeCheck = value => (String(value).match(/'(?:''|[^'])*'|::text\b|\s+|[\s\S]/g) || [])
  .filter(token => token !== '::text' && !/^\s+$/.test(token)).join('');
export function stoneSchemaProblems(snapshot, schema = 'public') {
  const problems = [];
  const columns = Array.isArray(snapshot?.columns) ? snapshot.columns : [];
  const constraints = Array.isArray(snapshot?.constraints) ? snapshot.constraints : [];
  const indexes = Array.isArray(snapshot?.indexes) ? snapshot.indexes : [];
  for (const [table, expected] of Object.entries(STONE_COLUMNS)) {
    for (const [column, type] of Object.entries(expected)) {
      const found = columns.find(row => row.table === table && row.column === column);
      if (!found || found.type !== type || found.notNull !== true) problems.push(`${table}.${column}: required type/nullability missing`);
      if (column === 'created_at' && found?.default !== 'now()') problems.push(`${table}.created_at: timestamp default missing`);
    }
    for (const definition of STONE_CHECKS[table]) {
      if (!constraints.some(row => row.table === table && row.kind === 'c' && row.validated === true && normalizeCheck(row.definition) === normalizeCheck(definition))) problems.push(`${table}: required CHECK definition missing`);
    }
  }
  const validIndex = (row,table,columns,unique,descending = columns.map(() => false)) => row.table === table && same(row.columns,columns) && same(row.descending,descending) && row.unique === unique && row.valid === true && row.ready === true && row.immediate === true && row.predicate === null && row.method === 'btree';
  for (const key of STONE_KEYS) {
    if (!constraints.some(row => row.table === key.table && row.kind === key.kind && same(row.columns,key.columns) && row.validated === true && row.deferrable === false) || !indexes.some(row => validIndex(row,key.table,key.columns,true))) problems.push(`${key.table}: immediate ${key.kind} key (${key.columns.join(',')}) missing`);
  }
  for (const [column,targetTable] of STONE_FOREIGN_KEYS) {
    if (!constraints.some(row => row.table === receipts && row.kind === 'f' && same(row.columns,[column]) && row.targetTable === targetTable && row.targetSchema === schema && same(row.targetColumns,['id']) && row.validated === true && row.deferrable === false && row.onDelete === 'a' && row.onUpdate === 'a')) problems.push(`${receipts}.${column}: required foreign key missing`);
  }
  if (!indexes.some(row => validIndex(row,receipts,['buyer_id','listing_id','seller_id','fingerprint','created_at'],false,[false,false,false,false,true]))) problems.push(`${receipts}: legacy retry index missing`);
  return problems;
}
export async function assertExchangeStoneSchema(client, schema = 'public') {
  if (typeof schema !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid schema identifier');
  const result = await client.query(STONE_SCHEMA_QUERY,[schema,STONE_TABLES]);
  if (result.rows?.length !== 1) throw new Error('Stone schema inspection did not return one snapshot');
  const problems = stoneSchemaProblems(result.rows[0],schema);
  if (problems.length) throw new Error(`Exchange stone schema is not release-ready: ${problems.join('; ')}`);
  return { tables: STONE_TABLES, status: 'verified' };
}
