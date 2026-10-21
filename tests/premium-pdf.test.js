import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumPdfPacket} from '../src/domain/premium-pdf.js';
import {sampleDraft} from '../web/sample.js';

test('PDF export ignores a forged publication claim and requires both entry links for a reviewed premium',()=>{
 const draft={...sampleDraft(),publicationReady:true};assert.equal(premiumPdfPacket(draft).publicationReady,false);assert.equal(draft.publicationReady,true);
 const reviewed={...draft,fictional:false,approved:true,reviewed:true,trialNumber:'TEST',approvalEvidence:'Fictional evidence',waiver:'Reviewed host test agreement',entryPdfUrl:'https://example.com/entry.pdf'};
 assert.equal(premiumPdfPacket(reviewed).publicationReady,true);delete reviewed.entryPdfUrl;assert.equal(premiumPdfPacket(reviewed).publicationReady,false);
});
test('PDF export rejects malformed and oversized input before launching the renderer',()=>{
 assert.throws(()=>premiumPdfPacket(null),/Check/);
 assert.throws(()=>premiumPdfPacket({...sampleDraft(),events:new Array(151).fill({})}),/Check/);
 assert.throws(()=>premiumPdfPacket({...sampleDraft(),email:{forged:'value'}}),/text/);
 assert.throws(()=>premiumPdfPacket({...sampleDraft(),fees:[{label:'Fee',unit:'event',cents:1.5}]}),/fee/);
});
