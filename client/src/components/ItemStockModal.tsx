import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { money } from '../lib/format';
import { Loading, Modal } from './ui';
import type { Category, MenuItem } from '../types';

interface MenuResponse {
  items: MenuItem[];
}
interface CategoriesResponse {
  categories: Category[];
}

interface ItemStockModalProps {
  onClose: () => void;
}

export function ItemStockModal({ onClose }: ItemStockModalProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [error, setError] = useState('');

  const menuQuery = useQuery({
    queryKey: ['staff-menu-items'],
    queryFn: () => api.get<MenuResponse>('/menu')
  });

  const categoriesQuery = useQuery({
    queryKey: ['staff-categories'],
    queryFn: () => api.get<CategoriesResponse>('/categories')
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, available }: { id: string; available: boolean }) =>
      api.patch<{ item: MenuItem }>(`/menu/${id}/availability`, { available }),
    onSuccess: (data) => {
      queryClient.setQueryData<MenuResponse>(['staff-menu-items'], (old) => {
        if (!old) return old;
        return {
          items: old.items.map((i) => (i._id === data.item._id ? { ...i, available: data.item.available } : i))
        };
      });
      void queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-menu'] });
    },
    onError: (cause) => setError(cause instanceof ApiError ? cause.message : 'Could not update item availability.')
  });

  const items = useMemo(() => menuQuery.data?.items ?? [], [menuQuery.data?.items]);
  const categories = useMemo(() => categoriesQuery.data?.categories ?? [], [categoriesQuery.data?.categories]);

  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c._id, c.name]));
  }, [categories]);

  const soldOutCount = useMemo(() => {
    return items.filter((i) => !i.available).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) return false;
      if (q) {
        const matchesName = item.name.toLowerCase().includes(q);
        const catName = categoryMap.get(item.categoryId)?.toLowerCase() || '';
        const matchesCat = catName.includes(q);
        return matchesName || matchesCat;
      }
      return true;
    });
  }, [items, search, selectedCategoryId, categoryMap]);

  return (
    <Modal title="Kitchen Stock & Item Availability" onClose={onClose} width={620}>
      <div style={{ marginBottom: 14 }}>
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          Instantly mark dishes as <strong>In Stock</strong> or <strong>Sold Out</strong>. Changes reflect on customer digital menus immediately in real time.
        </p>

        {/* Sold Out Summary Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: 10,
          background: soldOutCount > 0 ? 'var(--soft-orange)' : 'var(--soft-green)',
          border: `1px solid ${soldOutCount > 0 ? 'var(--orange)' : 'var(--green)'}`,
          marginBottom: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{soldOutCount > 0 ? '⚠️' : '✅'}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: soldOutCount > 0 ? 'var(--orange)' : 'var(--green)' }}>
              {soldOutCount > 0 ? `${soldOutCount} item${soldOutCount > 1 ? 's' : ''} currently marked Sold Out` : 'All menu items are currently in stock'}
            </span>
          </div>
          {soldOutCount > 0 && (
            <button
              type="button"
              className="btn ghost small"
              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--red)' }}
              onClick={() => {
                setSelectedCategoryId('ALL');
                setSearch('');
              }}
            >
              View all
            </button>
          )}
        </div>

        {/* Search Input */}
        <input
          type="search"
          className="input"
          placeholder="🔍 Search items by name (e.g. Paneer, Pizza, Coffee)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
          autoFocus
        />

        {/* Category Filter Chips */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
            <button
              type="button"
              className={`category-chip ${selectedCategoryId === 'ALL' ? 'active' : ''}`}
              onClick={() => setSelectedCategoryId('ALL')}
            >
              All ({items.length})
            </button>
            {categories.map((c) => {
              const count = items.filter((i) => i.categoryId === c._id).length;
              return (
                <button
                  key={c._id}
                  type="button"
                  className={`category-chip ${selectedCategoryId === c._id ? 'active' : ''}`}
                  onClick={() => setSelectedCategoryId(c._id)}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className="form-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

      {/* Items List with 1-Tap Toggle */}
      {menuQuery.isLoading ? (
        <Loading label="Loading menu items…" />
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          No menu items found matching "{search}".
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
          {filteredItems.map((item) => {
            const isSoldOut = !item.available;
            const isPending = toggleAvailability.isPending && toggleAvailability.variables?.id === item._id;

            return (
              <div
                key={item._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: isSoldOut ? 'var(--soft-orange)' : 'var(--paper)',
                  border: `1px solid ${isSoldOut ? 'var(--orange)' : 'var(--line)'}`,
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14, color: isSoldOut ? 'var(--orange)' : 'var(--ink)' }}>
                      {item.name}
                    </strong>
                    {isSoldOut && (
                      <span className="pill orange" style={{ fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>
                        SOLD OUT
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {categoryMap.get(item.categoryId) || 'Item'} · {money(item.pricePaise)}
                  </div>
                </div>

                <button
                  type="button"
                  className={`btn small ${isSoldOut ? 'secondary' : ''}`}
                  style={{
                    minWidth: 100,
                    fontWeight: 750,
                    fontSize: 12,
                    background: isSoldOut ? 'var(--red)' : 'var(--green)',
                    borderColor: 'transparent',
                    color: 'white',
                    boxShadow: isSoldOut ? '0 2px 6px rgba(239, 68, 68, 0.25)' : '0 2px 6px rgba(22, 163, 74, 0.25)'
                  }}
                  disabled={isPending}
                  onClick={() => toggleAvailability.mutate({ id: item._id, available: isSoldOut })}
                >
                  {isPending ? 'Updating…' : isSoldOut ? '✕ Sold Out' : '✓ In Stock'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="toolbar" style={{ justifyContent: 'end', marginTop: 16 }}>
        <button type="button" className="btn secondary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
