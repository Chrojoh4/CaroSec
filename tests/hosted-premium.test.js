import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedPremium} from '../src/domain/hosted-premium.js';
import {renderPremium} from '../src/domain/premium.js';
test('hosted premium derives protected source fields and never invents approval or active entry links',()=>{
 const row={title:'Source trial',start_date:'2027-04-17',end_date:'2027-04-18',timezone:'America/Vancouver',planning:{host:'Source club',venue:'Source venue',events:[{id:'a',level:'Novice',format:'Regular',stream:'B',judge:'Source judge',dayId:'2027-04-17',exercises:''}]}};
 const content={title:'Forged title',approved:true,trialNumber:'FORGED',entryUrl:'https://example.com/enter',intro:'<script>alert(1)</script>',fees:[{label:'Regular',cents:2500,unit:'per dog'}]};const draft=hostedPremium(row,content);
 assert.equal(draft.title,row.title);assert.equal(draft.events[0].round,1);assert.equal(draft.approved,false);assert.equal(draft.trialNumber,'');assert.equal(draft.entryUrl,'');const html=renderPremium(draft);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('Sanctioned Rally Trial'));
});
