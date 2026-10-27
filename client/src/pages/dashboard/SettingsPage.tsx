import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useStaff } from '../../hooks/useStaff';
import { ErrorPanel, Loading, Modal } from '../../components/ui';
import type { RestaurantInfo, StaffUser } from '../../types';

interface SettingsPayload { restaurant: RestaurantInfo }
interface SettingsForm { name: string; description: string; logoUrl: string; address: string; contactPhone: string; contactEmail: string }

export default function SettingsPage() {
  const staff = useStaff();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['restaurant-settings'], queryFn: () => api.get<SettingsPayload>('/restaurant/settings') });
  const [overrides, setOverrides] = useState<Partial<SettingsForm>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const restaurant = query.data?.restaurant;
  const form: SettingsForm = {
    name: overrides.name ?? restaurant?.name ?? '',
    description: overrides.description ?? restaurant?.description ?? '',
    logoUrl: overrides.logoUrl ?? restaurant?.logoUrl ?? '',
    address: overrides.address ?? restaurant?.address ?? '',
    contactPhone: overrides.contactPhone ?? restaurant?.contactPhone ?? '',
    contactEmail: overrides.contactEmail ?? restaurant?.contactEmail ?? ''
  };
  const save = useMutation({
    mutationFn: () => api.patch<SettingsPayload>('/restaurant/settings', form),
    onSuccess: async (response) => { setOverrides({ name: response.restaurant.name, description: response.restaurant.description ?? '', logoUrl: response.restaurant.logoUrl ?? '', address: response.restaurant.address ?? '', contactPhone: response.restaurant.contactPhone ?? '', contactEmail: response.restaurant.contactEmail ?? '' }); setMessage('Restaurant settings saved.'); setError(''); await client.invalidateQueries({ queryKey: ['restaurant-settings'] }); await client.invalidateQueries({ queryKey: ['staff', 'me'] }); },
    onError: (cause: Error) => { setMessage(''); setError(cause instanceof ApiError ? cause.message : 'Settings could not be saved.'); }
  });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorPanel message="Restaurant settings could not be loaded." retry={() => void query.refetch()} />;
  const canEdit = staff.data?.user.role === 'owner';
  return <>
    <div className="heading-row"><div><span className="eyebrow">Restaurant profile</span><h1>Settings</h1><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>This is the information customers see when they scan a table QR.</p></div></div>
    <section className="surface" style={{ maxWidth: 760, padding: 22 }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); setMessage(''); save.mutate(); }}><div className="field"><label htmlFor="restaurant-name">Restaurant name</label><input className="input" id="restaurant-name" required minLength={2} maxLength={120} disabled={!canEdit} value={form.name} onChange={(event) => setOverrides((current) => ({ ...current, name: event.target.value }))} /></div><div className="field"><label htmlFor="restaurant-description">Description</label><textarea className="textarea" id="restaurant-description" maxLength={500} disabled={!canEdit} value={form.description} onChange={(event) => setOverrides((current) => ({ ...current, description: event.target.value }))} /></div><div className="field"><label htmlFor="restaurant-logo">Logo URL <span className="muted">(HTTPS)</span></label><input className="input" id="restaurant-logo" type="url" maxLength={2048} disabled={!canEdit} value={form.logoUrl} onChange={(event) => setOverrides((current) => ({ ...current, logoUrl: event.target.value }))} placeholder="https://…" /></div><div className="field"><label htmlFor="restaurant-address">Address</label><input className="input" id="restaurant-address" maxLength={300} disabled={!canEdit} value={form.address} onChange={(event) => setOverrides((current) => ({ ...current, address: event.target.value }))} /></div><div className="toolbar"><div className="field" style={{ flex: 1 }}><label htmlFor="restaurant-phone">Contact phone</label><input className="input" id="restaurant-phone" type="tel" disabled={!canEdit} value={form.contactPhone} onChange={(event) => setOverrides((current) => ({ ...current, contactPhone: event.target.value }))} /></div><div className="field" style={{ flex: 1 }}><label htmlFor="restaurant-email">Contact email</label><input className="input" id="restaurant-email" type="email" disabled={!canEdit} value={form.contactEmail} onChange={(event) => setOverrides((current) => ({ ...current, contactEmail: event.target.value }))} /></div></div>
      <div className="notice">Table QR codes use the public app URL configured by the restaurant operator.</div>
      {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
      {canEdit ? <button className="btn" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</button> : <div className="notice">Only the restaurant owner can change these settings.</div>}
    </form></section>
    {canEdit && <StaffAccess />}
  </>;
}

interface StaffList { users: (StaffUser & { _id?: string; active: boolean; createdAt: string })[] }

function StaffAccess() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<StaffList>('/restaurant/staff') });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'kitchen'>('kitchen');
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: () => api.post('/restaurant/staff', { name, email, password, role }),
    onSuccess: async () => { setOpen(false); setName(''); setEmail(''); setPassword(''); setError(''); await client.invalidateQueries({ queryKey: ['staff-users'] }); },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This account could not be created.')
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/restaurant/staff/${id}`, { active }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['staff-users'] }),
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This account could not be updated.')
  });
  return <section className="surface" style={{ maxWidth: 760, marginTop: 18, padding: 22 }}>
    <div className="heading-row" style={{ marginTop: 0 }}><div><span className="eyebrow">Team access</span><h2>Staff accounts</h2><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Give your team their own sign-in for orders or kitchen work.</p></div><button className="btn small" onClick={() => { setError(''); setOpen(true); }}>Add staff</button></div>
    {error && !open && <div className="form-error" style={{ marginBottom: 12 }} role="alert">{error}</div>}
    {query.isLoading ? <Loading /> : query.error ? <ErrorPanel message="Staff accounts could not be loaded." retry={() => void query.refetch()} /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{(query.data?.users ?? []).map((user) => <tr key={user.id ?? user._id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td>{user.role}</td><td><span className={`pill ${user.active ? '' : 'gray'}`}>{user.active ? 'Active' : 'Inactive'}</span></td><td>{user.role !== 'owner' && <button className="btn secondary small" onClick={() => toggle.mutate({ id: user.id ?? user._id!, active: !user.active })}>{user.active ? 'Deactivate' : 'Reactivate'}</button>}</td></tr>)}</tbody></table></div>}
    {open && <Modal title="Add a staff account" onClose={() => { if (!create.isPending) setOpen(false); }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(); }}><div className="field"><label htmlFor="staff-name">Name</label><input className="input" id="staff-name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="staff-email">Email</label><input className="input" id="staff-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="staff-role">Access</label><select className="select" id="staff-role" value={role} onChange={(event) => setRole(event.target.value as 'staff' | 'kitchen')}><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select><span className="muted" style={{ fontSize: 11 }}>Kitchen accounts can view and update orders. Staff accounts can also manage the menu and tables.</span></div><div className="field"><label htmlFor="staff-password">Temporary password</label><input className="input" id="staff-password" type="password" minLength={10} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 10 characters" /></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="btn full" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button></form></Modal>}
  </section>;
}
