import React from 'react';
import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,Outlet,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './app/AppShell';
import {AuthProvider,useAuth} from './app/AuthProvider';
import {I18nProvider,useI18n} from './i18n/I18nProvider';
import {ClientsPage} from './pages/ClientsPage';
import {DashboardWorkspacePage} from './pages/dashboard/DashboardWorkspacePage';
import {DataSourcesPage} from './pages/DataSourcesPage';
import {EmptySectionPage} from './pages/EmptySectionPage';
import {ForbiddenPage} from './pages/ForbiddenPage';
import {LoginPage} from './pages/LoginPage';
import {ModuleCatalogPage} from './pages/ModuleCatalogPage';
import {ModulePlaceholderPage} from './pages/ModulePlaceholderPage';
import {NotFoundPage} from './pages/NotFoundPage';
import {MetaAdsCampaignsPage,TikTokAdsCampaignsPage} from './pages/integrations/PaidAdsCampaignsPage';
import './styles.css';
import './auth.css';

function Root(){const{configured,loading,session,workspace,error}=useAuth();const{t}=useI18n();if(loading)return <div className="center-screen">{t('common.loadingWorkspace')}</div>;if(configured&&!session)return <LoginPage/>;if(error&&!workspace)return <div className="center-screen error-card">{error}</div>;return <AppShell><Outlet/></AppShell>}
const rootRoute=createRootRoute({component:Root,notFoundComponent:NotFoundPage});
const clientsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/',component:ClientsPage});
const reportsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/reports',component:()=> <EmptySectionPage titleKey="nav.reports"/>});
const rollupsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/rollups',component:()=> <EmptySectionPage titleKey="nav.rollups"/>});
const kpisRoute=createRoute({getParentRoute:()=>rootRoute,path:'/kpis',component:()=> <EmptySectionPage titleKey="nav.kpis"/>});
const dataRoute=createRoute({getParentRoute:()=>rootRoute,path:'/data',component:DataSourcesPage});
const templatesRoute=createRoute({getParentRoute:()=>rootRoute,path:'/templates',component:()=> <EmptySectionPage titleKey="nav.templates"/>});
const exportsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/exports',component:()=> <EmptySectionPage titleKey="nav.exports"/>});
const modulesRoute=createRoute({getParentRoute:()=>rootRoute,path:'/platform/modules',component:ModuleCatalogPage});
const moduleRoute=createRoute({getParentRoute:()=>rootRoute,path:'/platform/module/$moduleId',component:ModulePlaceholderPage});
const dashboardRoute=createRoute({getParentRoute:()=>rootRoute,path:'/client/$clientId/dashboards',component:DashboardWorkspacePage});
const metaCampaignsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/client/$clientId/meta-ads/campaigns',component:MetaAdsCampaignsPage});
const tiktokCampaignsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/client/$clientId/tiktok-ads/campaigns',component:TikTokAdsCampaignsPage});
const forbiddenRoute=createRoute({getParentRoute:()=>rootRoute,path:'/403',component:ForbiddenPage});
const router=createRouter({routeTree:rootRoute.addChildren([clientsRoute,reportsRoute,rollupsRoute,kpisRoute,dataRoute,templatesRoute,exportsRoute,modulesRoute,moduleRoute,dashboardRoute,metaCampaignsRoute,tiktokCampaignsRoute,forbiddenRoute])});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><I18nProvider><QueryClientProvider client={queryClient}><AuthProvider><RouterProvider router={router}/></AuthProvider></QueryClientProvider></I18nProvider></React.StrictMode>);
