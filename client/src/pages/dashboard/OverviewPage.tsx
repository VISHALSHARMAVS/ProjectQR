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
  const stats = [
    ['Total revenue', money(metrics.totalSalesPaise || 0), `${metrics.totalOrdersCount || 0} orders processed`],
    ['New orders', metrics.newOrders, 'Waiting for kitchen acceptance'],
    ['In preparation', metrics.preparingOrders, 'Accepted or cooking right now'],
    ['Active tables', metrics.activeTables, 'Ready to accept customer orders']
  ];

  return (
    <>
      <div className="heading-row">
        <div>
          <span className="eyebrow">Restaurant performance</span>
          <h1>Welcome back.</h1>
          <p className="muted" style={{ margin: '7px 0 0', fontSize: 13 }}>Here is how your restaurant and menu are performing.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn secondary" to="/dashboard/day-close">📋 Day Close Report</Link>
          <Link className="btn" to="/dashboard/kitchen">Open kitchen <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <section className="stat-grid">
        {stats.map(([label, value, caption]) => (
          <article className="stat-card surface" key={String(label)}>
            <div className="eyebrow">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-caption">{caption}</div>
          </article>
        ))}
      </section>

      {/* Quick Setup & Management Hub */}
      <div className="heading-row" style={{ marginTop: 28, marginBottom: 10 }}>
        <div>
          <span className="eyebrow">Quick navigation</span>
          <h2>⚡ Restaurant Management</h2>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <Link to="/dashboard/menu" className="surface" style={{ padding: '14px 12px', borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', display: 'block' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🍽️</div>
          <strong style={{ fontSize: 13, display: 'block' }}>Menu Items</strong>
          <span className="muted" style={{ fontSize: 11 }}>{metrics.menuItems} dishes</span>
        </Link>
        <Link to="/dashboard/categories" className="surface" style={{ padding: '14px 12px', borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', display: 'block' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📂</div>
          <strong style={{ fontSize: 13, display: 'block' }}>Categories</strong>
          <span className="muted" style={{ fontSize: 11 }}>Manage sections</span>
        </Link>
        <Link to="/dashboard/tables" className="surface" style={{ padding: '14px 12px', borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', display: 'block' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🪑</div>
          <strong style={{ fontSize: 13, display: 'block' }}>Tables & QR</strong>
          <span className="muted" style={{ fontSize: 11 }}>{metrics.activeTables} tables</span>
        </Link>
        <Link to="/dashboard/floor-map" className="surface" style={{ padding: '14px 12px', borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', display: 'block' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🗺️</div>
          <strong style={{ fontSize: 13, display: 'block' }}>Floor Map</strong>
          <span className="muted" style={{ fontSize: 11 }}>Live table grid</span>
        </Link>
        <Link to="/dashboard/day-close" className="surface" style={{ padding: '14px 12px', borderRadius: 12, textDecoration: 'none', color: 'inherit', border: '1px solid var(--line)', display: 'block' }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📋</div>
          <strong style={{ fontSize: 13, display: 'block' }}>Day Close</strong>
          <span className="muted" style={{ fontSize: 11 }}>Z-Report register</span>
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
