import React from 'react';
import ReactDOM from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {createRootRoute,createRoute,createRouter,Outlet,RouterProvider} from '@tanstack/react-router';
import {AppShell} from './app/AppShell';
import {AuthProvider,useAuth} from './app/AuthProvider';
import {ClientsPage} from './pages/ClientsPage';
import {EmptySectionPage} from './pages/EmptySectionPage';
import {ForbiddenPage} from './pages/ForbiddenPage';
import {LoginPage} from './pages/LoginPage';
import {NotFoundPage} from './pages/NotFoundPage';
import './styles.css';

function Root(){const{configured,loading,session,workspace,error}=useAuth();if(loading)return <div className="center-screen">Loading workspace…</div>;if(configured&&!session)return <LoginPage/>;if(error&&!workspace)return <div className="center-screen error-card">{error}</div>;return <AppShell><Outlet/></AppShell>}
const rootRoute=createRootRoute({component:Root,notFoundComponent:NotFoundPage});
const clientsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/',component:ClientsPage});
const reportsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/reports',component:()=> <EmptySectionPage title="Reports"/>});
const rollupsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/rollups',component:()=> <EmptySectionPage title="Roll-Ups"/>});
const kpisRoute=createRoute({getParentRoute:()=>rootRoute,path:'/kpis',component:()=> <EmptySectionPage title="KPIs"/>});
const dataRoute=createRoute({getParentRoute:()=>rootRoute,path:'/data',component:()=> <EmptySectionPage title="Data"/>});
const templatesRoute=createRoute({getParentRoute:()=>rootRoute,path:'/templates',component:()=> <EmptySectionPage title="Templates"/>});
const exportsRoute=createRoute({getParentRoute:()=>rootRoute,path:'/exports',component:()=> <EmptySectionPage title="Exports"/>});
const forbiddenRoute=createRoute({getParentRoute:()=>rootRoute,path:'/403',component:ForbiddenPage});
const router=createRouter({routeTree:rootRoute.addChildren([clientsRoute,reportsRoute,rollupsRoute,kpisRoute,dataRoute,templatesRoute,exportsRoute,forbiddenRoute])});
declare module '@tanstack/react-router'{interface Register{router:typeof router}}
const queryClient=new QueryClient({defaultOptions:{queries:{staleTime:30000,retry:1}}});
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><AuthProvider><RouterProvider router={router}/></AuthProvider></QueryClientProvider></React.StrictMode>);
