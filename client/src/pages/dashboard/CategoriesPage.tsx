import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { EmptyState, ErrorPanel, Loading, Modal } from '../../components/ui';
import type { Category } from '../../types';

interface CategoryPayload { categories: Category[] }
interface CategoryForm { name: string; description: string; displayOrder: string; active: boolean }
const blank: CategoryForm = { name: '', description: '', displayOrder: '0', active: true };

export default function CategoriesPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['staff-categories'], queryFn: () => api.get<CategoryPayload>('/categories') });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(blank);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: form.name.trim(), description: form.description.trim(), displayOrder: Number(form.displayOrder || 0), active: form.active };
      return editing ? api.patch(`/categories/${editing._id}`, body) : api.post('/categories', body);
    },
    onSuccess: async () => { setError(''); setModalOpen(false); setEditing(null); setForm(blank); await client.invalidateQueries({ queryKey: ['staff-categories'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'The category could not be saved.')
  });
  const remove = useMutation({
    mutationFn: (category: Category) => api.delete(`/categories/${category._id}`),
    onSuccess: async () => { setDeleting(null); setError(''); await client.invalidateQueries({ queryKey: ['staff-categories'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'The category could not be deleted.')
  });
  const open = (category?: Category): void => {
    setError(''); setEditing(category ?? null); setModalOpen(true);
    setForm(category ? { name: category.name, description: category.description, displayOrder: String(category.displayOrder), active: category.active } : { ...blank });
  };
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorPanel message="Categories could not be loaded." retry={() => void query.refetch()} />;
  const categories = query.data.categories;
  return <>
    <div className="heading-row"><div><span className="eyebrow">Organize your menu</span><h1>Categories</h1><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Group menu items so guests can find what they want.</p></div><button className="btn" onClick={() => open()}>Add category</button></div>
    <section className="surface table-wrap">{categories.length === 0 ? <EmptyState title="No categories yet" description="Start with a few sections such as Small plates, Mains and Drinks." action={<button className="btn small" onClick={() => open()}>Create a category</button>} /> : <table className="data-table"><thead><tr><th>Name</th><th>Description</th><th>Order</th><th>Status</th><th /></tr></thead><tbody>{categories.map((category) => <tr key={category._id}><td><strong>{category.name}</strong></td><td>{category.description || '—'}</td><td>{category.displayOrder}</td><td><span className={`pill ${category.active ? '' : 'gray'}`}>{category.active ? 'Active' : 'Hidden'}</span></td><td><div className="toolbar"><button className="btn secondary small" onClick={() => open(category)}>Edit</button><button className="btn ghost small" onClick={() => setDeleting(category)}>Delete</button></div></td></tr>)}</tbody></table>}</section>
    {modalOpen && <Modal title={editing ? 'Edit category' : 'Add category'} onClose={() => { if (!save.isPending) { setModalOpen(false); setError(''); } }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}><div className="field"><label htmlFor="category-name">Name</label><input className="input" id="category-name" required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="field"><label htmlFor="category-description">Description</label><textarea className="textarea" id="category-description" maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="field"><label htmlFor="category-order">Display order</label><input className="input" id="category-order" type="number" min="0" value={form.displayOrder} onChange={(event) => setForm({ ...form, displayOrder: event.target.value })} /></div><label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Show category to customers</label>{error && <div className="form-error">{error}</div>}<button className="btn full" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save category'}</button></form></Modal>}
    {deleting && <Modal title="Delete category?" onClose={() => { setDeleting(null); setError(''); }}><p className="muted">Delete “{deleting.name}”? Categories with menu items must be emptied first.</p>{error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}<div className="toolbar" style={{ justifyContent: 'end' }}><button className="btn secondary" onClick={() => { setDeleting(null); setError(''); }}>Cancel</button><button className="btn danger" onClick={() => remove.mutate(deleting)} disabled={remove.isPending}>{remove.isPending ? 'Deleting…' : 'Delete category'}</button></div></Modal>}
  </>;
}
