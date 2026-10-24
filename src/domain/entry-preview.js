// Draft layout only. Never infer event prices or eligibility from fee labels.
export function draftEntryPreview(trial,content={},offerings=null){
 const planning=trial.planning||{};
 const config={id:trial.id,title:trial.title,host:planning.host||'',venue:planning.venue||'',address:planning.address||'',timezone:trial.timezone,date:trial.start_date,endDate:trial.end_date,opens:content.opens||'',closes:content.closes||'',premiumVersion:'unpublished draft',waiver:content.waiver||'Host agreement has not been entered.',payment:content.payment||'Payment instructions have not been entered.',accommodations:content.accommodations||'',moveups:content.moveups||'',refunds:content.refunds||'',events:(planning.events||[]).map((event,index)=>({id:event.id,round:index+1,dayId:event.dayId,level:event.level,format:event.format,judge:event.judge,levels:(event.stream||'').trim().split(/[ ,;]+/).filter(Boolean).length?(event.stream||'').trim().split(/[ ,;]+/).filter(Boolean):['Not configured'],exercises:event.format==='Working'?(event.exercises||'').split(/[;,\n]+/).filter(x=>x.trim()).map((name,i)=>({id:'preview-exercise-'+i,name:name.trim()})):[],fee:{cents:0},feoFee:null,basis:'not configured',previewMissingFee:true}))};
 for(const event of config.events){const original=planning.events.find(e=>e.id===event.id),row=offerings?.rows?.find(r=>r.key===event.id),source=['id','dayId','level','format','stream','judge','exercises'].map(key=>original?.[key]||'');
 if(row&&JSON.stringify(row.source)===JSON.stringify(source)&&JSON.stringify(offerings.fees_snapshot)===JSON.stringify(content.fees)){Object.assign(event,{levels:row.levels,fee:row.fee,feoFee:row.feoFee,basis:row.basis,capacity:row.capacity,previewMissingFee:false});}
 }
 return config;
}
