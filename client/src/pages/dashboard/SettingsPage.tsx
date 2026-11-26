import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { useStaff } from '../../hooks/useStaff';
import { ErrorPanel, Loading, Modal } from '../../components/ui';
import type { RestaurantInfo, StaffUser, UserPermissions, UserRole } from '../../types';

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
  googleReviewUrl: string;
  autoConfirmPayments: boolean;
  paymentGateway: 'direct_upi' | 'razorpay' | 'cashfree' | 'custom';
  webhookSecret: string;
  enableDishReviews: boolean;
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
    requireCustomerOtp: overrides.requireCustomerOtp ?? restaurant?.requireCustomerOtp ?? false,
    googleReviewUrl: overrides.googleReviewUrl ?? restaurant?.googleReviewUrl ?? '',
    autoConfirmPayments: overrides.autoConfirmPayments ?? restaurant?.autoConfirmPayments ?? false,
    paymentGateway: overrides.paymentGateway ?? restaurant?.paymentGateway ?? 'direct_upi',
    webhookSecret: overrides.webhookSecret ?? restaurant?.webhookSecret ?? '',
    enableDishReviews: overrides.enableDishReviews ?? restaurant?.enableDishReviews ?? true
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
        contactEmail: response.restaurant.contactEmail ?? '',
        gstin: response.restaurant.gstin ?? '',
        gstPercentage: response.restaurant.gstPercentage ?? 5,
        upiId: response.restaurant.upiId ?? '',
        requireCustomerOtp: response.restaurant.requireCustomerOtp ?? false,
        googleReviewUrl: response.restaurant.googleReviewUrl ?? '',
        autoConfirmPayments: response.restaurant.autoConfirmPayments ?? false,
        paymentGateway: response.restaurant.paymentGateway ?? 'direct_upi',
        webhookSecret: response.restaurant.webhookSecret ?? '',
        enableDishReviews: response.restaurant.enableDishReviews ?? true
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
    <section className="surface" style={{ maxWidth: 840, padding: 22 }}><form className="form-grid" onSubmit={(event) => { event.preventDefault(); setError(''); setMessage(''); save.mutate(); }}>
      <div style={{ padding: '16px 18px', background: 'var(--paper-elevated)', borderRadius: 14, border: '1px solid var(--line)', marginBottom: 8 }}>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 4, color: 'var(--ink)' }}>Basic Information</strong>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 14px' }}>Essential details displayed on your digital guest menu and invoices.</p>
        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="restaurant-name">Restaurant name</label>
          <input className="input" id="restaurant-name" required minLength={2} maxLength={120} disabled={!canEdit} value={form.name} onChange={(event) => setOverrides((current) => ({ ...current, name: event.target.value }))} />
        </div>
        <div className="field">
          <label htmlFor="restaurant-description">Description</label>
          <textarea className="textarea" id="restaurant-description" maxLength={500} disabled={!canEdit} value={form.description} onChange={(event) => setOverrides((current) => ({ ...current, description: event.target.value }))} />
        </div>
      </div>

      <div style={{ padding: '16px 18px', background: 'var(--paper-elevated)', borderRadius: 14, border: '1px solid var(--line)', marginTop: 4, marginBottom: 8 }}>
        <strong style={{ display: 'block', fontSize: 15, marginBottom: 4, color: 'var(--ink)' }}>Branding & Visual Identity</strong>
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
              background: 'var(--paper)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)', marginTop: 10, flexWrap: 'wrap' }}>
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
      <div style={{ padding: 18, background: 'var(--paper-elevated)', borderRadius: 14, border: '1px solid var(--line)', margin: '18px 0' }}>
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
              background: !form.requireCustomerOtp ? 'var(--soft-green)' : 'var(--paper)',
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
              background: form.requireCustomerOtp ? 'var(--soft-green)' : 'var(--paper)',
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
      <div style={{ padding: 18, background: 'var(--paper-elevated)', borderRadius: 14, border: '1px solid var(--line)', margin: '18px 0' }}>
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

      {/* Dynamic UPI Payment Settings & Auto-Confirm */}
      <div style={{ padding: 18, background: 'var(--soft-green)', borderRadius: 14, border: '1px solid var(--green)', margin: '18px 0' }}>
        <div>
          <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--green)' }}>
            📱 UPI Payment Integration & Rush-Hour Auto-Confirm
          </strong>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13 }}>
            Configure your business UPI ID and automated payment verification so staff never have to stand around checking diner phone screens during busy rush hours.
          </p>
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="restaurant-upi-id" style={{ color: 'var(--green)', fontWeight: 650 }}>
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
            Direct settlement: payments go straight from customer bank account to your merchant bank account with zero platform commission.
          </span>
        </div>

        <div style={{ padding: 12, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line)', marginBottom: 14 }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: canEdit ? 'pointer' : 'default' }}>
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Boolean(form.autoConfirmPayments)}
              onChange={(e) => setOverrides((current) => ({ ...current, autoConfirmPayments: e.target.checked }))}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ fontSize: 13, color: 'var(--green)', display: 'block' }}>
                ⚡ Enable 1-Tap UPI Auto-Confirmation
              </strong>
              <span className="muted" style={{ fontSize: 12 }}>
                Allows diners to tap "I've Paid via UPI" with optional UTR / Reference ID. Automatically settles the order and updates kitchen and floor maps instantly with pleasant chimes.
              </span>
            </div>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="field">
            <label htmlFor="payment-gateway" style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
              Payment Mode / Gateway
            </label>
            <select
              id="payment-gateway"
              className="select"
              disabled={!canEdit}
              value={form.paymentGateway}
              onChange={(e) => setOverrides((current) => ({ ...current, paymentGateway: e.target.value as SettingsForm['paymentGateway'] }))}
            >
              <option value="direct_upi">Direct UPI (Dynamic QR & Intent)</option>
              <option value="razorpay">Razorpay UPI Webhook</option>
              <option value="cashfree">Cashfree UPI Webhook</option>
              <option value="custom">Soundbox / Custom Gateway</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="webhook-secret" style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
              Webhook Secret <span className="muted">(Optional HMAC key)</span>
            </label>
            <input
              id="webhook-secret"
              className="input"
              disabled={!canEdit}
              placeholder="e.g. whsec_..."
              value={form.webhookSecret}
              onChange={(e) => setOverrides((current) => ({ ...current, webhookSecret: e.target.value.trim() }))}
            />
          </div>
        </div>

        <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--soft-green)', borderRadius: 8, fontSize: 11, color: 'var(--green)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, border: '1px solid var(--line)' }}>
          <span>Universal Webhook URL: <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/payment` : '/api/webhooks/payment'}</code></span>
          <button
            type="button"
            className="btn ghost small"
            style={{ fontSize: 10, padding: '2px 6px' }}
            onClick={() => {
              if (typeof window !== 'undefined') {
                void navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/payment`);
              }
            }}
          >
            📋 Copy URL
          </button>
        </div>
      </div>

      {/* Google Reviews Booster & Human Psychology Feedback */}
      <div style={{ padding: 18, background: 'var(--paper-elevated)', borderRadius: 14, border: '1px solid var(--line)', margin: '18px 0' }}>
        <div>
          <strong style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)' }}>
            ⭐ Google Reviews Booster & Behavioral Psychology Feedback
          </strong>
          <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13 }}>
            Rooted in Daniel Kahneman's Peak-End Rule: Delighted 4-5 star diners are gently guided directly into your Google Maps 5-star review page with 1 tap, while unhappy 1-3 star diners are caught table-side with diagnostic chips and alert the floor manager before leaving.
          </p>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="restaurant-google-review-url" style={{ color: 'var(--ink)', fontWeight: 650 }}>
            Google Maps Review Link / Shortlink <span className="muted">(e.g. https://g.page/r/your-id/review or https://maps.app.goo.gl/...)</span>
          </label>
          <input
            className="input"
            id="restaurant-google-review-url"
            maxLength={2048}
            disabled={!canEdit}
            placeholder="https://g.page/r/YOUR_RESTAURANT/review"
            value={form.googleReviewUrl}
            onChange={(e) => setOverrides((current) => ({ ...current, googleReviewUrl: e.target.value.trim() }))}
          />
          <span className="muted" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
            Obtain this link from your Google Business Profile &gt; "Ask for reviews".
          </span>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: canEdit ? 'pointer' : 'default', padding: '6px 0' }}>
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={Boolean(form.enableDishReviews)}
            onChange={(e) => setOverrides((current) => ({ ...current, enableDishReviews: e.target.checked }))}
          />
          <div>
            <strong style={{ fontSize: 13, color: 'var(--ink)', display: 'block' }}>
              Enable Dish-Level Sentiment Feedback (Yumpingo Style)
            </strong>
            <span className="muted" style={{ fontSize: 11 }}>
              Customers can give 1-tap 👍/👎 on individual dishes they ordered to diagnose kitchen taste & consistency.
            </span>
          </div>
        </label>
      </div>

      <div className="notice">Table QR codes use the public app URL configured by the restaurant operator.</div>
      {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="notice success" role="status">{message}</div>}
      {canEdit ? <button className="btn" disabled={save.isPending}>{save.isPending && <span className="btn-spinner" aria-hidden="true" />}{save.isPending ? 'Saving…' : 'Save settings'}</button> : <div className="notice">Only the restaurant owner can change these settings.</div>}
    </form></section>
    {canEdit && <StaffAccess />}
  </>;
}

interface StaffList { users: (StaffUser & { _id?: string; active: boolean; createdAt: string })[] }

function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case 'owner':
    case 'manager':
      return {
        canViewFinancials: true,
        canEditMenu: true,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: true,
        canCloseRegister: true
      };
    case 'cashier':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: false,
        canCloseRegister: true
      };
    case 'waiter':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: false,
        canPunchOrders: true,
        canManageReviews: false,
        canCloseRegister: false
      };
    case 'kitchen':
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: false,
        canPunchOrders: false,
        canManageReviews: false,
        canCloseRegister: false
      };
    case 'staff':
    default:
      return {
        canViewFinancials: false,
        canEditMenu: false,
        canManageStock: true,
        canSettleBills: true,
        canPunchOrders: true,
        canManageReviews: true,
        canCloseRegister: false
      };
  }
}

const roleMeta: Record<UserRole, { label: string; icon: string; description: string; badgeColor: string }> = {
  owner: { label: 'Owner', icon: '👑', description: 'Master administrator with full unconstrained power', badgeColor: '#854d0e' },
  manager: { label: 'Manager', icon: '🧑‍💼', description: 'Floor oversight, complaint recovery, item stock, orders', badgeColor: '#1e40af' },
  cashier: { label: 'Cashier / Reception', icon: '💵', description: 'Counter billing, payments, shift register close', badgeColor: '#166534' },
  waiter: { label: 'Waiter / Captain', icon: '🛎️', description: 'Floor map, table status, punching walk in orders', badgeColor: '#b45309' },
  kitchen: { label: 'Kitchen Cook', icon: '🍳', description: 'Kitchen KDS ticket queue preparation only', badgeColor: '#9f1239' },
  staff: { label: 'Staff', icon: '👤', description: 'General operations and orders', badgeColor: '#475569' }
};

const permissionMeta: { key: keyof UserPermissions; label: string; description: string; icon: string }[] = [
  { key: 'canViewFinancials', label: 'View Total Sales and Revenue', description: 'See daily turnover, orders value, and financial metrics on dashboard', icon: '💰' },
  { key: 'canEditMenu', label: 'Edit Menu Dishes and Prices', description: 'Add or modify dishes, categories, and item pricing', icon: '🍽️' },
  { key: 'canManageStock', label: 'Toggle 86 / Out of Stock', description: 'Mark dishes unavailable or restore stock during rush hours', icon: '🚫' },
  { key: 'canSettleBills', label: 'Settle Bills and Collect Payments', description: 'Mark table bills paid via Cash, Card, or manual UPI', icon: '💳' },
  { key: 'canPunchOrders', label: 'Punch Walk In / Table Orders', description: 'Take orders for guests directly from staff device', icon: '📝' },
  { key: 'canManageReviews', label: 'Table Complaints and Recovery', description: 'View dining feedback, receive live table alerts, and record resolutions', icon: '⭐' },
  { key: 'canCloseRegister', label: 'Close Register and Cash Drawer', description: 'Run end of day register reconciliation and generate Z Report', icon: '📋' }
];

function StaffAccess() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<StaffList>('/restaurant/staff') });
  const [openAddModal, setOpenAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<(StaffUser & { _id?: string }) | null>(null);

  // Form states for creating staff
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('waiter');
  const [customPowers, setCustomPowers] = useState<UserPermissions>(getDefaultPermissions('waiter'));
  const [showAdvancedPowers, setShowAdvancedPowers] = useState(false);
  const [error, setError] = useState('');

  // Form states for editing existing staff
  const [editRole, setEditRole] = useState<UserRole>('waiter');
  const [editPowers, setEditPowers] = useState<UserPermissions>(getDefaultPermissions('waiter'));
  const [editError, setEditError] = useState('');

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setCustomPowers(getDefaultPermissions(newRole));
  };

  const create = useMutation({
    mutationFn: () => api.post('/restaurant/staff', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
      permissions: customPowers
    }),
    onSuccess: async () => {
      setOpenAddModal(false);
      setName('');
      setEmail('');
      setPassword('');
      setError('');
      setShowAdvancedPowers(false);
      await client.invalidateQueries({ queryKey: ['staff-users'] });
    },
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This account could not be created.')
  });

  const update = useMutation({
    mutationFn: ({ id, role, permissions, active }: { id: string; role?: UserRole; permissions?: UserPermissions; active?: boolean }) =>
      api.patch(`/restaurant/staff/${id}`, { role, permissions, active }),
    onSuccess: async () => {
      setEditingStaff(null);
      setEditError('');
      await client.invalidateQueries({ queryKey: ['staff-users'] });
    },
    onError: (cause: Error) => setEditError(cause instanceof ApiError ? cause.message : 'Could not update staff account.')
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => api.patch(`/restaurant/staff/${id}`, { active }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ['staff-users'] }),
    onError: (cause: Error) => setError(cause instanceof ApiError ? cause.message : 'This account could not be updated.')
  });

  const openEditModal = (staff: StaffUser & { _id?: string }) => {
    setEditingStaff(staff);
    setEditRole(staff.role);
    setEditPowers(staff.permissions || getDefaultPermissions(staff.role));
    setEditError('');
  };

  return (
    <section className="surface" style={{ maxWidth: 860, marginTop: 18, padding: 24, borderRadius: 16 }}>
      <div className="heading-row" style={{ marginTop: 0 }}>
        <div>
          <span className="eyebrow">Access Control and Team Permissions</span>
          <h2>Staff accounts and role powers</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
            Assign specific powers to managers, waiters, cashiers, and cooks. Shield daily revenue and menu pricing from unauthorized edits.
          </p>
        </div>
        <button
          className="btn small"
          onClick={() => {
            setError('');
            handleRoleChange('waiter');
            setOpenAddModal(true);
          }}
        >
          ➕ Add team member
        </button>
      </div>

      {error && !openAddModal && <div className="form-error" style={{ marginBottom: 14 }} role="alert">{error}</div>}

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorPanel message="Staff accounts could not be loaded." retry={() => void query.refetch()} />
      ) : (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Role</th>
                <th>Enabled Powers</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(query.data?.users ?? []).map((user) => {
                const userId = user.id ?? user._id!;
                const userRole = (user.role as UserRole) || 'staff';
                const meta = roleMeta[userRole] || roleMeta.staff;
                const perms = user.permissions || getDefaultPermissions(userRole);
                const isOwner = userRole === 'owner';

                return (
                  <tr key={userId}>
                    <td>
                      <strong>{user.name}</strong>
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{user.email}</div>
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          background: isOwner ? 'var(--soft-orange)' : 'var(--paper-elevated)',
                          color: isOwner ? 'var(--orange)' : 'var(--ink)',
                          fontWeight: 750,
                          fontSize: 12,
                          gap: 4
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>
                    </td>
                    <td>
                      {isOwner ? (
                        <span className="pill green" style={{ fontSize: 11 }}>Full Unrestricted Access</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280 }}>
                          {perms.canViewFinancials && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>💰 Sales</span>}
                          {perms.canEditMenu && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>🍽️ Menu</span>}
                          {perms.canSettleBills && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>💳 Billing</span>}
                          {perms.canPunchOrders && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>📝 Punch</span>}
                          {perms.canManageReviews && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>⭐ Reviews</span>}
                          {perms.canCloseRegister && <span className="pill green" style={{ fontSize: 10, padding: '1px 6px' }}>📋 Register</span>}
                          {!perms.canViewFinancials && !perms.canEditMenu && !perms.canSettleBills && !perms.canPunchOrders && !perms.canManageReviews && (
                            <span className="pill gray" style={{ fontSize: 10, padding: '1px 6px' }}>🍳 Kitchen KDS only</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${user.active ? '' : 'gray'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isOwner && (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn secondary small"
                            onClick={() => openEditModal(user)}
                            title="Configure role powers"
                          >
                            ⚙️ Edit Powers
                          </button>
                          <button
                            type="button"
                            className="btn secondary small"
                            style={{ color: user.active ? 'var(--red)' : 'inherit' }}
                            onClick={() => toggle.mutate({ id: userId, active: !user.active })}
                          >
                            {user.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Staff Modal with Role and Permission Matrix */}
      {openAddModal && (
        <Modal
          title="Add team member"
          onClose={() => { if (!create.isPending) setOpenAddModal(false); }}
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setError('');
              create.mutate();
            }}
          >
            <div className="field">
              <label htmlFor="staff-name">Full name</label>
              <input
                className="input"
                id="staff-name"
                required
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Rohan Verma"
              />
            </div>

            <div className="field">
              <label htmlFor="staff-email">Work email address</label>
              <input
                className="input"
                id="staff-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="rohan@restaurant.com"
              />
            </div>

            <div className="field">
              <label htmlFor="staff-role">Assigned role</label>
              <select
                className="select"
                id="staff-role"
                value={role}
                onChange={(event) => handleRoleChange(event.target.value as UserRole)}
              >
                <option value="manager">🧑‍💼 Manager (Floor operations, complaints, stock, orders)</option>
                <option value="cashier">💵 Cashier / Reception (Billing counter, payments, register close)</option>
                <option value="waiter">🛎️ Waiter / Captain (Floor map, table orders, table PIN defense)</option>
                <option value="kitchen">🍳 Kitchen (Kitchen KDS preparation queue only)</option>
              </select>
              <span className="muted" style={{ fontSize: 12 }}>
                {roleMeta[role]?.description}
              </span>
            </div>

            <div className="field">
              <label htmlFor="staff-password">Temporary password</label>
              <input
                className="input"
                id="staff-password"
                type="password"
                minLength={8}
                maxLength={72}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {/* Power Customization Section */}
            <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: 'var(--paper-elevated)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 13, display: 'block' }}>Operational Powers for this Account</strong>
                  <span className="muted" style={{ fontSize: 11 }}>Presets are active. You can customize any switch below.</span>
                </div>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setShowAdvancedPowers(!showAdvancedPowers)}
                  style={{ fontSize: 11 }}
                >
                  {showAdvancedPowers ? 'Hide powers' : 'Customize powers'}
                </button>
              </div>

              {showAdvancedPowers && (
                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  {permissionMeta.map((perm) => (
                    <label
                      key={perm.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--paper)',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 16 }}>{perm.icon}</span>
                        <div>
                          <strong style={{ fontSize: 13, display: 'block' }}>{perm.label}</strong>
                          <span className="muted" style={{ fontSize: 11 }}>{perm.description}</span>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(customPowers[perm.key])}
                        onChange={(e) => setCustomPowers({ ...customPowers, [perm.key]: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="btn full" disabled={create.isPending}>
              {create.isPending ? 'Creating account…' : 'Create team member'}
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Powers & Role Modal for Existing Staff */}
      {editingStaff && (
        <Modal
          title={`Edit powers: ${editingStaff.name}`}
          onClose={() => { if (!update.isPending) setEditingStaff(null); }}
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              setEditError('');
              update.mutate({
                id: editingStaff.id ?? editingStaff._id!,
                role: editRole,
                permissions: editPowers
              });
            }}
          >
            <div className="field">
              <label htmlFor="edit-role">Role preset</label>
              <select
                className="select"
                id="edit-role"
                value={editRole}
                onChange={(event) => {
                  const newRole = event.target.value as UserRole;
                  setEditRole(newRole);
                  setEditPowers(getDefaultPermissions(newRole));
                }}
              >
                <option value="manager">🧑‍💼 Manager</option>
                <option value="cashier">💵 Cashier / Reception</option>
                <option value="waiter">🛎️ Waiter / Captain</option>
                <option value="kitchen">🍳 Kitchen Cook</option>
              </select>
            </div>

            <div className="field">
              <label style={{ marginBottom: 4 }}>Custom permission powers</label>
              <div style={{ display: 'grid', gap: 8 }}>
                {permissionMeta.map((perm) => (
                  <label
                    key={perm.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: 'var(--paper)',
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 16 }}>{perm.icon}</span>
                      <div>
                        <strong style={{ fontSize: 13, display: 'block' }}>{perm.label}</strong>
                        <span className="muted" style={{ fontSize: 11 }}>{perm.description}</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(editPowers[perm.key])}
                      onChange={(e) => setEditPowers({ ...editPowers, [perm.key]: e.target.checked })}
                      style={{ width: 18, height: 18, accentColor: 'var(--green)' }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {editError && <div className="form-error" role="alert">{editError}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setEditingStaff(null)}
              >
                Cancel
              </button>
              <button
                className="btn"
                disabled={update.isPending}
              >
                {update.isPending ? 'Saving…' : 'Save powers'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
