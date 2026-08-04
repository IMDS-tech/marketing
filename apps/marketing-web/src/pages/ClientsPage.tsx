import { useQuery } from '@tanstack/react-query';
import { loadWorkspaceBootstrap } from '@imds/auth';
import { Badge, Button, Card } from '@imds/ui';

export function ClientsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['workspace-bootstrap'], queryFn: loadWorkspaceBootstrap });
  if (isLoading) return <Card className="loading-card">Loading workspace…</Card>;
  if (error || !data) return <Card className="error-card">Could not load workspace.</Card>;
  const sources = data.clients.reduce((sum, client) => sum + client.connectedSources, 0);
  return <>
    <section className="page-heading"><p>Manage clients, access and connected marketing data.</p><div className="heading-actions"><Button variant="secondary">Add Filter</Button><Button>Add Client</Button></div></section>
    <section className="stats-grid"><Card><span>Total clients</span><strong>{data.clients.length}</strong><small>Across {data.agencies.length} agency</small></Card><Card><span>Connected sources</span><strong>{sources}</strong><small>Meta Ads and TikTok Ads</small></Card><Card><span>Workspace mode</span><strong>{data.mode === 'demo' ? 'Demo' : 'Live'}</strong><small>{data.mode === 'demo' ? 'Configure Supabase to enable live data' : 'Supabase connected'}</small></Card></section>
    <Card className="table-card"><div className="table-toolbar"><div><h2>Clients</h2><span>Showing {data.clients.length} of {data.clients.length} Rows</span></div><input aria-label="Search clients" placeholder="Search clients" /></div><div className="table-wrap"><table><thead><tr><th /><th>Client</th><th>Domain</th><th>Status</th><th>Data Sources</th><th>Created</th><th /></tr></thead><tbody>{data.clients.map(client => <tr key={client.id}><td><input type="checkbox" aria-label={`Select ${client.company}`} /></td><td><div className="client-cell"><div className="client-logo" style={{background:client.brandColor}}>{client.company.slice(0,2).toUpperCase()}</div><div><strong>{client.company}</strong><span>{client.id}</span></div></div></td><td>{client.url ?? '—'}</td><td><Badge tone={client.status === 'active' ? 'success' : 'warning'}>{client.status}</Badge></td><td>{client.connectedSources}</td><td>{client.createdAt}</td><td><button className="icon-button">⋯</button></td></tr>)}</tbody><tfoot><tr><td colSpan={4}>TOTALS</td><td>{sources}</td><td colSpan={2}>{data.clients.length} clients</td></tr></tfoot></table></div></Card>
  </>;
}
