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
import { t, useGuestLang } from '../../lib/i18n';
import { getBrandStyle } from '../../lib/theme';
import type { OrderRecord, OrderStatus, RestaurantInfo } from '../../types';

interface PaymentIntentResponse {
  paymentIntent: {
    mode: 'razorpay_checkout' | 'cashfree_checkout' | 'upi_intent';
    provider: string;
    orderId: string;
    orderNumber: string;
    amountPaise: number;
    currency: 'INR';
    restaurantName: string;
    gatewayOrderId?: string;
    gatewayKeyId?: string;
    paymentSessionId?: string;
    upiUri?: string;
    upiId?: string;
    supportsAutoWebhook: boolean;
    supportsManualUtr: boolean;
  };
}

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
  const [autoConfirmError, setAutoConfirmError] = useState('');
  const [billSheetOpen, setBillSheetOpen] = useState(false);
  const [selectedPayMethod, setSelectedPayMethod] = useState<'CASH' | 'CARD' | 'UPI' | null>(null);
  const [billRequesting, setBillRequesting] = useState(false);
  const [billRequestedMethod, setBillRequestedMethod] = useState<'CASH' | 'CARD' | null>(null);
  const [billError, setBillError] = useState('');
  const [intentLoading, setIntentLoading] = useState(false);
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntentResponse['paymentIntent'] | null>(null);

  const sessionQuery = useQuery({
    queryKey: ['customer-session', token],
    queryFn: () => api.get<SessionResponse>(`/customer/session?token=${encodeURIComponent(token)}`),
    retry: false
  });
  const [lang] = useGuestLang(sessionQuery.data?.restaurant?.defaultLanguage);

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
    const trimmedRef = upiRef.trim();
    if (!trimmedRef || trimmedRef.length < 6) {
      setAutoConfirmError('Please enter your 12-digit UPI Reference / UTR number from your payment app.');
      return;
    }
    setAutoConfirmError('');
    setUpiConfirming(true);
    try {
      await api.post(`/customer/orders/${encodeURIComponent(orderId)}/auto-confirm?token=${encodeURIComponent(token)}`, {
        transactionReference: trimmedRef
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

  const handleRequestCashOrCardBill = async (method: 'CASH' | 'CARD') => {
    setBillError('');
    setBillRequesting(true);
    try {
      await api.post(`/customer/service-request?token=${encodeURIComponent(token)}`, {
        token,
        type: 'BILL',
        notes: `Payment method: ${method === 'CASH' ? 'Cash' : 'Card'} (Order #${orderQuery.data?.order.orderNumber ?? ''})`
      });
      setBillRequestedMethod(method);
      setBillSheetOpen(false);
    } catch (err: unknown) {
      setBillError(err instanceof ApiError ? err.message : 'Could not send bill request. Please call a waiter.');
    } finally {
      setBillRequesting(false);
    }
  };

  const handleSelectUpiPayment = async () => {
    setBillError('');
    setIntentLoading(true);
    try {
      const res = await api.post<PaymentIntentResponse>(
        `/customer/orders/${encodeURIComponent(orderId)}/payment-intent?token=${encodeURIComponent(token)}`,
        {}
      );
      setPaymentIntent(res.paymentIntent);
      setBillSheetOpen(false);
    } catch (err: unknown) {
      setBillError(err instanceof ApiError ? err.message : 'UPI payment is unavailable right now. Please choose Cash or Card.');
    } finally {
      setIntentLoading(false);
    }
  };

  const handleOpenGatewayCheckout = () => {
    if (!paymentIntent) return;
    if (paymentIntent.mode === 'razorpay_checkout' && paymentIntent.gatewayKeyId && paymentIntent.gatewayOrderId) {
      const win = window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } };
      const launch = () => {
        if (!win.Razorpay) return;
        const rzp = new win.Razorpay({
          key: paymentIntent.gatewayKeyId,
          amount: paymentIntent.amountPaise,
          currency: paymentIntent.currency,
          name: paymentIntent.restaurantName,
          description: `Order #${paymentIntent.orderNumber}`,
          order_id: paymentIntent.gatewayOrderId,
          handler: () => {
            void queryClient.invalidateQueries({ queryKey: ['customer-order', orderId, token] });
          }
        });
        rzp.open();
      };
      if (win.Razorpay) {
        launch();
      } else {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = launch;
        document.body.appendChild(script);
      }
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

  const brandStyle = getBrandStyle(sessionQuery.data?.restaurant?.brandColor);

  return (
    <main className="customer-wrap customer-page" style={brandStyle}>
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
            Call staff
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
              <span>Rate Your Dining Experience</span>
            </button>
          </div>
        ) : !rejected ? (
          <div style={{ marginTop: 16, padding: '16px', background: 'var(--paper-elevated)', border: '1px solid var(--line)', borderRadius: 12 }}>
            {billRequestedMethod ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{billRequestedMethod === 'CASH' ? '💵' : '💳'}</div>
                <strong style={{ display: 'block', fontSize: 14, color: 'var(--green)', marginBottom: 4 }}>
                  {t('billRequestedBanner', lang, { method: billRequestedMethod === 'CASH' ? t('payCash', lang) : t('payCard', lang) })}
                </strong>
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ marginTop: 8, fontSize: 12 }}
                  onClick={() => {
                    setBillRequestedMethod(null);
                    setBillSheetOpen(true);
                  }}
                >
                  Change payment method
                </button>
              </div>
            ) : paymentIntent ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ minWidth: 0, flex: '1 1 160px' }}>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--ink)' }}>
                      {t('payViaUpiTitle', lang)} ({money(order.totalPaise)})
                    </strong>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {paymentIntent.supportsAutoWebhook ? 'Auto-confirms on payment' : 'Fast UPI verification'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn ghost small"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setPaymentIntent(null);
                      setBillSheetOpen(true);
                    }}
                  >
                    ← Change
                  </button>
                </div>

                {paymentIntent.mode === 'razorpay_checkout' ? (
                  <button
                    type="button"
                    className="btn full"
                    style={{ background: '#072654', color: '#ffffff', fontWeight: 700, minHeight: 44 }}
                    onClick={handleOpenGatewayCheckout}
                  >
                    {t('payWithGateway', lang, { amount: (order.totalPaise / 100).toFixed(0) })}
                  </button>
                ) : paymentIntent.upiUri ? (
                  (() => {
                    const upiParams = paymentIntent.upiUri.replace(/^upi:\/\/pay\?/, '');
                    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
                    const genericUpiHref = isAndroid
                      ? `intent://pay?${upiParams}#Intent;scheme=upi;end`
                      : paymentIntent.upiUri;
                    return (
                      <>
                        <a
                          href={genericUpiHref}
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
                            textDecoration: 'none',
                            boxShadow: '0 4px 12px rgba(49, 91, 67, 0.2)'
                          }}
                        >
                          <span>{t('openUpiApp', lang)} · {money(order.totalPaise)}</span>
                        </a>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                          <a href={`tez://upi/pay?${upiParams}`} className="btn secondary small" style={{ justifyContent: 'center', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>GPay</a>
                          <a href={`phonepe://pay?${upiParams}`} className="btn secondary small" style={{ justifyContent: 'center', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>PhonePe</a>
                          <a href={`paytmmp://pay?${upiParams}`} className="btn secondary small" style={{ justifyContent: 'center', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>Paytm</a>
                        </div>

                        <div style={{ textAlign: 'center', margin: '12px 0', padding: 14, background: '#ffffff', borderRadius: 12, border: '1px solid var(--line)' }}>
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(paymentIntent.upiUri)}`}
                            alt="Scan to pay via any UPI app"
                            style={{ width: 180, height: 180, margin: '0 auto', display: 'block', borderRadius: 8 }}
                          />
                          <div style={{ fontSize: 12, color: '#111827', marginTop: 8, fontWeight: 700 }}>
                            {t('orScanQr', lang)}
                          </div>
                          {paymentIntent.upiId && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                              UPI ID: <strong style={{ color: '#111827' }}>{paymentIntent.upiId}</strong>
                            </div>
                          )}
                        </div>

                        {paymentIntent.supportsManualUtr && sessionQuery.data?.restaurant?.autoConfirmPayments && (
                          <div style={{ marginTop: 14, padding: 12, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)' }}>
                            <label htmlFor="upi-ref" style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--ink)' }}>
                              {t('enterUtrPrompt', lang)}
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                id="upi-ref"
                                className="input"
                                placeholder="e.g. 423456789012"
                                value={upiRef}
                                onChange={(e) => setUpiRef(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                                maxLength={30}
                                style={{ fontSize: 13, flex: 1 }}
                              />
                              <button
                                type="button"
                                className="btn"
                                style={{ background: 'var(--green, #315b43)', color: '#ffffff', fontWeight: 750, fontSize: 13, whiteSpace: 'nowrap' }}
                                onClick={handleAutoConfirmPayment}
                                disabled={upiConfirming || upiRef.trim().length < 6}
                              >
                                {upiConfirming ? t('confirming', lang) : t('confirmUpiPayment', lang)}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()
                ) : (
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>
                    Payment session initialized ({paymentIntent.provider}). Please complete payment in your gateway window.
                  </p>
                )}
              </div>
            ) : billSheetOpen ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong style={{ fontSize: 14, color: 'var(--ink)' }}>
                    {t('choosePaymentMethod', lang)} ({money(order.totalPaise)})
                  </strong>
                  <button
                    type="button"
                    className="btn ghost small"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setBillSheetOpen(false);
                      setSelectedPayMethod(null);
                      setBillError('');
                    }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                  {(['CASH', 'CARD', 'UPI'] as const).map((method) => {
                    const isSelected = selectedPayMethod === method;
                    const upiAvailable = Boolean(
                      sessionQuery.data?.restaurant?.upiId ||
                      (sessionQuery.data?.restaurant?.paymentGateway && sessionQuery.data.restaurant.paymentGateway !== 'direct_upi')
                    );
                    const disabled = method === 'UPI' && !upiAvailable;
                    const icon = method === 'CASH' ? '💵' : method === 'CARD' ? '💳' : '📱';
                    const title = method === 'CASH' ? t('payCash', lang) : method === 'CARD' ? t('payCard', lang) : t('payUpi', lang);
                    const hint = method === 'CASH' ? t('payCashHint', lang) : method === 'CARD' ? t('payCardHint', lang) : t('payUpiHint', lang);
                    return (
                      <button
                        key={method}
                        type="button"
                        disabled={disabled || intentLoading || billRequesting}
                        onClick={() => {
                          if (method === 'UPI') {
                            setSelectedPayMethod('UPI');
                            void handleSelectUpiPayment();
                          } else {
                            setSelectedPayMethod(method);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: isSelected ? '2px solid var(--green)' : '1px solid var(--line)',
                          background: isSelected ? 'var(--soft-green)' : 'var(--paper)',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.5 : 1,
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <div style={{ flex: 1 }}>
                          <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)' }}>{title}</strong>
                          <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(selectedPayMethod === 'CASH' || selectedPayMethod === 'CARD') && (
                  <button
                    type="button"
                    className="btn full"
                    disabled={billRequesting}
                    onClick={() => void handleRequestCashOrCardBill(selectedPayMethod)}
                    style={{
                      background: 'var(--green, #315b43)',
                      color: '#ffffff',
                      fontWeight: 700,
                      minHeight: 44
                    }}
                  >
                    {billRequesting
                      ? t('sendingBillRequest', lang)
                      : t('sendBillRequest', lang, { method: selectedPayMethod === 'CASH' ? t('payCash', lang) : t('payCard', lang) })}
                  </button>
                )}

                {intentLoading && (
                  <p className="muted" style={{ fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>
                    {t('openingCheckout', lang)}
                  </p>
                )}
                {billError && (
                  <div className="form-error" style={{ marginTop: 10, fontSize: 12 }}>
                    {billError}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <strong style={{ fontSize: 14, display: 'block', color: 'var(--ink)' }}>
                      {t('total', lang)} · {money(order.totalPaise)}
                    </strong>
                    <span className="muted" style={{ fontSize: 11 }}>
                      Cash, Card, or UPI
                    </span>
                  </div>
                  <span className="pill gray" style={{ fontSize: 10, fontWeight: 700 }}>
                    UNPAID
                  </span>
                </div>

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
                  onClick={() => setBillSheetOpen(true)}
                >
                  <span>🧾 {t('askForBill', lang)}</span>
                </button>
              </div>
            )}

            {autoConfirmError && (
              <div className="form-error" style={{ marginTop: 10, fontSize: 12 }}>
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
            Table Cleared · Visit Complete
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
