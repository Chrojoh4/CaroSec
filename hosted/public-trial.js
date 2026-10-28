import {entryWindow} from '../src/domain/entry-window.js';
import {mountPublicEntry,showReceipt} from './public-entry.js';
import {createClient} from '@supabase/supabase-js';
import {publicPremiumHtml} from '../src/domain/public-premium.js';
const $=id=>document.getElementById(id);
const client=createClient(__CARO_PUBLIC_CONFIG__.url,__CARO_PUBLIC_CONFIG__.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
async function load(){
 const receipt=location.hash.match(/^#receipt=([a-f0-9]{64})$/);if(receipt){await showReceipt($('entry-panel'),receipt[1]);$('status').textContent='Private entry receipt';return;}
 const slug=new URL(location.href).searchParams.get('trial');
 if(!/^[a-z0-9][a-z0-9-]{2,79}$/.test(slug||''))throw new Error('This trial link is incomplete. Ask the host for its published premium link.');
 const {data,error}=await client.rpc('caro_public_premium',{p_slug:slug});
 if(error)throw new Error('This trial premium is unavailable. Contact the host for its current premium.');
 $('premium').innerHTML=publicPremiumHtml(data);document.title=data.configuration.title+' — Premium';
 $('status').textContent='Published premium';$('controls').hidden=false;
 $('paper-entry').href='/api/entry-form?trial='+encodeURIComponent(slug);
 let mounted=false,lastPhase='';
 function updateWindow(){
  if(!$('entry-status'))return;
  const window=entryWindow(data.configuration);$('entry-status').textContent=window.text;$('entry-status').className=window.phase==='before'?'entry-countdown':'';
  if(window.phase==='open'&&!mounted){
   if(data.onlineEnabled){mountPublicEntry($('entry-panel'),data);mounted=true;}
   else $('entry-status').textContent='Online entry setup is being completed. Please contact the host or use the paper / email form.';
  }
  if(lastPhase==='open'&&window.phase!=='open')for(const control of $('entry-panel').querySelectorAll('input,select,textarea,button'))control.disabled=true;
  lastPhase=window.phase;
 }
 updateWindow();setInterval(updateWindow,1000);
}
$('print').addEventListener('click',()=>window.print());
load().catch(error=>{$('status').textContent=error.message;});
