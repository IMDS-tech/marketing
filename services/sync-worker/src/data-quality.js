const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const METRIC_RE=/^[a-z][a-z0-9_]*$/;
const ENTITY_TYPES=new Set(['account','campaign','adgroup','ad','keyword','page','country','device','age','gender']);

function reasonFor(row,source){
  if(!row||typeof row!=='object')return'not_object';
  if(row.agency_id!==source.agency_id||row.client_id!==source.client_id||row.data_source_id!==source.id)return'tenant_mismatch';
  if(!row.integration_slug||row.integration_slug!==source.integration_slug)return'provider_mismatch';
  if(!ENTITY_TYPES.has(row.entity_type))return'invalid_entity_type';
  if(typeof row.entity_id!=='string'||!row.entity_id.trim())return'missing_entity_id';
  if(typeof row.metric_date!=='string'||!DATE_RE.test(row.metric_date)||Number.isNaN(Date.parse(`${row.metric_date}T00:00:00Z`)))return'invalid_metric_date';
  if(typeof row.metric_key!=='string'||!METRIC_RE.test(row.metric_key))return'invalid_metric_key';
  if(!Number.isFinite(Number(row.value)))return'invalid_value';
  if(row.dimensions!==undefined&&(row.dimensions===null||Array.isArray(row.dimensions)||typeof row.dimensions!=='object'))return'invalid_dimensions';
  if(row.source_updated_at!==undefined&&row.source_updated_at!==null&&Number.isNaN(Date.parse(row.source_updated_at)))return'invalid_source_updated_at';
  return null;
}

function key(row){return[row.agency_id,row.client_id,row.data_source_id,row.integration_slug,row.entity_type,row.entity_id,row.metric_date,row.metric_key].join('|')}

export function validateMetricRows(rows,source){
  if(!Array.isArray(rows))throw new TypeError('Provider adapter must return an array of metric rows');
  const accepted=[];const rejected=[];const reasons={};const seen=new Set();let duplicates=0;
  for(const candidate of rows){
    const reason=reasonFor(candidate,source);
    if(reason){reasons[reason]=(reasons[reason]||0)+1;rejected.push({reason,row:candidate});continue}
    const normalized={...candidate,entity_id:candidate.entity_id.trim(),metric_key:candidate.metric_key.trim(),value:Number(candidate.value),dimensions:candidate.dimensions||{}};
    const dedupe=key(normalized);if(seen.has(dedupe)){duplicates+=1;reasons.duplicate=(reasons.duplicate||0)+1;continue}
    seen.add(dedupe);accepted.push(normalized);
  }
  return{accepted,rejected,reasons,duplicates,received:rows.length,acceptedCount:accepted.length,rejectedCount:rejected.length+duplicates,acceptanceRate:rows.length?accepted.length/rows.length:1};
}

export function assertQualityThreshold(result,{minimumAcceptanceRate=0.8}={}){
  if(result.received>0&&result.acceptedCount===0){const error=new Error('Provider returned rows but none passed data-quality validation');error.code='DATA_QUALITY_EMPTY';error.retryable=false;error.quality=result;throw error}
  if(result.received>=10&&result.acceptanceRate<minimumAcceptanceRate){const error=new Error(`Data-quality acceptance rate ${Math.round(result.acceptanceRate*100)}% is below ${Math.round(minimumAcceptanceRate*100)}%`);error.code='DATA_QUALITY_THRESHOLD';error.retryable=false;error.quality=result;throw error}
  return result;
}
