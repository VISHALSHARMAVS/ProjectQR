import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { readCart, setCartQuantity, type CartLine } from '../../lib/cart';
import { money } from '../../lib/format';
import { createIdempotencyKey } from '../../lib/idempotency';
import { EmptyState, Loading } from '../../components/ui';
import type { MenuItem, OrderStatus, RestaurantInfo } from '../../types';

interface CustomerSession { sessionId: string; customer: { name: string }; restaurant: RestaurantInfo; table: { label: string } }
interface MenuResponse { items: MenuItem[] }
interface CreatedOrder { order: { id: string; status: OrderStatus } }

export default function CheckoutPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const cartKey = `projectqr-cart:${token}`;
  const [cart, setCart] = useState<CartLine[]>(() => readCart(cartKey));
  const [orderNotes, setOrderNotes] = useState('');
  const [message, setMessage] = useState('');
  const [idempotencyKey] = useState(createIdempotencyKey);
  const session = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<CustomerSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const menu = useQuery({ queryKey: ['customer-menu', token], queryFn: () => api.get<MenuResponse>(`/customer/menu?token=${encodeURIComponent(token)}`), enabled: Boolean(session.data), retry: false });
  useEffect(() => { localStorage.setItem(cartKey, JSON.stringify(cart)); }, [cart, cartKey]);
  const current = new Map((menu.data?.items ?? []).map((item) => [item._id, item]));
  const stale = cart.flatMap<{ line: CartLine; reason: 'price' | 'unavailable' }>((line) => {
    const item = current.get(line.menuItemId);
    if (!item || !item.available) return [{ line, reason: 'unavailable' as const }];
    if (item.pricePaise !== line.unitPricePaise) return [{ line, reason: 'price' as const }];
    return [];
  });
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);
  const mutation = useMutation({
    mutationFn: () => api.post<CreatedOrder>('/customer/orders', { token, idempotencyKey, items: cart.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, notes: line.notes, expectedUnitPricePaise: line.unitPricePaise })), notes: orderNotes }),
    onSuccess: (response) => { localStorage.removeItem(cartKey); navigate(`/order/${encodeURIComponent(token)}/tracking/${response.order.id}`, { replace: true }); },
    onError: async (cause) => {
      setMessage(cause instanceof ApiError ? cause.message : 'Your order could not be placed. Please try again.');
      if (cause instanceof ApiError && ['PRICE_CHANGED', 'ITEM_UNAVAILABLE'].includes(cause.code)) await menu.refetch();
    }
  });
  if (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  if (session.isLoading || menu.isLoading) return <div className="customer-wrap"><Loading label="Reviewing your order…" /></div>;
  if (!session.data) return <div className="customer-wrap"><Loading /></div>;
  if (menu.error) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 24 }}>We couldn’t verify the current menu. Please refresh before placing your order.</div><button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void menu.refetch()}>Refresh menu</button></main>;
  if (cart.length === 0) return <main className="customer-wrap customer-page"><header className="customer-header"><div className="restaurant-logo">{session.data.restaurant.name.slice(0, 1)}</div><div><h1>{session.data.restaurant.name}</h1><p>Table {session.data.table.label}</p></div></header><div className="surface" style={{ marginTop: 28 }}><EmptyState title="Your cart is empty" description="Take a look at the menu and add something you like." action={<Link className="btn" to={`/order/${encodeURIComponent(token)}/menu`}>Back to menu</Link>} /></div></main>;

  return <main className="customer-wrap customer-page">
    <header className="customer-header"><div className="restaurant-logo">{session.data.restaurant.name.slice(0, 1)}</div><div><h1>{session.data.restaurant.name}</h1><p>Table {session.data.table.label} · Order for {session.data.customer.name}</p></div></header>
    <div style={{ paddingTop: 27 }}><span className="eyebrow">Almost there</span><h1 style={{ margin: '4px 0 17px', fontSize: 31, letterSpacing: '-.05em' }}>Review your order</h1></div>
    <section className="customer-card surface"><div className="cart-list">{cart.map((line) => <article className="cart-line" key={line.menuItemId}><div><h3>{line.name}</h3><div className="muted" style={{ marginTop: 5, fontSize: 12 }}>{money(line.unitPricePaise)} each</div><div className="qty-control" style={{ marginTop: 10 }}><button aria-label={`Remove one ${line.name}`} onClick={() => setCart(setCartQuantity(cart, line.menuItemId, line.quantity - 1))}>−</button><strong>{line.quantity}</strong><button aria-label={`Add one ${line.name}`} onClick={() => setCart(setCartQuantity(cart, line.menuItemId, line.quantity + 1))}>+</button><button className="btn ghost small" style={{ marginLeft: 5 }} onClick={() => setCart(setCartQuantity(cart, line.menuItemId, 0))}>Remove</button></div><div className="field" style={{ marginTop: 10 }}><label htmlFor={`note-${line.menuItemId}`}>Note for the kitchen <span className="muted">(optional)</span></label><input className="input" id={`note-${line.menuItemId}`} maxLength={250} value={line.notes} onChange={(event) => setCart(cart.map((current) => current.menuItemId === line.menuItemId ? { ...current, notes: event.target.value } : current))} placeholder="e.g. No onions" /></div></div><span className="line-total">{money(line.quantity * line.unitPricePaise)}</span></article>)}</div>
      <div className="field" style={{ marginTop: 19 }}><label htmlFor="order-notes">Order note <span className="muted">(optional)</span></label><textarea className="textarea" id="order-notes" maxLength={500} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="Anything else we should know?" /></div>
      <div style={{ marginTop: 18 }}><div className="total-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="total-row"><span>Payment</span><span>Pay at the restaurant</span></div><div className="total-row grand"><span>Total</span><span>{money(subtotal)}</span></div></div>
    </section>
    {stale.length > 0 && <div className="form-error" style={{ marginTop: 14 }}><strong>Review your cart</strong><ul style={{ margin: '7px 0 0', paddingLeft: 18 }}>{stale.map(({ line, reason }) => <li key={line.menuItemId}>{line.name}: {reason === 'price' ? `now ${money(current.get(line.menuItemId)?.pricePaise ?? 0)}` : 'no longer available'}.</li>)}</ul><Link to={`/order/${encodeURIComponent(token)}/menu`} style={{ display: 'inline-block', marginTop: 8, textDecoration: 'underline' }}>Return to the menu</Link></div>}
    {message && <div className="form-error" role="alert" style={{ marginTop: 14 }}>{message}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginTop: 17 }}><Link className="btn secondary" to={`/order/${encodeURIComponent(token)}/menu`}>Back</Link><button className="btn" disabled={stale.length > 0 || mutation.isPending || cart.length === 0} onClick={() => { setMessage(''); mutation.mutate(); }}>{mutation.isPending ? 'Placing order…' : `Confirm order · ${money(subtotal)}`}</button></div>
    <p className="muted" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>Payment is handled by the restaurant. Your order will be sent to the kitchen after you confirm.</p>
  </main>;
}
