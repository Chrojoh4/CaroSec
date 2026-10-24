import test from 'node:test';import assert from 'node:assert/strict';import {browserAuthStorage} from '../src/cloud/browser-auth-storage.js';import {createBrowserAuth} from '../src/cloud/auth.js';import {createClient} from '@supabase/supabase-js';import {requestPasswordReset,exchangeEmailCallback} from '../hosted/password-recovery.js';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
test('tabs share only expiring PKCE verifier material; session tokens stay isolated',()=>{
 const shared=memory(),tabA=memory(),tabB=memory();let time=100;const a=browserAuthStorage(tabA,shared,{now:()=>time}),b=browserAuthStorage(tabB,shared,{now:()=>time});
 for(const key of ['caro-staff-session-code-verifier','caro-staff-session-flows-code-verifier','caro-staff-session-flow-abcdefgh-code-verifier']){a.setItem(key,'verifier');assert.equal(b.getItem(key),'verifier');}
 a.setItem('caro-staff-session','private-token');assert.equal(b.getItem('caro-staff-session'),null);assert.equal([...shared.values.values()].some(v=>v.includes('private-token')),false);
 a.setItem('unrelated-code-verifier','other-private-value');assert.equal(b.getItem('unrelated-code-verifier'),null);
 b.removeItem('caro-staff-session-flow-abcdefgh-code-verifier');assert.equal(a.getItem('caro-staff-session-flow-abcdefgh-code-verifier'),null);
 time+=60*60*1000;assert.equal(b.getItem('caro-staff-session-code-verifier'),null);
});
test('older same-tab verifier and blocked shared storage retain a usable tab-only fallback',()=>{
 const tab=memory();tab.setItem('caro-staff-session-code-verifier','old');const denied={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};const adapter=browserAuthStorage(tab,denied);assert.equal(adapter.getItem('caro-staff-session-code-verifier'),'old');adapter.setItem('caro-staff-session-code-verifier','new');assert.equal(adapter.getItem('caro-staff-session-code-verifier'),'new');adapter.removeItem('caro-staff-session-code-verifier');assert.equal(adapter.getItem('caro-staff-session-code-verifier'),null);
});
test('official SDK reset request in one tab exchanges in a second tab using the matching flow verifier',async()=>{
 const shared=memory(),first=memory(),second=memory(),calls=[];
 const config={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
 const jwt=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'00000000-0000-0000-0000-000000000001',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
 const fetch=async(url,options)=>{const body=JSON.parse(options.body);calls.push({url:String(url),body});return new Response(JSON.stringify(String(url).includes('/recover')?{}:{access_token:jwt,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user:{id:'00000000-0000-0000-0000-000000000001',email:'person@example.com'}}),{status:200,headers:{'Content-Type':'application/json'}});};
 const factory=(url,key,options)=>createClient(url,key,{...options,auth:{...options.auth,autoRefreshToken:false},global:{fetch}});
 const a=createBrowserAuth(config,first,{clientFactory:factory,verifierStorage:shared});await requestPasswordReset(a.auth,'person@example.com','https://carosec.vercel.app');
 const slot=[...shared.values.keys()].find(k=>/^caro-pkce:caro-staff-session-flow-[A-Za-z0-9_-]+-code-verifier$/.test(k));assert.ok(slot);const flowId=slot.match(/-flow-(.*)-code-verifier$/)[1];
 const b=createBrowserAuth(config,second,{clientFactory:factory,verifierStorage:shared});assert.equal(await exchangeEmailCallback(b.auth,'fake-one-time-code',flowId),true);
 assert.equal(calls[1].body.auth_code,'fake-one-time-code');assert.equal(typeof calls[1].body.code_verifier,'string');assert.ok(calls[1].body.code_verifier.length>20);
 assert.equal(first.getItem('caro-staff-session'),null);assert.ok(second.getItem('caro-staff-session'));assert.equal(shared.getItem(slot),null);
 await a.auth.stopAutoRefresh();await b.auth.stopAutoRefresh();
});
