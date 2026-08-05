export type ModuleDeliveryStatus='not_started'|'in_progress'|'complete'|'error';

export interface ModuleProgressRecord{
  status:ModuleDeliveryStatus;
  note?:string;
}

export const moduleDeliveryLabels:Record<ModuleDeliveryStatus,string>={
  not_started:'Не начат',
  in_progress:'В работе',
  complete:'Полностью готов',
  error:'Ошибка',
};

export const moduleCompletionCriteria=[
  'Завершён дизайн модуля и всех адаптивных состояний',
  'Реализованы все заявленные подмодули',
  'Созданы и подключены все внутренние страницы и маршруты',
  'Работают формы, кнопки, фильтры и пользовательские действия',
  'Подключены API, база данных и фоновые процессы',
  'Применены permissions, entitlements и tenant isolation',
  'Обработаны loading, empty, success и error states',
  'Пройдены typecheck, тесты и production build',
] as const;

const progress:Record<string,ModuleProgressRecord>={
  authentication:{status:'in_progress'},
  workspace:{status:'in_progress'},
  'multi-tenancy':{
    status:'complete',
    note:'Tenant-scoped RLS, API, jobs, OAuth references and private storage are deployed; isolation tests, typecheck, tests and production build passed.',
  },
  permissions:{status:'in_progress'},
  audit:{status:'in_progress'},
  'client-directory':{status:'in_progress'},
  'integration-catalog':{status:'in_progress'},
  'connection-manager':{status:'in_progress'},
  'data-source-management':{status:'in_progress'},
  'sync-health':{status:'in_progress'},
  'sync-dispatcher':{status:'in_progress'},
  'sync-worker':{status:'in_progress'},
  'provider-adapters':{status:'in_progress'},
  'raw-data-processing':{status:'in_progress'},
  campaigns:{status:'in_progress'},
  'funnel-analytics':{status:'in_progress'},
  'dashboard-directory':{status:'in_progress'},
  'dashboard-builder':{status:'in_progress'},
  'widget-builder':{status:'in_progress'},
  'widget-configuration':{status:'in_progress'},
  'dashboard-filters':{status:'in_progress'},
  configuration:{status:'in_progress'},
  'ci-cd':{status:'in_progress'},
  observability:{status:'in_progress'},
  'database-operations':{status:'in_progress'},
  'job-infrastructure':{status:'in_progress'},
};

export function getModuleDelivery(moduleId:string):ModuleProgressRecord{
  return progress[moduleId]??{status:'not_started'};
}

export function getModuleDeliveryStatus(moduleId:string):ModuleDeliveryStatus{
  return getModuleDelivery(moduleId).status;
}
