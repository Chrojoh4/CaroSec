import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';
import {DeskError} from '../domain/secretary.js';
import {receiveOnlineEntry,onlineReceipt} from './online-intake.js';

function serverClient(env,factory){
 const key=env.SUPABASE_SECRET_KEY;
 if(typeof key!=='string'||!/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))throw new DeskError('Online entry is not configured. Use the paper / email form.',503);
 const defaults=JSON.parse(readFileSync(new URL('../../hosted/public-config.json',import.meta.url),'utf8'));
 let url;try{url=new URL(env.SUPABASE_URL||defaults.url);}catch{throw new DeskError('Online entry configuration needs review.',503);}
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new DeskError('Online entry configuration needs review.',503);
 return {client:factory(url.origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),key};
}
export function makeOnlineHandler(kind,{env=process.env,clientFactory=createClient,now=()=>new Date().toISOString()}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,value)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  try{
   if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Use the online entry or receipt form.'});}
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new DeskError('JSON is required.',415);
   if(req.headers.origin&&req.headers.origin!=='https://'+req.headers.host)throw new DeskError('Open the trial entry form on this site.',403);
   const {client,key}=serverClient(env,clientFactory);
   // Only Vercel's overwritten client-IP header is trusted. Local development
   // uses a single loopback bucket; arbitrary forwarded headers are ignored.
   const ip=env.VERCEL==='1'?req.headers['x-vercel-forwarded-for']:'127.0.0.1';
   if(typeof ip!=='string'||!isIP(ip))throw new DeskError('Request origin could not be verified.',503);
   const bucket=createHmac('sha256',key).update(kind+'\n'+ip).digest('hex');
   const allowance=await client.rpc('caro_claim_online_request',{p_bucket:bucket,p_limit:kind==='entry'?10:30});
   if(allowance.error)throw new DeskError('Online entry is temporarily unavailable. Use the paper / email form.',503);
   if(allowance.data!==true){res.setHeader('Retry-After','60');throw new DeskError('Too many requests. Wait a minute before retrying.',429);}
   let body=req.body;
   if(typeof body==='string'){if(Buffer.byteLength(body)>65000)throw new DeskError('Request is too large.',413);try{body=JSON.parse(body);}catch{throw new DeskError('Check the request.',422);}}
   if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>65000)throw new DeskError('Check the request size.',413);
   const result=kind==='entry'?await receiveOnlineEntry(body,{client,now:now()}):await onlineReceipt(body.receiptSecret,{client});
   reply(200,result);
  }catch(error){reply(error instanceof DeskError?error.status:503,{error:error instanceof DeskError?error.message:'The request could not be completed. Keep your receipt link and retry.'});}
 };
}
