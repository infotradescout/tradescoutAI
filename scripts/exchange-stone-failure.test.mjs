import test from 'node:test';
import assert from 'node:assert/strict';
import { stoneFailureCode, stoneImporterProcessError, readStoneImporterReceipt } from './lib/exchange-stone-failure.mjs';

const secret = 'DO_NOT_EMIT_PRIVATE_DATABASE_PASSWORD_OR_PACKAGE_TOKEN';
for (const [message, code] of [
  ['TradeScout seller does not currently meet canonical exposure authority', 'seller_exposure_rejected'],
  ['Verified TradeScout seller, location, category and signing configuration required', 'seller_configuration_incomplete'],
  ['Launch download failed', 'package_download_failed'],
  ['Existing publication and stable buyer-metrics signing configuration required', 'launch_signing_missing'],
  ['Launch archive identity mismatch', 'package_hash_mismatch'],
  ['Apply receipt does not match the approved dry run', 'apply_receipt_mismatch'],
  ['Stored listing/photo read-back failed', 'publication_readback_mismatch'],
]) test(`classifies ${code} without copying errors`, () => {
  const error = new Error(message); error.detail = secret; error.stack = secret;
  assert.equal(stoneFailureCode(error), code);
});
for (const [driver, code] of [
  ['28P01', 'database_authentication_failed'], ['42P01', 'database_table_missing'],
  ['42703', 'database_column_missing'], ['42501', 'database_permission_denied'],
  ['40001', 'database_serialization_conflict'], ['40P01', 'database_deadlock'],
  ['57014', 'database_statement_timeout'], ['ETIMEDOUT', 'operation_timed_out'],
  ['ENOENT', 'required_file_missing'], ['ENOBUFS', 'importer_output_limit'],
]) test(`classifies driver ${driver} without its message`, () => {
  assert.equal(stoneFailureCode({ code: driver, message: secret }), code);
});
test('unknown errors, thrown strings, null and hostile getters stay private', () => {
  for (const error of [null, undefined, secret, new Error(secret), {code:secret}, {get message(){throw new Error(secret);}}]) {
    assert.equal(stoneFailureCode(error), 'unknown_failure');
  }
});
test('does not accept a fabricated diagnostic property on an arbitrary error', () => {
  assert.equal(stoneFailureCode({code:'seller_exposure_rejected',message:secret}), 'unknown_failure');
});
test('forwards only the validated child failure code', () => {
  const stderr = `${secret}\nSTONE_IMPORT_FAILED ${JSON.stringify({confirmed:false,code:'seller_exposure_rejected',detail:secret})}\n`;
  const error = stoneImporterProcessError({status:1,stderr});
  assert.equal(stoneFailureCode(error), 'seller_exposure_rejected');
  assert.equal(JSON.stringify(error).includes(secret), false);
  assert.equal(error.message.includes(secret), false);
});
for (const [name, stderr] of [
  ['invalid JSON', 'STONE_IMPORT_FAILED {not json}'],
  ['unknown code', `STONE_IMPORT_FAILED {"confirmed":false,"code":"${secret}"}`],
  ['false success', 'STONE_IMPORT_FAILED {"confirmed":true,"code":"seller_missing"}'],
  ['duplicate records', 'STONE_IMPORT_FAILED {"confirmed":false,"code":"seller_missing"}\nSTONE_IMPORT_FAILED {"confirmed":false,"code":"seller_missing"}'],
  ['oversized record', 'STONE_IMPORT_FAILED '+JSON.stringify({confirmed:false,code:'seller_missing',extra:'x'.repeat(400)})],
  ['oversized stderr', 'x'.repeat(2000001)],
]) test(`rejects ${name}`, () => {
  assert.equal(stoneFailureCode(stoneImporterProcessError({status:1,stderr})), 'importer_process_failed');
});
test('spawn timeout outranks a child record; no committed outcome is inferred', () => {
  const result={status:null,error:{code:'ETIMEDOUT',message:secret},stderr:'STONE_IMPORT_FAILED {"confirmed":false,"code":"seller_missing"}'};
  assert.throws(()=>readStoneImporterReceipt(result),error=>stoneFailureCode(error)==='operation_timed_out');
});
test('termination outranks a child record and fails even with status zero', () => {
  assert.throws(()=>readStoneImporterReceipt({status:0,signal:'SIGTERM',stdout:'{\n}'}),error=>stoneFailureCode(error)==='importer_terminated');
});
test('missing, nonzero and uncertain process status never confirms a receipt', () => {
  for (const status of [undefined,null,1,2]) assert.throws(()=>readStoneImporterReceipt({status,stdout:'{\n"mode":"applied"\n}'}));
});
test('parses a successful canonical receipt following ordinary process output', () => {
  assert.deepEqual(readStoneImporterReceipt({status:0,stdout:'startup\n{\n"mode":"dry_run","inserted":0\n}\n'}),{mode:'dry_run',inserted:0});
});
test('missing and malformed receipts expose no raw stdout', () => {
  for(const [stdout,code] of [[secret,'importer_receipt_missing'],['{\n'+secret,'importer_receipt_malformed']]) {
    assert.throws(()=>readStoneImporterReceipt({status:0,stdout}),error=>stoneFailureCode(error)===code && !error.message.includes(secret));
  }
});
