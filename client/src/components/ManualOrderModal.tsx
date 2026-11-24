import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { formatTableLabel, money } from '../lib/format';
import { printOrderReceipt } from '../lib/printer';
import { useStaff } from '../hooks/useStaff';
import { Modal } from './ui';
import type { Category, MenuItem, MenuItemAddon, MenuItemVariant, OrderRecord, TableRecord } from '../types';

interface MenuResponse {
  items: MenuItem[];
}
interface CategoriesResponse {
  categories: Category[];
}
interface TablesResponse {
  tables: TableRecord[];
}

interface CartDraftItem {
  id: string; // unique draft key
  menuItem: MenuItem;
  quantity: number;
  selectedVariant: MenuItemVariant | null;
  selectedAddons: MenuItemAddon[];
  notes: string;
}

interface ManualOrderModalProps {
  initialTableId?: string;
  onClose: () => void;
  onOrderCreated?: (order: OrderRecord) => void;
}

export function ManualOrderModal({ initialTableId, onClose, onOrderCreated }: ManualOrderModalProps) {
  const queryClient = useQueryClient();
  const staff = useStaff();
  const restaurant = staff.data?.restaurant;
  const restaurantName = restaurant?.name || 'Restaurant';

  const [tableId, setTableId] = useState(initialTableId || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartDraftItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [printKot, setPrintKot] = useState(true);
  const [error, setError] = useState('');

  // Item customization modal state if an item has variants or addons
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [customVariant, setCustomVariant] = useState<MenuItemVariant | null>(null);
  const [customAddons, setCustomAddons] = useState<MenuItemAddon[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  const tablesQuery = useQuery({
    queryKey: ['staff-tables-list'],
    queryFn: () => api.get<TablesResponse>('/tables')
  });

  const menuQuery = useQuery({
    queryKey: ['staff-menu-items'],
    queryFn: () => api.get<MenuResponse>('/menu')
  });

  const categoriesQuery = useQuery({
    queryKey: ['staff-categories'],
    queryFn: () => api.get<CategoriesResponse>('/categories')
  });

  const tables = (tablesQuery.data?.tables ?? []).filter((t) => t.active);
  const items = menuQuery.data?.items ?? [];
  const categories = categoriesQuery.data?.categories ?? [];

  // If tableId wasn't preset and tables loaded, pick the first table
  if (!tableId && tables.length > 0 && !initialTableId) {
    setTableId(tables[0]._id ?? tables[0].id ?? '');
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) return false;
      if (q) {
        return item.name.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, search, selectedCategoryId]);

  const addDirect = (item: MenuItem) => {
    if ((item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0)) {
      setCustomizingItem(item);
      setCustomVariant(item.variants?.[0] ?? null);
      setCustomAddons([]);
      setCustomNotes('');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItem._id === item._id && !i.selectedVariant && i.selectedAddons.length === 0);
      if (existing) {
        return prev.map((i) => (i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          id: `${item._id}-${Date.now()}`,
          menuItem: item,
          quantity: 1,
          selectedVariant: null,
          selectedAddons: [],
          notes: ''
        }
      ];
    });
  };

  const confirmCustomization = () => {
    if (!customizingItem) return;
    setCart((prev) => [
      ...prev,
      {
        id: `${customizingItem._id}-${Date.now()}`,
        menuItem: customizingItem,
        quantity: 1,
        selectedVariant: customVariant,
        selectedAddons: customAddons,
        notes: customNotes.trim()
      }
    ]);
    setCustomizingItem(null);
  };

  const updateQuantity = (draftId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === draftId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter((i): i is CartDraftItem => i !== null);
    });
  };

  const calculateItemPrice = (entry: CartDraftItem) => {
    const base = entry.selectedVariant ? entry.selectedVariant.pricePaise : entry.menuItem.pricePaise;
    const addons = entry.selectedAddons.reduce((sum, a) => sum + a.pricePaise, 0);
    return (base + addons) * entry.quantity;
  };

  const totalPaise = cart.reduce((sum, item) => sum + calculateItemPrice(item), 0);

  const createOrderMutation = useMutation({
    mutationFn: () =>
      api.post<{ order: OrderRecord }>('/restaurant/orders', {
        tableId,
        items: cart.map((c) => ({
          menuItemId: c.menuItem._id,
          quantity: c.quantity,
          selectedVariant: c.selectedVariant ? { name: c.selectedVariant.name, pricePaise: c.selectedVariant.pricePaise } : null,
          selectedAddons: c.selectedAddons.map((a) => ({ name: a.name, pricePaise: a.pricePaise })),
          notes: c.notes
        })),
        notes: orderNotes.trim()
      }),
    onSuccess: (response) => {
      setError('');
      if (printKot) {
        printOrderReceipt(response.order, restaurantName, 'KOT');
      }
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['floor-tables'] });
      if (onOrderCreated) onOrderCreated(response.order);
      onClose();
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'Could not create order.')
  });

  return (
    <Modal title="➕ Punch In Walk-in Order (Staff POS)" onClose={onClose} width={760}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        {/* Top Controls: Table Selector & Kitchen Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--line)' }}>
          <div className="field">
            <label htmlFor="punch-table" style={{ fontWeight: 700 }}>Dining Table</label>
            <select
              className="select"
              id="punch-table"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              {tables.map((t) => (
                <option key={t._id ?? t.id} value={t._id ?? t.id}>
                  {formatTableLabel(t.label)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="punch-notes">Order Notes <span className="muted">(e.g. VIP guest, Rush)</span></label>
            <input
              className="input"
              id="punch-notes"
              placeholder="Optional notes for kitchen"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Two-Column Workspace: Menu on Left, Running Bill on Right */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* Left: Dishes List */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: '#fff' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                type="search"
                className="input"
                placeholder="🔍 Search dish…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Category Chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 10 }}>
              <button
                type="button"
                className={`category-chip ${selectedCategoryId === 'ALL' ? 'active' : ''}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => setSelectedCategoryId('ALL')}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className={`category-chip ${selectedCategoryId === c._id ? 'active' : ''}`}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => setSelectedCategoryId(c._id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Items Grid */}
            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'grid', gap: 6, paddingRight: 4 }}>
              {filteredItems.map((item) => {
                const isSoldOut = !item.available;
                return (
                  <div
                    key={item._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: isSoldOut ? '#fafafa' : '#fff',
                      opacity: isSoldOut ? 0.6 : 1
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 13, display: 'block' }}>{item.name}</strong>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {money(item.pricePaise)} {isSoldOut && '· (SOLD OUT)'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn small"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      disabled={isSoldOut}
                      onClick={() => addDirect(item)}
                    >
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Running Bill & Action */}
          <div style={{ border: '1.5px solid var(--line)', borderRadius: 12, padding: 14, background: '#fdfbf7', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 10 }}>
              <strong style={{ fontSize: 14 }}>📋 Order Summary ({cart.reduce((s, c) => s + c.quantity, 0)} items)</strong>
              {cart.length > 0 && (
                <button type="button" className="btn ghost small" style={{ fontSize: 11, color: '#dc2626' }} onClick={() => setCart([])}>
                  Clear all
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13, minHeight: 180 }}>
                Select items from the menu to build the order ticket.
              </div>
            ) : (
              <div style={{ flex: 1, maxHeight: 250, overflowY: 'auto', display: 'grid', gap: 8, paddingRight: 4, marginBottom: 12 }}>
                {cart.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: 8, background: '#fff', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <strong style={{ fontSize: 13 }}>{entry.menuItem.name}</strong>
                      {entry.selectedVariant && (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Variant: {entry.selectedVariant.name}</div>
                      )}
                      {entry.selectedAddons.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>+ {entry.selectedAddons.map((a) => a.name).join(', ')}</div>
                      )}
                      {entry.notes && (
                        <div style={{ fontSize: 11, color: '#854d0e' }}>Note: {entry.notes}</div>
                      )}
                      <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{money(calculateItemPrice(entry))}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button type="button" className="icon-button" style={{ width: 26, height: 26 }} onClick={() => updateQuantity(entry.id, -1)}>
                        −
                      </button>
                      <span style={{ fontWeight: 700, fontSize: 13, minWidth: 16, textAlign: 'center' }}>{entry.quantity}</span>
                      <button type="button" className="icon-button" style={{ width: 26, height: 26 }} onClick={() => updateQuantity(entry.id, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total and Submit */}
            <div style={{ borderTop: '2px dashed var(--line)', paddingTop: 10, marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontWeight: 650, fontSize: 14 }}>Total Amount:</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#166534' }}>{money(totalPaise)}</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={printKot}
                  onChange={(e) => setPrintKot(e.target.checked)}
                />
                <span>🖨️ Automatically Print Kitchen Order Ticket (KOT)</span>
              </label>

              {error && <div className="form-error" role="alert" style={{ marginBottom: 10 }}>{error}</div>}

              <button
                type="button"
                className="btn full"
                style={{ background: '#16a34a', borderColor: '#15803d', fontWeight: 800 }}
                disabled={cart.length === 0 || !tableId || createOrderMutation.isPending}
                onClick={() => createOrderMutation.mutate()}
              >
                {createOrderMutation.isPending ? 'Sending to Kitchen…' : `🍳 Send Order to Kitchen (${money(totalPaise)})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Customization Sub-Modal (if clicked item has variants or addons) */}
      {customizingItem && (
        <Modal title={`Customize ${customizingItem.name}`} onClose={() => setCustomizingItem(null)} width={460}>
          <div style={{ display: 'grid', gap: 14 }}>
            {customizingItem.variants && customizingItem.variants.length > 0 && (
              <div className="field">
                <label style={{ fontWeight: 700 }}>Choose Variant / Portion</label>
                <div style={{ display: 'grid', gap: 6 }}>
                  {customizingItem.variants.map((v) => (
                    <label key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="variant"
                        checked={customVariant?.name === v.name}
                        onChange={() => setCustomVariant(v)}
                      />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{v.name}</span>
                      <strong style={{ fontSize: 13 }}>{money(v.pricePaise)}</strong>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {customizingItem.addons && customizingItem.addons.length > 0 && (
              <div className="field">
                <label style={{ fontWeight: 700 }}>Add-ons & Extras</label>
                <div style={{ display: 'grid', gap: 6 }}>
                  {customizingItem.addons.map((a) => {
                    const isChecked = customAddons.some((ca) => ca.name === a.name);
                    return (
                      <label key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setCustomAddons((prev) => [...prev, a]);
                            else setCustomAddons((prev) => prev.filter((ca) => ca.name !== a.name));
                          }}
                        />
                        <span style={{ flex: 1, fontSize: 13 }}>{a.name}</span>
                        <span style={{ fontSize: 13, color: 'var(--muted)' }}>+{money(a.pricePaise)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="field">
              <label htmlFor="custom-notes">Cooking Note <span className="muted">(optional)</span></label>
              <input
                id="custom-notes"
                className="input"
                placeholder="e.g. Less spicy, Extra crisp"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn full"
              onClick={confirmCustomization}
            >
              Add to Bill
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
