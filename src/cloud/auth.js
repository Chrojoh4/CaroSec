import {browserAuthStorage} from './browser-auth-storage.js';
import {createClient} from '@supabase/supabase-js';

export class AccessError extends Error {
  constructor(message,status=401){super(message);this.status=status;}
}
export function publicAuthConfig(env=process.env){
  const url=env.NEXT_PUBLIC_SUPABASE_URL,key=env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let parsed;try{parsed=new URL(url);}catch{throw new AccessError('Supabase configuration is missing.',503);}
  if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co')||parsed.username||parsed.password||parsed.pathname!=='/'||!key?.startsWith('sb_publishable_')){
    throw new AccessError('Supabase public configuration is invalid.',503);
  }
  // Explicit allowlist: never return env wholesale or include the server secret.
  return {url:parsed.origin,publishableKey:key};
}
export async function requireStaffSession(request,{env=process.env,clientFactory=createClient}={}){
  const header=request.headers?.authorization;
  if(typeof header!=='string'||header.length>8192||!/^Bearer \S+$/i.test(header))throw new AccessError('Sign in required.');
  const token=header.slice(7),config=publicAuthConfig(env);
  const client=clientFactory(config.url,config.publishableKey,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{headers:{Authorization:`Bearer ${token}`}},
  });
  // The Auth server verifies the token. Never trust client-decoded JWT claims or
  // a user/role supplied in the request body to authorize a database operation.
  let result;try{result=await client.auth.getUser(token);}catch{throw new AccessError('Unable to verify sign-in. Try again.',503);}
  if(result.error||!result.data?.user?.id||result.data.user.is_anonymous)throw new AccessError('Sign in required.');
  return {client,user:result.data.user};
}
export async function requireTrialAccess(session,clubId,trialId){
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(!uuid.test(clubId||'')||!uuid.test(trialId||''))throw new AccessError('Trial access denied.',403);
  // Uses the caller JWT and database policies, never the privileged server client.
  const {data,error}=await session.client.from('caro_trials').select('id,club_id,timezone,revision').eq('club_id',clubId).eq('id',trialId).maybeSingle();
  if(error)throw new AccessError('Trial access could not be verified.',503);
  if(!data)throw new AccessError('Trial access denied.',403);
  return data;
}
export function createBrowserAuth(config,storage,{clientFactory=createClient,verifierStorage=null}={}){
  const validated=publicAuthConfig({NEXT_PUBLIC_SUPABASE_URL:config.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:config.publishableKey});
  if(!storage)throw new AccessError('Session storage is required.',503);
  return clientFactory(validated.url,validated.publishableKey,{
    auth:{storage:verifierStorage?browserAuthStorage(storage,verifierStorage):storage,storageKey:'caro-staff-session',persistSession:true,autoRefreshToken:true,flowType:'pkce',experimental:{appendPkceFlowIdToRedirects:true},detectSessionInUrl:false},
  });
}
