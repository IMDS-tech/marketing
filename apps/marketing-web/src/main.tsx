import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { AppShell } from './app/AppShell';
import { ClientsPage } from './pages/ClientsPage';
import { EmptySectionPage } from './pages/EmptySectionPage';
import './styles.css';

const rootRoute = createRootRoute({ component: () => <AppShell><Outlet /></AppShell> });
const clientsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: ClientsPage });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: () => <EmptySectionPage title="Reports" /> });
const rollupsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/rollups', component: () => <EmptySectionPage title="Roll-Ups" /> });
const kpisRoute = createRoute({ getParentRoute: () => rootRoute, path: '/kpis', component: () => <EmptySectionPage title="KPIs" /> });
const dataRoute = createRoute({ getParentRoute: () => rootRoute, path: '/data', component: () => <EmptySectionPage title="Data" /> });
const templatesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/templates', component: () => <EmptySectionPage title="Templates" /> });
const exportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/exports', component: () => <EmptySectionPage title="Exports" /> });
const router = createRouter({ routeTree: rootRoute.addChildren([clientsRoute, reportsRoute, rollupsRoute, kpisRoute, dataRoute, templatesRoute, exportsRoute]) });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } });
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
