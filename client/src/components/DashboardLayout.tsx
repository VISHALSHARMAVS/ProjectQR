import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStaff } from '../hooks/useStaff';
import { api } from '../lib/api';
import { Loading } from './ui';

const links = [
  { to: '/dashboard/overview', label: 'Overview', icon: '📊' },
  { to: '/dashboard/menu', label: 'Menu Items', icon: '🍽️' },
  { to: '/dashboard/categories', label: 'Categories', icon: '📂' },
  { to: '/dashboard/tables', label: 'Tables & QR', icon: '🪑' },
  { to: '/dashboard/floor-map', label: 'Floor Map', icon: '🗺️' },
  { to: '/dashboard/orders', label: 'Live Orders', icon: '🔔' },
  { to: '/dashboard/kitchen', label: 'Kitchen KDS', icon: '🍳' },
  { to: '/dashboard/day-close', label: 'Day Close / Register', icon: '📋' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙️' }
];

export function ProtectedDashboard() {
  const staff = useStaff();
  if (staff.isLoading) return <Loading label="Opening your workspace…" />;
  if (staff.error) return <Link to="/login" replace>Sign in to continue</Link>;
  return <Outlet />;
}

export function ManagementOnly({ children }: { children: ReactNode }) {
  const staff = useStaff();
  if (staff.data?.user.role === 'kitchen') return <Navigate to="/dashboard/kitchen" replace />;
  return children;
}

export default function DashboardLayout() {
  const staff = useStaff();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: async () => {
      await queryClient.clear();
      navigate('/', { replace: true });
    }
  });

  const itemLink = (item: typeof links[number]) => (
    <NavLink
      key={item.to}
      to={item.to}
      title={item.label}
      aria-label={item.label}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
    >
      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </NavLink>
  );

  const restaurant = staff.data?.restaurant;
  const name = restaurant?.name ?? 'Restaurant';
  const brandColor = restaurant?.brandColor || '#315b43';
  const brandStyle = {
    '--green': brandColor,
    '--green-dark': brandColor,
    '--soft-green': `${brandColor}18`
  } as CSSProperties;

  const visibleLinks = staff.data?.user.role === 'kitchen'
    ? links.filter((item) => ['/dashboard/orders', '/dashboard/kitchen'].includes(item.to))
    : links;

  return (
    <div className="staff-layout" style={brandStyle}>
      <aside className="sidebar">
        <Link to="/dashboard/overview" className="brand">
          {restaurant?.logoUrl ? (
            <div style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#f0f0eb' }}>
              <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <span className="brand-mark">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <span className="brand-name">{name}</span>
        </Link>
        <div className="sidebar-label">Workspace</div>
        <nav className="nav-list" aria-label="Restaurant navigation">{visibleLinks.map(itemLink)}</nav>
        <div className="sidebar-bottom">
          <div className="sidebar-label">Signed in as</div>
          <div style={{ padding: '0 10px 8px', fontSize: 12, lineHeight: 1.5 }}>
            <strong>{staff.data?.user.name}</strong><br /><span className="muted">{name}</span>
          </div>
          <button className="nav-link" title="Sign out" aria-label="Sign out" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <span className="nav-icon" aria-hidden="true">↪</span>
            <span className="nav-label">{logout.isPending ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>
      </aside>

      <div className="staff-main">
        <header className="staff-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="mobile-menu-toggle-btn"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              title="Open Menu"
            >
              ☰
            </button>
            {restaurant?.logoUrl && (
              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: '#f0f0eb' }}>
                <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div>
              <div className="eyebrow">Restaurant workspace</div>
              <strong style={{ fontSize: 14 }}>{name}</strong>
            </div>
          </div>
          <span className="pill">{staff.data?.user.role ?? 'owner'}</span>
        </header>

        <main className="staff-content"><Outlet /></main>
      </div>

      {/* Mobile Slide-Out Drawer with full labeled navigation */}
      {mobileDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileDrawerOpen(false)}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {restaurant?.logoUrl ? (
                  <img src={restaurant.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <span className="brand-mark">{name.slice(0, 1).toUpperCase()}</span>
                )}
                <div>
                  <strong style={{ fontSize: 15, display: 'block' }}>{name}</strong>
                  <span className="muted" style={{ fontSize: 11 }}>{staff.data?.user.name} ({staff.data?.user.role})</span>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Close navigation menu"
              >
                ✕
              </button>
            </div>

            <div className="mobile-drawer-nav">
              <span className="eyebrow" style={{ padding: '8px 12px 4px', display: 'block' }}>Restaurant Navigation</span>
              {visibleLinks.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) => `mobile-drawer-link ${isActive ? 'active' : ''}`}
                >
                  <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mobile-drawer-footer">
              <button
                type="button"
                className="btn secondary full"
                onClick={() => { setMobileDrawerOpen(false); logout.mutate(); }}
                disabled={logout.isPending}
              >
                ↪ {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar with direct Menu & Tables links */}
      <nav className="mobile-nav" aria-label="Quick navigation">
        {staff.data?.user.role === 'kitchen' ? (
          [
            { to: '/dashboard/kitchen', label: 'Kitchen', icon: '🍳' },
            { to: '/dashboard/orders', label: 'Orders', icon: '🔔' }
          ].map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))
        ) : (
          <>
            <NavLink to="/dashboard/overview" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">📊</span>
              <span className="nav-label">Overview</span>
            </NavLink>
            <NavLink to="/dashboard/menu" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">🍽️</span>
              <span className="nav-label">Menu</span>
            </NavLink>
            <NavLink to="/dashboard/tables" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">🪑</span>
              <span className="nav-label">Tables</span>
            </NavLink>
            <NavLink to="/dashboard/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">🔔</span>
              <span className="nav-label">Orders</span>
            </NavLink>
            <button
              type="button"
              className="nav-link"
              onClick={() => setMobileDrawerOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span className="nav-icon">☰</span>
              <span className="nav-label">More</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
