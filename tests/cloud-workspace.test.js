import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWorkspace,createClub} from '../src/cloud/workspace.js';
test('workspace reads only display columns through the caller client and fails closed on database errors',async()=>{
  const calls=[];const client={from(table){return {select(columns){calls.push({table,columns});return {order:async()=>({data:[],error:table==='caro_trials'?{message:'denied'}:null})};}};}};
  await assert.rejects(loadWorkspace(client),/could not be loaded/);
  assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.columns.includes('*')&&!c.columns.includes('details')));
});
test('club setup sends only validated name and explicit timezone to atomic ownership RPC',async()=>{
  const calls=[];const client={rpc:async(...args)=>{calls.push(args);return {data:'club-id'};}};
  await assert.rejects(createClub(client,'','America/Edmonton'),/club name/);
  await assert.rejects(createClub(client,'Club',''),/timezone/);
  await assert.rejects(createClub(client,'Club','not-a-zone'),/timezone/);
  assert.equal(calls.length,0);
  assert.equal(await createClub(client,'  Club  ','America/Edmonton'),'club-id');
  assert.deepEqual(calls,[['caro_create_club',{p_name:'Club',p_timezone:'America/Edmonton'}]]);
});
