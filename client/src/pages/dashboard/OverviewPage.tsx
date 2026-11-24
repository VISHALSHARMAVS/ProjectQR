import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, money } from '../../lib/format';
import { EmptyState, ErrorPanel, Loading, StatusPill } from '../../components/ui';
import type { DishLeaderboardItem, OrderStatus, ReviewRecord, ReviewSummary } from '../../types';

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
    financialsHidden?: boolean;
  };
  topSellers: TopSeller[];
  recentlyCompleted: { id: string; orderNumber: string; status: OrderStatus; totalPaise: number; updatedAt: string; tableLabel: string }[];
}

export default function OverviewPage() {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<DashboardData>('/restaurant/dashboard') });
  const reviewsQuery = useQuery({
    queryKey: ['restaurant-reviews'],
    queryFn: () => api.get<{ summary: ReviewSummary; reviews: ReviewRecord[]; dishLeaderboard: DishLeaderboardItem[] }>('/restaurant/reviews'),
    refetchInterval: 15_000
  });

  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) {
    return <ErrorPanel message={query.error instanceof ApiError ? query.error.message : 'Dashboard data could not be loaded.'} retry={() => void query.refetch()} />;
  }
  const { metrics, topSellers, recentlyCompleted } = query.data;
  const reviewSummary = reviewsQuery.data?.summary;
  const recentReviews = reviewsQuery.data?.reviews ?? [];
  const unresolvedAlertCount = reviewSummary?.unresolvedComplaints ?? 0;

  return (
    <>
      <div className="heading-row">
        <div>
          <span className="eyebrow">Restaurant performance</span>
          <h1>Welcome back.</h1>
          <p className="muted" style={{ margin: '7px 0 0', fontSize: 13 }}>Here is how your restaurant, kitchen, and guest satisfaction are performing.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn secondary" to="/dashboard/reviews">⭐ Reviews & Alerts</Link>
          <Link className="btn secondary" to="/dashboard/day-close">📋 Day Close Report</Link>
          <Link className="btn" to="/dashboard/kitchen">Open kitchen <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      {/* Real-time Owner Alert for Unresolved Table Complaints */}
      {unresolvedAlertCount > 0 && (
        <div
          className="surface"
          style={{
            background: '#fff1f2',
            border: '2px solid #fecdd3',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            boxShadow: '0 4px 14px rgba(225, 29, 72, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28, background: '#fee2e2', width: 44, height: 44, borderRadius: 10, display: 'grid', placeItems: 'center' }}>🚨</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ color: '#991b1b', fontSize: 15 }}>
                  {unresolvedAlertCount} Table Complaint{unresolvedAlertCount > 1 ? 's' : ''} Awaiting Attention
                </strong>
                <span className="pill red" style={{ fontSize: 10, fontWeight: 800 }}>LIVE ALERT</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#b91c1c' }}>
                Unhappy diners reported issues table-side. Take action before guests depart or post negative Google reviews.
              </p>
            </div>
          </div>
          <Link to="/dashboard/reviews" className="btn danger small" style={{ fontWeight: 700 }}>
            Inspect & Recover →
          </Link>
        </div>
      )}

      <section className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: '#15803d' }}>Total Revenue</span>
            <span style={{ fontSize: 16, background: '#dcfce7', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>💰</span>
          </div>
          <div className="stat-value">
            {metrics.financialsHidden ? (
              <span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 600 }}>🔒 Protected</span>
            ) : (
              money(metrics.totalSalesPaise || 0)
            )}
          </div>
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

        <article className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: unresolvedAlertCount > 0 ? '#dc2626' : '#d97706' }}>Guest Rating</span>
            <span style={{ fontSize: 16, background: unresolvedAlertCount > 0 ? '#fee2e2' : '#fef3c7', width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center' }}>⭐</span>
          </div>
          <div className="stat-value" style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: unresolvedAlertCount > 0 ? '#dc2626' : 'inherit' }}>
            {reviewSummary && reviewSummary.totalReviews > 0 ? reviewSummary.averageRating.toFixed(1) : '5.0'}
            <span style={{ fontSize: 16, color: '#f59e0b' }}>★</span>
          </div>
          <div className="stat-caption">
            {unresolvedAlertCount > 0 ? (
              <span style={{ color: '#dc2626', fontWeight: 700 }}>🚨 {unresolvedAlertCount} unresolved alert{unresolvedAlertCount > 1 ? 's' : ''}</span>
            ) : (
              `${reviewSummary?.totalReviews ?? 0} reviews (${reviewSummary?.googleClicks ?? 0} to Google)`
            )}
          </div>
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
        <Link to="/dashboard/orders" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--orange)' }}>🔔</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Live Orders</strong>
          <span className="muted" style={{ fontSize: 12 }}>Kitchen queue & tickets</span>
        </Link>
        <Link to="/dashboard/floor-map" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--green)' }}>🗺️</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Floor Map</strong>
          <span className="muted" style={{ fontSize: 12 }}>Real-time table states</span>
        </Link>
        <Link to="/dashboard/reviews" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--orange)' }}>⭐</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Reviews & Alerts</strong>
          <span className="muted" style={{ fontSize: 12 }}>Table recovery & Google rating</span>
        </Link>
        <Link to="/dashboard/menu" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--green)' }}>🍽️</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Menu Items</strong>
          <span className="muted" style={{ fontSize: 12 }}>{metrics.menuItems} dishes active</span>
        </Link>
        <Link to="/dashboard/tables" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--ink)' }}>🪑</div>
          <strong style={{ fontSize: 14, display: 'block' }}>Tables & QR</strong>
          <span className="muted" style={{ fontSize: 12 }}>{metrics.activeTables} tables configured</span>
        </Link>
        <Link to="/dashboard/day-close" className="surface" style={{ padding: '16px 14px', borderRadius: 14, textDecoration: 'none', color: 'inherit', display: 'block', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--green)' }}>📋</div>
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

      {/* Real-Time Guest Reviews & Table Sentiment */}
      <div className="heading-row" style={{ marginTop: 34 }}>
        <div>
          <span className="eyebrow">Customer delight & Google reputation</span>
          <h2>⭐ Guest Reviews & Table Sentiment</h2>
        </div>
        <Link className="btn secondary small" to="/dashboard/reviews">
          Full Reviews & Recovery Center ({recentReviews.length}) <span aria-hidden="true">→</span>
        </Link>
      </div>

      <section className="surface" style={{ padding: 20, borderRadius: 14 }}>
        {recentReviews.length === 0 ? (
          <EmptyState
            title="No guest reviews yet"
            description="When diners complete their meal and rate your food via QR, live feedback and Google Maps conversions will appear here."
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {recentReviews.slice(0, 3).map((rev) => (
              <div
                key={rev.id}
                style={{
                  border: rev.rating <= 2 && !rev.resolved ? '1px solid var(--red)' : '1px solid var(--line)',
                  borderRadius: 12,
                  padding: 16,
                  background: rev.rating <= 2 && !rev.resolved ? 'var(--soft-orange)' : 'var(--paper)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 14, display: 'block' }}>{rev.tableLabel || 'Table'}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{rev.customerName || 'Anonymous guest'} · {elapsedSince(rev.createdAt)}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#f59e0b', fontSize: 15, fontWeight: 700 }}>
                      {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                    </span>
                  </div>
                </div>

                {rev.comment && (
                  <p style={{ margin: '8px 0', fontSize: 13, color: '#334155' }}>
                    "{rev.comment}"
                  </p>
                )}

                {rev.tags && rev.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                    {rev.tags.map((tag) => (
                      <span key={tag} className="pill red" style={{ fontSize: 10, padding: '1px 6px' }}>
                        #{tag.toLowerCase().replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {rev.dishRatings && rev.dishRatings.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {rev.dishRatings.map((dish, idx) => (
                      <span key={idx} className={`pill ${dish.liked ? 'green' : 'red'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                        {dish.liked ? '👍' : '👎'} {dish.dishName}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                  {rev.googleReviewClicked ? (
                    <span className="pill green" style={{ fontSize: 10 }}>✓ Posted to Google</span>
                  ) : rev.rating >= 4 ? (
                    <span className="pill gray" style={{ fontSize: 10 }}>Positive internal</span>
                  ) : rev.resolved ? (
                    <span className="pill green" style={{ fontSize: 10 }}>✓ Recovered</span>
                  ) : (
                    <span className="pill red" style={{ fontSize: 10, fontWeight: 700 }}>🚨 Unresolved Alert</span>
                  )}

                  <Link to="/dashboard/reviews" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                    Details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
