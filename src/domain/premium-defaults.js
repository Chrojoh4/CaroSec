export const reusablePremiumFields=['intro','dayOf','orderNote','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','theme','fees'];
export function applyPremiumDefaults(content={},remembered={}){
 const result=structuredClone(content),filled=[];
 for(const key of reusablePremiumFields){if(Object.hasOwn(result,key)||!Object.hasOwn(remembered,key))continue;const value=remembered[key];
  if(key==='fees'?!Array.isArray(value):typeof value!=='string')continue;
  if(key==='fees'&&!value.length||typeof value==='string'&&!value.trim())continue;
  result[key]=structuredClone(value);filled.push(key);
 }
 return {content:result,filled};
}
