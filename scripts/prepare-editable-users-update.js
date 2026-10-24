import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function editableUsersUpdate(){
 const names=['20261024204328_administrator_user_directory.sql','20261024205103_editable_users.sql'];
 const parts=['-- CARO editable users: corrected SQL-only update. Run the complete file once.','-- Preserves existing account access and trial records. RLS is included.','begin;'];
 for(const name of names){
  const source=await readFile(resolve(root,'supabase/migrations',name),'utf8');
  const begin=source.match(/^begin;\s*$/im),commit=source.match(/^commit;\s*$/im);
  if(!begin||!commit||commit.index<begin.index)throw new Error('Invalid migration transaction: '+name);
  let body=source.slice(begin.index+begin[0].length,commit.index);
  if(name.includes('user_directory'))body=body.replaceAll('create function ','create or replace function ');
  parts.push('-- '+name,body);
 }
 parts.push('commit;',"select to_regclass('public.caro_users') as editable_users_table;");
 return parts.join('\n')+'\n';
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const sql=await editableUsersUpdate(),directory=resolve(root,'output/deployment/editable-users-20261024');await mkdir(directory,{recursive:true});
 for(const name of ['apply-editable-users.sql','apply-editable-users-corrected.sql'])await writeFile(resolve(directory,name),sql);
 console.log('Wrote corrected SQL-only editable-users update ('+sql.length+' characters).');
}
