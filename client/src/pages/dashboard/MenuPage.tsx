import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { money, paiseFromRupees } from '../../lib/format';
import { DietaryBadge, EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import type { Category, DietaryType, MenuItem, MenuItemAddon, MenuItemVariant } from '../../types';

interface MenuPayload { items: MenuItem[] }
interface CategoryPayload { categories: Category[] }
interface ItemResponse { item: MenuItem }

interface FormState {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  variants: { name: string; price: string }[];
  addons: { name: string; price: string }[];
  imageUrl: string;
  available: boolean;
  dietary: DietaryType;
  preparationMinutes: string;
  displayOrder: string;
}

const blank: FormState = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  variants: [],
  addons: [],
  imageUrl: '',
  available: true,
  dietary: 'VEG',
  preparationMinutes: '',
  displayOrder: '0'
};

export default function MenuPage() {
  const queryClient = useQueryClient();
  const itemsQuery = useQuery({ queryKey: ['staff-menu'], queryFn: () => api.get<MenuPayload>('/menu') });
  const categoriesQuery = useQuery({ queryKey: ['staff-categories'], queryFn: () => api.get<CategoryPayload>('/categories') });
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blank);
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);

  const activeCategories = categoriesQuery.data?.categories.filter((category) => category.active) ?? [];

  const save = useMutation({
    mutationFn: async () => {
      const pricePaise = paiseFromRupees(form.price);
      if (pricePaise === null) throw new Error('Enter a valid base price in rupees, with up to two decimal places.');
      if (!form.categoryId) throw new Error('Choose a category for this item.');

      // Validate and parse variants
      const parsedVariants: MenuItemVariant[] = [];
      for (const v of form.variants) {
        if (!v.name.trim()) continue;
        const vPaise = paiseFromRupees(v.price);
        if (vPaise === null) throw new Error(`Invalid price for variant "${v.name}".`);
        parsedVariants.push({ name: v.name.trim(), pricePaise: vPaise });
      }

      // Validate and parse addons
      const parsedAddons: MenuItemAddon[] = [];
      for (const a of form.addons) {
        if (!a.name.trim()) continue;
        const aPaise = paiseFromRupees(a.price);
        if (aPaise === null) throw new Error(`Invalid price for add-on "${a.name}".`);
        parsedAddons.push({ name: a.name.trim(), pricePaise: aPaise });
      }

      const body = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        description: form.description.trim(),
        pricePaise,
        variants: parsedVariants,
        addons: parsedAddons,
        imageUrl: form.imageUrl.trim(),
        available: form.available,
        dietary: form.dietary,
        preparationMinutes: form.preparationMinutes ? Number(form.preparationMinutes) : null,
        displayOrder: Number(form.displayOrder || 0)
      };

      const response = editing
        ? await api.patch<ItemResponse>(`/menu/${editing._id}`, body)
        : await api.post<ItemResponse>('/menu', body);

      if (image) await api.upload<ItemResponse>(`/menu/${response.item._id}/image`, image);
    },
    onSuccess: async () => {
      setError('');
      setEditing(null);
      setModalOpen(false);
      setImage(null);
      setForm(blank);
      await queryClient.invalidateQueries({ queryKey: ['staff-menu'] });
    },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : cause.message || 'The menu item could not be saved.')
  });

  const remove = useMutation({
    mutationFn: (item: MenuItem) => api.delete(`/menu/${item._id}`),
    onSuccess: async () => { setDeleteItem(null); await queryClient.invalidateQueries({ queryKey: ['staff-menu'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'The menu item could not be deleted.')
  });

  const toggleAvailability = useMutation({
    mutationFn: (item: MenuItem) => api.patch(`/menu/${item._id}`, { available: !item.available }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['staff-menu'] }),
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'Availability could not be changed.')
  });

  const openEdit = (item?: MenuItem): void => {
    setModalOpen(true);
    setEditing(item ?? null);
    setImage(null);
    setError('');
    if (item) {
      setForm({
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        price: (item.pricePaise / 100).toFixed(2),
        variants: (item.variants || []).map((v) => ({ name: v.name, price: (v.pricePaise / 100).toFixed(2) })),
        addons: (item.addons || []).map((a) => ({ name: a.name, price: (a.pricePaise / 100).toFixed(2) })),
        imageUrl: item.imageUrl,
        available: item.available,
        dietary: item.dietary ?? 'VEG',
        preparationMinutes: item.preparationMinutes ? String(item.preparationMinutes) : '',
        displayOrder: String(item.displayOrder)
      });
    } else {
      setForm({ ...blank, categoryId: activeCategories[0]?._id ?? '' });
    }
  };

  if (itemsQuery.isLoading || categoriesQuery.isLoading) return <Loading />;
  if (itemsQuery.error || categoriesQuery.error || !itemsQuery.data || !categoriesQuery.data) {
    return <ErrorPanel message="Menu data could not be loaded." retry={() => { void itemsQuery.refetch(); void categoriesQuery.refetch(); }} />;
  }

  const items = itemsQuery.data.items;
  const categories = categoriesQuery.data.categories;
  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => setForm((current) => ({ ...current, [key]: value }));

  const addVariantRow = () => {
    setForm((curr) => ({ ...curr, variants: [...curr.variants, { name: '', price: '' }] }));
  };
  const removeVariantRow = (index: number) => {
    setForm((curr) => ({ ...curr, variants: curr.variants.filter((_, i) => i !== index) }));
  };
  const updateVariantRow = (index: number, field: 'name' | 'price', val: string) => {
    setForm((curr) => {
      const next = [...curr.variants];
      if (next[index]) next[index] = { ...next[index], [field]: val };
      return { ...curr, variants: next };
    });
  };

  const addAddonRow = () => {
    setForm((curr) => ({ ...curr, addons: [...curr.addons, { name: '', price: '' }] }));
  };
  const removeAddonRow = (index: number) => {
    setForm((curr) => ({ ...curr, addons: curr.addons.filter((_, i) => i !== index) }));
  };
  const updateAddonRow = (index: number, field: 'name' | 'price', val: string) => {
    setForm((curr) => {
      const next = [...curr.addons];
      if (next[index]) next[index] = { ...next[index], [field]: val };
      return { ...curr, addons: next };
    });
  };

  return (
    <>
      <div className="heading-row">
        <div>
          <span className="eyebrow">What guests can order</span>
          <h1>Menu</h1>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Manage names, portions, add-ons, photos and availability.</p>
        </div>
        <button className="btn" onClick={() => openEdit()} disabled={!activeCategories.length}>Add menu item</button>
      </div>

      {!activeCategories.length && (
        <div className="notice" style={{ marginBottom: 14 }}>
          Create an active category before adding menu items. <Link to="/dashboard/categories" style={{ textDecoration: 'underline', fontWeight: 700 }}>Manage categories</Link>
        </div>
      )}

      <section className="surface table-wrap">
        {items.length === 0 ? (
          <EmptyState
            title="Your menu is ready to grow"
            description="Add your first item so customers can start browsing."
            action={activeCategories.length > 0 ? <button className="btn small" onClick={() => openEdit()}>Add a menu item</button> : undefined}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Category</th>
                <th>Price / Variants</th>
                <th>Customizations</th>
                <th>Availability</th>
                <th>Prep time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, overflow: 'hidden', borderRadius: 10, background: '#edf0e8', flex: '0 0 auto' }}>
                        {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <DietaryBadge type={item.dietary} />
                          <strong>{item.name}</strong>
                        </div>
                        <small className="muted" style={{ display: 'block', maxWidth: 280 }}>{item.description}</small>
                      </div>
                    </div>
                  </td>
                  <td>{categories.find((category) => category._id === item.categoryId)?.name ?? 'Unassigned'}</td>
                  <td>
                    {item.variants && item.variants.length > 0 ? (
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)' }}>
                          {item.variants.length} portion sizes
                        </span>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {item.variants.map((v) => `${v.name} (${money(v.pricePaise)})`).join(' · ')}
                        </div>
                      </div>
                    ) : (
                      money(item.pricePaise)
                    )}
                  </td>
                  <td>
                    {item.addons && item.addons.length > 0 ? (
                      <span className="pill gray" style={{ fontSize: 11 }}>
                        +{item.addons.length} add-ons
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`stock-toggle-btn ${item.available ? 'in-stock' : 'sold-out'}`}
                      onClick={() => toggleAvailability.mutate(item)}
                      disabled={toggleAvailability.isPending}
                      title={item.available ? 'Click to mark as Sold Out' : 'Click to mark as In Stock'}
                    >
                      <span className="stock-dot" />{item.available ? 'In Stock' : 'Sold Out'}
                    </button>
                  </td>
                  <td>{item.preparationMinutes ? `${item.preparationMinutes} min` : '—'}</td>
                  <td>
                    <div className="toolbar">
                      <button className="btn secondary small" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn ghost small" onClick={() => setDeleteItem(item)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modalOpen && (
        <Modal
          title={editing ? 'Edit menu item' : 'Add menu item'}
          onClose={() => {
            if (!save.isPending) {
              setEditing(null);
              setModalOpen(false);
              setForm(blank);
              setError('');
            }
          }}
          width={640}
        >
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
            <div className="field">
              <label htmlFor="item-name">Item name</label>
              <input id="item-name" className="input" required maxLength={120} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Butter Chicken / Paneer Tikka" />
            </div>

            <div className="field">
              <label htmlFor="item-category">Category</label>
              <select id="item-category" className="select" required value={form.categoryId} onChange={(event) => update('categoryId', event.target.value)}>
                {activeCategories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Food type / Dietary</label>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="item-dietary" checked={form.dietary === 'VEG'} onChange={() => update('dietary', 'VEG')} />
                  <DietaryBadge type="VEG" /> Pure Veg
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="item-dietary" checked={form.dietary === 'NON_VEG'} onChange={() => update('dietary', 'NON_VEG')} />
                  <DietaryBadge type="NON_VEG" /> Non-Veg
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="item-dietary" checked={form.dietary === 'EGG'} onChange={() => update('dietary', 'EGG')} />
                  <DietaryBadge type="EGG" /> Contains Egg
                </label>
              </div>
            </div>

            <div className="field">
              <label htmlFor="item-description">Description</label>
              <textarea id="item-description" className="textarea" maxLength={500} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Ingredients, taste notes, or preparation style" />
            </div>

            <div className="field">
              <label htmlFor="item-price">Base Price (₹)</label>
              <input id="item-price" className="input" type="number" min="0" step="0.01" required value={form.price} onChange={(event) => update('price', event.target.value)} placeholder="245.00" />
            </div>

            {/* Portion Sizes / Variants Section */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Portion Sizes / Variants</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>e.g. Half / Full, Regular / Large (Overrides base price)</p>
                </div>
                <button type="button" className="btn secondary small" onClick={addVariantRow}>+ Add Size</button>
              </div>
              {form.variants.map((v, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Size name (e.g. Half)"
                    value={v.name}
                    onChange={(e) => updateVariantRow(idx, 'name', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Price (₹)"
                    value={v.price}
                    onChange={(e) => updateVariantRow(idx, 'price', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn ghost small" onClick={() => removeVariantRow(idx)} style={{ color: 'var(--red)' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Optional Extras / Add-ons Section */}
            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <strong style={{ fontSize: 14 }}>Custom Extras / Add-ons</strong>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>e.g. Extra Cheese (+₹30), Extra Pav (+₹25)</p>
                </div>
                <button type="button" className="btn secondary small" onClick={addAddonRow}>+ Add Extra</button>
              </div>
              {form.addons.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Extra name (e.g. Extra Cheese)"
                    value={a.name}
                    onChange={(e) => updateAddonRow(idx, 'name', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    placeholder="Addon (₹)"
                    value={a.price}
                    onChange={(e) => updateAddonRow(idx, 'price', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn ghost small" onClick={() => removeAddonRow(idx)} style={{ color: 'var(--red)' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="field">
              <label htmlFor="item-image">Image upload <span className="muted">(Direct upload to Cloudinary)</span></label>
              <input id="item-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </div>

            <div className="toolbar">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="item-prep">Prep time (minutes)</label>
                <input id="item-prep" className="input" type="number" min="1" max="600" value={form.preparationMinutes} onChange={(event) => update('preparationMinutes', event.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="item-order">Menu position <span className="muted">(1 = top)</span></label>
                <input id="item-order" className="input" type="number" min="0" value={form.displayOrder} onChange={(event) => update('displayOrder', event.target.value)} />
              </div>
            </div>

            <label style={{ display: 'flex', gap: 9, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={form.available} onChange={(event) => update('available', event.target.checked)} />
              Available for customers
            </label>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="btn full" disabled={save.isPending || !activeCategories.length}>
              {save.isPending && <span className="btn-spinner" aria-hidden="true" />}
              {save.isPending ? 'Saving…' : 'Save menu item'}
            </button>
          </form>
        </Modal>
      )}

      {deleteItem && (
        <Modal title="Delete this menu item?" onClose={() => setDeleteItem(null)}>
          <p className="muted">“{deleteItem.name}” will no longer appear on the menu. Existing orders keep their item and price snapshot.</p>
          {error && <div className="form-error">{error}</div>}
          <div className="toolbar" style={{ justifyContent: 'end' }}>
            <button className="btn secondary" onClick={() => setDeleteItem(null)}>Cancel</button>
            <button className="btn danger" onClick={() => remove.mutate(deleteItem)} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting…' : 'Delete item'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
