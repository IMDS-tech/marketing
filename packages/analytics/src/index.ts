export type MetricAggregation='sum'|'avg'|'weighted'|'last';
export interface MetricDefinition{key:string;label:string;type:'int'|'float'|'currency'|'percent'|'duration';aggregation:MetricAggregation}
export const coreMetrics:MetricDefinition[]=[{key:'impressions',label:'Показы',type:'int',aggregation:'sum'},{key:'clicks',label:'Клики',type:'int',aggregation:'sum'},{key:'spend',label:'Расход',type:'currency',aggregation:'sum'},{key:'leads',label:'Лиды',type:'int',aggregation:'sum'},{key:'revenue',label:'Выручка',type:'currency',aggregation:'sum'}];
