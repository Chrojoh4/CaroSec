import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createBackup,readBackup,validateRecords} from '../src/adapters/records-backup.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function safePath(input,createParent=false){
  const path=resolve(root,input),part=relative(root,path);
  if(!part||part.startsWith('..')||isAbsolute(part))throw new Error('Use a file inside E:\\CARO.');
  // Resolve every existing ancestor before creating a directory; reject junction escapes.
  let parent=dirname(path),missing=[];
  while(true){try{const actual=await realpath(parent),r=relative(root,actual);if(r.startsWith('..')||isAbsolute(r))throw new Error('Path escapes CARO through a link.');break;}catch(error){if(error.code!=='ENOENT')throw error;missing.push(parent);parent=dirname(parent);}}
  if(createParent)for(const folder of missing.reverse())await mkdir(folder);
  try{const actual=await realpath(path),r=relative(root,actual);if(r.startsWith('..')||isAbsolute(r))throw new Error('File escapes CARO through a link.');}catch(error){if(error.code!=='ENOENT')throw error;}
  return path;
}
async function main(){
  const [command,source,target]=process.argv.slice(2);
  if(!['create','verify','restore'].includes(command)||!source||(command!=='verify'&&!target))throw new Error('Usage: npm run records:backup -- create <records.json> <new-backup.json> | verify <backup.json> | restore <backup.json> <new-records.json>');
  const input=await safePath(source);const bytes=await readFile(input,'utf8');
  if(Buffer.byteLength(bytes)>50*1024*1024)throw new Error('Backup exceeds the 50 MB recovery limit.');
  const parsed=JSON.parse(bytes);
  const records=command==='create'?validateRecords(parsed):readBackup(parsed);
  if(command==='verify'){console.log(`Verified revision ${records.revision}: ${Object.keys(records.trials).length} trials, ${records.entries.length} entries, ${records.audit.length} journal records.`);return;}
  const output=await safePath(target,true);
  // wx never replaces an existing trial record or backup, including symlinks.
  await writeFile(output,JSON.stringify(command==='create'?createBackup(records):records,null,2),{encoding:'utf8',flag:'wx'});
  console.log(`${command==='create'?'Backup created':'Recovered copy created'}: ${output}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
