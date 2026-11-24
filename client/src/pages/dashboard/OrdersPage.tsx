import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import { playComplaintAlertChime, playKitchenChime, playPaymentSuccessChime, playWaiterCallAlert } from '../../lib/audio';
import { EmptyState, ErrorPanel, Loading, Modal, StatusPill } from '../../components/ui';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { printOrderReceipt } from '../../lib/printer';
import { useStaff } from '../../hooks/useStaff';
import { ItemStockModal } from '../../components/ItemStockModal';
import { ManualOrderModal } from '../../components/ManualOrderModal';
import type { OrderRecord, OrderStatus } from '../../types';

interface OrderList { orders: OrderRecord[] }
interface ServiceRequestItem {
  id: string;
  type: 'WATER' | 'CUTLERY' | 'BILL' | 'WAITER';
  tableLabel: string;
  notes: string;
  createdAt: string;
}

const serviceLabels: Record<ServiceRequestItem['type'], { title: string; icon: string }> = {
  WAITER: { title: 'Call Waiter', icon: '🙋' },
  BILL: { title: 'Bill Requested', icon: '🧾' },
  WATER: { title: 'Drinking Water', icon: '💧' },
  CUTLERY: { title: 'Plates & Cutlery', icon: '🍴' }
};

const filters: { label: string; value: string }[] = [
  { label: 'All statuses', value: '' }, { label: 'New', value: 'NEW' }, { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Preparing', value: 'PREPARING' }, { label: 'Ready', value: 'READY' }, { label: 'Delivered', value: 'DELIVERED' }, { label: 'Rejected', value: 'REJECTED' }
];
const next: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  NEW: { status: 'ACCEPTED', label: 'Accept order' },
  ACCEPTED: { status: 'PREPARING', label: 'Start preparing' },
  PREPARING: { status: 'READY', label: 'Mark ready' },
  READY: { status: 'DELIVERED', label: 'Mark delivered' }
};

export default function OrdersPage({ kitchen = false }: { kitchen?: boolean }) {
  const queryClient = useQueryClient();
  const staff = useStaff();
  const restaurant = staff.data?.restaurant;
  const restaurantName = restaurant?.name || 'Restaurant';
  const gstin = restaurant?.gstin;
  const gstPercentage = restaurant?.gstPercentage ?? 5;
  const upiId = restaurant?.upiId;
  const [punchOrderOpen, setPunchOrderOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [filter, setFilter] = useState(kitchen ? 'NEW' : '');
  const [now, setNow] = useState(0);
  const [rejectionOrder, setRejectionOrder] = useState<OrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [settlingOrder, setSettlingOrder] = useState<OrderRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'OTHER'>('CASH');
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('FLAT');
  const [discountInput, setDiscountInput] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [printOnSettle, setPrintOnSettle] = useState(true);
  const [settleError, setSettleError] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('pqr-kitchen-sound') !== 'false');
  const [activeAlert, setActiveAlert] = useState<ServiceRequestItem | null>(null);

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('pqr-kitchen-sound', String(next));
      if (next) playKitchenChime();
      return next;
    });
  };

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);

  const onNewOrder = useCallback(() => {
    setNotice('New order received! The board has been updated.');
    if (soundEnabled) playKitchenChime();
    if ('Notification' in window && Notification.permission === 'granted') new Notification('New ProjectQR order', { body: 'A customer order is ready to review.' });
    window.setTimeout(() => setNotice(''), 6000);
  }, [soundEnabled]);

  const onServiceRequest = useCallback((req: unknown) => {
    const data = req as ServiceRequestItem;
    const label = formatTableLabel(data.tableLabel ?? 'Table');
    setNotice(`${label} requested assistance!`);

    if (soundEnabled) {
      if (data.type === 'WAITER' || data.type === 'BILL') {
        playWaiterCallAlert();
      } else {
        playKitchenChime();
      }
    }

    if (data.type === 'WAITER' || data.type === 'BILL') {
      setActiveAlert(data);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🔔 ${label}: ${serviceLabels[data.type]?.title ?? 'Assistance'}`, {
        body: data.notes ? `Note: ${data.notes}` : 'Immediate staff attention requested.'
      });
    }

    window.setTimeout(() => setNotice(''), 6000);
  }, [soundEnabled]);

  const onOrderSettled = useCallback((payload: unknown) => {
    const data = payload as { tableLabel?: string; finalPaidPaise?: number; autoConfirmed?: boolean };
    if (soundEnabled) playPaymentSuccessChime();
    setNotice(`💰 ${data.tableLabel || 'Table'} settled: ${data.autoConfirmed ? 'Auto-Confirmed UPI' : 'Paid'}`);
    window.setTimeout(() => setNotice(''), 6000);
    void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
  }, [soundEnabled, queryClient]);

  const onReviewAlert = useCallback((payload: unknown) => {
    const data = payload as { tableLabel?: string; rating?: number; comment?: string };
    if (soundEnabled) playComplaintAlertChime();
    setNotice(`🚨 Alert: ${data.tableLabel || 'Table'} submitted ${data.rating || 1}★ feedback. Immediate recovery recommended!`);
    window.setTimeout(() => setNotice(''), 8000);
    void queryClient.invalidateQueries({ queryKey: ['restaurant-reviews'] });
  }, [soundEnabled, queryClient]);

  useOrderSocket(true, onNewOrder, onServiceRequest, undefined, onOrderSettled, onReviewAlert);

  const query = useQuery({ queryKey: ['staff-orders', filter], queryFn: () => api.get<OrderList>(`/restaurant/orders${filter ? `?status=${filter}` : ''}`), refetchInterval: 30_000 });
  const serviceRequests = useQuery({ queryKey: ['service-requests'], queryFn: () => api.get<{ requests: ServiceRequestItem[] }>('/restaurant/service-requests'), refetchInterval: 15_000 });

  const resolveRequest = useMutation({
    mutationFn: (id: string) => api.patch(`/restaurant/service-requests/${id}/resolve`, {}),
    onSuccess: async (_, id) => {
      if (activeAlert?.id === id) setActiveAlert(null);
      await queryClient.invalidateQueries({ queryKey: ['service-requests'] });
    }
  });

  const update = useMutation({
    mutationFn: ({ order, status, reason }: { order: OrderRecord; status: OrderStatus; reason?: string }) => api.patch(`/restaurant/orders/${order.id}/status`, { status, rejectionReason: reason ?? '' }),
    onSuccess: async () => { setError(''); setRejectionOrder(null); setRejectionReason(''); await queryClient.invalidateQueries({ queryKey: ['staff-orders'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'The order status could not be changed.')
  });

  const vacateTableMutation = useMutation({
    mutationFn: (tableId: string) => api.post(`/tables/${encodeURIComponent(tableId)}/vacate`, {}),
    onSuccess: () => {
      setNotice('Table marked as clean and vacant. Guest session ended.');
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['floor-map'] });
      window.setTimeout(() => setNotice(''), 4000);
    },
    onError: (cause: Error) => {
      setError(cause instanceof ApiError ? cause.message : 'Could not clear table.');
    }
  });

  const settleMutation = useMutation({
    mutationFn: ({
      orderId,
      paymentMethod,
      discountPaise,
      discountReason
    }: {
      orderId: string;
      paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'OTHER';
      discountPaise: number;
      discountReason: string;
    }) =>
      api.patch<{ order: OrderRecord }>(`/restaurant/orders/${orderId}/settle`, {
        paymentMethod,
        discountPaise,
        discountReason
      }),
    onSuccess: async (data) => {
      setSettleError('');
      if (printOnSettle) {
        printOrderReceipt(data.order, restaurantName, 'BILL', gstin, gstPercentage, upiId);
      }
      setSettlingOrder(null);
      setNotice(`Order ${data.order.orderNumber} successfully settled.`);
      await queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      window.setTimeout(() => setNotice(''), 4000);
    },
    onError: (cause: Error) => setSettleError(cause instanceof ApiError ? cause.message : 'Could not settle this order.')
  });

  const reject = (): void => { if (rejectionOrder) update.mutate({ order: rejectionOrder, status: 'REJECTED', reason: rejectionReason }); };
  if (query.isLoading) return <Loading label="Loading orders…" />;
  if (query.error || !query.data) return <ErrorPanel message={query.error instanceof ApiError ? query.error.message : 'Orders could not be loaded.'} retry={() => void query.refetch()} />;
  const orders = query.data.orders;
  const heading = kitchen ? 'Kitchen' : 'Orders';

  return <>
    <div className="heading-row">
      <div>
        <span className="eyebrow">Live order queue</span>
        <h1>{heading}</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Orders sync live across your team in real time.</p>
      </div>
      <div className="toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!kitchen && (
          <button
            type="button"
            className="btn small"
            style={{ background: '#16a34a', borderColor: '#15803d', color: 'white', fontWeight: 700 }}
            onClick={() => setPunchOrderOpen(true)}
            title="Punch in offline / walk-in order"
          >
            ➕ Punch New Order
          </button>
        )}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => setStockModalOpen(true)}
          title="Mark dishes In Stock or Sold Out"
        >
          📦 Item Stock
        </button>
        <button
          type="button"
          className={`btn small ${soundEnabled ? 'secondary' : 'ghost'}`}
          onClick={toggleSound}
          title={soundEnabled ? 'Click to mute chimes' : 'Click to enable chimes'}
        >
          {soundEnabled ? '🔔 Sound on' : '🔕 Muted'}
        </button>
        <button className="btn secondary small" onClick={() => void query.refetch()}>
          ↻ Refresh
        </button>
      </div>
    </div>

    {/* 1-Tap Segmented Status Tabs with Dynamic Order Counts */}
    <div className="orders-filter-bar">
      {filters.map((option) => {
        const isActive = filter === option.value;
        const count = option.value === ''
          ? orders.length
          : orders.filter((o) => o.status === option.value).length;
        const isNew = option.value === 'NEW' && count > 0;

        return (
          <button
            key={option.value}
            type="button"
            className={`orders-filter-chip ${isActive ? 'active' : ''} ${isNew ? 'has-new' : ''}`}
            onClick={() => setFilter(option.value)}
          >
            <span>{option.label}</span>
            <span className="orders-count-badge">{count}</span>
          </button>
        );
      })}
    </div>

    {/* High-priority full-screen modal alert for Waiter Call and Bill Request */}
    {activeAlert && (
      <div className="modal-backdrop" role="presentation" style={{ zIndex: 1100 }}>
        <section
          className="modal surface"
          role="alertdialog"
          aria-modal="true"
          aria-label="Waiter Call Alert"
          style={{
            width: 'min(440px, 94%)',
            border: '2px solid #ea580c',
            boxShadow: '0 20px 45px rgba(234, 88, 12, 0.28)'
          }}
        >
          <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: '#ffedd5',
                color: '#c2410c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                margin: '0 auto 12px'
              }}
            >
              {serviceLabels[activeAlert.type]?.icon || '🔔'}
            </div>
            <span className="eyebrow" style={{ color: '#c2410c', letterSpacing: '0.15em', fontWeight: 800 }}>
              GUEST ASSISTANCE ALERT
            </span>
            <h2 style={{ fontSize: 30, margin: '6px 0 4px', color: '#1c1917', fontWeight: 800 }}>
              {formatTableLabel(activeAlert.tableLabel)}
            </h2>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#9a3412' }}>
              {serviceLabels[activeAlert.type]?.title}
            </p>
            {activeAlert.notes && (
              <div style={{ marginTop: 14, padding: '9px 13px', background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#78350f', textAlign: 'left' }}>
                <strong>Guest note:</strong> {activeAlert.notes}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setActiveAlert(null)}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn"
              style={{ background: '#ea580c', borderColor: '#c2410c' }}
              disabled={resolveRequest.isPending}
              onClick={() => resolveRequest.mutate(activeAlert.id)}
            >
              {resolveRequest.isPending ? 'Marking…' : '✓ Acknowledge'}
            </button>
          </div>
        </section>
      </div>
    )}

    {serviceRequests.data?.requests && serviceRequests.data.requests.length > 0 && (
      <div className="surface" style={{ padding: '14px 18px', marginBottom: 16, borderLeft: '4px solid #c96d3c', background: '#fff9f5' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <strong style={{ fontSize: 14, color: '#9a3412', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔔 Table Assistance Requests ({serviceRequests.data.requests.length})
          </strong>
          <small className="muted">Live updates from guests</small>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {serviceRequests.data.requests.map((req) => (
            <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--line)' }}>
              <div>
                <strong>{formatTableLabel(req.tableLabel)}</strong>: <span style={{ fontWeight: 650 }}>{req.type === 'WATER' ? '💧 Drinking Water' : req.type === 'CUTLERY' ? '🍴 Extra Plates / Cutlery' : req.type === 'BILL' ? '🧾 Request Bill' : '🙋 Call Waiter'}</span>
                {req.notes && <small className="muted" style={{ display: 'block', marginTop: 2 }}>Note: {req.notes}</small>}
              </div>
              <button
                className="btn secondary small"
                disabled={resolveRequest.isPending}
                onClick={() => resolveRequest.mutate(req.id)}
              >
                ✓ Mark done
              </button>
            </div>
          ))}
        </div>
      </div>
    )}

    {notice && <div className="notice success" role="status" aria-live="polite" style={{ marginBottom: 14 }}>{notice}</div>}
    {error && !rejectionOrder && <div className="form-error" style={{ marginBottom: 14 }} role="alert">{error}</div>}
    {orders.length === 0 ? <section className="surface"><EmptyState title={filter === 'NEW' ? 'No new orders' : 'No orders in this view'} description="New customer orders will appear here as soon as they are placed." /></section> : <section className="order-grid">{orders.map((order) => {
      const action = next[order.status];
      const isActiveStatus = ['NEW', 'ACCEPTED', 'PREPARING'].includes(order.status);
      const currentTime = now || Date.now();
      const elapsedMinutes = Math.floor((currentTime - new Date(order.createdAt).getTime()) / 60_000);

      let urgencyClass = '';
      let urgencyBadge = null;
      if (isActiveStatus) {
        if (elapsedMinutes >= 20) {
          urgencyClass = 'urgency-critical';
          urgencyBadge = (
            <span className="order-urgency-tag critical">
              🔥 {elapsedMinutes}m - Critical
            </span>
          );
        } else if (elapsedMinutes >= 10) {
          urgencyClass = 'urgency-warning';
          urgencyBadge = (
            <span className="order-urgency-tag warning">
              ⚠️ {elapsedMinutes}m - Delayed
            </span>
          );
        } else {
          urgencyBadge = (
            <span className="order-urgency-tag normal">
              ⏱️ {elapsedMinutes}m
            </span>
          );
        }
      }

      return (
        <article className={`order-card surface ${urgencyClass}`} key={order.id}>
          <header>
            <div>
              <h3>{order.orderNumber}</h3>
              <span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                {formatTableLabel(order.table.label)} · {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {order.paymentStatus === 'PAID' ? (
                <span className="pill" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11, padding: '2px 8px' }}>
                  ✓ {order.autoConfirmed ? '⚡ AUTO-PAID (UPI)' : `PAID (${order.paymentMethod})`}
                </span>
              ) : order.status !== 'REJECTED' ? (
                <span className="pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: 11, padding: '2px 8px' }}>
                  UNPAID
                </span>
              ) : null}
              <StatusPill status={order.status} />
            </div>
          </header>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="pill gray">{elapsedSince(order.createdAt, now)}</span>
            {urgencyBadge}
          </div>                <ul className="order-items">
                  {order.items.map((item, idx) => (
                    <li key={idx}>
                      <span>
                        <strong>{item.quantity} × {item.name}</strong>
                        {item.selectedVariant && (
                          <span className="pill" style={{ fontSize: 10, marginLeft: 6, background: '#e0e7ff', color: '#3730a3', padding: '1px 6px' }}>
                            {item.selectedVariant.name}
                          </span>
                        )}
                        {item.selectedAddons && item.selectedAddons.length > 0 && (
                          <small style={{ color: '#4b5563', display: 'block', marginTop: 1 }}>
                            + {item.selectedAddons.map((a) => a.name).join(', ')}
                          </small>
                        )}
                        {item.notes && <small style={{ display: 'block' }}>Note: {item.notes}</small>}
                      </span>
                      <span>{money(item.subtotalPaise)}</span>
                    </li>
                  ))}
                </ul>{order.notes && <div className="notice" style={{ fontSize: 12 }}><strong>Order note:</strong> {order.notes}</div>}{order.rejectionReason && <div className="form-error" style={{ fontSize: 12 }}><strong>Rejection reason:</strong> {order.rejectionReason}</div>}                <div className="total-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div>
                    <span>Total</span>
                    {order.discountPaise && order.discountPaise > 0 ? (
                      <small style={{ color: '#b91c1c', display: 'block', fontSize: 11 }}>
                        Discount: -{money(order.discountPaise)} ({order.discountReason || 'Discount'})
                      </small>
                    ) : null}
                  </div>
                  <strong>{money(order.paymentStatus === 'PAID' ? (order.finalPaidPaise ?? order.totalPaise) : order.totalPaise)}</strong>
                </div>
                <div className="order-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => printOrderReceipt(order, restaurantName, 'KOT')}
                    title="Print 80mm Kitchen Order Ticket"
                  >
                    🖨️ KOT
                  </button>
                  <button
                    type="button"
                    className="btn secondary small"
                    onClick={() => printOrderReceipt(order, restaurantName, 'BILL', gstin, gstPercentage, upiId)}
                    title="Print Customer Bill Receipt (with GST Breakdown)"
                  >
                    🧾 Bill
                  </button>
                  {!kitchen && order.status !== 'REJECTED' && order.paymentStatus !== 'PAID' && (
                    <button
                      type="button"
                      className="btn small"
                      style={{ background: '#16a34a', borderColor: '#16a34a', color: 'white' }}
                      onClick={() => {
                        setSettlingOrder(order);
                        setPaymentMethod('CASH');
                        setDiscountType('FLAT');
                        setDiscountInput('0');
                        setDiscountReason('');
                        setSettleError('');
                      }}
                      title="Settle bill & record tender (Cash/UPI/Card)"
                    >
                      💳 Settle
                    </button>
                  )}
                  {order.paymentStatus === 'PAID' && (
                    order.table.needsClearing ? (
                      <button
                        type="button"
                        className="btn small"
                        style={{ background: '#b45309', borderColor: '#b45309', color: 'white' }}
                        onClick={() => { if (order.table.id) vacateTableMutation.mutate(order.table.id); }}
                        disabled={vacateTableMutation.isPending}
                        title="Clear table and end customer session for new guests"
                      >
                        🧹 Clear Table
                      </button>
                    ) : (
                      <span
                        className="pill"
                        style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: 11, padding: '4px 8px' }}
                        title="Table is clean and vacant"
                      >
                        ✓ Table Cleared
                      </span>
                    )
                  )}
                  {action && (
                    <button
                      className="btn small"
                      onClick={() => update.mutate({ order, status: action.status })}
                      disabled={update.isPending}
                    >
                      {action.label}
                    </button>
                  )}
                  {order.status === 'NEW' && (
                    <button
                      className="btn danger small"
                      onClick={() => { setRejectionOrder(order); setRejectionReason(''); setError(''); }}
                    >
                      Reject
                    </button>
                  )}
                </div>
              </article>
            );
          })}</section>}
    {rejectionOrder && <Modal title="Reject this order?" onClose={() => { setRejectionOrder(null); setError(''); }}><p className="muted">Tell the customer why {rejectionOrder.orderNumber} cannot be accepted. This message will appear on their tracking page.</p><div className="field" style={{ margin: '15px 0' }}><label htmlFor="reject-reason">Reason</label><textarea className="textarea" id="reject-reason" autoFocus required minLength={2} maxLength={300} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="e.g. One of the items is unavailable" /></div>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => setRejectionOrder(null)}>Cancel</button><button className="btn danger" onClick={reject} disabled={update.isPending || rejectionReason.trim().length < 2}>{update.isPending ? 'Updating…' : 'Reject order'}</button></div></Modal>}
    {settlingOrder && (
      <Modal
        title={`Settle Order ${settlingOrder.orderNumber}`}
        onClose={() => { setSettlingOrder(null); setSettleError(''); }}
        width={480}
      >
        <div style={{ fontSize: 13, marginBottom: 14, color: 'var(--ink)' }}>
          <strong>{formatTableLabel(settlingOrder.table.label)}</strong> · Gross Total: <strong>{money(settlingOrder.totalPaise)}</strong>
        </div>

        {/* Discount Section */}
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Discount / Courtesy (Optional)
          </label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className={`btn small ${discountType === 'FLAT' ? '' : 'secondary'}`}
                onClick={() => setDiscountType('FLAT')}
              >
                Flat (₹)
              </button>
              <button
                type="button"
                className={`btn small ${discountType === 'PERCENT' ? '' : 'secondary'}`}
                onClick={() => setDiscountType('PERCENT')}
              >
                Percentage (%)
              </button>
            </div>
            <input
              className="input"
              type="number"
              min="0"
              max={discountType === 'PERCENT' ? 100 : settlingOrder.totalPaise / 100}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              placeholder={discountType === 'PERCENT' ? 'e.g. 10%' : 'e.g. ₹50'}
              style={{ flex: '1 1 100px', minWidth: 90 }}
            />
          </div>
          <input
            className="input"
            maxLength={80}
            value={discountReason}
            onChange={(e) => setDiscountReason(e.target.value)}
            placeholder="Reason (e.g. Owner courtesy / Staff discount)"
            style={{ fontSize: 12 }}
          />
        </div>

        {/* Net Payable Display */}
        {(() => {
          const val = Number(discountInput) || 0;
          const discountPaise = discountType === 'PERCENT'
            ? Math.round((settlingOrder.totalPaise * Math.min(100, Math.max(0, val))) / 100)
            : Math.min(settlingOrder.totalPaise, Math.round(val * 100));
          const netPayablePaise = Math.max(0, settlingOrder.totalPaise - discountPaise);

          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>Net Amount to Collect:</span>
                <strong style={{ fontSize: 20, color: '#15803d' }}>{money(netPayablePaise)}</strong>
              </div>

              {/* Payment Method / Tender Selection */}
              <div className="field" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>Choose Payment Mode (Tender)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  {[
                    { id: 'CASH', label: '💵 Cash in Drawer' },
                    { id: 'UPI', label: '📱 UPI / QR Code' },
                    { id: 'CARD', label: '💳 Credit / Debit Card' },
                    { id: 'OTHER', label: '✨ Other / Complimentary' }
                  ].map((method) => (
                    <button
                      type="button"
                      key={method.id}
                      className={`btn ${paymentMethod === method.id ? '' : 'secondary'}`}
                      style={{ textAlign: 'left', padding: '12px 10px', fontSize: 13 }}
                      onClick={() => setPaymentMethod(method.id as 'CASH' | 'UPI' | 'CARD' | 'OTHER')}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Instant UPI QR Preview */}
              {paymentMethod === 'UPI' && (
                <div style={{ textAlign: 'center', padding: 14, background: '#f0fdf4', borderRadius: 12, border: '1.5px solid #86efac', marginBottom: 16 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Instant UPI QR Code (GPay / PhonePe / Paytm)
                  </span>
                  {upiId ? (
                    <>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=6&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(restaurantName)}&am=${(netPayablePaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(settlingOrder.orderNumber)}`)}`}
                        alt="UPI QR Code"
                        style={{ width: 140, height: 140, display: 'block', margin: '10px auto', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#14532d' }}>
                        UPI VPA: {upiId}
                      </div>
                      <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                        Customer scans this QR code to transfer exactly <strong>{money(netPayablePaise)}</strong> directly to your bank account.
                      </div>
                    </>
                  ) : (
                    <p style={{ margin: '8px 0 0', fontSize: 12, color: '#166534' }}>
                      To show an automated dynamic QR code here, add your restaurant's UPI ID in <strong>Settings ➔ UPI Payments</strong>.
                    </p>
                  )}
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 14, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={printOnSettle}
                  onChange={(e) => setPrintOnSettle(e.target.checked)}
                />
                <span>Print paid bill receipt immediately on 80mm thermal roll</span>
              </label>

              {settleError && <div className="form-error" style={{ marginBottom: 12 }}>{settleError}</div>}

              <div className="toolbar" style={{ justifyContent: 'end' }}>
                <button className="btn secondary" onClick={() => { setSettlingOrder(null); setSettleError(''); }}>
                  Cancel
                </button>
                <button
                  className="btn"
                  disabled={settleMutation.isPending}
                  onClick={() => {
                    settleMutation.mutate({
                      orderId: settlingOrder.id,
                      paymentMethod,
                      discountPaise,
                      discountReason
                    });
                  }}
                >
                  {settleMutation.isPending ? 'Settling…' : `Confirm Payment · ${money(netPayablePaise)}`}
                </button>
              </div>
            </>
          );
        })()}
      </Modal>
    )}

    {/* Manual Waiter Punch-in Modal */}
    {punchOrderOpen && (
      <ManualOrderModal
        onClose={() => setPunchOrderOpen(false)}
        onOrderCreated={(order) => {
          setNotice(`Order ${order.orderNumber} successfully sent to kitchen!`);
          window.setTimeout(() => setNotice(''), 4000);
        }}
      />
    )}

    {/* Kitchen Stock & Item Availability Modal */}
    {stockModalOpen && (
      <ItemStockModal
        onClose={() => setStockModalOpen(false)}
      />
    )}
  </>;
}
