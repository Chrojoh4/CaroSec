import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {createClient} from '@supabase/supabase-js';
import {createBrowserAuth} from '../src/cloud/auth.js';import {createStaffAccount} from '../hosted/account-signup.js';import {exchangeEmailCallback} from '../hosted/password-recovery.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('staff signup requests confirmation on this site and does not grant club or administrator access',async()=>{
 let sent;const result=await createStaffAccount({signUp:async args=>{sent=args;return {data:{user:{id:'one'},session:null}};}},' person@example.com ','example-password','https://carosec.vercel.app');
 assert.deepEqual(sent,{email:'person@example.com',password:'example-password',options:{emailRedirectTo:'https://carosec.vercel.app/'}});assert.equal(result.signedIn,false);assert.match(result.message,/new tab/);assert.equal('role' in sent,false);
 await assert.rejects(()=>createStaffAccount({},'bad','example-password','https://carosec.vercel.app'),/email/);
 await assert.rejects(()=>createStaffAccount({},'person@example.com','short','https://carosec.vercel.app'),/8 and 128/);
});
test('group signup reports sender rate limiting clearly without disclosing account existence',async()=>{
 await assert.rejects(()=>createStaffAccount({signUp:async()=>({error:{status:429}})},'person@example.com','example-password','https://carosec.vercel.app'),/group session/);
 await assert.rejects(()=>createStaffAccount({signUp:async()=>({error:{message:'Private server details'}})},'person@example.com','example-password','https://carosec.vercel.app'),/could not be completed/);
});
test('overlapping SDK signups keep distinct flow IDs and confirm each user in separate new tabs',async()=>{
 const shared=memory(),config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'},pending=new Map(),clients=[];
 const fetch=async(url,options)=>{const parsed=new URL(url),body=JSON.parse(options.body);let response;
  if(parsed.pathname.endsWith('/signup')){const redirect=new URL(parsed.searchParams.get('redirect_to')),flow=redirect.searchParams.get('sb_flow_id');assert.ok(flow);pending.set(body.email,{flow,challenge:body.code_challenge});response={user:{id:body.email,email:body.email},session:null};}
  else{const expected=pending.get(body.auth_code);assert.ok(expected);assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),expected.challenge);const jwt=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:body.auth_code,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';response={access_token:jwt,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user:{id:body.auth_code,email:body.auth_code}};}
  return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json'}});
 };
 const make=()=>{const storage=memory(),client=createBrowserAuth(config,storage,{verifierStorage:shared,clientFactory:(url,key,settings)=>createClient(url,key,{...settings,auth:{...settings.auth,autoRefreshToken:false},global:{fetch}})});clients.push(client);return {client,storage};};
 const a=make(),b=make();await Promise.all([createStaffAccount(a.client.auth,'alice@example.com','example-password','https://carosec.vercel.app'),createStaffAccount(b.client.auth,'bob@example.com','example-password','https://carosec.vercel.app')]);
 assert.notEqual(pending.get('alice@example.com').flow,pending.get('bob@example.com').flow);
 const confirmationB=make(),confirmationA=make();assert.equal(await exchangeEmailCallback(confirmationB.client.auth,'bob@example.com',pending.get('bob@example.com').flow),false);assert.equal(await exchangeEmailCallback(confirmationA.client.auth,'alice@example.com',pending.get('alice@example.com').flow),false);
 assert.equal(JSON.parse(confirmationA.storage.getItem('caro-staff-session')).user.email,'alice@example.com');assert.equal(JSON.parse(confirmationB.storage.getItem('caro-staff-session')).user.email,'bob@example.com');assert.equal(a.storage.getItem('caro-staff-session'),null);assert.equal(b.storage.getItem('caro-staff-session'),null);
 for(const client of clients)await client.auth.stopAutoRefresh();
});
