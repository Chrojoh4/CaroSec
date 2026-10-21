import {readdir,mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve,relative,dirname,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'tmp/releases',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
const blocked=new Set(['reference','source-extracts','node_modules','.git','.codex','.agents','data','output','tmp','public','checks','__pycache__']);
const allowedRoots=['api','src','web','hosted','tests','fixtures','supabase/migrations','scripts','docs'];
const rootFiles=['package.json','package-lock.json','build.js','vercel.json','index.html','README.md','AGENTS.md','.gitignore','.vercelignore','.python-version','requirements.txt','requirements-dev.txt'];
const files=[];
async function walk(directory){for(const item of await readdir(resolve(root,directory),{withFileTypes:true})){if(blocked.has(item.name)||item.name.startsWith('.env'))continue;const path=directory+'/'+item.name;if(item.isDirectory())await walk(path);else if(item.isFile()&&/\.(js|json|py|html|css|md|sql)$/.test(item.name))files.push(path);}}
for(const directory of allowedRoots)await walk(directory);files.push(...rootFiles);
await mkdir(output,{recursive:true});const manifest=[];
for(const path of [...new Set(files)].sort()){
 const source=resolve(root,path),target=resolve(output,path);
 if(!source.startsWith(root+sep)||!target.startsWith(output+sep))throw new Error('Release path escaped its directory.');
 const bytes=await readFile(source);
 // The auth negative test intentionally supplies this exact noncredential string.
 const scanned=bytes.toString('utf8').replaceAll('sb_secret_wrong','');
 if(/sb_secret_[A-Za-z0-9_-]+|SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/g.test(scanned))throw new Error('Possible server secret in '+path+'; release stopped.');
 await mkdir(dirname(target),{recursive:true});await copyFile(source,target);manifest.push({path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await writeFile(resolve(output,'RELEASE-MANIFEST.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
console.log(JSON.stringify({directory:output,files:manifest.length,excluded:'Environment files, live records, downloaded reference PDFs, caches, generated output and private SQL checks'},null,2));
