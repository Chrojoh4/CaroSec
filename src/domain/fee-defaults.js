// Private draft defaults. Explicit host choices are still reviewed before entry setup.
export const feeKinds={regular:'Regular Rally',feo:'FEO',team:'Team',brace:'Brace',working:'Working',custom:'Other / class override'};
export function feeKind(fee){
 if(Object.hasOwn(feeKinds,fee.kind))return fee.kind;
 const label=String(fee.label||'').toLowerCase();
 if(/\bfeo\b|exhibition/.test(label))return 'feo';
 if(/\bteam\b/.test(label))return 'team';if(/\bbrace\b/.test(label))return 'brace';if(/\bworking\b/.test(label))return 'working';
 if(/^(regular|competitive)( rally)?( entry)?( fee)?$/.test(label.trim()))return 'regular';return 'custom';
}
export function uniqueFee(fees,kind){const matches=fees.filter(f=>feeKind(f)===kind);return matches.length===1?matches[0]:null;}
export function draftFeeDefaults(event,fees=[],saved=null){
 const match=old=>{if(!old)return null;const same=fees.filter(f=>f.label===old.label&&f.unit===old.unit);return same.length===1?same[0]:null;};
 const kind=event.format==='Working'?'working':event.format==='Team'?'team':event.format==='Brace'?'brace':'regular';
 const fee=saved?match(saved.fee):uniqueFee(fees,kind);
 const globalFeo=uniqueFee(fees,'feo');const feoFee=saved?match(saved.feoFee):globalFeo?.offered===true?globalFeo:null;
 const unit=String(fee?.unit||'').toLowerCase();let basis=event.format==='Working'?'exercise':event.format==='Regular'?'dog':/per (team|brace|event|entry|group)/.test(unit)?'entry':/per (participating )?dog/.test(unit)?'dog':'';
 if(/confirm|review|not configured/.test(unit)&&!saved?.basis)basis='';
 if(saved?.basis)basis=saved.basis;
 return {fee,feoFee,basis,capacity:saved?.capacity||50};
}
