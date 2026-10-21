import {createHash} from 'node:crypto';
import {emptyRecords,submitEntry,DeskError} from '../domain/secretary.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const slugPattern=/^[a-z0-9][a-z0-9-]{2,79}$/;
async function rpc(client,name,args){
 const {data,error}=await client.rpc(name,args);
 if(error){const known=['online entry window is closed','already has an entry','reviewed premium changed','reference already used','event is already complete'];const text=String(error.message||'');throw new DeskError(known.some(part=>text.toLowerCase().includes(part))?text:'Online entry could not be saved. Keep your receipt link and retry, or contact the secretary.',error.code==='40001'||known.some(part=>text.toLowerCase().includes(part))?409:503);}
 return data;
}
export async function receiveOnlineEntry(body,{client,now=new Date().toISOString()}={}){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['slug','input','receiptSecret'].includes(k)))throw new DeskError('Check the entry request.');
 const {slug,input,receiptSecret}=body;
 if(!slugPattern.test(slug||'')||!input||typeof input!=='object'||Array.isArray(input)||typeof input.idempotencyKey!=='string'||!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(input.idempotencyKey)||!/^[a-f0-9]{64}$/.test(receiptSecret))throw new DeskError('Check the entry submission and receipt references.');
 if(Buffer.byteLength(JSON.stringify(body),'utf8')>65000)throw new DeskError('The entry request is too large.',413);
 const requestHash=hash(JSON.stringify(input)),receiptHash=hash(receiptSecret);
 const replay=await rpc(client,'caro_online_entry_replay',{p_slug:slug,p_request:input.idempotencyKey,p_hash:requestHash,p_receipt_hash:receiptHash});
 if(replay)return replay;
 const published=await rpc(client,'caro_public_premium',{p_slug:slug});
 if(published?.kind!=='public_entry_edition'||published.publicationReady!==true||published.onlineEnabled!==true||published.configuration?.fictional===true)throw new DeskError('Online entries are not available for this trial.',409);
 const config=structuredClone(published.configuration);
 if(config.id!==input.trialId)throw new DeskError('This entry belongs to a different trial.');
 config.fictional=false;
 const state=emptyRecords();state.trials[config.id]=config;
 submitEntry(state,input,'online',now);
 const entry=state.entries[0];
 // Drop the local desk's generated receipt token and audit identity. The client
 // holds its own random receipt secret; only its SHA-256 hash reaches storage.
 const details=Object.fromEntries(['contact','dog','partner','selections','accommodation'].map(key=>[key,entry[key]]));
 return rpc(client,'caro_commit_online_entry',{p_slug:slug,p_premium:published.premiumId,p_request:input.idempotencyKey,p_hash:requestHash,p_receipt_hash:receiptHash,p_details:details});
}
export async function onlineReceipt(secret,{client}={}){
 if(typeof secret!=='string'||!/^[a-f0-9]{64}$/.test(secret))throw new DeskError('This receipt link is incomplete.',422);
 const result=await rpc(client,'caro_online_receipt',{p_receipt_hash:hash(secret)});
 if(!result)throw new DeskError('This receipt is unavailable. Check the link or contact the secretary.',404);
 return result;
}
