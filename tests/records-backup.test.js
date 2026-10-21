import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyRecords} from '../src/domain/secretary.js';
import {createBackup,readBackup} from '../src/adapters/records-backup.js';
import {sampleScenario} from '../src/sample-scenario.js';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

test('recovery round trip preserves the complete sample including mixed waitlists, money and journal',async()=>{
  const {state}=await sampleScenario();const backup=createBackup(state);const recovered=readBackup(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(recovered,state);recovered.entries[0].status='changed';assert.notEqual(recovered.entries[0].status,state.entries[0].status);
});
test('recovery rejects changed bytes, unsupported formats and broken references',()=>{
  const backup=createBackup(emptyRecords());backup.records.revision++;assert.throws(()=>readBackup(backup),/checksum/);
  assert.throws(()=>readBackup(emptyRecords()),/supported/);
  const state=emptyRecords();state.entries.push({id:'orphan',trialId:'missing',selections:[]});assert.throws(()=>createBackup(state),/orphaned/);
});
test('recovery command writes a separate copy and refuses to overwrite existing records',async()=>{
  const root=resolve(import.meta.dirname,'..');await mkdir(resolve(root,'tmp'),{recursive:true});const directory=await mkdtemp(resolve(root,'tmp/recovery-test-'));
  const source=resolve(directory,'records.json'),backup=resolve(directory,'backup.json'),target=resolve(directory,'recovered.json');
  await writeFile(source,JSON.stringify(emptyRecords()));
  const run=(...args)=>execFileSync(process.execPath,['scripts/records-backup.js',...args],{cwd:root,encoding:'utf8',stdio:'pipe'});
  run('create',source,backup);assert.match(run('verify',backup),/Verified revision 0/);run('restore',backup,target);
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')),emptyRecords());
  assert.throws(()=>run('restore',backup,target),/EEXIST/);assert.equal(await readFile(source,'utf8'),JSON.stringify(emptyRecords()));
  assert.throws(()=>run('create',source,'../outside-caro.json'),/inside/);
});
