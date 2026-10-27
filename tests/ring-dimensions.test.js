import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeRingDimension,ringDimensionError} from '../hosted/ring-dimensions.js';
test('50 by 50 and decimal dimensions save as database-compatible numbers',()=>{
 for(const v of ['50',' 50 ','50.','50.5','.5']){const normalized=normalizeRingDimension(v);assert.match(normalized,/^[0-9]+(?:\.[0-9]+)?$/);assert.equal(ringDimensionError({ringWidth:normalized,ringLength:'50'}),'');}
 assert.equal(normalizeRingDimension(' 50 '),'50');
});
test('missing, zero, negative and unit-suffixed dimensions identify the field',()=>{
 for(const v of ['',null,'0','-5','50 feet','Infinity'])assert.match(ringDimensionError({ringWidth:v,ringLength:'50'}),/Ring width/);
 assert.match(ringDimensionError({ringWidth:'50',ringLength:'0'}),/Ring length/);
});
