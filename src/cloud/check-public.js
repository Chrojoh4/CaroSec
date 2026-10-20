import {readFile} from 'node:fs/promises';
const {url,publishableKey}=JSON.parse(await readFile(new URL('../../hosted/public-config.json',import.meta.url),'utf8'));
for(const table of ['caro_clubs','caro_memberships','caro_trials','caro_entries','caro_ledger','caro_scores','caro_audit']){
  const response=await fetch(`${url}/rest/v1/${table}?select=*&limit=1`,{headers:{apikey:publishableKey}});
  if(![401,403].includes(response.status))throw new Error(`Unexpected anonymous access response for ${table}: ${response.status}`);
  console.log(`${table}: anonymous access denied (${response.status})`);
}
const response=await fetch(`${url}/rest/v1/caro_public_trials?select=trial_id&limit=1`,{headers:{apikey:publishableKey}});
if(response.status!==200)throw new Error(`Public listing check failed: ${response.status}`);
const rows=await response.json();console.log(`Public listing readable: ${rows.length} visible listings (limit 1).`);
