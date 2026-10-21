import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {sampleScenario} from './sample-scenario.js';
const directory=resolve(import.meta.dirname,'../data/practice');
const file=resolve(directory,'records.json');await mkdir(directory,{recursive:true});
try{const data=JSON.parse(await readFile(file,'utf8'));if(data.schemaVersion!==1)throw new Error('Existing practice records are not recognized. Preserve them and review before continuing.');console.log('Reusing saved practice records.');}
catch(error){if(error.code!=='ENOENT')throw error;const {state}=await sampleScenario();await writeFile(file,JSON.stringify(state,null,2),{flag:'wx'});console.log('Created fictional RallyPaws practice records.');}
process.env.CARO_RECORDS_FILE='data/practice/records.json';process.env.CARO_PORT=process.env.CARO_PORT||'4322';
console.log('PRACTICE ONLY. Separate records: '+file);await import('./server.js');
