import {validatePremium} from './premium.js';
export function premiumPdfPacket(draft){
 if(!draft||typeof draft!=='object'||Array.isArray(draft)||typeof draft.title!=='string'||draft.title.length>200||!Array.isArray(draft.events)||draft.events.length>150||!Array.isArray(draft.fees)||draft.fees.length>50)throw new RangeError('Check the premium draft before exporting.');
 if(draft.fees.some(fee=>!fee||typeof fee.label!=='string'||fee.label.length>200||typeof fee.unit!=='string'||fee.unit.length>100||!Number.isSafeInteger(fee.cents)||fee.cents<0||fee.cents>999999999)||draft.events.some(event=>!event||typeof event!=='object'||Array.isArray(event)))throw new RangeError('Check event and fee values before exporting.');
 const fields=['title','host','date','endDate','timezone','venue','address','secretary','email','chair','opens','closes','capacity','intro','timing','dayOf','orderNote','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','entryUrl','entryPdfUrl','paperEntryInstructions','trialNumber','approvalEvidence'];
 if(fields.some(key=>draft[key]!==undefined&&typeof draft[key]!=='string')||draft.events.some(event=>['id','dayId','level','format','stream','judge','exercises'].some(key=>event[key]!==undefined&&(typeof event[key]!=='string'||event[key].length>10000))))throw new RangeError('Premium text fields must contain text within the supported limit.');
 for(const value of Object.values(draft))if(typeof value==='string'&&value.length>10000)throw new RangeError('Premium text is too long.');
 return {...structuredClone(draft),publicationReady:validatePremium(draft).length===0};
}
