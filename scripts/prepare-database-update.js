import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const applied=new Set(['202610190001_caro_foundation.sql','20261020153706_hosted_trial_drafts.sql']);
export async function databaseUpdate(){
 const directory=resolve(root,'supabase/migrations'),names=(await readdir(directory)).filter(name=>/^\d+_[a-z_]+\.sql$/.test(name)&&!applied.has(name)).sort();
 const files=[],parts=['-- CARO prepared update. Inspect live migration state before execution.','-- Requires the two foundation migrations already applied. Promotes no user.','begin;'];
 for(const name of names){
  const source=await readFile(resolve(directory,name),'utf8'),begin=source.match(/^begin;\s*$/im),commit=source.match(/^commit;\s*$/im);
  if(!begin||!commit||commit.index<begin.index||source.slice(commit.index+commit[0].length).trim())throw new Error('Review transaction boundaries in '+name);
  const body=source.slice(0,begin.index)+source.slice(begin.index+begin[0].length,commit.index);
  files.push({name,sha256:createHash('sha256').update(source).digest('hex')});parts.push('\n-- BEGIN SOURCE '+name+'\n'+body+'\n-- END SOURCE '+name);
 }
 parts.push('commit;');return {sql:parts.join('\n')+'\n',files};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const bundle=await databaseUpdate(),directory=resolve(root,'output/deployment',new Date().toISOString().replace(/[:.]/g,'-'));await mkdir(directory,{recursive:true});
 await writeFile(resolve(directory,'prepared-update.sql'),bundle.sql,{flag:'wx'});await writeFile(resolve(directory,'migration-manifest.json'),JSON.stringify({preparedAt:new Date().toISOString(),alreadyApplied:[...applied],files:bundle.files},null,2),{flag:'wx'});
 console.log(JSON.stringify({directory,migrations:bundle.files.length,applied:false},null,2));
}
