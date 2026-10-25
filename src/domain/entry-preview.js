import {draftFeeDefaults} from './fee-defaults.js';
export function draftOfferedLevels(event,levels=[]){
 if(event.format==='Working')return levels.length?levels:['Not configured'];
 if(['Novice','Intermediate'].includes(event.level))return ['B'];
 const values=[...new Set(levels.flatMap(x=>/^both$/i.test(x)?['B','C']:[x]).filter(x=>x&&x!=='Not configured'))];
 return values.length?values:['B'];
}
// Draft layout uses host defaults and saved round exceptions, never eligibility claims.
export function draftEntryPreview(trial,content={},offerings=null){
 const planning=trial.planning||{};
 const config={id:trial.id,title:trial.title,host:planning.host||'',venue:planning.venue||'',address:planning.address||'',timezone:trial.timezone,date:trial.start_date,endDate:trial.end_date,opens:content.opens||'',closes:content.closes||'',premiumVersion:'unpublished draft',waiver:content.waiver||'Host agreement has not been entered.',payment:content.payment||'Payment instructions have not been entered.',accommodations:content.accommodations||'',moveups:content.moveups||'',refunds:content.refunds||'',events:(planning.events||[]).map((event,index)=>({id:event.id,round:index+1,dayId:event.dayId,level:event.level,format:event.format,judge:event.judge,levels:(event.stream||'').trim().split(/[ ,;]+/).filter(Boolean).length?(event.stream||'').trim().split(/[ ,;]+/).filter(Boolean):['Not configured'],exercises:event.format==='Working'?(event.exercises||'').split(/[;,\n]+/).filter(x=>x.trim()).map((name,i)=>({id:'preview-exercise-'+i,name:name.trim()})):[],fee:{cents:0},feoFee:null,basis:'not configured',previewMissingFee:true}))};
 for(const event of config.events){const original=planning.events.find(e=>e.id===event.id),row=offerings?.rows?.find(r=>r.key===event.id),source=['id','dayId','level','format','stream','judge','exercises'].map(key=>original?.[key]||'');
 if(row&&JSON.stringify(row.source)===JSON.stringify(source)&&JSON.stringify(offerings.fees_snapshot)===JSON.stringify(content.fees)){Object.assign(event,{levels:row.levels,fee:row.fee,feoFee:row.feoFee,basis:row.basis,capacity:row.capacity,previewMissingFee:false});}
 else{const compatible=row?.source?.[2]===event.level&&row?.source?.[3]===event.format?row:null;const defaults=draftFeeDefaults(event,content.fees||[],compatible);if(defaults.fee)Object.assign(event,defaults,{previewMissingFee:false,previewUnreviewed:true});}
 }
 for(const event of config.events)event.levels=draftOfferedLevels(event,event.levels);
 return config;
}

// Private proof of current controls; no persistence or eligibility decision.
export function unsavedEntryPreview(trial,content,rows){
 const config=draftEntryPreview(trial,content);
 for(const event of config.events){
  const row=rows.find(r=>r.key===event.id);if(!row)continue;
  event.levels=row.levels.length?row.levels:['Not configured'];
  const fee=Number.isInteger(row.fee_index)?content.fees?.[row.fee_index]:null;
  Object.assign(event,{fee:fee||{cents:0},feoFee:Number.isInteger(row.feo_index)?content.fees?.[row.feo_index]||null:null,basis:row.basis||'not configured',capacity:row.capacity,previewMissingFee:!fee});
 }
 for(const event of config.events)event.levels=draftOfferedLevels(event,event.levels);
 return config;
}
