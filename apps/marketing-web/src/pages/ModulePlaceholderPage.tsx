import {Link,useParams} from '@tanstack/react-router';
import {getModuleById,isImplementedModule} from '../modules/navigation';

export function ModulePlaceholderPage(){
  const{moduleId}=useParams({strict:false}) as {moduleId?:string};
  const result=getModuleById(moduleId);
  if(!result)return <div className="module-placeholder"><h2>Модуль не найден</h2><Link to="/platform/modules">Открыть каталог модулей</Link></div>;
  const{domain,module}=result;
  return <div className="module-placeholder">
    <header className="module-placeholder__header">
      <div><span className="crumb">{domain.name}</span><h2>{module.name}</h2><p>{module.description}</p></div>
      <span className={`module-status module-status--${module.status}`}>{module.status}</span>
    </header>
    <section className="module-placeholder__notice"><strong>{isImplementedModule(module.id)?'Модуль подключён':'Архитектурный каркас подключён'}</strong><p>{isImplementedModule(module.id)?'Для этого модуля уже существует рабочая страница.':'Страница, маршрут и место в навигации готовы. Бизнес-логика будет добавляться по фазам.'}</p></section>
    <div className="module-placeholder__grid">
      <section className="module-panel"><h3>Подмодули</h3><div className="submodule-list">{module.submodules.map(item=><div key={item}><span>◇</span>{item}</div>)}</div></section>
      <aside className="module-panel"><h3>Архитектура</h3><dl><dt>Module ID</dt><dd>{module.id}</dd><dt>Surface</dt><dd>{module.surface}</dd><dt>Route</dt><dd>{module.route||'назначается через module registry'}</dd><dt>Permissions</dt><dd>{module.permissions.join(', ')||'не назначены'}</dd><dt>Entitlements</dt><dd>{module.entitlements.join(', ')||'не назначены'}</dd><dt>Dependencies</dt><dd>{module.dependencies.join(', ')||'нет'}</dd></dl></aside>
    </div>
  </div>;
}
