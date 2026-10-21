const text=(value,fallback='')=>typeof value==='string'&&value?value:fallback;
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,structuredClone(value[key])]));
export function hostedReportState(snapshot){
 if(!snapshot?.trial?.id||!Array.isArray(snapshot.trial.events)||!['entries','ledger','scores','expenses','audit'].every(key=>Array.isArray(snapshot[key])))throw new Error('Unsupported report snapshot.');
 const trial=structuredClone(snapshot.trial),id=trial.id;let legacyEntryCount=0;
 for(const key of ['entries','ledger','scores','expenses','audit'])if(snapshot[key].some(row=>row.trialId!==id))throw new Error('Report contains a foreign trial reference.');
 if(snapshot.incidents!==undefined&&(!Array.isArray(snapshot.incidents)||snapshot.incidents.some(row=>row.trialId!==id)))throw new Error('Report contains a foreign incident scope.');
 const dog=(value,reference)=>({name:text(value?.name,'Not recorded'),caroId:text(value?.caroId,'NOT RECORDED ('+reference+')'),breed:text(value?.breed,'Not recorded'),owner:text(value?.owner,'Not recorded'),height:text(value?.height,'Not recorded'),jumpHeight:text(value?.jumpHeight,'Not recorded'),veteran:value?.veteran===true});
 trial.events=trial.events.map(event=>({...event,exercises:Array.isArray(event.exercises)?event.exercises:[]}));trial.fictional=trial.fictional===true||trial.title.includes('TEST ONLY');
 const entries=snapshot.entries.map(row=>{
  const paired=(row.selections||[]).some(line=>trial.events.some(event=>event.id===line.eventId&&['Team','Brace'].includes(event.format)));
  if(!row.contact?.name||!row.dog?.caroId||(paired&&!row.partner?.dog?.caroId))legacyEntryCount++;
  return {...pick(row,['id','trialId','status','channel','amountCents','revision','createdAt','receivedAt']),contact:{name:text(row.contact?.name,'Not recorded'),email:text(row.contact?.email),phone:text(row.contact?.phone)},dog:dog(row.dog,row.id),partner:row.partner||paired?{handler:text(row.partner?.handler,'Not recorded'),dog:dog(row.partner?.dog,row.id+' partner')}:null,
   selections:(row.selections||[]).map(line=>({...pick(line,['eventId','stream','feo','units','unitCents','amountCents','status','statusChangedAt','statusReason','withdrawnAt','withdrawalReason']),exercises:Array.isArray(line.exercises)?structuredClone(line.exercises):[],participantIds:Array.isArray(line.participantIds)?structuredClone(line.participantIds):[]}))};
 });
 const ledger=snapshot.ledger.map(row=>pick(row,['id','entryId','trialId','eventId','kind','cents','note','method','actorId','occurredAt','receivedAt']));
 const expenses=snapshot.expenses.map(row=>({...pick(row,['id','trialId','kind','cents','category','note','sourceExpenseId','actorId','occurredAt','receivedAt']),category:(row.kind==='credit'?'Credit · ':'')+row.category}));
 const scores=snapshot.scores.map(row=>pick(row,['id','entryId','trialId','eventId','version','judge','results','elapsedSeconds','reason','actorId','occurredAt'])).sort((a,b)=>a.version-b.version);
 const audit=snapshot.audit.map(row=>{
  const source=[...ledger,...expenses].find(item=>item.id===row.reference),details=row.details||{};
  return {id:row.id,trialId:id,action:row.action,reference:row.reference,occurredAt:row.occurredAt,entryId:details.entryId||source?.entryId||null,eventId:details.eventId||null,
   actor:row.actorId?'Staff '+row.actorId:details.channel==='online'?'Online entrant (self-declared)':'Actor not recorded',receivedAt:details.receivedAt??source?.receivedAt??null,
   amountCents:details.amountCents??source?.cents??(details.chargedCents>0?details.chargedCents:null),reason:text(details.reason)||text(details.signoff)||text(source?.note)};
 });
 const scoped=value=>{if(!value||typeof value!=='object'||Array.isArray(value))return {};if(Object.keys(value).some(key=>!key.startsWith(id+':')))throw new Error('Report contains a foreign event scope.');return structuredClone(value);};
 return {schemaVersion:1,revision:0,activeTrialId:id,trials:{[id]:trial},entries,ledger,expenses,scores,audit,orders:scoped(snapshot.orders),finalizedEvents:scoped(snapshot.finalizedEvents),incidents:(snapshot.incidents||[]).map(row=>pick(row,['id','trialId','category','description','occurredAt','recordedAt','actorId'])),moveUps:[],ribbonClaims:[],trialAdmin:{[id]:structuredClone(snapshot.paperwork||{})},
  actorContext:'hosted_audit',generatedAt:snapshot.generatedAt,diagnostics:{legacyEntryCount}};
}
