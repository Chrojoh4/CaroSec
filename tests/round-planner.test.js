import test from 'node:test';import assert from 'node:assert/strict';import {trialDayKeys,dayClasses,orderedDraftRounds,reorderDayClass,setClassRoundCount} from '../src/domain/round-planner.js';
const e=(id,dayId,level='Novice',judge='Judge '+id)=>({id,dayId,level,format:'Regular',judge,stream:'B',exercises:''});
test('planner dates are calendar dates across DST and retain rounds outside changed trial dates',()=>{
 assert.deepEqual(trialDayKeys('2027-03-13','2027-03-15',[e('x','2027-03-16')]),['2027-03-13','2027-03-14','2027-03-15','2027-03-16']);assert.deepEqual(trialDayKeys('invalid','invalid',[e('x','2027-03-16')]),['2027-03-16']);
});
test('draft grouping sorts days and preserves round identity, judges and within-class order',()=>{
 const input=[e('d2','2027-03-14'),e('n1','2027-03-13'),e('a1','2027-03-13','Advanced'),e('n2','2027-03-13')],before=structuredClone(input),result=orderedDraftRounds(input);
 assert.deepEqual(result.map(e=>e.id),['n1','n2','a1','d2']);assert.deepEqual(input,before);assert.equal(result[1].judge,'Judge n2');
 assert.deepEqual(dayClasses(input,'2027-03-13',{contiguous:true}).flatMap(g=>g.events.map(e=>e.id)),['n1','a1','n2']);
});
test('class arrow and drop moves affect only the selected day and keep round assignments intact',()=>{
 const input=[e('n1','2027-03-13'),e('n2','2027-03-13'),e('a1','2027-03-13','Advanced'),e('d2','2027-03-14')];
 assert.deepEqual(reorderDayClass(input,'2027-03-13','Novice|Regular',{direction:1}).map(e=>e.id),['a1','n1','n2','d2']);
 assert.deepEqual(reorderDayClass(input,'2027-03-13','Advanced|Regular',{before:'Novice|Regular'}).map(e=>e.id),['a1','n1','n2','d2']);assert.deepEqual(input.map(e=>e.id),['n1','n2','a1','d2']);assert.deepEqual(reorderDayClass(input,'2027-03-13','Novice|Regular',{targetKey:'Advanced|Regular'}).map(e=>e.id),['a1','n1','n2','d2']);
});
test('round counts preserve existing IDs/judges and add independent empty rounds on the selected day',()=>{
 let id=0;const input=[e('n1','2027-03-13'),e('d2','2027-03-14')],result=setClassRoundCount(input,'2027-03-13','Novice','Regular',3,()=>`new-${++id}`);
 assert.deepEqual(result.map(e=>e.id),['n1','new-1','new-2','d2']);assert.equal(result[0].judge,'Judge n1');assert.equal(result[1].judge,'');assert.equal(result[1].stream,'');assert.equal(result[3].judge,'Judge d2');
 assert.deepEqual(setClassRoundCount(result,'2027-03-13','Novice','Regular',1,()=>'' ).map(e=>e.id),['n1','d2']);assert.throws(()=>setClassRoundCount(result,'2027-03-13','Novice','Regular',150,()=>''),/150 rounds/);
});
