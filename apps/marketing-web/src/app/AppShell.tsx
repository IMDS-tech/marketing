import type { ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';

const sections = [
  { label: 'Clients', to: '/' }, { group: 'ANALYSIS' },
  { label: 'Reports', to: '/reports' }, { label: 'Roll-Ups', to: '/rollups' },
  { group: 'PROJECT MANAGEMENT' }, { label: 'KPIs', to: '/kpis' },
  { group: 'MANAGEMENT' }, { label: 'Data', to: '/data' },
  { label: 'Templates', to: '/templates' }, { label: 'Exports', to: '/exports' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: state => state.location.pathname });
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">IM</div><div><strong>IMDS</strong><span>Marketing</span></div></div>
      <button className="global-search">⌕ <span>Search everything</span><kbd>⌘K</kbd></button>
      <nav>{sections.map((item,index) => 'group' in item ? <div className="nav-group" key={`${item.group}-${index}`}>{item.group}</div> : <Link key={item.to} to={item.to} className={`nav-link ${pathname === item.to ? 'is-active' : ''}`}>{item.label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="setup-card"><div><span>Account Setup</span><strong>40%</strong></div><div className="progress"><span /></div><small>2 of 5 steps completed</small></div><div className="account-card"><div className="avatar">ИХ</div><div><strong>Имомали</strong><span>Agency Admin</span></div><button>⋯</button></div></div>
    </aside>
    <main className="main"><header className="topbar"><div><span className="crumb">Workspace</span><h1>Marketing Platform</h1></div><div className="top-actions"><button>✦ AgencyAI</button><button>Inbox</button><button className="primary">Add Client</button></div></header><div className="page">{children}</div></main>
    <aside className="right-rail"><button title="AgencyAI">✦</button><button title="Inbox">✉</button><button title="MCP Setup">⌘</button></aside>
  </div>;
}
