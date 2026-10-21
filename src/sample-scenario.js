import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sampleDraft} from '../web/sample.js';
import {createTrialWorkspace,premiumFromTrial} from './domain/trial-workspace.js';
import {emptyRecords,makeTrialConfig,installTrial,submitEntry,changeEntryStatus,changeRunStatus,postFinance,withdrawRun,recordScore} from './domain/secretary.js';
import {judgePacket} from './domain/judge-packet.js';
import {workingReport} from '../web/reports.js';
export async function sampleScenario(){
 const fixture=JSON.parse(await readFile(new URL('../fixtures/rallypaws-practice-trial.json',import.meta.url),'utf8'));
 let premium={...sampleDraft(),...Object.fromEntries(['title','timezone'].map(k=>[k,fixture[k]])),host:fixture.planning.host,date:fixture.start_date,endDate:fixture.end_date,opens:'2027-03-01',closes:'2027-04-01',venue:fixture.planning.venue,address:fixture.planning.address,fictional:true,events:fixture.planning.events.map((row,i)=>({...row,round:i+1,stream:row.format==='Working'?'Rookie':'B'}))};
 const trial={...createTrialWorkspace(premium),...fixture.planning,events:premium.events},pricing=Object.fromEntries(premium.events.map(event=>[event.id,{fee:event.format==='Working'?2:event.format==='Team'?1:0,feoFee:3,basis:event.format==='Working'?'exercise':'dog'}]));
 premium=premiumFromTrial(trial,premium);
 const config=makeTrialConfig({trial,premium,editions:[],pricing,capacity:2});const state=emptyRecords();const now='2027-03-01T18:00:00Z';installTrial(state,config,now);
 const request=(n,events)=>({trialId:config.id,idempotencyKey:'practice-'+n,contact:{name:'Test Handler '+n,email:`handler${n}@example.com`,phone:'555-0100',address:'Fictional practice address'},dog:{name:['Maple','Cedar','Willow','Aspen'][n-1]+' (test)',caroId:'TEST-DOG-'+n,breed:'Mixed',birthDate:'2020-01-01',height:'18 inches',jumpHeight:'12 inches'},partner:{handler:'Test Partner '+n,dog:{name:'Birch (test)',caroId:'TEST-PARTNER-'+n,breed:'Mixed',birthDate:'2019-01-01',height:'20 inches',jumpHeight:'14 inches'}},selections:events.map(eventId=>({eventId,stream:'B',exercises:eventId==='rp-test-06'?[{id:'exercise-1',level:'Rookie'}]:[]})),agree:true,eligibilityDeclared:true,intakeEvidence:'Fictional signed form for development only'});
 const a=submitEntry(state,request(1,['rp-test-01','rp-test-02','rp-test-03','rp-test-06']),'online',now);changeEntryStatus(state,{entryId:a.id,status:'accepted'},now);postFinance(state,{entryId:a.id,kind:'payment',amountCents:a.amountCents,method:'Test record',note:'Fictional payment - no money received'},now);
 const b=submitEntry(state,request(2,['rp-test-01','rp-test-04']),'paper','2027-03-01T18:10:00Z');changeEntryStatus(state,{entryId:b.id,status:'accepted'},'2027-03-01T18:11:00Z');
 const c=submitEntry(state,request(3,['rp-test-01','rp-test-02']),'email','2027-03-01T18:20:00Z');changeEntryStatus(state,{entryId:c.id,status:'waitlisted'},'2027-03-01T18:21:00Z');
 withdrawRun(state,{entryId:a.id,eventId:'rp-test-01',reason:'Fictional one-run withdrawal; other runs retained'},'2027-03-02T18:00:00Z');changeRunStatus(state,{entryId:c.id,eventId:'rp-test-01',status:'accepted',reason:'Space released; other run stays waitlisted for review'},'2027-03-02T18:05:00Z');
 const d=request(4,['rp-test-05']);d.partner.handler=d.contact.name;const brace=submitEntry(state,d,'online','2027-03-02T18:10:00Z');changeEntryStatus(state,{entryId:brace.id,status:'accepted'},'2027-03-02T18:11:00Z');
 recordScore(state,{entryId:b.id,eventId:'rp-test-01',judgeConfirmed:true,outcome:'Q',score:190,elapsedSeconds:65},'2027-04-17T17:00:00Z');
 return {state,trialId:config.id,premium,trial};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const data=await sampleScenario(),directory=resolve(import.meta.dirname,'../output/sample-trial');await mkdir(directory,{recursive:true});
 await writeFile(resolve(directory,'records.json'),JSON.stringify(data.state,null,2));await writeFile(resolve(directory,'judge-packet.json'),JSON.stringify(judgePacket(data.state,data.trialId),null,2));
 for(const type of ['summary','journal','running','judges','finance','catalogue','waitlist','withdrawals','runs'])await writeFile(resolve(directory,type+'.html'),workingReport(data.state,data.trialId,type));
 console.log('Created isolated fictional records and working reports in '+directory+'. Live/local desk records were not changed.');
}
