import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleScenario} from '../src/sample-scenario.js';
import {trialReadiness} from '../src/domain/trial-readiness.js';
test('practice overview guides run review without requesting real approval or publication',async()=>{
 const {state,trialId}=await sampleScenario(),trial={id:trialId,is_practice:true,application_state:'finalized',sanction_status:'not_submitted'};
 const model=trialReadiness(trial,state,{premium:{revision:2},settings:{premium_draft_revision:0}});
 assert.equal(model.practice,true);assert.equal(model.summary.entries,4);assert.equal(model.tasks.some(t=>t.section==='sanction'),false);assert.equal(model.tasks.some(t=>t.label.startsWith('Publish')),false);
 assert.equal(model.tasks.find(t=>t.section==='entry-settings').done,true);assert.equal(model.tasks.find(t=>t.section==='trial-day').done,false);
});
test('real draft overview requires application, actual approval and published entry links',async()=>{
 const {state,trialId}=await sampleScenario();state.entries=[];
 const model=trialReadiness({id:trialId,is_practice:false,application_state:'draft',sanction_status:'not_submitted'},state,{premium:{revision:2},settings:{premium_draft_revision:1}});
 assert.equal(model.next.section,'application');assert.equal(model.tasks.find(t=>t.section==='sanction').done,false);assert.equal(model.tasks.find(t=>t.section==='entry-settings').done,false);assert.equal(model.tasks.find(t=>t.label.startsWith('Publish')).done,false);
});
