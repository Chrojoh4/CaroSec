import {createHash} from 'node:crypto';
import {emptyRecords} from '../domain/secretary.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validateRecords(value){
  if(!object(value)||value.schemaVersion!==1||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('Unsupported records schema or revision.');
  const shape=emptyRecords();
  for(const [key,expected] of Object.entries(shape)){
    if(key==='activeTrialId'||key==='schemaVersion'||key==='revision')continue;
    if(Array.isArray(expected)?!Array.isArray(value[key]):!object(value[key]))throw new Error(`Invalid records collection: ${key}.`);
  }
  if(value.activeTrialId!==null&&(!Object.hasOwn(value.trials,value.activeTrialId)))throw new Error('Active trial is missing.');
  const trialIds=new Set(Object.keys(value.trials)),entryIds=new Set();
  for(const [id,trial] of Object.entries(value.trials)){
    if(!object(trial)||trial.id!==id||!Array.isArray(trial.events))throw new Error('Invalid trial record.');
    const events=new Set();for(const event of trial.events){if(!object(event)||typeof event.id!=='string'||events.has(event.id))throw new Error('Invalid or duplicate event.');events.add(event.id);}
  }
  for(const entry of value.entries){
    if(!object(entry)||typeof entry.id!=='string'||entryIds.has(entry.id)||!trialIds.has(entry.trialId)||!Array.isArray(entry.selections))throw new Error('Invalid, duplicate or orphaned entry.');
    entryIds.add(entry.id);const events=new Set(value.trials[entry.trialId].events.map(event=>event.id));
    if(entry.selections.some(line=>!object(line)||!events.has(line.eventId)))throw new Error('Entry references a missing event.');
  }
  for(const row of [...value.ledger,...value.scores])if(!object(row)||!entryIds.has(row.entryId)||!trialIds.has(row.trialId))throw new Error('Ledger or score references a missing entry/trial.');
  return value;
}
export function createBackup(records,createdAt=new Date().toISOString()){
  const snapshot=structuredClone(validateRecords(records));
  return {format:'caro-local-records-backup',version:1,createdAt,sha256:digest(snapshot),records:snapshot};
}
export function readBackup(value){
  if(!object(value)||value.format!=='caro-local-records-backup'||value.version!==1)throw new Error('This is not a supported CARO recovery backup.');
  if(typeof value.sha256!=='string'||value.sha256!==digest(value.records))throw new Error('Backup checksum does not match. The file may have changed or been damaged.');
  return structuredClone(validateRecords(value.records));
}
