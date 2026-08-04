import {Link,useParams} from '@tanstack/react-router';
import {getModuleById,isImplementedModule} from '../modules/navigation';
import {getModuleDelivery,moduleCompletionCriteria,moduleDeliveryLabels} from '../modules/progress';

export function ModulePlaceholderPage(){
  const{moduleId}=useParams({strict:false}) as {moduleId?:string};
  const result=getModuleById(moduleId);
  if(!result)return <div className="module-placeholder"><h2>Модуль не найден</h2><Link to="/platform/modules">Открыть каталог модулей</Link></div>;
  const{domain,module}=result;
  const delivery=getModuleDelivery(module.id);
  const notice=delivery.status==='complete'
    ?'Модуль полностью завершён вместе со всеми подмодулями и внутренними страницами.'
    :delivery.status==='error'
      ?delivery.note||'В модуле есть блокирующая ошибка. До исправления он не считается завершённым.'
      :delivery.status==='in_progress'
        ?'Работа над модулем начата, но не все критерии завершения выполнены.'
        :'К реализации модуля ещё не приступали.';
  return <div className="module-placeholder">
    <header className="module-placeholder__header">
      <div><span className="crumb">{domain.name}</span><h2>{module.name}</h2><p>{module.description}</p></div>
      <span className={`module-status module-status--${delivery.status}`}>{moduleDeliveryLabels[delivery.status]}</span>
    </header>
    <section className="module-placeholder__notice"><strong>{isImplementedModule(module.id)?'Рабочая страница подключена':'Архитектурный маршрут подключён'}</strong><p>{notice}</p></section>
    <div className="module-placeholder__grid">
      <section className="module-panel"><h3>Подмодули</h3><div className="submodule-list">{module.submodules.map(item=><div key={item}><span>◇</span>{item}</div>)}</div></section>
      <aside className="module-panel"><h3>Архитектура</h3><dl><dt>Module ID</dt><dd>{module.id}</dd><dt>Surface</dt><dd>{module.surface}</dd><dt>Lifecycle</dt><dd>{module.status}</dd><dt>Delivery status</dt><dd>{moduleDeliveryLabels[delivery.status]}</dd><dt>Route</dt><dd>{module.route||'назначается через module registry'}</dd><dt>Permissions</dt><dd>{module.permissions.join(', ')||'не назначены'}</dd><dt>Entitlements</dt><dd>{module.entitlements.join(', ')||'не назначены'}</dd><dt>Dependencies</dt><dd>{module.dependencies.join(', ')||'нет'}</dd></dl></aside>
    </div>
    <section className="module-panel"><h3>Когда модуль можно отметить синим</h3><div className="completion-criteria">{moduleCompletionCriteria.map(item=><div key={item}><i/>{item}</div>)}</div></section>
  </div>;
}
