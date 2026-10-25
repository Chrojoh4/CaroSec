import test from 'node:test';
import assert from 'node:assert/strict';
import {draftEntryPreview,unsavedEntryPreview} from '../src/domain/entry-preview.js';
import {mountEntryForm} from '../web/entry-form.js';
const trial={id:'t',title:'Draft trial',start_date:'2026-11-29',end_date:'2026-11-29',timezone:'America/Vancouver',planning:{host:'Host',events:[{id:'regular',level:'Advanced',format:'Regular',stream:'B C',judge:'Judge A'},{id:'team',level:'Novice',format:'Team',stream:'',judge:'Judge B'},{id:'working',level:'Working',format:'Working',stream:'Rookie',judge:'Judge C',exercises:'Drop on Recall; Retrieve'}]}};
test('draft preview preserves source without guessing fee mappings or streams',()=>{
 const content={fees:[{label:'Regular',cents:2400}],waiver:'Reviewed source wording'},before=JSON.stringify({trial,content}),preview=draftEntryPreview(trial,content);
 assert.deepEqual(preview.events[0].levels,['B','C']);assert.deepEqual(preview.events[1].levels,['Not configured']);assert.equal(preview.events[0].previewMissingFee,true);assert.equal(preview.events[0].fee.cents,0);assert.equal(preview.events[2].exercises.length,2);assert.equal(preview.waiver,content.waiver);assert.equal(JSON.stringify({trial,content}),before);
});
test('read-only form expands conditional sections, disables every control and never registers mutation or lookup handlers',async()=>{
 const controls=[{disabled:false},{disabled:false}],submit={removed:false,remove(){this.removed=true;}},bar={textContent:''},listeners=[];
 const root={innerHTML:'',querySelectorAll(){return controls;},querySelector(selector){if(selector==='[type="submit"]')return submit;if(selector==='.entry-submit-bar')return bar;return null;},addEventListener(type,callback){listeners.push({type,callback});}};
 let submitted=false,lookedUp=false;const view=mountEntryForm(root,draftEntryPreview(trial),{readOnly:true,onSubmitted:()=>{submitted=true;},lookupResults:()=>{lookedUp=true;}});
 assert.ok(root.innerHTML.includes('Your teammate'));assert.ok(root.innerHTML.includes('Partner dog · Team / Brace'));assert.ok(root.innerHTML.includes('Drop on Recall'));assert.ok(root.innerHTML.includes('Fee assignment pending'));assert.ok(root.innerHTML.includes('Offered streams'));assert.ok(root.innerHTML.includes('B / C'));assert.equal(controls.every(c=>c.disabled),true);assert.equal(submit.removed,true);assert.deepEqual(listeners.map(l=>l.type),['submit']);let prevented=false;await listeners[0].callback({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(submitted,false);assert.equal(lookedUp,false);assert.equal(view.getModel().agree,false);assert.deepEqual(view.getModel().selections,[]);
});

test('saved draft assignments populate prices and streams but changed source or fees invalidate them',()=>{
 const content={fees:[{label:'Competitive',cents:2400,unit:'per dog'}]},event=trial.planning.events[0],row={key:event.id,source:['id','dayId','level','format','stream','judge','exercises'].map(k=>event[k]||''),levels:['B','C'],fee:content.fees[0],feoFee:{cents:1600},basis:'dog',capacity:40},setup={rows:[row],fees_snapshot:content.fees};
 const preview=draftEntryPreview(trial,content,setup);assert.equal(preview.events[0].fee.cents,2400);assert.equal(preview.events[0].previewMissingFee,false);assert.equal(preview.events[0].feoFee.cents,1600);
 const changed=structuredClone(trial);changed.planning.events[0].judge='Changed';assert.equal(draftEntryPreview(changed,content,setup).events[0].previewMissingFee,true);
 assert.equal(draftEntryPreview(trial,{fees:[{...content.fees[0],cents:2500}]},setup).events[0].previewMissingFee,true);
});

test('unsaved proof uses current selections without modifying saved fees or trial',()=>{
 const content={fees:[{label:'Competitive',cents:2400,unit:'per dog'},{label:'FEO',cents:1600}]},before=JSON.stringify({trial,content});
 const config=unsavedEntryPreview(trial,content,[{key:'regular',levels:['C'],fee_index:0,feo_index:1,basis:'dog',capacity:20},{key:'team',levels:['B'],fee_index:null,feo_index:null,basis:''}]);
 assert.deepEqual(config.events[0].levels,['C']);assert.equal(config.events[0].fee.cents,2400);assert.equal(config.events[0].feoFee.cents,1600);assert.equal(config.events[0].previewMissingFee,false);
 assert.equal(config.events[1].previewMissingFee,true);assert.deepEqual(config.events[1].levels,['B']);assert.equal(JSON.stringify({trial,content}),before);
});
