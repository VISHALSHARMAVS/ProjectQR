import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { formatTableLabel, money } from '../../lib/format';
import { createIdempotencyKey } from '../../lib/idempotency';
import { EmptyState, Loading } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useOrderSocket } from '../../hooks/useOrderSocket';
import { getBrandStyle } from '../../lib/theme';
import type { MenuItem, OrderStatus, RestaurantInfo, TableCartLine } from '../../types';

interface CustomerSession {
  sessionId: string;
  customer: { name: string };
  restaurant: RestaurantInfo;
  table: { label: string; pin?: string | null };
  tab?: { id: string; label: string; isHost: boolean; isSeparateTab: boolean } | null;
  tableMismatch?: unknown;
}
interface MenuResponse { items: MenuItem[] }
interface CreatedOrder { order: { id: string; status: OrderStatus } }

function CartItemNoteInput({
  id,
  initialNotes,
  onSave
}: {
  id: string;
  initialNotes: string;
  onSave: (notes: string) => void;
}) {
  const [value, setValue] = useState(initialNotes);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(initialNotes);
  }, [initialNotes]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setValue(nextVal);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onSave(nextVal);
    }, 450);
  };

  const handleBlur = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (value !== initialNotes) {
      onSave(value);
    }
  };

  return (
    <input
      className="input"
      id={id}
      maxLength={250}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="e.g. Extra spicy / No onions"
    />
  );
}

export default function CheckoutPage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cartKey = `projectqr-cart:${token}`;
  useOrderSocket(true);
  const [orderNotes, setOrderNotes] = useState('');
  const [message, setMessage] = useState('');
  const [idempotencyKey] = useState(createIdempotencyKey);
  const session = useQuery({ queryKey: ['customer-session', token], queryFn: () => api.get<CustomerSession>(`/customer/session?token=${encodeURIComponent(token)}`), retry: false });
  const menu = useQuery({ queryKey: ['customer-menu', token], queryFn: () => api.get<MenuResponse>(`/customer/menu?token=${encodeURIComponent(token)}`), enabled: Boolean(session.data), retry: false });
  const tableCartQuery = useQuery({
    queryKey: ['table-cart', token],
    queryFn: () => api.get<{ items: TableCartLine[] }>(`/customer/cart?token=${encodeURIComponent(token)}`),
    enabled: Boolean(session.data),
    retry: false,
    refetchInterval: 10_000
  });

  const cart = tableCartQuery.data?.items ?? [];

  const updateItem = useMutation({
    mutationFn: ({
      menuItemId,
      quantity,
      selectedVariant,
      selectedAddons,
      notes
    }: {
      menuItemId: string;
      quantity: number;
      selectedVariant?: TableCartLine['selectedVariant'];
      selectedAddons?: TableCartLine['selectedAddons'];
      notes?: string;
    }) =>
      api.post<{ items: TableCartLine[] }>('/customer/cart/items', {
        token,
        menuItemId,
        quantity,
        selectedVariant: selectedVariant ?? null,
        selectedAddons: selectedAddons ?? [],
        notes
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['table-cart', token] })
  });

  const current = new Map((menu.data?.items ?? []).map((item) => [item._id, item]));
  const stale = cart.flatMap<{ line: TableCartLine; reason: 'price' | 'unavailable'; latestPricePaise?: number }>((line) => {
    const item = current.get(line.menuItemId);
    if (!item || !item.available) return [{ line, reason: 'unavailable' as const }];

    let currentBasePrice = item.pricePaise;
    if (line.selectedVariant) {
      const matchVariant = item.variants?.find((v) => v.name === line.selectedVariant?.name);
      if (!matchVariant) return [{ line, reason: 'unavailable' as const }];
      currentBasePrice = matchVariant.pricePaise;
    }

    let currentAddonsTotal = 0;
    if (line.selectedAddons && line.selectedAddons.length > 0) {
      for (const addon of line.selectedAddons) {
        const matchAddon = item.addons?.find((a) => a.name === addon.name);
        if (!matchAddon) return [{ line, reason: 'unavailable' as const }];
        currentAddonsTotal += matchAddon.pricePaise;
      }
    }

    const expectedUnitPrice = currentBasePrice + currentAddonsTotal;
    if (expectedUnitPrice !== line.unitPricePaise) {
      return [{ line, reason: 'price' as const, latestPricePaise: expectedUnitPrice }];
    }
    return [];
  });
  const totalItemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPricePaise, 0);

  const mutation = useMutation({
    mutationFn: () => api.post<CreatedOrder>('/customer/orders', {
      token,
      idempotencyKey,
      items: cart.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        selectedVariant: line.selectedVariant ?? null,
        selectedAddons: line.selectedAddons ?? [],
        notes: line.notes,
        expectedUnitPricePaise: line.unitPricePaise
      })),
      notes: orderNotes
    }),
    onSuccess: async (response) => {
      localStorage.removeItem(cartKey);
      await queryClient.invalidateQueries({ queryKey: ['table-cart', token] });
      navigate(`/order/${encodeURIComponent(token)}/tracking/${response.order.id}`, { replace: true });
    },
    onError: async (cause) => {
      setMessage(cause instanceof ApiError ? cause.message : 'Your order could not be placed. Please try again.');
      if (cause instanceof ApiError && ['PRICE_CHANGED', 'ITEM_UNAVAILABLE'].includes(cause.code)) await menu.refetch();
    }
  });

  if (session.error instanceof ApiError && (session.error.status === 401 || session.error.code === 'CUSTOMER_SESSION_TABLE_MISMATCH')) return <Navigate to={`/order/${encodeURIComponent(token)}/verify`} replace />;
  if (session.isLoading || menu.isLoading || tableCartQuery.isLoading) return <div className="customer-wrap"><Loading label="Reviewing table order…" /></div>;
  if (!session.data) return <div className="customer-wrap"><Loading /></div>;
  if (menu.error) return <main className="customer-wrap customer-page"><div className="form-error" style={{ marginTop: 24 }}>We couldn’t verify the current menu. Please refresh before placing your order.</div><button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void menu.refetch()}>Refresh menu</button></main>;
  const { restaurant, table, customer } = session.data;
  const brandStyle = getBrandStyle(restaurant.brandColor);

  if (cart.length === 0) return (
    <main className="customer-wrap customer-page" style={brandStyle}>
      <header className="customer-header">
        <div className="customer-header-brand">
          <div className="restaurant-logo">{restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}</div>
          <div><h1>{restaurant.name}</h1><p>{formatTableLabel(table.label)}</p></div>
        </div>
        <ThemeToggle variant="compact" />
      </header>
      <div className="surface" style={{ marginTop: 24, padding: 24 }}>
        <EmptyState title="Table cart is empty" description="Add delicious items from the menu to build your table’s order." action={<Link className="btn" to={`/order/${encodeURIComponent(token)}/menu`}>Browse menu</Link>} />
      </div>
    </main>
  );

  return (
    <main className="customer-wrap customer-page" style={brandStyle}>
      <header className="customer-header">
        <div className="customer-header-brand">
          <Link
            to={`/order/${encodeURIComponent(token)}/menu`}
            className="btn secondary small"
            style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, flexShrink: 0 }}
            title="Back to menu"
          >
            ← Menu
          </Link>
          <div className="restaurant-logo">
            {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt="" /> : restaurant.name.slice(0, 1).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurant.name}</h1>
            <p>{formatTableLabel(table.label)} · Guest: {customer.name}</p>
          </div>
        </div>
        <ThemeToggle variant="compact" />
      </header>
      <div style={{ paddingTop: 16 }}>
        <span className="eyebrow">Table order</span>
        <h1 className="heading-4" style={{ margin: '4px 0 16px' }}>Review table order</h1>
      </div>

      <section className="customer-card surface">
        <div className="notice success" style={{ marginBottom: 16 }}>
          👥 <strong>Shared table cart</strong>: Items added by everyone at {formatTableLabel(table.label)} are combined here in real time.
        </div>

      <div className="cart-list">
        {cart.map((line) => (
          <article className="cart-line" key={line.menuItemId}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{line.name}</h3>
                {line.selectedVariant && (
                  <span className="pill" style={{ fontSize: 11, background: 'var(--soft-green)', color: 'var(--green-dark)', fontWeight: 650 }}>
                    {line.selectedVariant.name}
                  </span>
                )}
                {line.addedByName && (
                  <span className="pill gray" style={{ fontSize: 10, padding: '2px 8px' }}>
                    Added by {line.addedByName}
                  </span>
                )}
              </div>

              {/* Transparent Calculation Breakdown */}
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {line.selectedVariant ? (
                  <span>{line.selectedVariant.name} ({money(line.selectedVariant.pricePaise)})</span>
                ) : (
                  <span>Base: {money(current.get(line.menuItemId)?.pricePaise ?? line.unitPricePaise)}</span>
                )}
                {line.selectedAddons && line.selectedAddons.length > 0 && (
                  <span style={{ marginLeft: 4 }}>
                    + Extras: {line.selectedAddons.map((a) => `${a.name} (+${money(a.pricePaise)})`).join(', ')}
                  </span>
                )}
                <span style={{ fontWeight: 700, color: 'var(--ink)', marginLeft: 6 }}>
                  = {money(line.unitPricePaise)} each
                </span>
              </div>

              {/* Quantity selector and safely separated Remove button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
                <div className="qty-control">
                  <button
                    type="button"
                    aria-label={`Remove one ${line.name}`}
                    onClick={() => updateItem.mutate({
                      menuItemId: line.menuItemId,
                      quantity: line.quantity - 1,
                      selectedVariant: line.selectedVariant,
                      selectedAddons: line.selectedAddons,
                      notes: line.notes
                    })}
                    disabled={updateItem.isPending}
                  >
                    −
                  </button>
                  <strong style={{ minWidth: 22, textAlign: 'center', fontSize: 14 }}>{line.quantity}</strong>
                  <button
                    type="button"
                    aria-label={`Add one ${line.name}`}
                    onClick={() => updateItem.mutate({
                      menuItemId: line.menuItemId,
                      quantity: line.quantity + 1,
                      selectedVariant: line.selectedVariant,
                      selectedAddons: line.selectedAddons,
                      notes: line.notes
                    })}
                    disabled={updateItem.isPending}
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  className="btn ghost small"
                  style={{ color: 'var(--red)', fontSize: 12, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => updateItem.mutate({
                    menuItemId: line.menuItemId,
                    quantity: 0,
                    selectedVariant: line.selectedVariant,
                    selectedAddons: line.selectedAddons
                  })}
                  disabled={updateItem.isPending}
                  title="Remove dish from table order"
                >
                  <span aria-hidden="true">🗑️</span>
                  <span>Remove</span>
                </button>
              </div>

              <div className="field" style={{ marginTop: 12 }}>
                <label htmlFor={`note-${line.menuItemId}`} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                  🍳 Cooking note for this dish <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <CartItemNoteInput
                  id={`note-${line.menuItemId}`}
                  initialNotes={line.notes || ''}
                  onSave={(notes) => updateItem.mutate({
                    menuItemId: line.menuItemId,
                    quantity: line.quantity,
                    selectedVariant: line.selectedVariant,
                    selectedAddons: line.selectedAddons,
                    notes
                  })}
                />
              </div>
            </div>
            <span className="line-total" style={{ fontSize: 15, fontWeight: 750, color: 'var(--ink)' }}>
              {money(line.quantity * line.unitPricePaise)}
            </span>
          </article>
        ))}
      </div>

      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="order-notes" style={{ fontWeight: 650 }}>
          📝 Table dining instructions <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <textarea
          className="textarea"
          id="order-notes"
          maxLength={500}
          value={orderNotes}
          onChange={(event) => setOrderNotes(event.target.value)}
          placeholder="e.g. Serve starters first / Bring food together / Need extra glasses"
          rows={2}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <div className="total-row">
          <span>Subtotal ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <div className="total-row"><span>Payment</span><span>Pay at table or counter</span></div>
        <div className="total-row grand"><span>Total (Incl. Taxes)</span><span>{money(subtotal)}</span></div>
        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
          ✓ All item prices are inclusive of applicable GST
        </div>
      </div>
    </section>

    {stale.length > 0 && (
      <div className="notice" style={{ marginTop: 14, borderColor: 'var(--red)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--red)' }}>
        <strong>Price or Availability Update</strong>
        <ul style={{ margin: '7px 0 10px', paddingLeft: 18 }}>
          {stale.map(({ line, reason, latestPricePaise }) => (
            <li key={line.menuItemId}>
              {line.name}: {reason === 'price' ? `updated to ${money(latestPricePaise ?? 0)}` : 'no longer available'}
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className="btn small"
            style={{ background: 'var(--red)', borderColor: 'transparent', color: 'white' }}
            onClick={() => {
              void tableCartQuery.refetch();
              void menu.refetch();
            }}
          >
            Update Cart Prices & Continue
          </button>
          <Link to={`/order/${encodeURIComponent(token)}/menu`} className="muted" style={{ fontSize: 12, textDecoration: 'underline' }}>
            Return to menu
          </Link>
        </div>
      </div>
    )}
    {message && <div className="form-error" role="alert" style={{ marginTop: 14 }}>{message}</div>}

    <div style={{ marginTop: 22 }}>
      <button
        type="button"
        className="btn full"
        style={{
          minHeight: 50,
          fontSize: 16,
          fontWeight: 750,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: '0 4px 14px rgba(49, 91, 67, 0.25)'
        }}
        disabled={stale.length > 0 || mutation.isPending || cart.length === 0}
        onClick={() => { setMessage(''); mutation.mutate(); }}
      >
        {mutation.isPending && <span className="btn-spinner" aria-hidden="true" />}
        {mutation.isPending ? 'Sending order to kitchen…' : `Place Table Order · ${money(subtotal)} →`}
      </button>
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link
          to={`/order/${encodeURIComponent(token)}/menu`}
          className="muted"
          style={{ fontSize: 13, textDecoration: 'underline' }}
        >
          + Add more items from menu
        </Link>
      </div>
    </div>
    <p className="muted" style={{ fontSize: 11, textAlign: 'center', lineHeight: 1.5, marginTop: 12 }}>
      Once placed, your order is sent directly to the kitchen display board.
    </p>
  </main>
  );
}
