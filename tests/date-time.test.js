import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dateInZone,timestampLabel,validCalendarDate} from '../src/domain/date-time.js';
import {workingReport} from '../web/reports.js';

test('calendar dates reject impossible days and never pretend to be instants',()=>{
  assert.equal(validCalendarDate('2028-02-29'),true);
  assert.equal(validCalendarDate('2026-02-29'),false);
  assert.equal(validCalendarDate('2026-10-18T00:00:00Z'),false);
  assert.throws(()=>dateInZone('2026-10-18','America/Edmonton'),/explicit offset/);
  assert.throws(()=>dateInZone('2026-10-18T12:00:00','America/Edmonton'),/explicit offset/);
});
test('entry calendar day comes from the selected venue zone, including half-hour zones',()=>{
  assert.equal(dateInZone('2026-10-19T01:00:00Z','America/Edmonton'),'2026-10-18');
  assert.equal(dateInZone('2026-10-19T01:00:00Z','Asia/Tokyo'),'2026-10-19');
  assert.equal(dateInZone('2026-10-19T02:15:00Z','America/St_Johns'),'2026-10-18');
  assert.equal(dateInZone('2026-10-19T02:30:00Z','America/St_Johns'),'2026-10-19');
});
test('daylight-saving transitions use the correct offset and repeated hour remains distinguishable',()=>{
  assert.match(timestampLabel('2026-03-08T08:59:00Z','America/Edmonton'),/1:59:00.*GMT-7/);
  assert.match(timestampLabel('2026-03-08T09:00:00Z','America/Edmonton'),/3:00:00.*GMT-6/);
  assert.match(timestampLabel('2026-11-01T07:30:00Z','America/Edmonton'),/1:30:00.*GMT-6/);
  assert.match(timestampLabel('2026-11-01T08:30:00Z','America/Edmonton'),/1:30:00.*GMT-7/);
});
test('date labels and date arithmetic stay identical on computers in different zones',()=>{
  const script=`import {dateLabel} from './src/domain/premium.js';
    import {dateInZone,timestampLabel} from './src/domain/date-time.js';
    import {trialDays} from './src/domain/trial-workspace.js';
    console.log(JSON.stringify([dateLabel('2026-11-01'),trialDays({date:'2026-10-31',endDate:'2026-11-02'}),dateInZone('2026-10-19T01:00:00Z','America/Edmonton'),timestampLabel('2026-10-19T01:00:00Z','America/Edmonton')]));`;
  const outputs=['UTC','America/Vancouver','Asia/Tokyo'].map(TZ=>execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:process.cwd(),env:{...process.env,TZ},encoding:'utf8'}));
  assert.equal(outputs[0],outputs[1]);assert.equal(outputs[1],outputs[2]);
});
test('invalid timestamps and venue zones do not silently use the computer zone',()=>{
  assert.match(timestampLabel('bad','America/Edmonton'),/Time unavailable/);
  assert.match(timestampLabel('2026-10-19T01:00:00Z',undefined),/Time unavailable/);
  assert.throws(()=>dateInZone('2026-10-19T01:00:00Z',undefined),/explicit trial timezone/);
  assert.match(timestampLabel('2026-10-19T01:00:00Z','bad-zone'),/Time unavailable/);
});
test('printed incident report displays the venue date, offset and zone while source keeps UTC',()=>{
  const occurredAt='2026-10-19T01:00:00Z';
  const state={trials:{t:{id:'t',title:'Test',timezone:'America/Edmonton'}},entries:[],incidents:[{trialId:'t',occurredAt,category:'Other',description:'Test'}]};
  const report=workingReport(state,'t','incidents');
  assert.match(report,/Oct 18, 2026/);assert.match(report,/GMT-6/);assert.match(report,/America\/Edmonton/);
  assert.equal(state.incidents[0].occurredAt,occurredAt);
});
