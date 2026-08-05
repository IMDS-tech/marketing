import test from'node:test';import assert from'node:assert/strict';
import{validateMetricRows,assertQualityThreshold}from'../src/data-quality.js';
const source={id:'source-1',agency_id:'agency-1',client_id:'client-1',integration_slug:'meta-ads'};
const row={agency_id:'agency-1',client_id:'client-1',data_source_id:'source-1',integration_slug:'meta-ads',entity_type:'campaign',entity_id:'campaign-1',metric_date:'2026-08-05',metric_key:'spend',value:'12.5',dimensions:{campaign_name:'Test'}};

test('quality gate normalizes valid rows and removes duplicates',()=>{const result=validateMetricRows([row,{...row}],source);assert.equal(result.acceptedCount,1);assert.equal(result.duplicates,1);assert.equal(result.accepted[0].value,12.5);assert.equal(result.reasons.duplicate,1)});
test('quality gate rejects cross-tenant and malformed metrics',()=>{const result=validateMetricRows([{...row,agency_id:'other'},{...row,metric_date:'bad'},{...row,value:Infinity}],source);assert.equal(result.acceptedCount,0);assert.deepEqual(result.reasons,{tenant_mismatch:1,invalid_metric_date:1,invalid_value:1});assert.throws(()=>assertQualityThreshold(result),/none passed/)});
test('quality threshold rejects large mostly-invalid provider responses',()=>{const rows=Array.from({length:10},(_,i)=>i<2?{...row,entity_id:`ok-${i}`}:{...row,entity_id:`bad-${i}`,metric_key:'Bad Key'});const result=validateMetricRows(rows,source);assert.throws(()=>assertQualityThreshold(result,{minimumAcceptanceRate:.8}),/below 80%/)});
