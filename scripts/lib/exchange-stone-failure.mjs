/** Closed diagnostic vocabulary. Never return driver messages, SQL, URLs or inputs.
 * A failure is NOT evidence of rollback: an uncertain commit must be reconciled.
 */
const messageCodes = new Map([
  ['Unknown stone launch mode', 'launch_mode_invalid'],
  ['Stone launch is restricted to the verified TradeScout production service', 'launch_target_rejected'],
  ['Existing publication and stable buyer-metrics signing configuration required', 'launch_signing_missing'],
  ['Production database is missing', 'database_missing'],
  ['An explicit secured database connection is required', 'database_missing'],
  ['PostgreSQL connection URL is invalid', 'database_url_invalid'],
  ['Database connection URL must use postgres:// or postgresql://', 'database_url_invalid'],
  ['Remote PostgreSQL connections may not disable certificate verification', 'database_tls_rejected'],
  ['Stone launch database identity mismatch', 'database_target_rejected'],
  ['Database target differs from the operator-reviewed host/database', 'database_target_rejected'],
  ['Connected database mismatch', 'database_identity_rejected'],
  ['Server database identity does not match reviewed target', 'database_identity_rejected'],
  ['Existing launch receipt conflicts; no import performed', 'launch_receipt_conflict'],
  ['Launch URL is not an authorized connector download', 'package_url_rejected'],
  ['Launch download failed', 'package_download_failed'],
  ['Launch download length mismatch', 'package_size_mismatch'],
  ['Launch download exceeds its approved size', 'package_size_mismatch'],
  ['Launch download does not match approved bytes', 'package_hash_mismatch'],
  ['Launch archive identity mismatch', 'package_hash_mismatch'],
  ['Exactly one existing TradeScout seller setting must match the reviewed seller', 'seller_setting_mismatch'],
  ['The reviewed published TradeScout profile does not belong to the configured seller', 'seller_profile_mismatch'],
  ['The active canonical stone category is missing or ambiguous', 'stone_category_mismatch'],
  ['TradeScout seller does not currently meet canonical exposure authority', 'seller_exposure_rejected'],
  ['Configured TradeScout seller account is missing', 'seller_missing'],
  ['Verified TradeScout seller, location, category and signing configuration required', 'seller_configuration_incomplete'],
  ['Canonical importer receipt is missing', 'importer_receipt_missing'],
  ['Canonical importer receipt is incomplete', 'importer_receipt_invalid'],
  ['Importer receipt material set mismatch', 'importer_material_set_mismatch'],
  ['Read-only importer returned an invalid receipt', 'dry_run_receipt_invalid'],
  ['Apply receipt does not match the approved dry run', 'apply_receipt_mismatch'],
  ['Apply requires the exact reviewed nonempty dry-run plan', 'apply_plan_mismatch'],
  ['Committed publication read-back differs from approved inputs', 'publication_readback_mismatch'],
  ['Stored listing/photo read-back failed', 'publication_readback_mismatch'],
]);
const driverCodes = new Map([
  ['28P01', 'database_authentication_failed'], ['3D000', 'database_not_found'],
  ['42P01', 'database_table_missing'], ['42703', 'database_column_missing'],
  ['42501', 'database_permission_denied'], ['23502', 'database_required_value_missing'],
  ['23503', 'database_reference_conflict'], ['23505', 'database_unique_conflict'],
  ['40001', 'database_serialization_conflict'], ['40P01', 'database_deadlock'],
  ['55P03', 'database_lock_timeout'], ['57014', 'database_statement_timeout'],
  ['ECONNREFUSED', 'connection_refused'], ['ECONNRESET', 'connection_reset'],
  ['ENOTFOUND', 'host_resolution_failed'], ['EAI_AGAIN', 'host_resolution_failed'],
  ['ETIMEDOUT', 'operation_timed_out'], ['ENOENT', 'required_file_missing'],
  ['ENOBUFS', 'importer_output_limit'], ['ERR_INVALID_URL', 'url_invalid'],
]);
const allowed = new Set([...messageCodes.values(), ...driverCodes.values(),
  'unknown_failure', 'importer_process_failed', 'importer_terminated', 'importer_receipt_malformed']);
const processCodes = new WeakMap();

export function stoneFailureCode(error) {
  try {
    if (error && processCodes.has(error)) return processCodes.get(error);
    return messageCodes.get(error?.message) || driverCodes.get(error?.code) || 'unknown_failure';
  } catch { return 'unknown_failure'; }
}

/** Child stderr is untrusted. Accept exactly one closed-vocabulary record, never
 * copy other fields, surrounding output, stack traces or a credential-bearing URL.
 */
export function stoneImporterProcessError(result) {
  let code = 'importer_process_failed';
  if (result?.error) code = driverCodes.get(result.error.code) || code;
  else if (result?.signal) code = 'importer_terminated';
  else if (typeof result?.stderr === 'string' && result.stderr.length <= 2000000) {
    const lines = result.stderr.split(/\r?\n/).filter(line => line.startsWith('STONE_IMPORT_FAILED '));
    if (lines.length === 1 && lines[0].length < 300) {
      try {
        const record = JSON.parse(lines[0].slice('STONE_IMPORT_FAILED '.length));
        if (record.confirmed === false && allowed.has(record.code)) code = record.code;
      } catch { /* Keep the bounded generic failure code. */ }
    }
  }
  const error = new Error('Canonical stone importer did not confirm this operation');
  processCodes.set(error, code);
  return error;
}

export function readStoneImporterReceipt(result) {
  if (result?.status !== 0 || result?.error || result?.signal) throw stoneImporterProcessError(result);
  const start = typeof result.stdout === 'string' ? result.stdout.indexOf('{\n') : -1;
  if (start < 0) throw new Error('Canonical importer receipt is missing');
  try { return JSON.parse(result.stdout.slice(start)); }
  catch {
    const error = new Error('Canonical importer receipt is malformed');
    processCodes.set(error, 'importer_receipt_malformed');
    throw error;
  }
}
