import { useMemo, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { formatTableLabel, money } from '../../lib/format';
import { DietaryBadge, EmptyState, Loading } from '../../components/ui';
import { CustomerAssistanceModal } from '../../components/CustomerAssistanceModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import type { Category, CustomerHistory, DietaryType, MenuItem, RestaurantInfo, TableCartLine } from '../../types';

interface CustomerSession { sessionId: string; customer: { id: string; name: string }; restaurant: RestaurantInfo; table: { id: string; label: string } }
interface CustomerMenu { categories: Category[]; items: MenuItem[] }

export default function CustomerMenuPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartKey = `projectqr-cart:${token}`;
  useOrderSocket(true);
  const session = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<CustomerSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const menu = useQuery({ queryKey: ['customer-menu', token], queryFn: () => api.get<CustomerMenu>(`/customer/menu?token=${encodeURIComponent(token)}`), enabled: Boolean(session.data), retry: false });
  const tableCartQuery = useQuery({
    queryKey: ['table-cart', token],
    queryFn: () => api.get<{ items: TableCartLine[] }>(`/customer/cart?token=${encodeURIComponent(token)}`),
    enabled: Boolean(session.data),
    retry: false,
    refetchInterval: 10_000
  });

  const historyQuery = useQuery({
    queryKey: ['customer-history', token],
    queryFn: () => api.get<CustomerHistory>(`/customer/history?token=${encodeURIComponent(token)}`),
    enabled: Boolean(session.data),
    retry: false
  });

  const endVisit = useMutation({
    mutationFn: () => api.post('/customer/logout'),
    onSuccess: async () => {
      localStorage.removeItem(cartKey);
      await queryClient.removeQueries({ queryKey: ['customer-session', token] });
      navigate(`/order/${encodeURIComponent(token)}`, { replace: true });
    }
  });

  const cart = tableCartQuery.data?.items ?? [];
  const [activeCategory, setActiveCategory] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | DietaryType>('ALL');
  const [assistanceOpen, setAssistanceOpen] = useState(false);

  const updateItemMutation = useMutation({
    mutationFn: ({ item, quantity, notes }: { item: MenuItem; quantity: number; notes?: string }) =>
      api.post<{ items: TableCartLine[] }>('/customer/cart/items', { token, menuItemId: item._id, quantity, notes }),
    onMutate: async ({ item, quantity, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['table-cart', token] });
      const previous = queryClient.getQueryData<{ items: TableCartLine[] }>(['table-cart', token]);
      const currentItems = previous?.items ? [...previous.items] : [];
      const existingIndex = currentItems.findIndex((line) => line.menuItemId === item._id);
      if (quantity <= 0) {
        if (existingIndex >= 0) currentItems.splice(existingIndex, 1);
      } else if (existingIndex >= 0) {
        currentItems[existingIndex] = { ...currentItems[existingIndex], quantity, notes: notes ?? currentItems[existingIndex].notes };
      } else {
        currentItems.push({
          menuItemId: item._id,
          name: item.name,
          unitPricePaise: item.pricePaise,
          quantity,
          notes: notes ?? '',
          addedByName: session.data?.customer?.name || 'You'
        });
      }
      queryClient.setQueryData(['table-cart', token], { items: currentItems });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['table-cart', token], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['table-cart', token] });
    }
  });

  const quantityById = useMemo(() => new Map(cart.map((line) => [line.menuItemId, line.quantity])), [cart]);
  if (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  if (session.isLoading || menu.isLoading) return <div className="customer-wrap"><Loading label="Setting your table…" /></div>;
  if (!session.data) return <div className="customer-wrap"><Loading /></div>;
  if (menu.error || !menu.data) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 24 }}>{menu.error instanceof ApiError ? menu.error.message : 'The menu could not be loaded.'}</div><button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void menu.refetch()}>Try again</button></main>;
  const { restaurant, table } = session.data;
  const { categories, items } = menu.data;

  const filteredItems = items.filter((item) => dietaryFilter === 'ALL' || (item.dietary ?? 'VEG') === dietaryFilter);
  const availableCategories = categories.filter((category) => filteredItems.some((item) => item.categoryId === category._id));

  const updateQuantity = (item: MenuItem, value: number): void => updateItemMutation.mutate({ item, quantity: value });
  const addItem = (item: MenuItem): void => updateItemMutation.mutate({ item, quantity: 1 });
  const scrollTo = (id: string): void => { setActiveCategory(id); document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);

  const brandStyle = restaurant.brandColor ? ({
    '--green': restaurant.brandColor,
    '--green-dark': restaurant.brandColor
  } as CSSProperties) : undefined;

  return <main className={`customer-wrap customer-page ${cart.length > 0 ? 'cart-active' : ''}`} style={brandStyle}>
    <header className="customer-header">
      <div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <h1>{restaurant.name}</h1>
        <p>{formatTableLabel(table.label)} · Hi, {session.data.customer.name}</p>
      </div>
      <button
        type="button"
        className="btn secondary small"
        onClick={() => setAssistanceOpen(true)}
        title="Request water, cutlery, bill or call a waiter"
      >
        🔔 Help
      </button>
      <Link className="btn secondary small" to={`/order/${encodeURIComponent(token)}/tracking`}>Orders</Link>
      <button className="btn ghost small" onClick={() => endVisit.mutate()} disabled={endVisit.isPending}>{endVisit.isPending ? 'Ending…' : 'End visit'}</button>
    </header>
    <div style={{ paddingTop: 20 }}>
      <span className="eyebrow">Made fresh for you</span>
      <h1 style={{ margin: '5px 0 14px', fontSize: 31, letterSpacing: '-.05em' }}>The menu</h1>

      <div className="dietary-filter-bar" aria-label="Filter by dietary preference">
        <button
          type="button"
          className={`dietary-filter-chip ${dietaryFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setDietaryFilter('ALL')}
        >
          All Items
        </button>
        <button
          type="button"
          className={`dietary-filter-chip ${dietaryFilter === 'VEG' ? 'active' : ''}`}
          onClick={() => setDietaryFilter(dietaryFilter === 'VEG' ? 'ALL' : 'VEG')}
        >
          <DietaryBadge type="VEG" /> Veg Only
        </button>
        <button
          type="button"
          className={`dietary-filter-chip ${dietaryFilter === 'NON_VEG' ? 'active' : ''}`}
          onClick={() => setDietaryFilter(dietaryFilter === 'NON_VEG' ? 'ALL' : 'NON_VEG')}
        >
          <DietaryBadge type="NON_VEG" /> Non-Veg
        </button>
        <button
          type="button"
          className={`dietary-filter-chip ${dietaryFilter === 'EGG' ? 'active' : ''}`}
          onClick={() => setDietaryFilter(dietaryFilter === 'EGG' ? 'ALL' : 'EGG')}
        >
          <DietaryBadge type="EGG" /> Contains Egg
        </button>
      </div>

      {/* Quick Reorder Carousel from Previous Visit */}
      {historyQuery.data?.favoriteItems && historyQuery.data.favoriteItems.length > 0 && (
        <section style={{ marginBottom: 20, padding: '14px 16px', background: '#fdfbf7', border: '1px solid #ebd9c8', borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span className="eyebrow" style={{ color: '#9a3412', fontSize: 10, letterSpacing: '0.12em' }}>
                WELCOME BACK
              </span>
              <h2 style={{ fontSize: 16, margin: '2px 0 0', fontWeight: 750, color: '#431407' }}>
                🕒 Reorder from your last visits
              </h2>
            </div>
            {historyQuery.data.lastVisit && (
              <span className="muted" style={{ fontSize: 11 }}>
                Last visited {new Date(historyQuery.data.lastVisit.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
            {historyQuery.data.favoriteItems.map((fav) => {
              const matchedMenuItem = menu.data?.items.find((i) => i._id === fav.menuItemId);
              const qty = quantityById.get(fav.menuItemId) ?? 0;
              return (
                <div
                  key={fav.menuItemId}
                  style={{
                    flex: '0 0 170px',
                    background: 'white',
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid var(--line)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                      <DietaryBadge type={fav.dietaryType} />
                      <strong style={{ fontSize: 13, lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {fav.name}
                      </strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                      {money(fav.pricePaise)}
                    </span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {qty > 0 ? (
                      <div className="qty-control" style={{ width: '100%', height: 32 }}>
                        <button
                          aria-label={`Remove one ${fav.name}`}
                          onClick={() => matchedMenuItem && updateQuantity(matchedMenuItem, qty - 1)}
                        >
                          −
                        </button>
                        <strong>{qty}</strong>
                        <button
                          aria-label={`Add one ${fav.name}`}
                          onClick={() => matchedMenuItem && updateQuantity(matchedMenuItem, qty + 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn small full"
                        style={{ minHeight: 32, fontSize: 12, padding: '0 8px' }}
                        onClick={() => matchedMenuItem && addItem(matchedMenuItem)}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {availableCategories.length > 0 && <nav className="menu-categories" aria-label="Menu categories">{availableCategories.map((category) => <button key={category._id} className={`category-chip ${activeCategory === category._id ? 'active' : ''}`} onClick={() => scrollTo(category._id)}>{category.name}</button>)}</nav>}
    </div>
    {availableCategories.length === 0 ? <div className="surface"><EmptyState title="No items match this filter" description="Try selecting 'All Items' or choose another category." /></div> : availableCategories.map((category) => <section className="menu-section" id={`category-${category._id}`} key={category._id}><h2>{category.name}</h2>{category.description && <p className="muted" style={{ margin: '-6px 0 10px', fontSize: 12 }}>{category.description}</p>}{filteredItems.filter((item) => item.categoryId === category._id).map((item) => {
      const quantity = quantityById.get(item._id) ?? 0;
      return <article className={`menu-card ${item.available ? '' : 'is-sold-out'}`} key={item._id}><div><div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><h3>{item.name}</h3><DietaryBadge type={item.dietary} /></div>{item.description && <p>{item.description}</p>}<span className="menu-price">{money(item.pricePaise)}</span><div className="menu-action">{item.available ? quantity > 0 ? <div className="qty-control"><button aria-label={`Remove one ${item.name}`} onClick={() => updateQuantity(item, quantity - 1)}>−</button><strong>{quantity}</strong><button aria-label={`Add one ${item.name}`} onClick={() => updateQuantity(item, quantity + 1)}>+</button></div> : <button className="btn small" onClick={() => addItem(item)}>Add <span aria-hidden="true">+</span></button> : <span className="pill red" style={{ fontSize: 11, fontWeight: 700 }}>✕ Sold Out</span>}</div></div>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} loading="lazy" /> : <div style={{ width: '100%', height: 100, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#799078', background: '#edf0e8', fontSize: 12 }}>Made fresh</div>}</article>;
    })}</section>)}

    <button
      type="button"
      className="assistance-float-pill"
      onClick={() => setAssistanceOpen(true)}
      title="Request water, cutlery, bill or call a waiter"
    >
      <span>🔔</span> Call Staff
    </button>

    {cart.length > 0 && (
      <Link className="cart-bar" to={`/order/${encodeURIComponent(token)}/checkout`}>
        <span>
          <strong>{totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} · Table Cart</strong>
          <small>Shared with {formatTableLabel(table.label)}</small>
        </span>
        <strong>{money(subtotal)} <span aria-hidden="true">→</span></strong>
      </Link>
    )}

    <CustomerAssistanceModal
      isOpen={assistanceOpen}
      onClose={() => setAssistanceOpen(false)}
      token={token}
      tableLabel={formatTableLabel(table.label)}
    />
  </main>;
}
