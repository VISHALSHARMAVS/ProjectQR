import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  loadDemoState,
  saveDemoState,
  resetDemoState,
  type DemoState
} from '../lib/demoData';
import { money, formatTableLabel } from '../lib/format';
import { playKitchenChime, playPaymentSuccessChime } from '../lib/audio';
import { DietaryBadge, Modal } from '../components/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import type { MenuItem, MenuItemAddon, MenuItemVariant, OrderRecord, OrderStatus } from '../types';

type DemoView = 'menu' | 'kitchen' | 'dashboard' | 'floormap';

export default function DemoPage() {
  const [state, setState] = useState<DemoState>(() => loadDemoState());
  const [activeView, setActiveView] = useState<DemoView>('menu');
  const [notification, setNotification] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number; variant?: MenuItemVariant | null; addons?: MenuItemAddon[]; notes?: string }[]>([]);
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([]);
  const [cookingNotes, setCookingNotes] = useState('');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [kdsFilter, setKdsFilter] = useState<string>('');

  // Persist state updates
  useEffect(() => {
    saveDemoState(state);
  }, [state]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    window.setTimeout(() => setNotification(''), 6000);
  };

  const handleReset = () => {
    const fresh = resetDemoState();
    setState(fresh);
    setCart([]);
    showNotification('Demo data reset to clean initial state.');
  };

  // Cart operations
  const addToCart = (item: MenuItem, variant?: MenuItemVariant | null, addons: MenuItemAddon[] = [], notes: string = '') => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (line) => line.item._id === item._id && line.variant?.name === variant?.name
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + 1
        };
        return next;
      }
      return [...prev, { item, quantity: 1, variant: variant ?? null, addons, notes }];
    });
    setCustomizingItem(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[index].quantity + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = { ...next[index], quantity: newQty };
      return next;
    });
  };

  const cartTotalPaise = useMemo(() => {
    return cart.reduce((sum, line) => {
      const unit = (line.variant ? line.variant.pricePaise : line.item.pricePaise) +
        (line.addons?.reduce((s, a) => s + a.pricePaise, 0) || 0);
      return sum + unit * line.quantity;
    }, 0);
  }, [cart]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((sum, line) => sum + line.quantity, 0);
  }, [cart]);

  // Place demo order
  const handlePlaceDemoOrder = () => {
    if (cart.length === 0) return;

    playPaymentSuccessChime();
    window.setTimeout(() => {
      playKitchenChime();
    }, 450);

    const orderNumber = `TK-${100 + state.orders.length + 1}`;
    const newOrder: OrderRecord = {
      id: `ord-demo-${Date.now()}`,
      orderNumber,
      table: { id: 'tbl-3', label: 'Table 3' },
      customer: { id: 'cust-demo', name: 'Demo Visitor' },
      status: 'ACCEPTED',
      statusHistory: [{ status: 'ACCEPTED', at: new Date().toISOString(), note: 'Demo order placed' }],
      paymentStatus: 'PAID',
      paymentMethod: 'UPI',
      autoConfirmed: true,
      items: cart.map((line) => {
        const unit = (line.variant ? line.variant.pricePaise : line.item.pricePaise) +
          (line.addons?.reduce((s, a) => s + a.pricePaise, 0) || 0);
        return {
          menuItemId: line.item._id,
          name: line.item.name,
          unitPricePaise: unit,
          quantity: line.quantity,
          subtotalPaise: unit * line.quantity,
          selectedVariant: line.variant ?? undefined,
          selectedAddons: line.addons,
          notes: line.notes || ''
        };
      }),
      subtotalPaise: cartTotalPaise,
      totalPaise: Math.round(cartTotalPaise * 1.05),
      notes: '',
      rejectionReason: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setState((prev) => {
      const updatedTables = prev.tables.map((t) =>
        t._id === 'tbl-3' ? { ...t, status: 'OCCUPIED' as const, activeOrdersCount: t.activeOrdersCount + 1 } : t
      );
      return {
        ...prev,
        tables: updatedTables,
        orders: [newOrder, ...prev.orders]
      };
    });

    setCart([]);
    showNotification(`🎉 Order ${orderNumber} placed & UPI auto-confirmed! Switch to the "Kitchen Display (KDS)" tab to watch your ticket arrive live.`);
  };

  // KDS Status Transitions
  const advanceOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    playKitchenChime();
    setState((prev) => {
      const updatedOrders = prev.orders.map((o) =>
        o.id === orderId ? { ...o, status: nextStatus } : o
      );
      return { ...prev, orders: updatedOrders };
    });
    showNotification(`Ticket updated to ${nextStatus.toLowerCase()}.`);
  };

  // Toggle item 86 availability
  const toggleItemAvailability = (itemId: string) => {
    setState((prev) => {
      const updatedItems = prev.items.map((it) =>
        it._id === itemId ? { ...it, available: !it.available } : it
      );
      return { ...prev, items: updatedItems };
    });
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return state.items.filter((item) => {
      if (dietaryFilter === 'VEG' && item.dietary !== 'VEG') return false;
      if (dietaryFilter === 'NON_VEG' && item.dietary !== 'NON_VEG') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [state.items, dietaryFilter, searchQuery]);

  // Operational metrics for dashboard
  const totalSalesPaise = useMemo(() => {
    return state.orders
      .filter((o) => o.paymentStatus === 'PAID')
      .reduce((sum, o) => sum + o.totalPaise, 0);
  }, [state.orders]);

  const activeOrdersCount = useMemo(() => {
    return state.orders.filter((o) => ['NEW', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;
  }, [state.orders]);

  const occupiedTablesCount = useMemo(() => {
    return state.tables.filter((t) => t.status !== 'AVAILABLE').length;
  }, [state.tables]);

  return (
    <div className="demo-shell" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Top Demo Banner */}
      <header
        style={{
          background: 'var(--paper)',
          borderBottom: '1px solid var(--line)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div
          className="page-wrap"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 15 }}>
              <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>QR</span>
              <span>ProjectQR</span>
            </Link>
            <span
              className="pill"
              style={{
                background: 'var(--soft-green)',
                color: 'var(--green-dark)',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px'
              }}
            >
              Interactive Demo
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn secondary small"
              onClick={handleReset}
              title="Reset sample tables and orders"
            >
              ↻ Reset demo data
            </button>
            <ThemeToggle variant="compact" />
            <Link to="/register" className="btn small" style={{ fontWeight: 600 }}>
              Start free trial →
            </Link>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div
          className="page-wrap"
          style={{
            display: 'flex',
            gap: 6,
            padding: '4px 16px 10px',
            overflowX: 'auto',
            scrollbarWidth: 'none'
          }}
        >
          <button
            type="button"
            className={`btn small ${activeView === 'menu' ? '' : 'secondary'}`}
            onClick={() => setActiveView('menu')}
            style={{ borderRadius: 8, fontSize: 13 }}
          >
            📱 1. Customer QR Menu
          </button>
          <button
            type="button"
            className={`btn small ${activeView === 'kitchen' ? '' : 'secondary'}`}
            onClick={() => setActiveView('kitchen')}
            style={{ borderRadius: 8, fontSize: 13 }}
          >
            🍳 2. Kitchen Display (KDS)
            {activeOrdersCount > 0 && (
              <span style={{ marginLeft: 6, background: '#ea580c', color: 'white', padding: '1px 6px', borderRadius: 999, fontSize: 11 }}>
                {activeOrdersCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`btn small ${activeView === 'dashboard' ? '' : 'secondary'}`}
            onClick={() => setActiveView('dashboard')}
            style={{ borderRadius: 8, fontSize: 13 }}
          >
            📊 3. Owner Dashboard
          </button>
          <button
            type="button"
            className={`btn small ${activeView === 'floormap' ? '' : 'secondary'}`}
            onClick={() => setActiveView('floormap')}
            style={{ borderRadius: 8, fontSize: 13 }}
          >
            🗺️ 4. Live Floor Map
          </button>
        </div>
      </header>

      {/* Floating System Notification Toast */}
      {notification && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: 110,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'var(--ink)',
            color: 'var(--paper)',
            padding: '12px 20px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            fontSize: 13,
            fontWeight: 600,
            maxWidth: 'min(92vw, 560px)',
            textAlign: 'center',
            lineHeight: 1.4,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {notification}
        </div>
      )}

      {/* Guided Tour Helper Banner */}
      <div
        className="page-wrap"
        style={{
          marginTop: 14,
          padding: '10px 16px',
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          fontSize: 13
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <span>
            <strong>Simulate full restaurant flow:</strong> Add dishes in the <strong>Customer QR Menu</strong>, click <strong>Place demo order</strong>, then switch to <strong>Kitchen Display</strong> to see the ticket arrive live!
          </span>
        </div>
        <span className="caption-3" style={{ color: 'var(--muted)' }}>
          Table: Table 3 (Dine in) · Mode: Interactive Simulator
        </span>
      </div>

      {/* VIEW 1: CUSTOMER QR MENU */}
      {activeView === 'menu' && (
        <main className="customer-wrap customer-page" style={{ paddingTop: 16 }}>
          <header className="customer-header">
            <div className="customer-header-brand">
              <div className="restaurant-logo" style={{ color: 'var(--green)' }}>OT</div>
              <div style={{ minWidth: 0 }}>
                <h1>{state.restaurant.name}</h1>
                <p>Table 3 · PIN: 2049 · Hi, Demo Diner</p>
              </div>
            </div>
            <div className="customer-header-actions">
              <span className="pill orange" style={{ fontSize: 11 }}>
                UPI Auto Confirm Active
              </span>
            </div>
          </header>

          {/* Search Bar */}
          <div className="menu-search-wrap" style={{ marginTop: 14 }}>
            <span className="menu-search-icon">🔍</span>
            <input
              type="search"
              className="menu-search-input"
              placeholder="Search sourdough pizza, starters, coolers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search dishes"
            />
            {searchQuery && (
              <button
                type="button"
                className="menu-search-clear"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Dietary Filters */}
          <div className="dietary-filter-bar">
            <button
              type="button"
              className={`dietary-filter-chip ${dietaryFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setDietaryFilter('ALL')}
            >
              All items
            </button>
            <button
              type="button"
              className={`dietary-filter-chip ${dietaryFilter === 'VEG' ? 'active' : ''}`}
              onClick={() => setDietaryFilter('VEG')}
            >
              <DietaryBadge type="VEG" /> Veg only
            </button>
            <button
              type="button"
              className={`dietary-filter-chip ${dietaryFilter === 'NON_VEG' ? 'active' : ''}`}
              onClick={() => setDietaryFilter('NON_VEG')}
            >
              <DietaryBadge type="NON_VEG" /> Non-veg
            </button>
          </div>

          {/* Dish List */}
          <div style={{ marginTop: 16 }}>
            {filteredMenuItems.map((item) => {
              const cartEntry = cart.find((c) => c.item._id === item._id);
              const qty = cartEntry ? cartEntry.quantity : 0;
              const hasCustomizations = (item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0);

              return (
                <article className={`swiggy-card ${item.available ? '' : 'is-sold-out'}`} key={item._id}>
                  <div className="swiggy-card-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <DietaryBadge type={item.dietary || 'VEG'} />
                      <span className="swiggy-social-badge reordered">
                        <span className="meter" /> Bestseller
                      </span>
                    </div>

                    <h3 className="swiggy-dish-title">{item.name}</h3>

                    <div className="swiggy-dish-price">
                      {money(item.pricePaise)}
                    </div>

                    <p className="swiggy-dish-desc">{item.description}</p>
                  </div>

                  <div className="swiggy-media-col">
                    <div className="swiggy-img-wrap">
                      <img src={item.imageUrl} alt={item.name} loading="lazy" />
                    </div>

                    <div className="swiggy-btn-anchor">
                      {!item.available ? (
                        <span className="swiggy-sold-out-pill">Sold out</span>
                      ) : qty === 0 ? (
                        <>
                          <button
                            type="button"
                            className="swiggy-add-btn"
                            onClick={() => {
                              if (hasCustomizations) {
                                setCustomizingItem(item);
                                setSelectedVariant(item.variants?.[0] ?? null);
                                setSelectedAddons([]);
                                setCookingNotes('');
                              } else {
                                addToCart(item);
                              }
                            }}
                          >
                            Add +
                          </button>
                          {hasCustomizations && (
                            <span className="swiggy-customisable-hint">Customisable</span>
                          )}
                        </>
                      ) : (
                        <div className="swiggy-stepper">
                          <button
                            type="button"
                            onClick={() => {
                              const index = cart.findIndex((c) => c.item._id === item._id);
                              if (index >= 0) updateQuantity(index, -1);
                            }}
                          >
                            −
                          </button>
                          <span>{qty}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const index = cart.findIndex((c) => c.item._id === item._id);
                              if (index >= 0) updateQuantity(index, 1);
                            }}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Floating Cart Bar */}
          {cart.length > 0 && (
            <aside className="swiggy-floating-cart-bar">
              <div>
                <div className="font-mono-numbers" style={{ fontSize: 13, fontWeight: 600 }}>
                  {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} · {money(cartTotalPaise)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9, marginTop: 1 }}>
                  Table 3 · Auto UPI confirm ready
                </div>
              </div>
              <button
                type="button"
                className="btn"
                style={{
                  background: 'white',
                  color: 'var(--green)',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '8px 16px',
                  borderRadius: 8
                }}
                onClick={handlePlaceDemoOrder}
              >
                Place demo order →
              </button>
            </aside>
          )}

          {/* Customization Modal */}
          {customizingItem && (
            <Modal
              title={`Customize ${customizingItem.name}`}
              onClose={() => setCustomizingItem(null)}
              width={460}
            >
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {customizingItem.variants && customizingItem.variants.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--ink)' }}>
                      Choose portion size (required)
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {customizingItem.variants.map((v) => (
                        <label
                          key={v.name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 14px',
                            border: selectedVariant?.name === v.name ? '2px solid var(--green)' : '1px solid var(--line)',
                            borderRadius: 10,
                            background: selectedVariant?.name === v.name ? 'var(--soft-green)' : 'var(--paper)',
                            cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="radio"
                              name="demo-portion"
                              checked={selectedVariant?.name === v.name}
                              onChange={() => setSelectedVariant(v)}
                            />
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{v.name}</span>
                          </div>
                          <span className="font-mono-numbers" style={{ fontSize: 13, fontWeight: 600 }}>{money(v.pricePaise)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {customizingItem.addons && customizingItem.addons.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--ink)' }}>
                      Add extras (optional)
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {customizingItem.addons.map((a) => {
                        const isChecked = selectedAddons.some((x) => x.name === a.name);
                        return (
                          <label
                            key={a.name}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              border: isChecked ? '1.5px solid var(--green)' : '1px solid var(--line)',
                              borderRadius: 10,
                              background: isChecked ? 'var(--soft-green)' : 'var(--paper)',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedAddons((prev) => [...prev, a]);
                                  else setSelectedAddons((prev) => prev.filter((x) => x.name !== a.name));
                                }}
                              />
                              <span style={{ fontSize: 14 }}>{a.name}</span>
                            </div>
                            <span className="font-mono-numbers" style={{ fontSize: 13, color: 'var(--muted)' }}>
                              +{money(a.pricePaise)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="demo-cooking-notes" className="eyebrow" style={{ display: 'block', marginBottom: 6, color: 'var(--ink)' }}>
                    Cooking instructions (optional)
                  </label>
                  <input
                    id="demo-cooking-notes"
                    type="text"
                    className="input"
                    placeholder="e.g. Less spicy, dressing on side"
                    value={cookingNotes}
                    onChange={(e) => setCookingNotes(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <button
                  type="button"
                  className="btn full"
                  onClick={() => addToCart(customizingItem, selectedVariant, selectedAddons, cookingNotes)}
                >
                  Add to table order
                </button>
              </div>
            </Modal>
          )}
        </main>
      )}

      {/* VIEW 2: KITCHEN DISPLAY SYSTEM (KDS) */}
      {activeView === 'kitchen' && (
        <main className="page-wrap" style={{ padding: '24px 16px 64px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <span className="eyebrow" style={{ color: '#ea580c' }}>Live kitchen queue</span>
              <h1 className="heading-4" style={{ margin: '2px 0 0' }}>Kitchen Display System (KDS)</h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => playKitchenChime()}
              >
                🔔 Test chime
              </button>
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="orders-filter-bar">
            {[
              { label: 'All active tickets', value: '' },
              { label: 'New / Accepted', value: 'ACCEPTED' },
              { label: 'Cooking', value: 'PREPARING' },
              { label: 'Ready to serve', value: 'READY' }
            ].map((tab) => {
              const count = tab.value === ''
                ? state.orders.filter((o) => o.status !== 'DELIVERED').length
                : state.orders.filter((o) => o.status === tab.value).length;
              return (
                <button
                  key={tab.value}
                  type="button"
                  className={`orders-filter-chip ${kdsFilter === tab.value ? 'active' : ''}`}
                  onClick={() => setKdsFilter(tab.value)}
                >
                  <span>{tab.label}</span>
                  <span className="orders-count-badge">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Tickets Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              marginTop: 18
            }}
          >
            {state.orders
              .filter((o) => (kdsFilter ? o.status === kdsFilter : o.status !== 'DELIVERED'))
              .map((order) => {
                const isNew = order.status === 'NEW' || order.status === 'ACCEPTED';
                const isCooking = order.status === 'PREPARING';
                const isReady = order.status === 'READY';

                return (
                  <section
                    key={order.id}
                    className="surface"
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: isReady
                        ? '2px solid #22c55e'
                        : isCooking
                        ? '2px solid #ea580c'
                        : '1.5px solid var(--line)',
                      background: 'var(--paper)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Ticket Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <strong style={{ fontSize: 16, color: 'var(--ink)' }}>{order.orderNumber}</strong>
                          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>
                            {formatTableLabel(order.table.label)}{order.customer?.name ? ` · ${order.customer.name}` : ''}
                          </span>
                        </div>
                        <span
                          className={`pill ${isReady ? 'green' : isCooking ? 'orange' : ''}`}
                          style={{ fontSize: 11, fontWeight: 700 }}
                        >
                          {order.status}
                        </span>
                      </div>

                      {/* Items List */}
                      <div style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '10px 0', margin: '8px 0' }}>
                        {order.items.map((line, idx) => (
                          <div key={idx} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                              <strong>{line.quantity}x {line.name}</strong>
                            </div>
                            {line.selectedVariant && (
                              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                                Portion: {line.selectedVariant.name}
                              </div>
                            )}
                            {line.notes && (
                              <div style={{ fontSize: 12, color: '#b45309', background: '#fef3c7', padding: '2px 6px', borderRadius: 4, marginTop: 3 }}>
                                ✎ Note: {line.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action button */}
                    <div style={{ marginTop: 12 }}>
                      {isNew && (
                        <button
                          type="button"
                          className="btn full"
                          style={{ background: '#ea580c' }}
                          onClick={() => advanceOrderStatus(order.id, 'PREPARING')}
                        >
                          Start preparing →
                        </button>
                      )}
                      {isCooking && (
                        <button
                          type="button"
                          className="btn full"
                          style={{ background: '#16a34a' }}
                          onClick={() => advanceOrderStatus(order.id, 'READY')}
                        >
                          Mark ready to serve ✓
                        </button>
                      )}
                      {isReady && (
                        <button
                          type="button"
                          className="btn secondary full"
                          onClick={() => advanceOrderStatus(order.id, 'DELIVERED')}
                        >
                          Mark delivered / clear
                        </button>
                      )}
                    </div>
                  </section>
                );
              })}
          </div>

          {/* Kitchen Stock 86 Toggle Showcase */}
          <div className="surface" style={{ marginTop: 36, padding: 20, borderRadius: 16 }}>
            <div className="eyebrow" style={{ color: 'var(--muted)' }}>Kitchen stock management</div>
            <h2 className="heading-5" style={{ margin: '4px 0 12px' }}>
              86 items on the fly during rush hours
            </h2>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 16px' }}>
              When a dish runs out of ingredients, chefs toggle it off here. It instantly marks the item sold out across all customer table QR codes.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {state.items.map((it) => (
                <button
                  key={it._id}
                  type="button"
                  className={`btn small ${it.available ? 'secondary' : 'danger'}`}
                  onClick={() => toggleItemAvailability(it._id)}
                  title="Click to toggle availability"
                >
                  {it.available ? `✓ ${it.name} (In stock)` : `✕ ${it.name} (86 Sold out)`}
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* VIEW 3: RESTAURANT OWNER DASHBOARD */}
      {activeView === 'dashboard' && (
        <main className="page-wrap" style={{ padding: '24px 16px 64px' }}>
          <div style={{ marginBottom: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Executive overview</span>
            <h1 className="heading-4" style={{ margin: '2px 0 0' }}>Restaurant Operations Dashboard</h1>
          </div>

          {/* Key Stat Cards */}
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <span className="stat-caption">Today's gross sales</span>
              <div className="stat-value font-mono-numbers">{money(totalSalesPaise)}</div>
              <span className="caption-3" style={{ color: '#16a34a', marginTop: 4, display: 'block' }}>
                ✓ 100% UPI auto-confirmed
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-caption">Active kitchen tickets</span>
              <div className="stat-value font-mono-numbers">{activeOrdersCount}</div>
              <span className="caption-3" style={{ color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                Avg preparation: 11.4 mins
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-caption">Table occupancy</span>
              <div className="stat-value font-mono-numbers">{occupiedTablesCount} / {state.tables.length}</div>
              <span className="caption-3" style={{ color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                {Math.round((occupiedTablesCount / state.tables.length) * 100)}% dining capacity
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-caption">Internal theft protection</span>
              <div className="stat-value" style={{ color: '#16a34a', fontSize: 24 }}>Protected</div>
              <span className="caption-3" style={{ color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                Fine-grained RBAC active
              </span>
            </div>
          </div>

          {/* Recent Orders Ledger */}
          <div className="surface" style={{ padding: 20, borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 className="heading-6" style={{ margin: 0 }}>Live table orders ledger</h2>
              <span className="caption-2" style={{ color: 'var(--muted)' }}>Real-time event stream</span>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Table</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontWeight: 600 }}>{ord.orderNumber}</td>
                      <td>{ord.table.label}</td>
                      <td>{ord.customer?.name || 'Table Guest'}</td>
                      <td>{ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}</td>
                      <td className="font-mono-numbers" style={{ fontWeight: 600 }}>{money(ord.totalPaise)}</td>
                      <td>
                        <span className={`pill ${ord.status === 'READY' ? 'green' : ord.status === 'PREPARING' ? 'orange' : ''}`}>
                          {ord.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 12 }}>
                          ✓ UPI Auto-confirmed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* VIEW 4: LIVE FLOOR MAP */}
      {activeView === 'floormap' && (
        <main className="page-wrap" style={{ padding: '24px 16px 64px' }}>
          <div style={{ marginBottom: 20 }}>
            <span className="eyebrow" style={{ color: 'var(--green)' }}>Dining room map</span>
            <h1 className="heading-4" style={{ margin: '2px 0 0' }}>Live Floor Map</h1>
            <p className="muted" style={{ fontSize: 14, margin: '4px 0 0' }}>
              Tap any table to inspect guest party, active orders, and table PIN.
            </p>
          </div>

          {/* Table Status Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#22c55e' }} /> Available
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ea580c' }} /> Occupied / Dining
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: '#8b5cf6' }} /> Bill Requested
            </span>
          </div>

          {/* Tables Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 16
            }}
          >
            {state.tables.map((tbl) => {
              const isOccupied = tbl.status === 'OCCUPIED';
              const isBilled = tbl.status === 'BILL_REQUESTED';
              const isSelected = selectedTableId === tbl._id;
              const matchingOrder = state.orders.find((o) => o.table.label === tbl.label && o.status !== 'DELIVERED');

              return (
                <div
                  key={tbl._id}
                  className="surface"
                  onClick={() => setSelectedTableId(tbl._id)}
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    border: isSelected
                      ? '2px solid var(--green)'
                      : isBilled
                      ? '2px solid #8b5cf6'
                      : isOccupied
                      ? '2px solid #ea580c'
                      : '1px solid var(--line)',
                    background: isSelected ? 'var(--soft-green)' : 'var(--paper)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <strong style={{ fontSize: 16 }}>{tbl.label}</strong>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: isBilled ? '#8b5cf6' : isOccupied ? '#ea580c' : '#22c55e'
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {isBilled ? 'Bill requested' : isOccupied ? 'Seated & ordering' : 'Ready for guests'}
                  </div>
                  {tbl.pin && (
                    <div className="font-mono-numbers" style={{ fontSize: 11, color: 'var(--green-dark)', marginTop: 6 }}>
                      PIN: {tbl.pin}
                    </div>
                  )}
                  {matchingOrder && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#ea580c', fontWeight: 600 }}>
                      Ticket {matchingOrder.orderNumber}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Table Detail Drawer */}
          {selectedTableId && (
            <div className="surface" style={{ marginTop: 28, padding: 20, borderRadius: 16 }}>
              {(() => {
                const table = state.tables.find((t) => t._id === selectedTableId);
                const tableOrders = state.orders.filter((o) => o.table.label === table?.label);
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 className="heading-6" style={{ margin: 0 }}>
                        {table?.label} details
                      </h3>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => setSelectedTableId(null)}
                      >
                        Close
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                      Status: <strong>{table?.status}</strong> · Table PIN: <strong>{table?.pin || 'None'}</strong>
                    </p>
                    {tableOrders.length === 0 ? (
                      <p className="muted" style={{ fontSize: 13 }}>No active orders for this table.</p>
                    ) : (
                      tableOrders.map((ord) => (
                        <div key={ord.id} style={{ padding: 12, border: '1px solid var(--line)', borderRadius: 10, marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                            <span>Order {ord.orderNumber} ({ord.status})</span>
                            <span className="font-mono-numbers">{money(ord.totalPaise)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                            {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      )}

      {/* Demo Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--line)',
          background: 'var(--paper)',
          padding: '32px 16px',
          textAlign: 'center',
          marginTop: 64
        }}
      >
        <div className="page-wrap" style={{ maxWidth: 600 }}>
          <h3 className="heading-6" style={{ margin: '0 0 8px' }}>
            Ready to bring this speed to your restaurant?
          </h3>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 18px', lineHeight: 1.5 }}>
            ProjectQR runs directly on your existing phones and tablets with zero upfront hardware costs.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/register" className="btn" style={{ fontWeight: 600 }}>
              Start 14-day free trial →
            </Link>
            <Link to="/" className="btn secondary">
              Back to homepage
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
