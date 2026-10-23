import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDraft } from '../web/sample.js';
import { validatePremium, publishEdition, renderPremium, sourceKey } from '../src/domain/premium.js';

function reviewed() {
  return { ...sampleDraft(), entryPdfUrl:'https://example.com/test-entry.pdf',fictional: false, approved: true, trialNumber: 'TEST-ONLY', approvalEvidence: 'Fictional test evidence', reviewed: true, waiver: 'Host-reviewed test agreement' };
}
test('fictional draft cannot be saved as an approved edition', () => {
  assert.throws(() => publishEdition(sampleDraft(), []), /approval/);
  assert.ok(validatePremium(sampleDraft()).some(error => error.includes('sample')));
});
test('approval requires both a number and evidence independently of review', () => {
  for (const patch of [{ trialNumber: '' }, { approved: false }, { approvalEvidence: '' }, { reviewed: false }]) {
    assert.ok(validatePremium({ ...reviewed(), ...patch }).length > 0);
  }
});
test('editions preserve their original contents and changes need a new edition', () => {
  const draft = reviewed();
  const first = publishEdition(draft, [], '2026-10-19T01:00:00Z');
  assert.throws(() => publishEdition(draft, [first]), /already/);
  draft.fees[0].cents = 3300;
  assert.equal(first.snapshot.fees[0].cents, 2500);
  assert.notEqual(sourceKey(draft), first.sourceKey);
  const second = publishEdition(draft, [first]);
  assert.equal(second.version, 2);
  assert.equal(second.snapshot.fees[0].cents, 3300);
});
test('invalid dates, missing judges, Working offerings and negative fees stop review', () => {
  for (const mutate of [
    draft => draft.opens = '2026-12-01',
    draft => draft.date = '2026-02-30',
    draft => draft.timezone = 'not/a-zone',
    draft => draft.events[0].judge = '',
    draft => draft.events.at(-1).exercises = '',
    draft => draft.fees[0].cents = -100,
  ]) {
    const draft = reviewed(); mutate(draft); assert.ok(validatePremium(draft).length > 0);
  }
});
test('user HTML and unsafe entry links cannot inject scripts in premium exports', () => {
  const draft = reviewed(); draft.title = '<img src=x onerror=alert(1)>'; draft.entryUrl = 'javascript:alert(1)';
  const html = renderPremium(draft, { standalone: true });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(validatePremium(draft).some(error => error.includes('URL')));
});
test('preview and edition use the same explicit CAD prices, units and official rounds', () => {
  const draft = reviewed();
  const html = renderPremium(draft, { version: 1 });
  assert.ok(html.includes('$25.00'));
  assert.ok(html.includes('per exercise'));
  assert.ok(html.includes('EDITION 1'));
  assert.ok(html.includes('round-pill">5'));
  assert.ok(!html.includes('PRIVATE DRAFT'));
});

test('private premium testing links are explicit and excluded from distributed exports',()=>{
 const draft=sampleDraft();const preview=renderPremium(draft,{secretaryPreview:true});assert.ok(preview.includes('#secretary-online-entry-preview'));assert.ok(preview.includes('#secretary-paper-entry-preview'));assert.ok(preview.includes('PRIVATE PROOF'));
 assert.equal(renderPremium(draft,{standalone:true}).includes('#secretary-paper-entry-preview'),false);
});

test('downloaded private premium retains usable authenticated proof links',()=>{
 const html=renderPremium(sampleDraft(),{standalone:true,secretaryLinks:{online:'https://carosec.vercel.app/?trial=example&view=entry-preview',paper:'https://carosec.vercel.app/?trial=example&view=entry-paper-proof'}});
 assert.ok(html.includes('view=entry-preview'));assert.ok(html.includes('view=entry-paper-proof'));assert.ok(html.includes('Secretary testing links'));assert.equal(html.includes('href="#secretary-'),false);
});
