import {fillOfficialFields} from './fill.js';
import {officialEventText} from '../../src/domain/official-application.js';
const $=id=>document.getElementById(id);let packet=null;
function accept(value){
 if(value?.kind!=='caro-official-application-transfer'||value.version!==1||!value.fields||!Array.isArray(value.events)||value.events.length>150)throw new Error('Choose a CARO Secretary application transfer file.');
 packet=value;$('trial').textContent=value.trial.title+(value.trial.practice?' - PRACTICE: filling the official site is blocked':'');$('events').value=officialEventText(value);$('fill').disabled=value.trial.practice!==false;$('review').checked=false;
}
$('file').addEventListener('change',async()=>{packet=null;$('fill').disabled=true;$('trial').textContent=$('events').value='';$('results').replaceChildren();await chrome.storage.session.remove('caroApplication');try{const file=$('file').files[0];if(!file||file.size>150000)throw new Error('Choose a transfer file smaller than 150 KB.');accept(JSON.parse(await file.text()));await chrome.storage.session.set({caroApplication:packet});$('status').textContent='Imported. Review the details before filling.';}catch(error){$('status').textContent=error.message;}});
$('fill').addEventListener('click',async()=>{
 $('fill').disabled=true;try{
  if(!packet||!$('review').checked)throw new Error('Review the imported trial and check the confirmation first.');
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id||!/^https:\/\/app\.canadianrallyo\.ca\/trialapplication\/?(?:[?#]|$)/.test(tab.url||''))throw new Error('Open CARO’s official Trial Application in the active tab.');
  const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:fillOfficialFields,args:[packet,$('overwrite').checked]});
  $('results').replaceChildren();for(const row of result.result||[]){const li=document.createElement('li');li.textContent=row.field+': '+row.status;$('results').append(li);}
  $('status').textContent='Review the fields on CARO. Use its own controls to continue. No application was submitted.';
 }catch(error){$('status').textContent=error.message;}finally{$('fill').disabled=packet?.trial.practice!==false;}
});
$('clear').addEventListener('click',async()=>{await chrome.storage.session.remove('caroApplication');packet=null;$('trial').textContent=$('events').value='';$('results').replaceChildren();$('fill').disabled=true;$('status').textContent='Imported application forgotten.';});
const saved=await chrome.storage.session.get('caroApplication');if(saved.caroApplication)try{accept(saved.caroApplication);}catch{await chrome.storage.session.remove('caroApplication');}
