import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { addCartLine, readCart, setCartQuantity, type CartLine } from '../../lib/cart';
import { money } from '../../lib/format';
import { EmptyState, Loading } from '../../components/ui';
import type { Category, MenuItem, RestaurantInfo } from '../../types';

interface CustomerSession { sessionId: string; customer: { id: string; name: string }; restaurant: RestaurantInfo; table: { id: string; label: string } }
interface CustomerMenu { categories: Category[]; items: MenuItem[] }

export default function CustomerMenuPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartKey = `projectqr-cart:${token}`;
  const session = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<CustomerSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const menu = useQuery({ queryKey: ['customer-menu', token], queryFn: () => api.get<CustomerMenu>(`/customer/menu?token=${encodeURIComponent(token)}`), enabled: Boolean(session.data), retry: false });
  const endVisit = useMutation({ mutationFn: () => api.post('/customer/logout'), onSuccess: async () => { localStorage.removeItem(cartKey); await queryClient.removeQueries({ queryKey: ['customer-session', token] }); navigate(`/order/${encodeURIComponent(token)}`, { replace: true }); } });
  const [cart, setCart] = useState<CartLine[]>(() => readCart(cartKey));
  const [activeCategory, setActiveCategory] = useState('');
  useEffect(() => { localStorage.setItem(cartKey, JSON.stringify(cart)); }, [cart, cartKey]);
  const quantityById = useMemo(() => new Map(cart.map((line) => [line.menuItemId, line.quantity])), [cart]);
  if (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  if (session.isLoading || menu.isLoading) return <div className="customer-wrap"><Loading label="Setting your table…" /></div>;
  if (!session.data) return <div className="customer-wrap"><Loading /></div>;
  if (menu.error || !menu.data) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 24 }}>{menu.error instanceof ApiError ? menu.error.message : 'The menu could not be loaded.'}</div><button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void menu.refetch()}>Try again</button></main>;
  const { restaurant, table } = session.data;
  const { categories, items } = menu.data;
  const availableCategories = categories.filter((category) => items.some((item) => item.categoryId === category._id));
  const updateQuantity = (item: MenuItem, value: number): void => setCart(setCartQuantity(cart, item._id, value));
  const addItem = (item: MenuItem): void => setCart(addCartLine(cart, { menuItemId: item._id, name: item.name, unitPricePaise: item.pricePaise }));
  const scrollTo = (id: string): void => { setActiveCategory(id); document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);

  return <main className="customer-wrap customer-page">
    <header className="customer-header"><div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div><div style={{ flex: 1 }}><h1>{restaurant.name}</h1><p>Table {table.label} · Hi, {session.data.customer.name}</p></div><Link className="btn secondary small" to={`/order/${encodeURIComponent(token)}/tracking`}>Orders</Link><button className="btn ghost small" onClick={() => endVisit.mutate()} disabled={endVisit.isPending}>{endVisit.isPending ? 'Ending…' : 'End visit'}</button></header>
    <div style={{ paddingTop: 24 }}><span className="eyebrow">Made fresh for you</span><h1 style={{ margin: '5px 0 16px', fontSize: 31, letterSpacing: '-.05em' }}>The menu</h1>
      {availableCategories.length > 0 && <nav className="menu-categories" aria-label="Menu categories">{availableCategories.map((category) => <button key={category._id} className={`category-chip ${activeCategory === category._id ? 'active' : ''}`} onClick={() => scrollTo(category._id)}>{category.name}</button>)}</nav>}
    </div>
    {availableCategories.length === 0 ? <div className="surface"><EmptyState title="The menu is being prepared" description="Please check back in a moment or ask a team member." /></div> : availableCategories.map((category) => <section className="menu-section" id={`category-${category._id}`} key={category._id}><h2>{category.name}</h2>{category.description && <p className="muted" style={{ margin: '-6px 0 10px', fontSize: 12 }}>{category.description}</p>}{items.filter((item) => item.categoryId === category._id).map((item) => {
      const quantity = quantityById.get(item._id) ?? 0;
      return <article className="menu-card" key={item._id}><div><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}<span className="menu-price">{money(item.pricePaise)}</span><div className="menu-action">{item.available ? quantity > 0 ? <div className="qty-control"><button aria-label={`Remove one ${item.name}`} onClick={() => updateQuantity(item, quantity - 1)}>−</button><strong>{quantity}</strong><button aria-label={`Add one ${item.name}`} onClick={() => updateQuantity(item, quantity + 1)}>+</button></div> : <button className="btn small" onClick={() => addItem(item)}>Add <span aria-hidden="true">+</span></button> : <span className="pill gray">Currently unavailable</span>}</div></div>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" /> : <div style={{ width: '100%', height: 100, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#799078', background: '#edf0e8', fontSize: 12 }}>Made fresh</div>}</article>;
    })}</section>)}
    {cart.length > 0 && <Link className="cart-bar" to={`/order/${encodeURIComponent(token)}/checkout`}><span><strong>{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}</strong><small>View your order</small></span><strong>{money(subtotal)} <span aria-hidden="true">→</span></strong></Link>}
  </main>;
}
