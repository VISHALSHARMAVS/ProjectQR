import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import { Loading, StatusPill } from '../../components/ui';
import { CustomerAssistanceModal } from '../../components/CustomerAssistanceModal';
import { ReviewModal } from '../../components/ReviewModal';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { playPaymentSuccessChime } from '../../lib/audio';
import type { OrderRecord, OrderStatus, RestaurantInfo } from '../../types';

interface OrderResponse { order: OrderRecord }
interface SessionResponse {
  restaurant: RestaurantInfo;
  table: { label: string };
}
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
  const [reviewOpen, setReviewOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [tableVacated, setTableVacated] = useState(false);
  const [upiConfirming, setUpiConfirming] = useState(false);
  const [upiRef, setUpiRef] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [showUpiQr, setShowUpiQr] = useState(false);
  const [autoConfirmError, setAutoConfirmError] = useState('');

  const sessionQuery = useQuery({
    queryKey: ['customer-session', token],
    queryFn: () => api.get<SessionResponse>(`/customer/session?token=${encodeURIComponent(token)}`),
    retry: false
  });

  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId, token],
    queryFn: () => api.get<OrderResponse>(`/customer/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`),
    enabled: Boolean(orderId),
    refetchInterval: false,
    retry: false
  });

  useOrderSocket(
    true,
    undefined,
    undefined,
    () => setTableVacated(true),
    (settledData: unknown) => {
      const settled = settledData as { orderId?: string } | undefined;
      if (!settled?.orderId || settled.orderId === orderId) {
        playPaymentSuccessChime();
        setReviewOpen(true);
      }
    }
  );

  const handleAutoConfirmPayment = async () => {
    setAutoConfirmError('');
    setUpiConfirming(true);
    try {
      await api.post(`/customer/orders/${encodeURIComponent(orderId)}/auto-confirm?token=${encodeURIComponent(token)}`, {
        transactionReference: upiRef.trim() || undefined
      });
      playPaymentSuccessChime();
      await queryClient.invalidateQueries({ queryKey: ['customer-order', orderId, token] });
      setTimeout(() => setReviewOpen(true), 600);
    } catch (err: unknown) {
      setAutoConfirmError(err instanceof ApiError ? err.message : 'Could not confirm payment. Please ask staff for assistance.');
    } finally {
      setUpiConfirming(false);
    }
  };

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
          style={rejected ? { background: 'var(--soft-orange)', color: 'var(--red)' } : {}}
        >
          {rejected ? '✕' : '✓'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rejected ? 'Order cancelled' : 'Order placed'}
          </h1>
          <p>{formatTableLabel(order.table.label)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ThemeToggle variant="compact" />
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setAssistanceOpen(true)}
          >
            🔔 Call staff
          </button>
        </div>
      </header>

      <section className="customer-intro" style={{ paddingTop: 28 }}>
        <span className="eyebrow" style={rejected ? { color: 'var(--red)' } : {}}>
          {order.orderNumber} {rejected ? '· DECLINED' : ''}
        </span>
        <h2 style={rejected ? { color: 'var(--red)' } : {}}>
          {rejected ? 'Order was not accepted.' : order.status === 'DELIVERED' ? 'Enjoy your meal.' : 'We’re on it.'}
        </h2>
        <p style={rejected ? { color: 'var(--muted)' } : {}}>
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
          <div style={{ padding: 14, background: 'var(--soft-orange)', border: '1.5px solid var(--red)', borderRadius: 12, marginBottom: 12 }}>
            <strong style={{ color: 'var(--red)', display: 'block', fontSize: 14 }}>
              ❌ Order Cancelled by Restaurant
            </strong>
            <p style={{ color: 'var(--ink)', margin: '4px 0 0', fontSize: 13 }}>
              <strong>Reason:</strong> {order.rejectionReason || 'Item unavailable or kitchen closed.'}
            </p>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', fontWeight: 650 }}>
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
                  <span className="pill" style={{ fontSize: 10, marginLeft: 6, background: 'var(--paper-elevated)', color: 'var(--muted)' }}>
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
            <strong style={rejected ? { color: 'var(--green)', fontSize: 20 } : {}}>
              {rejected ? '₹0.00' : money(order.totalPaise)}
            </strong>
            {rejected && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--green)', fontWeight: 650 }}>
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

        {/* Paid & Settled confirmation or UPI Auto-Confirm / Bill request */}
        {order.paymentStatus === 'PAID' ? (
          <div style={{ marginTop: 16, padding: '16px', background: 'var(--soft-green)', border: '1.5px solid var(--green)', borderRadius: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 750, color: 'var(--green)', display: 'block' }}>
              ✓ Bill Paid & Settled {order.autoConfirmed ? '(Auto-Confirmed UPI)' : `(${order.paymentMethod || 'PAID'})`}
            </span>
            {order.transactionReference && (
              <small style={{ display: 'block', color: 'var(--green)', fontSize: 11, marginTop: 2 }}>
                Ref / UTR: {order.transactionReference}
              </small>
            )}
            <p className="muted" style={{ margin: '6px 0 14px', fontSize: 12 }}>
              Thank you for dining with us! How was your experience today?
            </p>
            <button
              type="button"
              className="btn full"
              style={{
                background: 'var(--orange)',
                color: '#ffffff',
                fontWeight: 750,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
              }}
              onClick={() => setReviewOpen(true)}
            >
              <span>⭐</span>
              <span>Rate Your Dining Experience</span>
            </button>
          </div>
        ) : !rejected ? (
          <div style={{ marginTop: 16, padding: '16px', background: 'var(--paper-elevated)', border: '1px solid var(--line)', borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 14, display: 'block', color: 'var(--ink)' }}>
                  📱 Pay with UPI (Zero Wait Time)
                </strong>
                <span className="muted" style={{ fontSize: 11 }}>
                  Instant UPI payment · Digital order receipt updates in real time
                </span>
              </div>
              <span className="pill green" style={{ fontSize: 10, fontWeight: 700 }}>
                AUTO-CONFIRM
              </span>
            </div>

            {sessionQuery.data?.restaurant?.upiId && (
              <div style={{ marginBottom: 12 }}>
                <a
                  href={`upi://pay?pa=${encodeURIComponent(sessionQuery.data.restaurant.upiId)}&pn=${encodeURIComponent(sessionQuery.data.restaurant.name)}&am=${(order.totalPaise / 100).toFixed(2)}&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}&cu=INR`}
                  className="btn full"
                  style={{
                    background: 'var(--green)',
                    color: '#ffffff',
                    fontWeight: 750,
                    fontSize: 14,
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    textDecoration: 'none'
                  }}
                >
                  <span>⚡</span>
                  <span>Open UPI App to Pay {money(order.totalPaise)}</span>
                </a>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--muted)', padding: '2px 4px', flexWrap: 'wrap', gap: 6 }}>
                  <span>UPI ID: <strong>{sessionQuery.data.restaurant.upiId}</strong></span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => setShowUpiQr((prev) => !prev)}
                    >
                      {showUpiQr ? '✕ Hide QR' : '📷 Show QR Code'}
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                      onClick={() => {
                        if (sessionQuery.data?.restaurant?.upiId) {
                          void navigator.clipboard.writeText(sessionQuery.data.restaurant.upiId);
                        }
                      }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>

                {showUpiQr && (
                  <div style={{ textAlign: 'center', margin: '10px 0', padding: 12, background: '#ffffff', borderRadius: 12, border: '1px solid var(--line)' }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(`upi://pay?pa=${sessionQuery.data.restaurant.upiId}&pn=${encodeURIComponent(sessionQuery.data.restaurant.name)}&am=${(order.totalPaise / 100).toFixed(2)}&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}&cu=INR`)}`}
                      alt="Scan to pay via any UPI app"
                      style={{ width: 180, height: 180, margin: '0 auto', display: 'block', borderRadius: 8 }}
                    />
                    <div style={{ fontSize: 11, color: '#333333', marginTop: 6, fontWeight: 600 }}>
                      Scan with Google Pay, PhonePe, Paytm, or BHIM
                    </div>
                  </div>
                )}
              </div>
            )}

            {showUpiInput && (
              <div style={{ marginBottom: 10 }}>
                <label htmlFor="upi-ref" style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  UPI Reference / UTR Number (optional)
                </label>
                <input
                  id="upi-ref"
                  className="input"
                  placeholder="e.g. 423456789012"
                  value={upiRef}
                  onChange={(e) => setUpiRef(e.target.value)}
                  maxLength={50}
                  style={{ fontSize: 13 }}
                />
              </div>
            )}

            <div style={{ display: 'grid', gap: 8 }}>
              <button
                type="button"
                className="btn full"
                style={{
                  background: 'var(--green, #315b43)',
                  color: '#ffffff',
                  fontWeight: 750,
                  fontSize: 14,
                  minHeight: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(49, 91, 67, 0.2)'
                }}
                onClick={handleAutoConfirmPayment}
                disabled={upiConfirming}
              >
                <span>✓</span>
                <span>{upiConfirming ? 'Auto-Confirming Payment…' : "I've Paid via UPI · Auto-Confirm"}</span>
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ fontSize: 11, padding: '2px 4px', color: 'var(--muted)' }}
                  onClick={() => setShowUpiInput((prev) => !prev)}
                >
                  {showUpiInput ? '− Hide UTR input' : '+ Add UTR / Reference number'}
                </button>

                <button
                  type="button"
                  className="btn ghost small"
                  style={{ fontSize: 11, padding: '2px 4px', color: 'var(--muted)' }}
                  onClick={() => setAssistanceOpen(true)}
                >
                  🔔 Request Cash / Card Bill
                </button>
              </div>
            </div>

            {autoConfirmError && (
              <div className="form-error" style={{ marginTop: 8, fontSize: 12 }}>
                {autoConfirmError}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Table Vacated Notification Banner */}
      {tableVacated && (
        <div style={{ padding: 14, background: 'var(--soft-green)', border: '1.5px solid var(--green)', borderRadius: 12, marginTop: 14, textAlign: 'center' }}>
          <strong style={{ color: 'var(--green)', display: 'block', fontSize: 14 }}>
            👋 Table Cleared · Visit Complete
          </strong>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink)' }}>
            This table is now cleared for the next guests. Thank you for dining with us!
          </p>
        </div>
      )}

      {!tableVacated && (
        <Link className="btn secondary full" style={{ marginTop: 14 }} to={`/order/${encodeURIComponent(token)}/menu`}>
          Back to the menu
        </Link>
      )}

      <CustomerAssistanceModal
        isOpen={assistanceOpen}
        onClose={() => setAssistanceOpen(false)}
        token={token}
        tableLabel={formatTableLabel(order.table.label)}
      />

      <ReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        token={token}
        orderId={order.id}
        tableLabel={formatTableLabel(order.table.label)}
        googleReviewUrl={sessionQuery.data?.restaurant?.googleReviewUrl}
        enableDishReviews={sessionQuery.data?.restaurant?.enableDishReviews ?? true}
        orderedDishes={order.items.map((it) => ({ menuItemId: it.menuItemId, name: it.name }))}
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
