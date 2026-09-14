import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readReceivingDraft, writeReceivingDraft, ReceivingDraftConflict } from '../client/src/features/jw-stone/jwStoneReceivingDraftStore.ts';
const blank = () => ({fields:{},photos:[],frozenReceipt:null});
for (const id of ['', ' ', ' staff ', 'x'.repeat(257)]) {
  test(`reject invalid employee key ${JSON.stringify(id.slice(0,12))}`, async () => {
    await assert.rejects(readReceivingDraft(id), /signed-in employee/);
  });
}
test('reject arbitrary fields before opening storage', async () => {
  await assert.rejects(writeReceivingDraft('staff',0,{...blank(),fields:{isEmployee:'true'}}),/draft is invalid/);
});
test('reject oversized photos without a write', async () => {
  await assert.rejects(writeReceivingDraft('staff',0,{...blank(),photos:[new File([new Uint8Array(10485761)],'too-large.jpg')]}),/draft is invalid/);
});
test('reject file-shaped JSON in place of real File bytes', async () => {
  await assert.rejects(writeReceivingDraft('staff',0,{...blank(),photos:[{name:'fake.jpg',size:2}]}),/draft is invalid/);
});
test('reject more than eight photos', async () => {
  await assert.rejects(writeReceivingDraft('staff',0,{...blank(),photos:Array.from({length:9},()=>new File(['x'],'x.jpg'))}),/draft is invalid/);
});
test('reject invalid revision values without a write', async () => {
  for(const revision of [-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER]) await assert.rejects(writeReceivingDraft('staff',revision,blank()),/Invalid receiving draft revision/);
});
test('unsupported storage never reports a successful save', async () => {
  assert.equal(typeof globalThis.indexedDB,'undefined');
  await assert.rejects(readReceivingDraft('staff'), /cannot save receiving photos/);
  await assert.rejects(writeReceivingDraft('staff',0,blank()), /cannot save receiving photos/);
});
test('conflicts tell the employee to recover the newer draft', () => {
  assert.match(new ReceivingDraftConflict().message,/changed in another tab/);
});
test('reject non-object field collections', async () => {
  for(const fields of [true, 1, [], 'text']) await assert.rejects(writeReceivingDraft('staff',0,{...blank(),fields}), /draft is invalid/);
});
