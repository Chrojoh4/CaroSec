import test from 'node:test';import assert from 'node:assert/strict';
import {draftFeeDefaults,feeKind} from '../src/domain/fee-defaults.js';import {draftEntryPreview} from '../src/domain/entry-preview.js';import {hostedPremium} from '../src/domain/hosted-premium.js';
const fees=[{label:'Competitive Rally',cents:2400,unit:'per dog / event'},{label:'FEO Rally',cents:1600,unit:'per dog / event',kind:'feo',offered:false},{label:'Team',cents:1200,unit:'per team event entry'}];
test('CARO trial defaults populate Rally and Team independently; FEO needs an explicit host choice',()=>{
 const before=JSON.stringify(fees);assert.equal(feeKind(fees[0]),'regular');const regular=draftFeeDefaults({format:'Regular'},fees);assert.equal(regular.fee.cents,2400);assert.equal(regular.basis,'dog');assert.equal(regular.feoFee,null);
 const team=draftFeeDefaults({format:'Team'},fees);assert.equal(team.fee.cents,1200);assert.equal(team.basis,'entry');
 const enabled=structuredClone(fees);enabled[1].offered=true;assert.equal(draftFeeDefaults({format:'Regular'},enabled).feoFee.cents,1600);
 assert.equal(JSON.stringify(fees),before);
});
test('ambiguous defaults and missing Working prices are left for review; round FEO exceptions survive defaults',()=>{
 assert.equal(draftFeeDefaults({format:'Regular'},[...fees,{...fees[0],cents:2600}]).fee,null);
 assert.equal(draftFeeDefaults({format:'Working'},fees).fee,null);assert.equal(draftFeeDefaults({format:'Working'},fees).basis,'exercise');
 const enabled=structuredClone(fees);enabled[1].offered=true;
 assert.equal(draftFeeDefaults({format:'Regular'},enabled,{fee:fees[0],feoFee:null,basis:'dog'}).feoFee,null);
 assert.equal(draftFeeDefaults({format:'Regular'},fees,{fee:fees[0],feoFee:fees[1],basis:'dog'}).feoFee.cents,1600);
});
test('disabled trial FEO is not advertised in premium but keeps its saved amount for re-enabling',()=>{
 const trial={id:'t',title:'Draft',planning:{events:[{id:'e',format:'Regular',level:'Advanced',stream:'B C'}]}};
 assert.equal(hostedPremium(trial,{fees}).fees.some(f=>f.label==='FEO Rally'),false);
 const preview=draftEntryPreview(trial,{fees});assert.equal(preview.events[0].fee.cents,2400);assert.equal(preview.events[0].feoFee,null);
 assert.equal(fees[1].cents,1600);
});

test('unconfirmed Team units remain flagged until the host chooses the charging unit',()=>{
 const values=[{label:'Team',kind:'team',cents:1200,unit:'per team entry — confirm charging unit'}];
 assert.equal(draftFeeDefaults({format:'Team'},values).basis,'');
 assert.equal(draftFeeDefaults({format:'Team'},values,{fee:values[0],basis:'dog',feoFee:null}).basis,'dog');
});
