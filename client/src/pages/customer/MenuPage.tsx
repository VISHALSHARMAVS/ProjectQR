import { useMemo, useState, type CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { formatTableLabel, money } from '../../lib/format';
import { DietaryBadge, EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import { CustomerAssistanceModal } from '../../components/CustomerAssistanceModal';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import type { Category, CustomerHistory, DietaryType, MenuItem, MenuItemAddon, MenuItemVariant, RestaurantInfo, TableCartLine } from '../../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [assistanceOpen, setAssistanceOpen] = useState(false);

  // Customization Modal State (for Variants and Add-ons)
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([]);

  const updateItemMutation = useMutation({
    mutationFn: ({
      item,
      quantity,
      variant,
      addons,
      notes
    }: {
      item: MenuItem;
      quantity: number;
      variant?: MenuItemVariant | null;
      addons?: MenuItemAddon[];
      notes?: string;
    }) =>
      api.post<{ items: TableCartLine[] }>('/customer/cart/items', {
        token,
        menuItemId: item._id,
        quantity,
        selectedVariant: variant ?? null,
        selectedAddons: addons ?? [],
        notes
      }),
    onSuccess: () => {
      setCustomizingItem(null);
      void queryClient.invalidateQueries({ queryKey: ['table-cart', token] });
    }
  });

  const openCustomizer = (item: MenuItem) => {
    setCustomizingItem(item);
    if (item.variants && item.variants.length > 0) {
      setSelectedVariant(item.variants[0] || null);
    } else {
      setSelectedVariant(null);
    }
    setSelectedAddons([]);
  };

  const addItemDirect = (item: MenuItem) => {
    // If the item has variants or add-ons, always open customizer
    if ((item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0)) {
      openCustomizer(item);
    } else {
      updateItemMutation.mutate({ item, quantity: 1 });
    }
  };

  const quantityById = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of cart) {
      map.set(line.menuItemId, (map.get(line.menuItemId) || 0) + line.quantity);
    }
    return map;
  }, [cart]);

  if (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) {
    return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  }
  if (session.isLoading || menu.isLoading) return <Loading label="Loading your menu…" />;
  if (session.error || !session.data || menu.error || !menu.data) {
    return <ErrorPanel message="Could not load menu. Scan the QR code again or ask your waiter for assistance." />;
  }

  const { restaurant, table } = session.data;
  const categories = menu.data.categories;
  const items = menu.data.items;

  const queryClean = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (dietaryFilter !== 'ALL' && item.dietary !== dietaryFilter) return false;
    if (queryClean) {
      const matchName = item.name.toLowerCase().includes(queryClean);
      const matchDesc = item.description?.toLowerCase().includes(queryClean);
      return matchName || matchDesc;
    }
    return true;
  });

  const availableCategories = categories.filter((category) => {
    return filteredItems.some((item) => item.categoryId === category._id);
  });

  const scrollTo = (id: string): void => {
    setActiveCategory(id);
    document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);

  const brandStyle = restaurant.brandColor ? ({
    '--green': restaurant.brandColor,
    '--green-dark': restaurant.brandColor
  } as CSSProperties) : undefined;

  // Compute live subtotal inside customization modal
  const modalUnitPrice = (selectedVariant ? selectedVariant.pricePaise : (customizingItem?.pricePaise || 0)) +
    selectedAddons.reduce((s, a) => s + a.pricePaise, 0);

  return (
    <main className={`customer-wrap customer-page ${cart.length > 0 ? 'cart-active' : ''}`} style={brandStyle}>
      <header className="customer-header">
        <div className="customer-header-brand">
          <div className="restaurant-logo">
            {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</h1>
            <p>{formatTableLabel(table.label)} · Hi, {session.data.customer.name}</p>
          </div>
        </div>
        <div className="customer-header-actions">
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setAssistanceOpen(true)}
            title="Request water, cutlery, bill or call a waiter"
          >
            🔔 Help
          </button>
          <Link className="btn secondary small" to={`/order/${encodeURIComponent(token)}/tracking`}>
            Orders
          </Link>
          <button className="btn ghost small" onClick={() => endVisit.mutate()} disabled={endVisit.isPending} title="End dining visit">
            {endVisit.isPending ? '…' : 'End'}
          </button>
        </div>
      </header>

      <div style={{ paddingTop: 20 }}>
        <span className="eyebrow">Made fresh for you</span>
        <h1 style={{ margin: '5px 0 10px', fontSize: 31, letterSpacing: '-.05em' }}>The menu</h1>

        {/* Instant Search Bar */}
        <div className="menu-search-wrap">
          <span className="menu-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            className="menu-search-input"
            placeholder="Search dishes, drinks, ingredients…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search menu"
          />
          {searchQuery && (
            <button
              type="button"
              className="menu-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Dietary Filters */}
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
                      <button
                        type="button"
                        className="btn small full"
                        style={{ minHeight: 32, fontSize: 12, padding: '0 8px' }}
                        onClick={() => matchedMenuItem && addItemDirect(matchedMenuItem)}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {availableCategories.length > 0 && (
          <nav className="menu-categories" aria-label="Menu categories">
            {availableCategories.map((category) => (
              <button
                key={category._id}
                className={`category-chip ${activeCategory === category._id ? 'active' : ''}`}
                onClick={() => scrollTo(category._id)}
              >
                {category.name}
              </button>
            ))}
          </nav>
        )}
      </div>

      {availableCategories.length === 0 ? (
        <div className="surface" style={{ marginTop: 14 }}>
          <EmptyState
            title={searchQuery ? `No dishes found for “${searchQuery}”` : "No items match this filter"}
            description={searchQuery ? "Try checking your spelling or clear the search to browse all items." : "Try selecting 'All Items' or choose another category."}
            action={searchQuery ? <button className="btn small" onClick={() => setSearchQuery('')}>Clear search</button> : undefined}
          />
        </div>
      ) : (
        availableCategories.map((category) => (
          <section className="menu-section" id={`category-${category._id}`} key={category._id}>
            <h2>{category.name}</h2>
            {category.description && (
              <p className="muted" style={{ margin: '-6px 0 10px', fontSize: 12 }}>{category.description}</p>
            )}
            {filteredItems.filter((item) => item.categoryId === category._id).map((item) => {
              const qty = quantityById.get(item._id) ?? 0;
              const hasCustomizations = (item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0);

              return (
                <article className={`menu-card ${item.available ? '' : 'is-sold-out'}`} key={item._id}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <h3>{item.name}</h3>
                      <DietaryBadge type={item.dietary} />
                    </div>
                    {item.description && <p>{item.description}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span className="menu-price">
                        {item.variants && item.variants.length > 0
                          ? `From ${money(Math.min(...item.variants.map((v) => v.pricePaise)))}`
                          : money(item.pricePaise)}
                      </span>
                      {hasCustomizations && (
                        <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 650 }}>
                          Customizable
                        </span>
                      )}
                    </div>
                    <div className="menu-action">
                      {item.available ? (
                        <button className="btn small" onClick={() => addItemDirect(item)}>
                          {hasCustomizations ? (qty > 0 ? `Add more (${qty}) +` : 'Customize +') : (qty > 0 ? `Add (${qty}) +` : 'Add +')}
                        </button>
                      ) : (
                        <span className="pill red" style={{ fontSize: 11, fontWeight: 700 }}>✕ Sold Out</span>
                      )}
                    </div>
                  </div>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: 100, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#799078', background: '#edf0e8', fontSize: 12 }}>
                      Made fresh
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ))
      )}

      {/* GST Inclusive Notice Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 12px 100px', color: 'var(--muted)', fontSize: 12 }}>
        <p style={{ margin: 0, fontWeight: 500 }}>✓ All menu prices are inclusive of applicable taxes (GST).</p>
        <p style={{ margin: '4px 0 0', opacity: 0.8 }}>Itemized tax invoice breakdown provided on your bill.</p>
      </footer>

      {/* Item Customization Modal (Portion Sizes & Extras) */}
      {customizingItem && (
        <Modal
          title={`Customize ${customizingItem.name}`}
          onClose={() => setCustomizingItem(null)}
          width={480}
        >
          <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: 4 }}>
            {/* Portion Size Selection */}
            {customizingItem.variants && customizingItem.variants.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8, color: 'var(--ink)' }}>
                  Choose Portion Size (Required)
                </span>
                <div style={{ display: 'grid', gap: 8 }}>
                  {customizingItem.variants.map((v) => (
                    <label
                      key={v.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        border: selectedVariant?.name === v.name ? '2px solid var(--green)' : '1px solid var(--line)',
                        borderRadius: 12,
                        background: selectedVariant?.name === v.name ? 'var(--soft-green)' : 'white',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input
                          type="radio"
                          name="portion-variant"
                          checked={selectedVariant?.name === v.name}
                          onChange={() => setSelectedVariant(v)}
                        />
                        <strong style={{ fontSize: 14 }}>{v.name}</strong>
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{money(v.pricePaise)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Add-ons / Extras Selection */}
            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <span className="eyebrow" style={{ display: 'block', marginBottom: 8, color: 'var(--ink)' }}>
                  Add Extras (Optional)
                </span>
                <div style={{ display: 'grid', gap: 8 }}>
                  {customizingItem.addons.map((addon) => {
                    const isChecked = selectedAddons.some((a) => a.name === addon.name);
                    return (
                      <label
                        key={addon.name}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '11px 14px',
                          border: isChecked ? '1.5px solid var(--green)' : '1px solid var(--line)',
                          borderRadius: 12,
                          background: isChecked ? '#f0fdf4' : 'white',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAddons((prev) => [...prev, addon]);
                              } else {
                                setSelectedAddons((prev) => prev.filter((a) => a.name !== addon.name));
                              }
                            }}
                          />
                          <span style={{ fontSize: 14, fontWeight: 550 }}>{addon.name}</span>
                        </div>
                        <span style={{ fontWeight: 650, color: 'var(--muted)', fontSize: 13 }}>
                          +{money(addon.pricePaise)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Add Action */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
              Inclusive of all taxes (GST)
            </div>
            <button
              type="button"
              className="btn full"
              disabled={updateItemMutation.isPending}
              onClick={() => {
                updateItemMutation.mutate({
                  item: customizingItem,
                  quantity: 1,
                  variant: selectedVariant,
                  addons: selectedAddons
                });
              }}
            >
              {updateItemMutation.isPending ? 'Adding…' : `Add to Order · ${money(modalUnitPrice)}`}
            </button>
          </div>
        </Modal>
      )}

      {/* Floating Call Staff Button */}
      <button
        type="button"
        className="assistance-float-pill"
        onClick={() => setAssistanceOpen(true)}
        title="Request water, cutlery, bill or call a waiter"
      >
        <span>🔔</span> Call Staff
      </button>

      {/* Bottom Sticky Table Cart Bar */}
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
    </main>
  );
}
