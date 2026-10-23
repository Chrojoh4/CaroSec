import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPremiumHtml} from '../src/domain/public-premium.js';

test('public premium renderer requires a published projection and escapes host content',()=>{
 const value={kind:'public_entry_edition',publicationReady:true,version:2,configuration:{title:'<script>bad</script>',host:'Host',events:[{round:1,dayId:'2027-04-17',format:'Regular',level:'Novice',levels:['B'],judge:'Judge',basis:'dog',fee:{cents:2500},feoFee:{cents:2000}}]},content:{waiver:'<img src=x onerror=alert(1)>'}};
 const withoutFeo=structuredClone(value);withoutFeo.configuration.events[0].feoFee=null;assert.ok(publicPremiumHtml(withoutFeo).includes('FEO not offered'));
 const html=publicPremiumHtml(value);assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('$25.00'));assert.equal(html.includes('<script>'),false);
 for(const forged of [{...value,publicationReady:false},{...value,kind:'private_review_copy'},{...value,configuration:null}])assert.throws(()=>publicPremiumHtml(forged),/unavailable/);
});

test('published judge amendments show latest attending judge, keep original fees, and escape public notices',()=>{
 const value={kind:'public_entry_edition',publicationReady:true,version:1,configuration:{title:'Trial',events:[{id:'round-a',round:1,judge:'Original Judge',levels:[],fee:{cents:2400}}]},judgeAmendments:[{eventId:'round-a',round:1,version:1,officiatingJudge:'Replacement',resultsJudge:'Original Judge',notice:'<script>private</script>',recordedAt:'2026-10-23T20:00:00Z'},{eventId:'round-a',round:1,version:2,officiatingJudge:'Second Replacement',resultsJudge:'Original Judge',notice:'Updated public notice'}]};
 const html=publicPremiumHtml(value);assert.ok(html.includes('Second Replacement<br>Results credit: Original Judge'));assert.ok(html.includes('$24.00'));assert.ok(html.includes('&lt;script&gt;'));assert.equal(html.includes('<script>'),false);assert.equal(value.configuration.events[0].judge,'Original Judge');
});
