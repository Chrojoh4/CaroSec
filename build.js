import {mkdir,readdir,copyFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {publicAuthConfig} from './src/cloud/auth.js';
const root=import.meta.dirname;
const output=resolve(root,'public');
await mkdir(output,{recursive:true});
const unexpected=(await readdir(output)).filter(name=>!['index.html','staff.js','staff.css','premium.css','public-trial.html','public-trial.js','public-trial.css'].includes(name));
if(unexpected.length)throw new Error('Public build contains unexpected files; refusing to publish.');
// This checked-in configuration contains only the browser-safe publishable key.
// Explicit environment configuration, if supplied, must also pass validation.
const defaults=JSON.parse(await readFile(resolve(root,'hosted/public-config.json'),'utf8'));
const config=publicAuthConfig({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL??defaults.url,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??defaults.publishableKey});
await build({entryPoints:[resolve(root,'hosted/staff.js')],outfile:resolve(output,'staff.js'),bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',loader:{'.css':'text'},define:{__CARO_PUBLIC_CONFIG__:JSON.stringify(config)}});
await copyFile(resolve(root,'hosted/index.html'),resolve(output,'index.html'));
await copyFile(resolve(root,'hosted/staff.css'),resolve(output,'staff.css'));
await copyFile(resolve(root,'hosted/premium.css'),resolve(output,'premium.css'));
console.log('Built staff login and club workspace. Only the public Supabase URL/key are bundled.');

await build({entryPoints:[resolve(root,'hosted/public-trial.js')],outfile:resolve(output,'public-trial.js'),bundle:true,minify:true,platform:'browser',format:'esm',target:'es2022',define:{__CARO_PUBLIC_CONFIG__:JSON.stringify(config)}});
for(const file of ['public-trial.html','public-trial.css'])await copyFile(resolve(root,'hosted',file),resolve(output,file));
