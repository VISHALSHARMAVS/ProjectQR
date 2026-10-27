import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { money } from '../../lib/format';
import { EmptyState, ErrorPanel, Loading, StatusPill } from '../../components/ui';
import type { OrderStatus } from '../../types';

interface DashboardData {
  metrics: { menuItems: number; activeTables: number; newOrders: number; preparingOrders: number };
  recentlyCompleted: { id: string; orderNumber: string; status: OrderStatus; totalPaise: number; updatedAt: string; tableLabel: string }[];
}

export default function OverviewPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/restaurant/dashboard') });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorPanel message={query.error instanceof ApiError ? query.error.message : 'Dashboard data could not be loaded.'} retry={() => void query.refetch()} />;
  const { metrics, recentlyCompleted } = query.data;
  const stats = [
    ['Menu items', metrics.menuItems, 'In your restaurant menu'],
    ['Active tables', metrics.activeTables, 'Ready to accept orders'],
    ['New orders', metrics.newOrders, 'Waiting for the team'],
    ['In the kitchen', metrics.preparingOrders, 'Accepted or being prepared']
  ];
  return <>
    <div className="heading-row"><div><span className="eyebrow">Today at a glance</span><h1>Good morning.</h1><p className="muted" style={{ margin: '7px 0 0', fontSize: 13 }}>Here’s what’s happening at your restaurant.</p></div><Link className="btn" to="/dashboard/kitchen">Open kitchen <span aria-hidden="true">→</span></Link></div>
    <section className="stat-grid">{stats.map(([label, value, caption]) => <article className="stat-card surface" key={String(label)}><div className="eyebrow">{label}</div><div className="stat-value">{value}</div><div className="stat-caption">{caption}</div></article>)}</section>
    <div className="heading-row" style={{ marginTop: 34 }}><div><span className="eyebrow">Latest activity</span><h2>Recently completed</h2></div><Link className="btn secondary small" to="/dashboard/orders">All orders</Link></div>
    <section className="surface table-wrap">{recentlyCompleted.length === 0 ? <EmptyState title="No completed orders yet" description="Completed and rejected orders will show here." /> : <table className="data-table"><thead><tr><th>Order</th><th>Table</th><th>Status</th><th>Total</th><th>Finished</th></tr></thead><tbody>{recentlyCompleted.map((order) => <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{order.tableLabel}</td><td><StatusPill status={order.status} /></td><td>{money(order.totalPaise)}</td><td>{new Date(order.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td></tr>)}</tbody></table>}</section>
  </>;
}
