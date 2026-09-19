/** Read-only feature-storage inspection. Ordered migration owns creation, never a request. */
export async function inspectJwFeatureSchema(client) {
  const columns = (await client.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='feature_flags'`)).rows;
  const types = new Map(columns.map(row => [row.column_name, row.data_type]));
  const missing = [];
  for (const name of ['id','key','name','description','category','created_at','updated_at']) {
    if (!types.has(name)) missing.push('feature_flags.' + name);
  }
  if (types.get('enabled') !== 'boolean') missing.push('feature_flags.enabled:boolean');
  if (types.get('config') !== 'jsonb') missing.push('feature_flags.config:jsonb');
  const unique = await client.query(`SELECT 1 FROM pg_index i
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
    WHERE i.indrelid=to_regclass('public.feature_flags') AND i.indisunique
      AND i.indisvalid AND i.indnkeyatts=1 AND i.indpred IS NULL AND a.attname='key'`);
  if (!unique.rows.length) missing.push('feature_flags.key:unique');
  return { contract: missing.length === 0, missing };
}
