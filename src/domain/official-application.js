export const officialApplicationUrl='https://app.canadianrallyo.ca/trialapplication';
export function officialApplicationPacket(trial){
 const p=trial.planning||trial,events=p.events||trial.events||[];
 if(!Array.isArray(events)||events.length>150)throw new Error('Review the application events before transfer.');
 const text=value=>typeof value==='string'?value.trim():'';
 const packet={kind:'caro-official-application-transfer',version:1,sourceUrl:officialApplicationUrl,
  trial:{title:text(trial.title),revision:trial.revision??null,practice:trial.is_practice===true||trial.fictional===true||/TEST ONLY/i.test(trial.title||'')},
  fields:{professionalMemberEmail:text(p.organizerEmail),'host.name':text(p.host),'host.website':text(p.website),
   'host.chairperson':text(p.chair),'host.chairpersonEmail':text(p.chairEmail),'host.secretary':text(p.secretary),'host.secretaryEmail':text(p.email),
   'trial.startDate':text(trial.start_date||trial.date),'trial.endDate':text(trial.end_date||trial.endDate),'trial.venueName':text(p.venue),'trial.address':text(p.address),
   'trial.city':text(p.city),'trial.province':text(p.province),'trial.postalCode':text(p.postalCode),'trial.country':text(p.country),
   'trialTypes.rally':events.some(e=>e.format!=='Working'),'trialTypes.working':events.some(e=>e.format==='Working')},
  events:events.map((e,index)=>({round:index+1,date:text(e.dayId),format:text(e.format),level:text(e.level),stream:text(e.stream),judge:text(e.judge),exercises:text(e.exercises)}))};
 for(const value of Object.values(packet.fields))if(typeof value==='string'&&value.length>5000)throw new Error('An application field exceeds the transfer limit.');
 return packet;
}
export function officialEventText(packet){return packet.events.map(e=>`Round ${e.round} | ${e.date} | ${e.level} ${e.format} | ${e.stream}\nJudge: ${e.judge}${e.exercises?'\nWorking offerings: '+e.exercises:''}`).join('\n\n');}
