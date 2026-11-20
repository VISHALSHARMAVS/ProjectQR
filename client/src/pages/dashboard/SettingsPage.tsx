import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useStaff } from '../../hooks/useStaff';
import { ErrorPanel, Loading, Modal } from '../../components/ui';
import type { RestaurantInfo, StaffUser } from '../../types';

interface SettingsPayload { restaurant: RestaurantInfo }
interface SettingsForm {
  name: string;
  description: string;
  logoUrl: string;
  brandColor: string;
  bannerUrl: string;
  welcomeTagline: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  gstin: string;
  gstPercentage: number;
  upiId: string;
  requireCustomerOtp: boolean;
}

const colorPresets = [
  { label: 'Forest Green', hex: '#315b43' },
  { label: 'Midnight Navy', hex: '#1e3a8a' },
  { label: 'Deep Burgundy', hex: '#8b0000' },
  { label: 'Warm Terracotta', hex: '#c85a32' },
  { label: 'Rich Charcoal', hex: '#262626' },
  { label: 'Golden Amber', hex: '#b45309' }
];

export default function SettingsPage() {
  const staff = useStaff();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['restaurant-settings'], queryFn: () => api.get<SettingsPayload>('/restaurant/settings') });
  const [overrides, setOverrides] = useState<Partial<SettingsForm>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const restaurant = query.data?.restaurant;
  const form: SettingsForm = {
    name: overrides.name ?? restaurant?.name ?? '',
    description: overrides.description ?? restaurant?.description ?? '',
    logoUrl: overrides.logoUrl ?? restaurant?.logoUrl ?? '',
    brandColor: overrides.brandColor ?? restaurant?.brandColor ?? '#315b43',
    bannerUrl: overrides.bannerUrl ?? restaurant?.bannerUrl ?? '',
    welcomeTagline: overrides.welcomeTagline ?? restaurant?.welcomeTagline ?? '',
    address: overrides.address ?? restaurant?.address ?? '',
    contactPhone: overrides.contactPhone ?? restaurant?.contactPhone ?? '',
    contactEmail: overrides.contactEmail ?? restaurant?.contactEmail ?? '',
    gstin: overrides.gstin ?? restaurant?.gstin ?? '',
    gstPercentage: overrides.gstPercentage ?? restaurant?.gstPercentage ?? 5,
    upiId: overrides.upiId ?? restaurant?.upiId ?? '',
    requireCustomerOtp: overrides.requireCustomerOtp ?? restaurant?.requireCustomerOtp ?? false
  };

  const handleLogoChange = (file: File | null) => {
    setLogoFile(file);
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
    } else {
      setLogoPreview('');
    }
  };

  const handleBannerChange = (file: File | null) => {
    setBannerFile(file);
    if (file) {
      setBannerPreview(URL.createObjectURL(file));
    } else {
      setBannerPreview('');
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      // 1. Save general settings
      const response = await api.patch<SettingsPayload>('/restaurant/settings', form);
      // 2. Upload logo if chosen from local storage
      if (logoFile) {
        const uploadRes = await api.upload<{ restaurant: RestaurantInfo; logoUrl: string }>('/restaurant/logo', logoFile, 'logo');
        response.restaurant.logoUrl = uploadRes.logoUrl;
      }
      // 3. Upload banner if chosen from local storage
      if (bannerFile) {
        const uploadRes = await api.upload<{ restaurant: RestaurantInfo; bannerUrl: string }>('/restaurant/banner', bannerFile, 'banner');
        response.restaurant.bannerUrl = uploadRes.bannerUrl;
      }
      return response;
    },
    onSuccess: async (response) => {
      setLogoFile(null);
      setLogoPreview('');
      setBannerFile(null);
      setBannerPreview('');
      setOverrides({
        name: response.restaurant.name,
        description: response.restaurant.description ?? '',
        logoUrl: response.restaurant.logoUrl ?? '',
        brandColor: response.restaurant.brandColor ?? '#315b43',
        bannerUrl: response.restaurant.bannerUrl ?? '',
        welcomeTagline: response.restaurant.welcomeTagline ?? '',
        address: response.restaurant.address ?? '',
        contactPhone: response.restaurant.contactPhone ?? '',
        contactEmail: response.restaurant.contactEmail ?? ''
      });
      setMessage('Restaurant settings, logo and branding saved successfully!');
      setError('');
      await client.invalidateQueries({ queryKey: ['restaurant-settings'] });
      await client.invalidateQueries({ queryKey: ['staff', 'me'] });
    },
    onError: (cause: Error) => { setMessage(''); setError(cause instanceof ApiError ? cause.message : 'Settings could not be saved.'); }
  });
  if (query.isLoading) return <Loading />;
  if (query.error || !query.data) return <ErrorPanel message="Restaurant settings could not be loaded." retry={() => void query.refetch()} />;
  const canEdit = staff.data?.user.role === 'owner';
  const effectiveBrandColor = form.brandColor || '#315b43';

  return <>
    <div className="heading-row"><div><span className="eyebrow">Restaurant profile</span><h1>Settings</h1><p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>This is the information customers see when they scan a table QR.</p></div></div>
    <section className="surface" style={{ maxWidth: 760, padding: 22 }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); setMessage(''); save.mutate(); }}>
      <div className="field"><label htmlFor="restaurant-name">Restaurant name</label><input className="input" id="restaurant-name" required minLength={2} maxLength={120} disabled={!canEdit} value={form.name} onChange={(event) => setOverrides((current) => ({ ...current, name: event.target.value }))} /></div>
      <div className="field"><label htmlFor="restaurant-description">Description</label><textarea className="textarea" id="restaurant-description" maxLength={500} disabled={!canEdit} value={form.description} onChange={(event) => setOverrides((current) => ({ ...current, description: event.target.value }))} /></div>

      <div style={{ padding: '16px 18px', background: '#f8f8f4', borderRadius: 14, border: '1px solid var(--line)', marginTop: 4, marginBottom: 4 }}>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 4 }}>Branding & Visual Identity</strong>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 16px' }}>Customize your restaurant logo, brand theme color, and mobile cover banner across both the customer menu and staff dashboard.</p>

        {/* Logo Upload Section */}
        <div className="field" style={{ marginBottom: 18 }}>
          <label htmlFor="restaurant-logo-upload">Restaurant Logo</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{
              width: 58,
              height: 58,
              borderRadius: 14,
              border: '1px solid var(--line)',
              background: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              {(logoPreview || form.logoUrl) ? (
                <img
                  src={logoPreview || form.logoUrl}
                  alt="Restaurant Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 24 }}>🍽️</span>
              )}
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <input
                type="file"
                id="restaurant-logo-upload"
                accept="image/jpeg,image/png,image/webp"
                disabled={!canEdit}
                onChange={(e) => handleLogoChange(e.target.files?.[0] ?? null)}
                style={{ fontSize: 13, maxWidth: '100%' }}
              />
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                Upload directly from your device (PNG, JPG, or WebP up to 5 MB).
              </div>
            </div>
            {(logoPreview || form.logoUrl) && (
              <button
                type="button"
                className="btn ghost small"
                disabled={!canEdit}
                onClick={() => {
                  setLogoFile(null);
                  setLogoPreview('');
                  setOverrides((current) => ({ ...current, logoUrl: '' }));
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Cover Banner Upload Section */}
        <div className="field" style={{ marginBottom: 18 }}>
          <label htmlFor="restaurant-banner-upload">Cover Banner <span className="muted">(optional)</span></label>
          {(bannerPreview || form.bannerUrl) && (
            <div style={{ width: '100%', height: 110, borderRadius: 12, overflow: 'hidden', marginBottom: 8, border: '1px solid var(--line)' }}>
              <img
                src={bannerPreview || form.bannerUrl}
                alt="Banner preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <input
              type="file"
              id="restaurant-banner-upload"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canEdit}
              onChange={(e) => handleBannerChange(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, flex: '1 1 200px', maxWidth: '100%' }}
            />
            {(bannerPreview || form.bannerUrl) && (
              <button
                type="button"
                className="btn ghost small"
                disabled={!canEdit}
                onClick={() => {
                  setBannerFile(null);
                  setBannerPreview('');
                  setOverrides((current) => ({ ...current, bannerUrl: '' }));
                }}
              >
                Remove
              </button>
            )}
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            Appears at the top of the guest table landing page.
          </div>
        </div>

        {/* Brand Theme Color Section */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label htmlFor="restaurant-brand-color">Brand Primary Color</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
            <input
              type="color"
              id="restaurant-brand-color"
              disabled={!canEdit}
              value={effectiveBrandColor}
              onChange={(e) => setOverrides((current) => ({ ...current, brandColor: e.target.value }))}
              style={{ width: 44, height: 38, padding: 0, border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer' }}
            />
            <input
              className="input"
              style={{ width: 110, textTransform: 'uppercase' }}
              maxLength={7}
              disabled={!canEdit}
              value={form.brandColor}
              onChange={(e) => setOverrides((current) => ({ ...current, brandColor: e.target.value }))}
              placeholder="#315B43"
            />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {colorPresets.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.label}
                  disabled={!canEdit}
                  onClick={() => setOverrides((current) => ({ ...current, brandColor: preset.hex }))}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    backgroundColor: preset.hex,
                    border: form.brandColor.toLowerCase() === preset.hex.toLowerCase() ? '2px solid #000' : '1px solid rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transform: form.brandColor.toLowerCase() === preset.hex.toLowerCase() ? 'scale(1.15)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live Preview Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'white', borderRadius: 10, border: '1px solid var(--line)', marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Theme Preview:</span>
            <button type="button" className="btn small" style={{ pointerEvents: 'none', background: effectiveBrandColor }}>
              Primary Button
            </button>
            <span className="pill" style={{ background: `${effectiveBrandColor}20`, color: effectiveBrandColor, fontWeight: 700 }}>
              Active Tab / Pill
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="restaurant-tagline">Welcome Tagline / Headline <span className="muted">(optional)</span></label>
          <input
            className="input"
            id="restaurant-tagline"
            maxLength={200}
            disabled={!canEdit}
            value={form.welcomeTagline}
            onChange={(event) => setOverrides((current) => ({ ...current, welcomeTagline: event.target.value }))}
            placeholder="e.g. Authentic Highway Dhaba & Wood-fired Specialties"
          />
        </div>
      </div>

      {/* Customer Verification Mode (Zero-SMS Guest vs Strict OTP) */}
      <div style={{ padding: 18, background: '#f8fafc', borderRadius: 14, border: '1px solid var(--line)', margin: '18px 0' }}>
        <div>
          <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            🛡️ Customer Dine-In Ordering Mode
          </strong>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13 }}>
            Choose how diners access the digital menu when scanning the table QR code.
          </p>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: 12,
              padding: 12,
              borderRadius: 10,
              border: !form.requireCustomerOtp ? '2px solid var(--green)' : '1px solid var(--line)',
              background: !form.requireCustomerOtp ? 'var(--soft-green)' : 'white',
              cursor: canEdit ? 'pointer' : 'default'
            }}
          >
            <input
              type="radio"
              name="requireCustomerOtp"
              disabled={!canEdit}
              checked={!form.requireCustomerOtp}
              onChange={() => setOverrides((current) => ({ ...current, requireCustomerOtp: false }))}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>⚡ Fast Guest Ordering (Recommended · Zero SMS Cost)</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                Customers enter their name and start ordering immediately. No OTP SMS sent, no network delays, highest order conversion.
              </span>
            </div>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'start',
              gap: 12,
              padding: 12,
              borderRadius: 10,
              border: form.requireCustomerOtp ? '2px solid var(--green)' : '1px solid var(--line)',
              background: form.requireCustomerOtp ? 'var(--soft-green)' : 'white',
              cursor: canEdit ? 'pointer' : 'default'
            }}
          >
            <input
              type="radio"
              name="requireCustomerOtp"
              disabled={!canEdit}
              checked={Boolean(form.requireCustomerOtp)}
              onChange={() => setOverrides((current) => ({ ...current, requireCustomerOtp: true }))}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ display: 'block', fontSize: 14 }}>📱 Strict Mobile Phone OTP Verification</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                Customers must submit their mobile number and verify a 6-digit SMS OTP code before placing orders. Best for high-risk prank prevention.
              </span>
            </div>
          </label>
        </div>
      </div>

      <div className="field"><label htmlFor="restaurant-address">Address</label><input className="input" id="restaurant-address" maxLength={300} disabled={!canEdit} value={form.address} onChange={(event) => setOverrides((current) => ({ ...current, address: event.target.value }))} /></div>
      <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="restaurant-phone">Contact phone</label>
          <input className="input" id="restaurant-phone" type="tel" disabled={!canEdit} value={form.contactPhone} onChange={(event) => setOverrides((current) => ({ ...current, contactPhone: event.target.value }))} />
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="restaurant-email">Contact email</label>
          <input className="input" id="restaurant-email" type="email" disabled={!canEdit} value={form.contactEmail} onChange={(event) => setOverrides((current) => ({ ...current, contactEmail: event.target.value }))} />
        </div>
      </div>

      {/* GST & Tax Compliance Section */}
      <div style={{ padding: 18, background: '#f8fafc', borderRadius: 14, border: '1px solid var(--line)', margin: '18px 0' }}>
        <div>
          <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
            🧾 GST & Tax Settings (Prices are Inclusive of GST)
          </strong>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13 }}>
            Customer menu prices always include tax. These settings calculate the legal CGST/SGST tax breakdown printed on the final guest bill.
          </p>
        </div>
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div className="field" style={{ flex: '2 1 200px' }}>
            <label htmlFor="restaurant-gstin">Restaurant GSTIN <span className="muted">(Optional, 15 characters)</span></label>
            <input
              className="input"
              id="restaurant-gstin"
              maxLength={15}
              disabled={!canEdit}
              placeholder="e.g. 07AAAAA0000A1Z5"
              style={{ textTransform: 'uppercase' }}
              value={form.gstin}
              onChange={(e) => setOverrides((current) => ({ ...current, gstin: e.target.value.toUpperCase() }))}
            />
          </div>
          <div className="field" style={{ flex: '1 1 160px' }}>
            <label htmlFor="restaurant-gst-rate">GST Rate (%)</label>
            <select
              className="select"
              id="restaurant-gst-rate"
              disabled={!canEdit}
              value={form.gstPercentage}
              onChange={(e) => setOverrides((current) => ({ ...current, gstPercentage: Number(e.target.value) }))}
            >
              <option value={0}>0% (Exempt / No GST)</option>
              <option value={5}>5% (Standard Restaurant Rate)</option>
              <option value={12}>12% (Composite / Food Delivery)</option>
              <option value={18}>18% (Hotel Outlets / AC Dining)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Dynamic UPI Payment Settings */}
      <div style={{ padding: 18, background: '#f0fdf4', borderRadius: 14, border: '1px solid #86efac', margin: '18px 0' }}>
        <div>
          <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, color: '#166534' }}>
            📱 UPI Payment Integration (Instant Bank Transfer)
          </strong>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13, color: '#14532d' }}>
            Enter your restaurant's business UPI ID (VPA). When diners settle their bill or choose UPI, a dynamic QR code will be generated with the exact bill amount for instant scanning via GPay, PhonePe, Paytm, or BHIM.
          </p>
        </div>
        <div className="field">
          <label htmlFor="restaurant-upi-id" style={{ color: '#166534', fontWeight: 650 }}>
            Restaurant UPI ID / VPA <span className="muted">(e.g. cafe@okaxis, 9876543210@paytm, business@hdfcbank)</span>
          </label>
          <input
            className="input"
            id="restaurant-upi-id"
            maxLength={100}
            disabled={!canEdit}
            placeholder="e.g. yourrestaurant@upi"
            value={form.upiId}
            onChange={(e) => setOverrides((current) => ({ ...current, upiId: e.target.value.trim() }))}
          />
          <span className="muted" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            100% direct settlement: payments go straight from customer bank account to your merchant bank account with zero platform commission.
          </span>
        </div>
      </div>

      <div className="notice">Table QR codes use the public app URL configured by the restaurant operator.</div>
      {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
      {canEdit ? <button className="btn" disabled={save.isPending}>{save.isPending && <span className="btn-spinner" aria-hidden="true" />}{save.isPending ? 'Saving…' : 'Save settings'}</button> : <div className="notice">Only the restaurant owner can change these settings.</div>}
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
    mutationFn: () => api.post('/restaurant/staff', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role
    }),
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
    {open && <Modal title="Add a staff account" onClose={() => { if (!create.isPending) setOpen(false); }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); create.mutate(); }}><div className="field"><label htmlFor="staff-name">Name</label><input className="input" id="staff-name" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></div><div className="field"><label htmlFor="staff-email">Email</label><input className="input" id="staff-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="field"><label htmlFor="staff-role">Access</label><select className="select" id="staff-role" value={role} onChange={(event) => setRole(event.target.value as 'staff' | 'kitchen')}><option value="kitchen">Kitchen</option><option value="staff">Staff</option></select><span className="muted" style={{ fontSize: 11 }}>Kitchen accounts can view and update orders. Staff accounts can also manage the menu and tables.</span></div><div className="field"><label htmlFor="staff-password">Temporary password</label><input className="input" id="staff-password" type="password" minLength={8} maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>{error && <div className="form-error" role="alert">{error}</div>}<button className="btn full" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button></form></Modal>}
  </section>;
}
