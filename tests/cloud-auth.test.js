import test from 'node:test';
import assert from 'node:assert/strict';
import {publicAuthConfig,requireStaffSession,requireTrialAccess,createBrowserAuth} from '../src/cloud/auth.js';
const env={NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_SECRET_KEY:'never-return-this'};
test('public auth configuration never includes server secrets and rejects secret keys/browser misconfiguration',()=>{
 assert.deepEqual(publicAuthConfig(env),{url:'https://example.supabase.co',publishableKey:'sb_publishable_test'});
 assert.throws(()=>publicAuthConfig({...env,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_wrong'}),/invalid/);
 assert.throws(()=>publicAuthConfig({...env,NEXT_PUBLIC_SUPABASE_URL:'https://supabase.co.attacker.example'}),/invalid/);
});
test('unauthenticated requests fail before creating a database client',async()=>{
 let called=false;await assert.rejects(()=>requireStaffSession({headers:{}},{env,clientFactory:()=>{called=true;}}),/Sign in required/);assert.equal(called,false);
});
test('staff requests verify tokens through Auth and propagate the caller JWT instead of privileged access',async()=>{
 let options,verified;
 const session=await requireStaffSession({headers:{authorization:'Bearer sample-access-token'}},{env,clientFactory:(url,key,settings)=>{assert.equal(key,'sb_publishable_test');options=settings;return{auth:{getUser:async token=>{verified=token;return {data:{user:{id:'test-user'}},error:null};}}};}});
 assert.equal(session.user.id,'test-user');assert.equal(verified,'sample-access-token');assert.equal(options.global.headers.Authorization,'Bearer sample-access-token');assert.equal(options.auth.persistSession,false);
});
test('forged or anonymous sessions never authorize staff access',async()=>{
 for(const result of [{error:{message:'Invalid JWT'},data:{user:null}},{data:{user:{id:'anonymous',is_anonymous:true}}}]){
  await assert.rejects(()=>requireStaffSession({headers:{authorization:'Bearer forged'}},{env,clientFactory:()=>({auth:{getUser:async()=>result}})}),/Sign in required/);
 }
});
test('trial authorization denies rows hidden by RLS and fails closed on database errors',async()=>{
 const query=result=>({from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>result})})})})});
 const club='00000000-0000-0000-0000-000000000001',trial='00000000-0000-0000-0000-000000000002';
 await assert.rejects(()=>requireTrialAccess({client:query({data:null,error:null})},club,trial),error=>error.status===403);
 await assert.rejects(()=>requireTrialAccess({client:query({data:null,error:{message:'Unavailable'}})},club,trial),error=>error.status===503);
 const row={id:trial,club_id:club};assert.equal(await requireTrialAccess({client:query({data:row,error:null})},club,trial),row);
});
test('browser sessions use explicit tab storage and the official PKCE client without exposing secrets',()=>{
 const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};let settings;
 createBrowserAuth(publicAuthConfig(env),storage,{clientFactory:(url,key,options)=>{settings=options;assert.equal(key,'sb_publishable_test');return{};}});
 assert.equal(settings.auth.storage,storage);assert.equal(settings.auth.flowType,'pkce');assert.equal(settings.auth.detectSessionInUrl,false);
});
