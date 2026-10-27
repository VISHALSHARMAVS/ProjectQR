import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, money } from '../../lib/format';
import { EmptyState, ErrorPanel, Loading, Modal, StatusPill } from '../../components/ui';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import type { OrderRecord, OrderStatus } from '../../types';

interface OrderList { orders: OrderRecord[] }
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

function playOrderTone(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.13, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.23);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.24);
    oscillator.onended = () => void context.close();
  } catch { /* The visible in-app notice is the fallback when sound is blocked. */ }
}

export default function OrdersPage({ kitchen = false }: { kitchen?: boolean }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState(kitchen ? 'NEW' : '');
  const [now, setNow] = useState(0);
  const [rejectionOrder, setRejectionOrder] = useState<OrderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);
  const onNewOrder = useCallback(() => {
    setNotice('New order received. The kitchen board has been updated.');
    playOrderTone();
    if ('Notification' in window && Notification.permission === 'granted') new Notification('New ProjectQR order', { body: 'A customer order is ready to review.' });
    window.setTimeout(() => setNotice(''), 6000);
  }, []);
  useOrderSocket(true, onNewOrder);
  const query = useQuery({ queryKey: ['staff-orders', filter], queryFn: () => api.get<OrderList>(`/restaurant/orders${filter ? `?status=${filter}` : ''}`), refetchInterval: 60_000 });
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
    <div className="heading-row"><div><span className="eyebrow">Live order queue</span><h1>{heading}</h1><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Orders are saved in MongoDB and sync live across the team.</p></div><div className="toolbar"><select className="select" aria-label="Filter orders by status" value={filter} onChange={(event) => setFilter(event.target.value)}>{filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><button className="btn secondary small" onClick={() => void query.refetch()}>Refresh</button></div></div>
    {notice && <div className="notice success" role="status" aria-live="polite" style={{ marginBottom: 14 }}>{notice}</div>}
    {error && !rejectionOrder && <div className="form-error" style={{ marginBottom: 14 }} role="alert">{error}</div>}
    {orders.length === 0 ? <section className="surface"><EmptyState title={filter === 'NEW' ? 'No new orders' : 'No orders in this view'} description="New customer orders will appear here as soon as they are placed." /></section> : <section className="order-grid">{orders.map((order) => {
      const action = next[order.status];
      return <article className="order-card surface" key={order.id}><header><div><h3>{order.orderNumber}</h3><span className="muted" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>Table {order.table.label} · {new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></div><StatusPill status={order.status} /></header><div style={{ marginTop: 12 }}><span className="pill gray">{elapsedSince(order.createdAt, now)}</span></div><ul className="order-items">{order.items.map((item) => <li key={item.menuItemId}><span><strong>{item.quantity} × {item.name}</strong>{item.notes && <small>Note: {item.notes}</small>}</span><span>{money(item.subtotalPaise)}</span></li>)}</ul>{order.notes && <div className="notice" style={{ fontSize: 12 }}><strong>Order note:</strong> {order.notes}</div>}{order.rejectionReason && <div className="form-error" style={{ fontSize: 12 }}><strong>Rejection reason:</strong> {order.rejectionReason}</div>}<div className="total-row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}><span>Total</span><strong>{money(order.totalPaise)}</strong></div>{action && <div className="order-actions"><button className="btn small" onClick={() => update.mutate({ order, status: action.status })} disabled={update.isPending}>{action.label}</button>{order.status === 'NEW' && <button className="btn danger small" onClick={() => { setRejectionOrder(order); setRejectionReason(''); setError(''); }}>Reject</button>}</div>}</article>;
    })}</section>}
    {rejectionOrder && <Modal title="Reject this order?" onClose={() => { setRejectionOrder(null); setError(''); }}><p className="muted">Tell the customer why {rejectionOrder.orderNumber} cannot be accepted. This message will appear on their tracking page.</p><div className="field" style={{ margin: '15px 0' }}><label htmlFor="reject-reason">Reason</label><textarea className="textarea" id="reject-reason" autoFocus required minLength={2} maxLength={300} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="e.g. One of the items is unavailable" /></div>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => setRejectionOrder(null)}>Cancel</button><button className="btn danger" onClick={reject} disabled={update.isPending || rejectionReason.trim().length < 2}>{update.isPending ? 'Updating…' : 'Reject order'}</button></div></Modal>}
  </>;
}
