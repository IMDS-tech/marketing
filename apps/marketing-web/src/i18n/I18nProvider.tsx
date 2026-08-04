import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type Language = 'en' | 'ru' | 'kk';

type TranslationValues = Record<string, string | number>;
interface TranslationTree {
  [key: string]: string | TranslationTree;
}

type I18nState = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: TranslationValues) => string;
};

const STORAGE_KEY = 'imds.marketing.language';

const locales: Record<Language, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  kk: 'kk-KZ',
};

const translations: Record<Language, TranslationTree> = {
  en: {
    common: {
      loadingWorkspace: 'Loading workspace…',
      refresh: 'Refresh',
      addFilter: 'Add filter',
      addClient: 'Add client',
      searchEverything: 'Search everything',
      logout: 'Log out',
      demoMode: 'Demo mode',
      workspace: 'Workspace',
      marketingPlatform: 'Marketing Platform',
      inbox: 'Inbox',
      mcpSetup: 'MCP setup',
      back: 'Back',
      createFirstItem: 'Create first item',
      networkError: 'Network connection is unavailable. Please try again.',
    },
    language: {
      select: 'Select language',
      english: 'English',
      russian: 'Русский',
      kazakh: 'Қазақша',
    },
    nav: {
      clients: 'Clients',
      paidAds: 'Paid ads',
      metaAds: 'Meta Ads',
      tiktokAds: 'TikTok Ads',
      analysis: 'Analysis',
      reports: 'Reports',
      rollups: 'Roll-ups',
      projectManagement: 'Project management',
      kpis: 'KPIs',
      management: 'Management',
      data: 'Data',
      templates: 'Templates',
      exports: 'Exports',
    },
    account: {
      setup: 'Account setup',
      stepsCompleted: '{{completed}} of {{total}} steps completed',
      demoUser: 'Demo user',
    },
    roles: {
      admin: 'Administrator',
      owner: 'Owner',
      manager: 'Manager',
      member: 'Member',
      viewer: 'Viewer',
      client: 'Client',
      demo: 'Demo',
    },
    auth: {
      title: 'Sign in to Marketing Platform',
      subtitle: 'Use your organization account.',
      email: 'Email',
      password: 'Password',
      signingIn: 'Signing in…',
      signIn: 'Sign in',
      errors: {
        invalidCredentials: 'The email or password is incorrect.',
        emailNotConfirmed: 'Confirm your email address before signing in.',
        workspaceLoad: 'Could not load the workspace.',
        signIn: 'Could not sign in. Check your details and try again.',
      },
    },
    clients: {
      title: 'Clients',
      description: 'Manage clients, access and connected marketing data.',
      totalClients: 'Total clients',
      acrossWorkspaces: 'Across {{count}} agency workspaces',
      connectedSources: 'Connected sources',
      connectedSourceHint: 'Meta Ads and TikTok Ads',
      workspaceMode: 'Workspace mode',
      demo: 'Demo',
      live: 'Live',
      configureSupabase: 'Configure Supabase to enable live data',
      supabaseConnected: 'Supabase connected',
      showingRows: 'Showing {{shown}} of {{total}} rows',
      search: 'Search clients',
      client: 'Client',
      domain: 'Domain',
      status: 'Status',
      dataSources: 'Data sources',
      created: 'Created',
      selectClient: 'Select {{name}}',
      totals: 'Totals',
      clientsCount: '{{count}} clients',
      statuses: {
        active: 'Active',
        inactive: 'Inactive',
        pending: 'Pending',
        archived: 'Archived',
      },
    },
    empty: {
      title: '{{section}} is ready to configure',
      description: 'This section is part of the application shell and will be connected to production data in the next implementation phases.',
      benefitPermissions: 'Tenant-aware permissions',
      benefitDesign: 'Consistent design system',
      benefitIntegrations: 'Ready for integrations and automation',
    },
    forbidden: {
      title: 'Access denied',
      description: 'Your role does not have permission to open this section.',
      benefitAgency: 'Access is managed at agency level',
      benefitProjects: 'Clients see only assigned projects',
      benefitRls: 'Every permission check is also enforced by RLS',
    },
    notFound: {
      title: 'Page not found',
      description: 'This route does not exist or has been moved.',
      benefitAddress: 'Check the page address',
      benefitClients: 'Return to the client list',
      benefitNavigation: 'Use the navigation on the left',
      action: 'Go to clients',
    },
    paid: {
      title: '{{platform}} Ads — Campaigns',
      days: '{{count}} days',
      refresh: 'Refresh',
      liveWarning: 'Live data: {{reason}} A safe fallback is being shown.',
      source: {
        live: 'Live data',
        importedPreview: 'Imported preview',
        demo: 'Demo data',
      },
      errors: {
        emptyLiveData: 'There are no rows for this platform in the connected database yet.',
        unavailable: 'The live data query is unavailable.',
      },
      metrics: {
        spend: 'Spend',
        impressions: 'Impressions',
        clicks: 'Clicks',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Leads',
        cpl: 'CPL',
        sales: 'Sales',
        roas: 'ROAS',
      },
      salesCount: 'Sales: {{count}}',
      chartTitle: 'Daily spend and leads',
      funnelTitle: 'Funnel for the selected period',
      funnel: {
        impressions: 'Impressions',
        clicks: 'Clicks',
        leads: 'Leads',
        arrived: 'Arrived',
        sales: 'Sales',
      },
      campaignsTitle: 'Campaigns ({{count}})',
      searchCampaign: 'Search campaigns…',
      statuses: {
        all: 'All statuses',
        active: 'Active',
        learning: 'Learning',
        paused: 'Paused',
      },
      table: {
        campaign: 'Campaign',
        spend: 'Spend',
        impressions: 'Impressions',
        clicks: 'Clicks',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Leads',
        cpl: 'CPL',
        sales: 'Sales',
        roas: 'ROAS',
      },
      empty: 'No campaigns match the selected filters.',
      total: 'Total',
      unnamedCampaign: 'Untitled campaign',
      foot: 'The route follows the Product Manifest: client → integration → campaigns. When tenant-scoped marketing_ads data is available, live data automatically replaces the fallback.',
    },
  },
  ru: {
    common: {
      loadingWorkspace: 'Загрузка рабочего пространства…',
      refresh: 'Обновить',
      addFilter: 'Добавить фильтр',
      addClient: 'Добавить клиента',
      searchEverything: 'Поиск по платформе',
      logout: 'Выйти',
      demoMode: 'Демо-режим',
      workspace: 'Рабочее пространство',
      marketingPlatform: 'Маркетинговая платформа',
      inbox: 'Входящие',
      mcpSetup: 'Настройка MCP',
      back: 'Назад',
      createFirstItem: 'Создать первый элемент',
      networkError: 'Нет подключения к сети. Повторите попытку.',
    },
    language: {
      select: 'Выберите язык',
      english: 'English',
      russian: 'Русский',
      kazakh: 'Қазақша',
    },
    nav: {
      clients: 'Клиенты',
      paidAds: 'Платная реклама',
      metaAds: 'Meta Ads',
      tiktokAds: 'TikTok Ads',
      analysis: 'Аналитика',
      reports: 'Отчёты',
      rollups: 'Сводные отчёты',
      projectManagement: 'Управление проектами',
      kpis: 'KPI',
      management: 'Управление',
      data: 'Данные',
      templates: 'Шаблоны',
      exports: 'Экспорт',
    },
    account: {
      setup: 'Настройка аккаунта',
      stepsCompleted: 'Выполнено {{completed}} из {{total}} шагов',
      demoUser: 'Демо-пользователь',
    },
    roles: {
      admin: 'Администратор',
      owner: 'Владелец',
      manager: 'Менеджер',
      member: 'Участник',
      viewer: 'Наблюдатель',
      client: 'Клиент',
      demo: 'Демо',
    },
    auth: {
      title: 'Вход в маркетинговую платформу',
      subtitle: 'Используйте учётную запись вашей организации.',
      email: 'Электронная почта',
      password: 'Пароль',
      signingIn: 'Выполняется вход…',
      signIn: 'Войти',
      errors: {
        invalidCredentials: 'Неверная электронная почта или пароль.',
        emailNotConfirmed: 'Подтвердите электронную почту перед входом.',
        workspaceLoad: 'Не удалось загрузить рабочее пространство.',
        signIn: 'Не удалось войти. Проверьте данные и повторите попытку.',
      },
    },
    clients: {
      title: 'Клиенты',
      description: 'Управляйте клиентами, доступами и подключёнными маркетинговыми данными.',
      totalClients: 'Всего клиентов',
      acrossWorkspaces: 'В {{count}} рабочих пространствах агентств',
      connectedSources: 'Подключённые источники',
      connectedSourceHint: 'Meta Ads и TikTok Ads',
      workspaceMode: 'Режим пространства',
      demo: 'Демо',
      live: 'Рабочий',
      configureSupabase: 'Настройте Supabase, чтобы включить реальные данные',
      supabaseConnected: 'Supabase подключён',
      showingRows: 'Показано {{shown}} из {{total}} строк',
      search: 'Поиск клиентов',
      client: 'Клиент',
      domain: 'Домен',
      status: 'Статус',
      dataSources: 'Источники данных',
      created: 'Создан',
      selectClient: 'Выбрать {{name}}',
      totals: 'Итого',
      clientsCount: 'Клиентов: {{count}}',
      statuses: {
        active: 'Активен',
        inactive: 'Неактивен',
        pending: 'Ожидает',
        archived: 'В архиве',
      },
    },
    empty: {
      title: 'Раздел «{{section}}» готов к настройке',
      description: 'Этот раздел входит в оболочку приложения и будет подключён к рабочим данным на следующих этапах реализации.',
      benefitPermissions: 'Права доступа с учётом организации',
      benefitDesign: 'Единая дизайн-система',
      benefitIntegrations: 'Готовность к интеграциям и автоматизации',
    },
    forbidden: {
      title: 'Нет доступа',
      description: 'У вашей роли нет разрешения на этот раздел.',
      benefitAgency: 'Доступ управляется на уровне агентства',
      benefitProjects: 'Клиент видит только назначенные проекты',
      benefitRls: 'Все проверки доступа также выполняются через RLS',
    },
    notFound: {
      title: 'Страница не найдена',
      description: 'Маршрут не существует или был перемещён.',
      benefitAddress: 'Проверьте адрес страницы',
      benefitClients: 'Вернитесь к списку клиентов',
      benefitNavigation: 'Используйте навигацию слева',
      action: 'К клиентам',
    },
    paid: {
      title: '{{platform}} Ads — Кампании',
      days: '{{count}} дн.',
      refresh: 'Обновить',
      liveWarning: 'Рабочие данные: {{reason}} Показан безопасный резервный набор.',
      source: {
        live: 'Рабочие данные',
        importedPreview: 'Импортированный предпросмотр',
        demo: 'Демо-данные',
      },
      errors: {
        emptyLiveData: 'В подключённой базе пока нет строк для этой платформы.',
        unavailable: 'Запрос рабочих данных недоступен.',
      },
      metrics: {
        spend: 'Расход',
        impressions: 'Показы',
        clicks: 'Клики',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Лиды',
        cpl: 'CPL',
        sales: 'Продажи',
        roas: 'ROAS',
      },
      salesCount: 'Продажи: {{count}}',
      chartTitle: 'Расход и лиды по дням',
      funnelTitle: 'Воронка за выбранный период',
      funnel: {
        impressions: 'Показы',
        clicks: 'Клики',
        leads: 'Лиды',
        arrived: 'Дошли',
        sales: 'Продажи',
      },
      campaignsTitle: 'Кампании ({{count}})',
      searchCampaign: 'Поиск кампаний…',
      statuses: {
        all: 'Все статусы',
        active: 'Активные',
        learning: 'Обучение',
        paused: 'На паузе',
      },
      table: {
        campaign: 'Кампания',
        spend: 'Расход',
        impressions: 'Показы',
        clicks: 'Клики',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Лиды',
        cpl: 'CPL',
        sales: 'Продажи',
        roas: 'ROAS',
      },
      empty: 'Нет кампаний для выбранных фильтров.',
      total: 'Итого',
      unnamedCampaign: 'Кампания без названия',
      foot: 'Маршрут соответствует Product Manifest: client → integration → campaigns. При наличии tenant-scoped данных marketing_ads резервный набор автоматически заменяется рабочими данными.',
    },
  },
  kk: {
    common: {
      loadingWorkspace: 'Жұмыс кеңістігі жүктелуде…',
      refresh: 'Жаңарту',
      addFilter: 'Сүзгі қосу',
      addClient: 'Клиент қосу',
      searchEverything: 'Платформа бойынша іздеу',
      logout: 'Шығу',
      demoMode: 'Демо режимі',
      workspace: 'Жұмыс кеңістігі',
      marketingPlatform: 'Маркетинг платформасы',
      inbox: 'Кіріс хабарлар',
      mcpSetup: 'MCP баптауы',
      back: 'Артқа',
      createFirstItem: 'Алғашқы элементті жасау',
      networkError: 'Желіге қосылу мүмкін емес. Қайталап көріңіз.',
    },
    language: {
      select: 'Тілді таңдаңыз',
      english: 'English',
      russian: 'Русский',
      kazakh: 'Қазақша',
    },
    nav: {
      clients: 'Клиенттер',
      paidAds: 'Ақылы жарнама',
      metaAds: 'Meta Ads',
      tiktokAds: 'TikTok Ads',
      analysis: 'Талдау',
      reports: 'Есептер',
      rollups: 'Жиынтық есептер',
      projectManagement: 'Жобаларды басқару',
      kpis: 'KPI',
      management: 'Басқару',
      data: 'Деректер',
      templates: 'Үлгілер',
      exports: 'Экспорт',
    },
    account: {
      setup: 'Аккаунтты баптау',
      stepsCompleted: '{{total}} қадамның {{completed}}-і орындалды',
      demoUser: 'Демо пайдаланушы',
    },
    roles: {
      admin: 'Әкімші',
      owner: 'Иесі',
      manager: 'Менеджер',
      member: 'Қатысушы',
      viewer: 'Бақылаушы',
      client: 'Клиент',
      demo: 'Демо',
    },
    auth: {
      title: 'Маркетинг платформасына кіру',
      subtitle: 'Ұйымыңыздың аккаунтын пайдаланыңыз.',
      email: 'Электрондық пошта',
      password: 'Құпиясөз',
      signingIn: 'Кіру орындалуда…',
      signIn: 'Кіру',
      errors: {
        invalidCredentials: 'Электрондық пошта немесе құпиясөз қате.',
        emailNotConfirmed: 'Кіру алдында электрондық поштаңызды растаңыз.',
        workspaceLoad: 'Жұмыс кеңістігін жүктеу мүмкін болмады.',
        signIn: 'Кіру мүмкін болмады. Деректерді тексеріп, қайталап көріңіз.',
      },
    },
    clients: {
      title: 'Клиенттер',
      description: 'Клиенттерді, қолжетімділікті және қосылған маркетинг деректерін басқарыңыз.',
      totalClients: 'Барлық клиенттер',
      acrossWorkspaces: '{{count}} агенттік жұмыс кеңістігінде',
      connectedSources: 'Қосылған дереккөздер',
      connectedSourceHint: 'Meta Ads және TikTok Ads',
      workspaceMode: 'Кеңістік режимі',
      demo: 'Демо',
      live: 'Жұмыс режимі',
      configureSupabase: 'Нақты деректерді қосу үшін Supabase-ті баптаңыз',
      supabaseConnected: 'Supabase қосылған',
      showingRows: '{{total}} жолдың {{shown}}-і көрсетілді',
      search: 'Клиенттерді іздеу',
      client: 'Клиент',
      domain: 'Домен',
      status: 'Күйі',
      dataSources: 'Дереккөздер',
      created: 'Құрылған күні',
      selectClient: '{{name}} клиентін таңдау',
      totals: 'Барлығы',
      clientsCount: 'Клиенттер: {{count}}',
      statuses: {
        active: 'Белсенді',
        inactive: 'Белсенді емес',
        pending: 'Күтуде',
        archived: 'Мұрағатта',
      },
    },
    empty: {
      title: '«{{section}}» бөлімі баптауға дайын',
      description: 'Бұл бөлім қолданба қабығының бір бөлігі және келесі іске асыру кезеңдерінде жұмыс деректеріне қосылады.',
      benefitPermissions: 'Ұйымды ескеретін қолжетімділік құқықтары',
      benefitDesign: 'Бірыңғай дизайн жүйесі',
      benefitIntegrations: 'Интеграциялар мен автоматтандыруға дайын',
    },
    forbidden: {
      title: 'Қолжетімділік жоқ',
      description: 'Сіздің рөліңізге бұл бөлімді ашуға рұқсат берілмеген.',
      benefitAgency: 'Қолжетімділік агенттік деңгейінде басқарылады',
      benefitProjects: 'Клиент тек тағайындалған жобаларды көреді',
      benefitRls: 'Барлық қолжетімділік тексерулері RLS арқылы да орындалады',
    },
    notFound: {
      title: 'Бет табылмады',
      description: 'Бұл бағыт жоқ немесе басқа жерге көшірілген.',
      benefitAddress: 'Бет мекенжайын тексеріңіз',
      benefitClients: 'Клиенттер тізіміне оралыңыз',
      benefitNavigation: 'Сол жақтағы навигацияны пайдаланыңыз',
      action: 'Клиенттерге өту',
    },
    paid: {
      title: '{{platform}} Ads — Науқандар',
      days: '{{count}} күн',
      refresh: 'Жаңарту',
      liveWarning: 'Жұмыс деректері: {{reason}} Қауіпсіз резервтік деректер көрсетілуде.',
      source: {
        live: 'Жұмыс деректері',
        importedPreview: 'Импортталған алдын ала қарау',
        demo: 'Демо деректер',
      },
      errors: {
        emptyLiveData: 'Қосылған дерекқорда бұл платформаға арналған жолдар әзірге жоқ.',
        unavailable: 'Жұмыс деректерін сұрау қолжетімсіз.',
      },
      metrics: {
        spend: 'Шығын',
        impressions: 'Көрсетілімдер',
        clicks: 'Басулар',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Лидтер',
        cpl: 'CPL',
        sales: 'Сатылымдар',
        roas: 'ROAS',
      },
      salesCount: 'Сатылымдар: {{count}}',
      chartTitle: 'Күндер бойынша шығын мен лидтер',
      funnelTitle: 'Таңдалған кезеңнің воронкасы',
      funnel: {
        impressions: 'Көрсетілімдер',
        clicks: 'Басулар',
        leads: 'Лидтер',
        arrived: 'Келгендер',
        sales: 'Сатылымдар',
      },
      campaignsTitle: 'Науқандар ({{count}})',
      searchCampaign: 'Науқандарды іздеу…',
      statuses: {
        all: 'Барлық күйлер',
        active: 'Белсенді',
        learning: 'Үйрену кезеңі',
        paused: 'Кідіртілген',
      },
      table: {
        campaign: 'Науқан',
        spend: 'Шығын',
        impressions: 'Көрсетілімдер',
        clicks: 'Басулар',
        ctr: 'CTR',
        cpc: 'CPC',
        leads: 'Лидтер',
        cpl: 'CPL',
        sales: 'Сатылымдар',
        roas: 'ROAS',
      },
      empty: 'Таңдалған сүзгілерге сәйкес науқан жоқ.',
      total: 'Барлығы',
      unnamedCampaign: 'Атаусыз науқан',
      foot: 'Бағыт Product Manifest құрылымына сәйкес: client → integration → campaigns. Tenant-scoped marketing_ads деректері болған кезде резервтік деректер автоматты түрде жұмыс деректерімен ауыстырылады.',
    },
  },
};

function resolveInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'ru' || stored === 'kk') return stored;
  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith('ru')) return 'ru';
  if (browserLanguage.startsWith('kk') || browserLanguage.startsWith('kz')) return 'kk';
  return 'en';
}

function resolveTranslation(tree: TranslationTree, key: string): string | undefined {
  let current: string | TranslationTree = tree;
  for (const part of key.split('.')) {
    if (typeof current === 'string') return undefined;
    current = current[part];
    if (current === undefined) return undefined;
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(value: string, values?: TranslationValues): string {
  if (!values) return value;
  return value.replace(/{{\s*([^}\s]+)\s*}}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{{${key}}}`,
  );
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({children}: {children: ReactNode}) {
  const [language, setLanguageState] = useState<Language>(resolveInitialLanguage);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback(
    (key: string, values?: TranslationValues) => {
      const localized = resolveTranslation(translations[language], key);
      const fallback = resolveTranslation(translations.en, key);
      return interpolate(localized ?? fallback ?? key, values);
    },
    [language],
  );

  const value = useMemo<I18nState>(
    () => ({language, locale: locales[language], setLanguage, t}),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
