import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import { Loading, StatusPill } from '../../components/ui';
import { CustomerAssistanceModal } from '../../components/CustomerAssistanceModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import type { OrderRecord, OrderStatus } from '../../types';

interface OrderResponse { order: OrderRecord }
const progress: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'NEW', label: 'Order received', description: 'Your order is with the restaurant.' },
  { status: 'ACCEPTED', label: 'Accepted', description: 'The kitchen is getting ready.' },
  { status: 'PREPARING', label: 'Being prepared', description: 'Fresh from the kitchen.' },
  { status: 'READY', label: 'Ready', description: 'Your order is ready to enjoy.' },
  { status: 'DELIVERED', label: 'Served', description: 'Enjoy your meal.' }
];

export default function TrackingPage() {
  const { token = '', orderId = '' } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [assistanceOpen, setAssistanceOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId, token],
    queryFn: () => api.get<OrderResponse>(`/customer/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`),
    enabled: Boolean(orderId),
    refetchInterval: false,
    retry: false
  });
  useOrderSocket(true);

  if (!orderId) {
    return (
      <main className="customer-wrap customer-page">
        <div className="customer-intro">
          <span className="eyebrow">Your orders</span>
          <h2>Orders from this visit</h2>
          <p>Choose an order to see its latest status.</p>
        </div>
        <OrdersList token={token} />
      </main>
    );
  }

  if (orderQuery.isLoading) return <div className="customer-wrap"><Loading label="Checking your order…" /></div>;
  if (orderQuery.error instanceof ApiError && (orderQuery.error.status === 401 || orderQuery.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) {
    return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  }
  if (orderQuery.error || !orderQuery.data) {
    return (
      <main className="customer-wrap customer-page">
        <div className="form-error" style={{ marginTop: 24 }}>
          {orderQuery.error instanceof ApiError ? orderQuery.error.message : 'Order status is temporarily unavailable.'}
        </div>
        <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void orderQuery.refetch()}>
          Refresh status
        </button>
      </main>
    );
  }

  const { order } = orderQuery.data;
  const rejected = order.status === 'REJECTED';
  const reachedIndex = progress.findIndex(({ status }) => status === order.status);

  const restoreToCart = async () => {
    if (!order.items.length) return;
    setRestoring(true);
    setRestoreError('');
    try {
      for (const item of order.items) {
        await api.post('/customer/cart/items', {
          token,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          selectedVariant: item.selectedVariant ?? null,
          selectedAddons: item.selectedAddons ?? [],
          notes: item.notes || ''
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['table-cart', token] });
      navigate(`/order/${encodeURIComponent(token)}/checkout`);
    } catch (cause) {
      setRestoreError(cause instanceof ApiError ? cause.message : 'Could not restore dishes to cart. Please re-select from the menu.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <main className="customer-wrap customer-page">
      <header className="customer-header">
        <div
          className="restaurant-logo"
          style={rejected ? { background: '#fee2e2', color: '#b91c1c' } : {}}
        >
          {rejected ? '✕' : '✓'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rejected ? 'Order Cancelled' : 'Order Placed'}
          </h1>
          <p>{formatTableLabel(order.table.label)}</p>
        </div>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => setAssistanceOpen(true)}
        >
          🔔 Call Staff
        </button>
      </header>

      <section className="customer-intro" style={{ paddingTop: 28 }}>
        <span className="eyebrow" style={rejected ? { color: '#b91c1c' } : {}}>
          {order.orderNumber} {rejected ? '· DECLINED' : ''}
        </span>
        <h2 style={rejected ? { color: '#991b1b' } : {}}>
          {rejected ? 'Order was not accepted.' : order.status === 'DELIVERED' ? 'Enjoy your meal.' : 'We’re on it.'}
        </h2>
        <p style={rejected ? { color: '#7f1d1d' } : {}}>
          {rejected
            ? (order.rejectionReason || 'The restaurant was unable to prepare this order at this time.')
            : 'Your order status updates here as the kitchen works on it.'}
        </p>
      </section>

      <section className="customer-card surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <strong>Order Progress</strong>
          <StatusPill status={order.status} />
        </div>

        {rejected ? (
          <div style={{ padding: 14, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 12, marginBottom: 12 }}>
            <strong style={{ color: '#991b1b', display: 'block', fontSize: 14 }}>
              ❌ Order Cancelled by Restaurant
            </strong>
            <p style={{ color: '#7f1d1d', margin: '4px 0 0', fontSize: 13 }}>
              <strong>Reason:</strong> {order.rejectionReason || 'Item unavailable or kitchen closed.'}
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: '#15803d', fontWeight: 650 }}>
              ✓ No charge applied. Amount payable for this order is ₹0.00.
            </div>
          </div>
        ) : (
          progress.map((step, index) => {
            const completed = reachedIndex >= index;
            const timestamp = order.statusHistory.find((event) => event.status === step.status)?.at;
            return (
              <div className={`tracking-step ${completed ? 'done' : ''}`} key={step.status}>
                <div className="tracking-dot">{completed ? '✓' : index + 1}</div>
                <div>
                  <h3>{step.label}</h3>
                  <p>{timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : step.description}</p>
                </div>
              </div>
            );
          })
        )}
        <p className="muted" style={{ fontSize: 11, margin: '8px 0 0' }}>
          Placed {elapsedSince(order.createdAt)} · Real-time kitchen tracking
        </p>
      </section>

      <section className="customer-card surface">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>Your order items</h2>
          {rejected && (
            <span className="pill red" style={{ fontSize: 11, fontWeight: 700 }}>
              VOIDED
            </span>
          )}
        </div>

        <div className="cart-list">
          {order.items.map((item) => (
            <div className="total-row" key={item.menuItemId}>
              <span>
                {item.quantity} × {item.name}
                {item.selectedVariant && (
                  <span className="pill" style={{ fontSize: 10, marginLeft: 6, background: '#f1f5f9', color: '#475569' }}>
                    {item.selectedVariant.name}
                  </span>
                )}
                {item.notes && <small style={{ display: 'block', marginTop: 3 }}>Note: {item.notes}</small>}
              </span>
              <strong style={rejected ? { textDecoration: 'line-through', color: 'var(--muted)' } : {}}>
                {money(item.subtotalPaise)}
              </strong>
            </div>
          ))}
        </div>

        <div className="total-row grand">
          <div>
            <span>{rejected ? 'Amount Payable' : 'Total'}</span>
            {rejected && (
              <small style={{ display: 'block', color: 'var(--muted)', fontSize: 11, textDecoration: 'line-through', marginTop: 2 }}>
                Original Total: {money(order.totalPaise)}
              </small>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={rejected ? { color: '#16a34a', fontSize: 20 } : {}}>
              {rejected ? '₹0.00' : money(order.totalPaise)}
            </strong>
            {rejected && (
              <span style={{ display: 'block', fontSize: 11, color: '#15803d', fontWeight: 650 }}>
                Cancelled (No Charge)
              </span>
            )}
          </div>
        </div>

        {/* When rejected: 1-Click Restore to Cart & Re-order */}
        {rejected && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <button
              type="button"
              className="btn full"
              style={{
                minHeight: 46,
                fontWeight: 750,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(49, 91, 67, 0.2)'
              }}
              onClick={restoreToCart}
              disabled={restoring}
            >
              <span>🔄</span>
              <span>{restoring ? 'Restoring dishes to cart…' : 'Restore Dishes to Cart & Re-order'}</span>
            </button>
            {restoreError && <div className="form-error" style={{ marginTop: 10 }}>{restoreError}</div>}
            <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>
              Puts all dishes back in your table cart so you can replace or adjust items.
            </p>
          </div>
        )}

        {/* Only show Bill request if order was NOT rejected */}
        {!rejected && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 13 }}>Need water, cutlery or bill?</span>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setAssistanceOpen(true)}
            >
              🔔 Request Help / Bill
            </button>
          </div>
        )}
      </section>

      <Link className="btn secondary full" style={{ marginTop: 14 }} to={`/order/${encodeURIComponent(token)}/menu`}>
        Back to the menu
      </Link>

      <CustomerAssistanceModal
        isOpen={assistanceOpen}
        onClose={() => setAssistanceOpen(false)}
        token={token}
        tableLabel={formatTableLabel(order.table.label)}
      />
    </main>
  );
}

function OrdersList({ token }: { token: string }) {
  const query = useQuery({ queryKey: ['customer-orders', token], queryFn: () => api.get<{ orders: OrderRecord[] }>(`/customer/orders?token=${encodeURIComponent(token)}`), retry: false });
  if (query.isLoading) return <Loading />;
  if (query.error instanceof ApiError && (query.error.status === 401 || query.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  const orders = query.data?.orders ?? [];
  if (!orders.length) return <div className="surface"><div style={{ padding: 20 }}><p className="muted">No orders have been placed from this table yet.</p><Link className="btn" to={`/order/${encodeURIComponent(token)}/menu`}>Browse the menu</Link></div></div>;
  return (
    <div className="surface" style={{ padding: '4px 18px' }}>
      {orders.map((order) => (
        <Link
          key={order.id}
          to={`/order/${encodeURIComponent(token)}/tracking/${order.id}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '15px 0', borderBottom: '1px solid var(--line)' }}
        >
          <span>
            <strong style={{ display: 'block', fontSize: 14 }}>{order.orderNumber}</strong>
            <small className="muted">
              {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {order.status === 'REJECTED' ? 'Cancelled (₹0.00)' : money(order.totalPaise)}
            </small>
          </span>
          <StatusPill status={order.status} />
        </Link>
      ))}
    </div>
  );
}
