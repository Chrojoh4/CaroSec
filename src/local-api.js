import { resolve, sep } from 'node:path';
import { readFile, mkdir, stat,unlink } from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {premiumPdfPacket} from './domain/premium-pdf.js';
import {judgePacket} from './domain/judge-packet.js';
import { execFile } from 'node:child_process';
import { LocalRecords } from './adapters/local-records.js';
import {withdrawRun,changeRunStatus} from './domain/secretary.js';
import { DeskError, makeTrialConfig, installTrial, submitEntry, receipt, changeEntryStatus, postFinance, postExpense, setRunningOrder, recordScore, completeEvent, approveMoveUp, recordAccommodation, recordIncident, recordTrialAdmin, recordRibbonClaim } from './domain/secretary.js';
export function createLocalApi(root,port) {
  const path=resolve(root,process.env.CARO_RECORDS_FILE || 'data/records.json');
  if(!path.startsWith(root+sep))throw new Error('CARO records must stay inside the project directory');
  const records=new LocalRecords(path), cache=new Map(), rates=new Map(), pdfJobs=new Map();
  const json=(response,status,value)=>{response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});response.end(JSON.stringify(value));};
  async function body(request) {
    if(!request.headers['content-type']?.startsWith('application/json'))throw new DeskError('JSON content is required.',415);
    let text='';for await(const chunk of request){text+=chunk;if(Buffer.byteLength(text)>300000)throw new DeskError('Request is too large.',413);}try{return JSON.parse(text);}catch{throw new DeskError('Invalid JSON.');}
  }
  async function exportPdf(script,packet,filename,response){
    const directory=resolve(root,'data/pdf');await mkdir(directory,{recursive:true});const pdf=resolve(directory,'export-'+randomUUID()+'.pdf');
    const python=process.env.CARO_PYTHON||resolve(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
    try{
      await new Promise((done,reject)=>{const child=execFile(python,[resolve(root,'src/pdf',script),pdf],{cwd:root,timeout:30000,maxBuffer:2000000,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}},error=>error?reject(error):done());child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(packet));});
      const bytes=await readFile(pdf);response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'});response.end(bytes);
    }finally{await unlink(pdf).catch(()=>{});await unlink(pdf+'.next').catch(()=>{});}
  }
  async function lookup(id) {
    if(!/^\d{1,12}$/.test(id))throw new DeskError('The public CARO lookup supports a numeric dog ID. You can still enter manually.');
    const saved=cache.get(id);if(saved&&Date.now()-saved.time<600000)return saved.value;
    const parts=await Promise.all(['rally','working'].map(async discipline=>{
      try {
        const response=await fetch(`https://app.canadianrallyo.ca/api/dog-results/${discipline}/${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});
        const raw=await response.text();if(raw.length>2000000)throw new Error('response size');const data=JSON.parse(raw);
        if(response.status===404&&data.message==='No results found for the provided dog ID.')return {discipline,status:'no_results',records:[]};
        if(!response.ok||!Array.isArray(data)||data.length>5000)throw new Error('response schema');
        const fields=['trial_start_date','trial_number','round_number','judge_name','event_level','score','status','stream','trial_host_name','event_category','exercise_name','exercise_level','result','exercise','level','outcome'];
        const rows=data.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('row');return Object.fromEntries(fields.filter(key=>Object.hasOwn(row,key)&&['string','number'].includes(typeof row[key])).map(key=>[key,String(row[key]).slice(0,500)]));});
        if(rows.some(row=>!Object.keys(row).length))throw new Error('unsupported result schema');
        return {discipline,status:rows.length?'available':'no_results',records:rows};
      } catch {return {discipline,status:'unavailable',records:[]};}
    }));
    const value={queriedDogId:id,sourceUrl:'https://canadianrallyo.ca/quick-results/',fetchedAt:new Date().toISOString(),sourceAsOf:null,parts};
    if(parts.every(part=>part.status!=='unavailable')){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(id,{time:Date.now(),value});}return value;
  }
  return async function handle(request,response,url) {
    if(!url.pathname.startsWith('/api/'))return false;
    try {
      const allowed=new Set([`localhost:${port}`,`127.0.0.1:${port}`]);
      if(!allowed.has(request.headers.host))throw new DeskError('Local workspace host required.',403);
      const origin=request.headers.origin;if(origin&&!allowed.has(new URL(origin).host))throw new DeskError('Cross-origin writes are not permitted.',403);
      if(request.method==='GET'&&url.pathname==='/api/desk'){json(response,200,await records.read());return true;}
      if(request.method==='GET'&&url.pathname==='/api/practice-workspace'){
        if(process.env.CARO_RECORDS_FILE!=='data/practice/records.json')throw new DeskError('Practice workspace is available only in the isolated practice server.',404);
        const {sampleScenario}=await import('./sample-scenario.js');const {premium,trial}=await sampleScenario();json(response,200,{draft:premium,trial,editions:[]});return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/public-trial'){
        const state=await records.read(),id=url.searchParams.get('trial'),trial=Object.hasOwn(state.trials,id)&&state.trials[id];if(!trial)throw new DeskError('Trial not found. Prepare the entry form from the secretary desk first.',404);json(response,200,trial);return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/receipt'){
        const token=url.searchParams.get('token');const state=await records.read(),entry=state.entries.find(entry=>entry.receiptToken===token);if(!entry)throw new DeskError('Receipt not found.',404);json(response,200,receipt(entry));return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/dog-results'){
        const key=request.socket.remoteAddress,rate=rates.get(key)||{since:Date.now(),count:0};if(Date.now()-rate.since>60000){rate.since=Date.now();rate.count=0;}if(++rate.count>20)throw new DeskError('Please wait a minute before another lookup.',429);rates.set(key,rate);json(response,200,await lookup(url.searchParams.get('id')||''));return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/judge-sheets'){
        const state=await records.read(),packet=judgePacket(state,url.searchParams.get('trial'),url.searchParams.get('event'));
        const directory=resolve(root,'data/pdf');await mkdir(directory,{recursive:true});const pdf=resolve(directory,'judges-'+randomUUID()+'.pdf');
        const python=process.env.CARO_PYTHON||resolve(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
        try{
          await new Promise((done,reject)=>{const child=execFile(python,[resolve(root,'src/pdf/judge_sheets.py'),pdf],{cwd:root,timeout:30000,maxBuffer:2000000,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}},error=>error?reject(error):done());child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(packet));});
          const bytes=await readFile(pdf);response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="CARO-judge-working-sheets.pdf"','Cache-Control':'no-store'});response.end(bytes);
        }finally{await unlink(pdf).catch(()=>{});await unlink(pdf+'.next').catch(()=>{});}
        return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/official-form'){
        const files={rally:'scoresheet-rally.pdf',working:'scoresheet-working-2026.pdf',rallyRecord:'judges-record-rally.pdf',workingRecord:'judges-record-working-2026.pdf',catalogue:'trial-catalogue.pdf',fees:'trial-fee-schedule-2026.pdf'};
        const file=files[url.searchParams.get('type')];if(!file)throw new DeskError('Form not found.',404);
        response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${file}"`,'Cache-Control':'no-store'});response.end(await readFile(resolve(root,'docs/reference',file)));return true;
      }
      if(request.method==='GET'&&url.pathname==='/api/entry-form'){
        const state=await records.read(),id=url.searchParams.get('trial'),trial=state.trials[id];if(!trial||!/^[a-f0-9]{24}$/.test(id||''))throw new DeskError('Trial not found.',404);
        const directory=resolve(root,'data/pdf');await mkdir(directory,{recursive:true});const pdf=resolve(directory,`${id}.pdf`);
        const script=resolve(root,'src/pdf/entry_form.py');
        let stale=true;try{stale=(await stat(pdf)).mtimeMs<(await stat(script)).mtimeMs;}catch(error){if(error.code!=='ENOENT')throw error;}
        if(stale){
          if(!pdfJobs.has(id)){
            const job=(async()=>{
              const python=process.env.CARO_PYTHON||resolve(process.env.USERPROFILE||'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
              const child=execFile(python,[script,pdf],{cwd:root,timeout:30000,maxBuffer:2000000,windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}},()=>{});
              const result=new Promise((resolvePromise,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolvePromise():reject(new Error('PDF generation failed')));});
              child.stdin.end(JSON.stringify(trial));await result;
            })();
            pdfJobs.set(id,job);job.then(()=>pdfJobs.delete(id),()=>pdfJobs.delete(id));
          }
          await pdfJobs.get(id);
        }
        response.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="CARO-entry-form.pdf"','Cache-Control':'no-store'});response.end(await readFile(pdf));return true;
      }
      if(request.method!=='POST')throw new DeskError('Endpoint not found.',404);
      const input=await body(request),now=new Date().toISOString();
      if(url.pathname==='/api/premium-pdf'){
        let packet;try{packet=premiumPdfPacket(input.draft);}catch(error){throw new DeskError(error.message);}
        await exportPdf('premium.py',packet,'CARO-trial-premium.pdf',response);return true;
      }
      if(url.pathname==='/api/entries'){json(response,201,await records.mutate(undefined,state=>submitEntry(state,input,'online',now)));return true;}
      if(!Number.isInteger(input.expectedRevision))throw new DeskError('Refresh the secretary records before saving.',409);
      const commands={
        '/api/desk/prepare':state=>installTrial(state,makeTrialConfig(input),now),
        '/api/desk/status':state=>changeEntryStatus(state,input,now),
        '/api/desk/withdraw-run':state=>withdrawRun(state,input,now),
        '/api/desk/run-status':state=>changeRunStatus(state,input,now),
        '/api/desk/manual-entry':state=>submitEntry(state,input.entry,['email','paper'].includes(input.channel)?input.channel:'paper',now),
        '/api/desk/finance':state=>postFinance(state,input,now),
        '/api/desk/expense':state=>postExpense(state,input,now),
        '/api/desk/order':state=>setRunningOrder(state,input,now),
        '/api/desk/score':state=>recordScore(state,input,now),
        '/api/desk/complete-event':state=>completeEvent(state,input,now),
        '/api/desk/move-up':state=>approveMoveUp(state,input,now),
        '/api/desk/accommodation':state=>recordAccommodation(state,input,now),
        '/api/desk/incident':state=>recordIncident(state,input,now),
        '/api/desk/trial-admin':state=>recordTrialAdmin(state,input,now),
        '/api/desk/ribbon-claim':state=>recordRibbonClaim(state,input,now),
      };
      if(!commands[url.pathname])throw new DeskError('Endpoint not found.',404);
      json(response,200,await records.mutate(input.expectedRevision,commands[url.pathname]));
    }catch(error){json(response,error.status||500,{error:error.status?error.message:'The local operation failed. Existing records have been preserved.'});}
    return true;
  };
}
