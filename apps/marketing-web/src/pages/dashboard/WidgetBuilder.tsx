import {useMemo,useState} from 'react';
import {X} from 'lucide-react';
import type {DashboardWidget,IntegrationOption,MetricOption,WidgetType} from './types';

type Props={
  open:boolean;
  metrics:MetricOption[];
  integrations:IntegrationOption[];
  initial?:DashboardWidget|null;
  onClose:()=>void;
  onSave:(widget:DashboardWidget)=>void;
  sectionId:string;
  y:number;
};

const types:Array<{value:WidgetType;label:string}>=[
  {value:'stat',label:'Показатель'},
  {value:'line',label:'Линейный график'},
  {value:'bar',label:'Столбцы'},
  {value:'pie',label:'Круговая диаграмма'},
  {value:'table',label:'Таблица'},
];

export function WidgetBuilder({open,metrics,integrations,initial,onClose,onSave,sectionId,y}:Props){
  const firstMetric=metrics[0]?.metric_key||'impressions';
  const [type,setType]=useState<WidgetType>(initial?.type||'stat');
  const [metricKey,setMetricKey]=useState(initial?.metric_key||firstMetric);
  const [integration,setIntegration]=useState(initial?.integration_slug||'');
  const [title,setTitle]=useState(initial?.title||'Новый виджет');
  const [color,setColor]=useState(initial?.color||'#0072EE');
  const [entityType,setEntityType]=useState(initial?.filters_json.entityType||'');
  const [breakdown,setBreakdown]=useState(initial?.settings_json.breakdown||'none');
  const selectedMetric=useMemo(()=>metrics.find(item=>item.metric_key===metricKey),[metrics,metricKey]);
  if(!open)return null;
  function submit(){
    const width=type==='stat'?3:type==='table'?12:6;
    const height=type==='stat'?3:type==='table'?8:7;
    onSave({
      id:initial?.id||`demo-${crypto.randomUUID()}`,
      section_id:initial?.section_id||sectionId,
      type,
      metric_key:metricKey,
      integration_slug:integration||null,
      title:title.trim()||selectedMetric?.label||'Widget',
      x:initial?.x||0,
      y:initial?.y??y,
      w:initial?.w||width,
      h:initial?.h||height,
      color,
      date_range_json:initial?.date_range_json||{},
      filters_json:{entityType:entityType||undefined},
      settings_json:{breakdown},
    });
    onClose();
  }
  return <div className="wb-backdrop" role="dialog" aria-modal="true"><div className="wb-modal"><header><div><small>Dashboard</small><h3>Настройка виджета</h3></div><button onClick={onClose}><X size={18}/></button></header><div className="wb-grid"><label>Название<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Визуализация<select value={type} onChange={e=>setType(e.target.value as WidgetType)}>{types.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Метрика<select value={metricKey} onChange={e=>setMetricKey(e.target.value)}>{metrics.map(item=><option key={item.metric_key} value={item.metric_key}>{item.label}</option>)}</select></label><label>Источник<select value={integration} onChange={e=>setIntegration(e.target.value)}><option value="">Все источники</option>{integrations.map(item=><option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label><label>Тип сущности<select value={entityType} onChange={e=>setEntityType(e.target.value)}><option value="">Все</option><option value="campaign">Campaign</option><option value="adgroup">Ad group</option><option value="ad">Ad</option><option value="keyword">Keyword</option><option value="page">Page</option></select></label><label>Разбивка<select value={breakdown} onChange={e=>setBreakdown(e.target.value as 'none'|'integration'|'entity')}><option value="none">Без разбивки</option><option value="integration">По источнику</option><option value="entity">По сущности</option></select></label><label>Цвет<input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label></div><div className="wb-preview"><span>Preview</span><strong>{title||selectedMetric?.label}</strong><div>{selectedMetric?.label||metricKey}</div><small>{integration?integrations.find(item=>item.slug===integration)?.name:'Все источники'}</small></div><footer><button onClick={onClose}>Отмена</button><button className="primary" onClick={submit}>Добавить виджет</button></footer></div><style>{`.wb-backdrop{position:fixed;inset:0;background:#11182780;display:grid;place-items:center;z-index:1000}.wb-modal{width:min(760px,calc(100vw - 32px));background:#fff;border-radius:12px;box-shadow:0 24px 80px #11182755;overflow:hidden}.wb-modal header,.wb-modal footer{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e5e7eb}.wb-modal footer{border-top:1px solid #e5e7eb;border-bottom:0;justify-content:flex-end;gap:8px}.wb-modal h3{margin:2px 0 0}.wb-modal header button{border:0;background:transparent}.wb-grid{padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px}.wb-grid label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}.wb-grid input,.wb-grid select{border:1px solid #d7dce3;border-radius:7px;padding:9px;background:#fff}.wb-preview{margin:0 20px 20px;padding:18px;border:1px dashed #9ecaff;background:#f5f9ff;border-radius:8px;display:flex;gap:10px;align-items:center}.wb-preview span{font-size:10px;text-transform:uppercase;color:#6b7280}.wb-preview strong{flex:1}.wb-modal footer button{padding:9px 14px;border:1px solid #d7dce3;border-radius:7px;background:#fff}.wb-modal footer button.primary{background:#0072ee;color:#fff;border-color:#0072ee}`}</style></div>
}
