import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { money } from '../../lib/format';
import { EmptyState, ErrorPanel, Loading, StatusPill } from '../../components/ui';
import type { OrderStatus } from '../../types';

interface TopSeller {
  menuItemId: string;
  name: string;
  totalQuantity: number;
  totalRevenuePaise: number;
}

interface DashboardData {
  metrics: {
    menuItems: number;
    activeTables: number;
    newOrders: number;
    preparingOrders: number;
    totalSalesPaise: number;
    totalOrdersCount: number;
  };
  topSellers: TopSeller[];
  recentlyCompleted: { id: string; orderNumber: string; status: OrderStatus; totalPaise: number; updatedAt: string; tableLabel: string }[];
}

export default function OverviewPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/restaurant/dashboard') });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return <ErrorPanel message={query.error instanceof ApiError ? query.error.message : 'Dashboard data could not be loaded.'} retry={() => void query.refetch()} />;
  }
  const { metrics, topSellers, recentlyCompleted } = query.data;

  return (
    <>
      <div className="heading-row">
        <div>
          <span className="eyebrow">Restaurant performance</span>
          <h1>Welcome back.</h1>
          <p className="muted" style={{ margin: '7px 0 0', fontSize: 13 }}>Here is how your restaurant and menu are performing.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary" to="/dashboard/day-close">📋 Day Close Report</Link>
          <Link className="btn" to="/dashboard/kitchen">Open kitchen <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <section className="stat-grid">
        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: '#15803d' }}>Total Revenue</span>
            <span style={{ fontSize: 16, background: '#dcfce7', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>💰</span>
          </div>
          <div className="stat-value">{money(metrics.totalSalesPaise || 0)}</div>
          <div className="stat-caption">{metrics.totalOrdersCount || 0} orders processed</div>
        </article>

        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: metrics.newOrders > 0 ? '#b45309' : 'var(--muted)' }}>New Orders</span>
            <span style={{ fontSize: 16, background: metrics.newOrders > 0 ? '#fef3c7' : '#f1f5f9', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>🔥</span>
          </div>
          <div className="stat-value" style={{ color: metrics.newOrders > 0 ? '#b45309' : 'inherit' }}>{metrics.newOrders}</div>
          <div className="stat-caption">Waiting for kitchen acceptance</div>
        </article>

        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: '#2563eb' }}>In Kitchen</span>
            <span style={{ fontSize: 16, background: '#dbeafe', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>🍳</span>
          </div>
          <div className="stat-value">{metrics.preparingOrders}</div>
          <div className="stat-caption">Accepted or cooking right now</div>
        </article>

        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: '#7c3aed' }}>Active Tables</span>
            <span style={{ fontSize: 16, background: '#ede9fe', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>🪑</span>
          </div>
          <div className="stat-value">{metrics.activeTables}</div>
          <div className="stat-caption">Ready for guest dining</div>
        </article>
      </section>

      {/* Quick Setup & Management Hub */}
      <div className="heading-row" style={{ marginTop: 28, marginBottom: 12 }}>
        <div>
          <span className="eyebrow">Quick navigation</span>
          <h2>⚡ Restaurant Operations Hub</h2>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Link to="/dashboard/orders" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#ea580c' }}>🔔</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Live Orders</strong>
          <span className="muted" style={{ fontSize: 12 }}>Kitchen queue & tickets</span>
        </Link>
        <Link to="/dashboard/floor-map" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#1b4d3e' }}>🗺️</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Floor Map</strong>
          <span className="muted" style={{ fontSize: 12 }}>Real-time table states</span>
        </Link>
        <Link to="/dashboard/reviews" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#f59e0b' }}>⭐</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Reviews & Alerts</strong>
          <span className="muted" style={{ fontSize: 12 }}>Table recovery & Google rating</span>
        </Link>
        <Link to="/dashboard/menu" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#0284c7' }}>🍽️</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Menu Items</strong>
          <span className="muted" style={{ fontSize: 12 }}>{metrics.menuItems} dishes active</span>
        </Link>
        <Link to="/dashboard/tables" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#7c3aed' }}>🪑</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Tables & QR</strong>
          <span className="muted" style={{ fontSize: 12 }}>{metrics.activeTables} tables configured</span>
        </Link>
        <Link to="/dashboard/day-close" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', border: '1px solid #e2e8f0', background: '#ffffff', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: '#16a34a' }}>📋</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Day Close</strong>
          <span className="muted" style={{ fontSize: 12 }}>Z-Report register ledger</span>
        </Link>
      </div>

      {/* Top Best-Selling Items */}
      <div className="heading-row" style={{ marginTop: 34 }}>
        <div>
          <span className="eyebrow">Sales insights</span>
          <h2>🏆 Top Selling Items</h2>
        </div>
        <Link className="btn secondary small" to="/dashboard/menu">Manage menu</Link>
      </div>

      <section className="surface table-wrap" style={{ padding: '4px 0' }}>
        {topSellers.length === 0 ? (
          <EmptyState title="No sales data yet" description="Your best-selling dishes will appear here once orders are placed." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Rank</th>
                <th>Dish Name</th>
                <th style={{ textAlign: 'right' }}>Portions Sold</th>
                <th style={{ textAlign: 'right' }}>Revenue Generated</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((item, index) => (
                <tr key={item.menuItemId}>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: index === 0 ? '#fef08a' : index === 1 ? '#e2e8f0' : index === 2 ? '#ffedd5' : '#f1f5f9',
                        color: index === 0 ? '#854d0e' : index === 1 ? '#475569' : index === 2 ? '#9a3412' : '#64748b',
                        fontWeight: 750,
                        fontSize: 12,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      #{index + 1}
                    </span>
                  </td>
                  <td><strong>{item.name}</strong></td>
                  <td style={{ textAlign: 'right' }}><strong>{item.totalQuantity}</strong> orders</td>
                  <td style={{ textAlign: 'right', fontWeight: 650 }}>{money(item.totalRevenuePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recently Completed Orders */}
      <div className="heading-row" style={{ marginTop: 34 }}>
        <div>
          <span className="eyebrow">Latest activity</span>
          <h2>Recently completed</h2>
        </div>
        <Link className="btn secondary small" to="/dashboard/orders">All orders</Link>
      </div>

      <section className="surface table-wrap">
        {recentlyCompleted.length === 0 ? (
          <EmptyState title="No completed orders yet" description="Completed and rejected orders will show here." />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Table</th>
                <th>Status</th>
                <th>Total</th>
                <th>Finished</th>
              </tr>
            </thead>
            <tbody>
              {recentlyCompleted.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>{order.tableLabel}</td>
                  <td><StatusPill status={order.status} /></td>
                  <td>{money(order.totalPaise)}</td>
                  <td>{new Date(order.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
