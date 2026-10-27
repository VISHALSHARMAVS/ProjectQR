import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { elapsedSince, money } from '../../lib/format';
import { Loading, StatusPill } from '../../components/ui';
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
  const orderQuery = useQuery({ queryKey: ['customer-order', orderId, token], queryFn: () => api.get<OrderResponse>(`/customer/orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`), enabled: Boolean(orderId), refetchInterval: false, retry: false });
  useOrderSocket(true);
  if (!orderId) return <main className="customer-wrap customer-page"><div className="customer-intro"><span className="eyebrow">Your orders</span><h2>Orders from this visit</h2><p>Choose an order to see its latest status.</p></div><OrdersList token={token} /></main>;
  if (orderQuery.isLoading) return <div className="customer-wrap"><Loading label="Checking your order…" /></div>;
  if (orderQuery.error instanceof ApiError && (orderQuery.error.status === 401 || orderQuery.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  if (orderQuery.error || !orderQuery.data) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 24 }}>{orderQuery.error instanceof ApiError ? orderQuery.error.message : 'Order status is temporarily unavailable.'}</div><button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void orderQuery.refetch()}>Refresh status</button></main>;
  const { order } = orderQuery.data;
  const rejected = order.status === 'REJECTED';
  const reachedIndex = progress.findIndex(({ status }) => status === order.status);
  return <main className="customer-wrap customer-page">
    <header className="customer-header"><div className="restaurant-logo">✓</div><div><h1>Order placed</h1><p>Table {order.table.label}</p></div></header>
    <section className="customer-intro" style={{ paddingTop: 33 }}><span className="eyebrow">{order.orderNumber}</span><h2>{rejected ? 'Please speak with a team member.' : order.status === 'DELIVERED' ? 'Enjoy your meal.' : 'We’re on it.'}</h2><p>{rejected ? order.rejectionReason || 'The restaurant could not accept this order.' : 'Your order status updates here as the kitchen works on it.'}</p></section>
    <section className="customer-card surface"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 17 }}><strong>Order progress</strong><StatusPill status={order.status} /></div>{rejected ? <div className="form-error">Order rejected: {order.rejectionReason || 'Please ask a team member for help.'}</div> : progress.map((step, index) => {
      const completed = reachedIndex >= index;
      const timestamp = order.statusHistory.find((event) => event.status === step.status)?.at;
      return <div className={`tracking-step ${completed ? 'done' : ''}`} key={step.status}><div className="tracking-dot">{completed ? '✓' : index + 1}</div><div><h3>{step.label}</h3><p>{timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : step.description}</p></div></div>;
    })}<p className="muted" style={{ fontSize: 11 }}>Placed {elapsedSince(order.createdAt)} · Updates appear automatically.</p></section>
    <section className="customer-card surface"><h2 style={{ margin: '0 0 15px', fontSize: 17 }}>Your order</h2><div className="cart-list">{order.items.map((item) => <div className="total-row" key={item.menuItemId}><span>{item.quantity} × {item.name}{item.notes && <small style={{ display: 'block', marginTop: 3 }}>{item.notes}</small>}</span><strong>{money(item.subtotalPaise)}</strong></div>)}</div><div className="total-row grand"><span>Total</span><strong>{money(order.totalPaise)}</strong></div></section>
    <Link className="btn secondary full" style={{ marginTop: 14 }} to={`/order/${encodeURIComponent(token)}/menu`}>Back to the menu</Link>
  </main>;
}

function OrdersList({ token }: { token: string }) {
  const query = useQuery({ queryKey: ['customer-orders', token], queryFn: () => api.get<{ orders: OrderRecord[] }>(`/customer/orders?token=${encodeURIComponent(token)}`), retry: false });
  if (query.isLoading) return <Loading />;
  if (query.error instanceof ApiError && (query.error.status === 401 || query.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  const orders = query.data?.orders ?? [];
  if (!orders.length) return <div className="surface"><div style={{ padding: 20 }}><p className="muted">No orders have been placed from this table yet.</p><Link className="btn" to={`/order/${encodeURIComponent(token)}/menu`}>Browse the menu</Link></div></div>;
  return <div className="surface" style={{ padding: '4px 18px' }}>{orders.map((order) => <Link key={order.id} to={`/order/${encodeURIComponent(token)}/tracking/${order.id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '15px 0', borderBottom: '1px solid var(--line)' }}><span><strong style={{ display: 'block', fontSize: 14 }}>{order.orderNumber}</strong><small className="muted">{new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {money(order.totalPaise)}</small></span><StatusPill status={order.status} /></Link>)}</div>;
}
