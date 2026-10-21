export const premiumTextFields=['opens','closes','capacity','intro','timing','dayOf','orderNote','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','theme'];
export function hostedPremium(trial,content={}){
 const planning=trial.planning||{};
 const text=Object.fromEntries(premiumTextFields.map(key=>[key,typeof content[key]==='string'?content[key]:'']));
 const fees=Array.isArray(content.fees)?content.fees.map(fee=>({label:String(fee.label||''),unit:String(fee.unit||''),cents:fee.cents})):[];
 return {...text,fees,fictional:trial.is_practice===true||trial.title.includes('TEST ONLY'),title:trial.title,host:planning.host||'',date:trial.start_date,endDate:trial.end_date,timezone:trial.timezone,venue:planning.venue||'',address:planning.address||'',secretary:planning.secretary||'',email:planning.email||'',chair:planning.chair||'',events:(planning.events||[]).map((event,index)=>({...event,round:index+1})),approved:false,reviewed:false,trialNumber:'',entryUrl:'',entryPdfUrl:''};
}
