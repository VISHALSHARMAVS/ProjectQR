import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, formatTableLabel, money } from '../../lib/format';
import { playKitchenChime, playWaiterCallAlert } from '../../lib/audio';
import { EmptyState, ErrorPanel, Loading, Modal, StatusPill } from '../../components/ui';
import { useOrderSocket } from '../../hooks/useOrderSocket';
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
  const [filter, setFilter] = useState(kitchen ? 'NEW' : '');
  const [now, setNow] = useState(0);
  const [rejectionOrder, setRejectionOrder] = useState<OrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
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

  useOrderSocket(true, onNewOrder, onServiceRequest);

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
      <div className="toolbar">
        <button
          type="button"
          className={`btn small ${soundEnabled ? 'secondary' : 'ghost'}`}
          onClick={toggleSound}
          title={soundEnabled ? 'Click to mute chimes' : 'Click to enable chimes'}
        >
          {soundEnabled ? '🔔 Sound on' : '🔕 Muted'}
        </button>
        <select className="select" aria-label="Filter orders by status" value={filter} onChange={(event) => setFilter(event.target.value)}>
          {filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button className="btn secondary small" onClick={() => void query.refetch()}>Refresh</button>
      </div>
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
      return <article className="order-card surface" key={order.id}><header><div><h3>{order.orderNumber}</h3><span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>{formatTableLabel(order.table.label)} · {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><StatusPill status={order.status} /></header><div style={{ marginTop: 12 }}><span className="pill gray">{elapsedSince(order.createdAt, now)}</span></div><ul className="order-items">{order.items.map((item) => <li key={item.menuItemId}><span><strong>{item.quantity} × {item.name}</strong>{item.notes && <small>Note: {item.notes}</small>}</span><span>{money(item.subtotalPaise)}</span></li>)}</ul>{order.notes && <div className="notice" style={{ fontSize: 12 }}><strong>Order note:</strong> {order.notes}</div>}{order.rejectionReason && <div className="form-error" style={{ fontSize: 12 }}><strong>Rejection reason:</strong> {order.rejectionReason}</div>}<div className="total-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}><span>Total</span><strong>{money(order.totalPaise)}</strong></div>{action && <div className="order-actions"><button className="btn small" onClick={() => update.mutate({ order, status: action.status })} disabled={update.isPending}>{action.label}</button>{order.status === 'NEW' && <button className="btn danger small" onClick={() => { setRejectionOrder(order); setRejectionReason(''); setError(''); }}>Reject</button>}</div>}</article>;
    })}</section>}
    {rejectionOrder && <Modal title="Reject this order?" onClose={() => { setRejectionOrder(null); setError(''); }}><p className="muted">Tell the customer why {rejectionOrder.orderNumber} cannot be accepted. This message will appear on their tracking page.</p><div className="field" style={{ margin: '15px 0' }}><label htmlFor="reject-reason">Reason</label><textarea className="textarea" id="reject-reason" autoFocus required minLength={2} maxLength={300} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="e.g. One of the items is unavailable" /></div>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => setRejectionOrder(null)}>Cancel</button><button className="btn danger" onClick={reject} disabled={update.isPending || rejectionReason.trim().length < 2}>{update.isPending ? 'Updating…' : 'Reject order'}</button></div></Modal>}
  </>;
}
