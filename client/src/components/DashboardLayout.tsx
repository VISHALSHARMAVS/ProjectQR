import { useState, type CSSProperties, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStaff } from '../hooks/useStaff';
import { api } from '../lib/api';
import { Loading } from './ui';
import { ThemeToggle } from './ThemeToggle';
import type { UserRole } from '../types';

function OverviewIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function KitchenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" x2="18" y1="17" y2="17" />
    </svg>
  );
}

function FloorMapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function TablesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />
    </svg>
  );
}

function DayCloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" /><path d="M12 6v12" />
    </svg>
  );
}

function ReviewsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const navSections = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard/orders', label: 'Live Orders', icon: <OrdersIcon /> },
      { to: '/dashboard/kitchen', label: 'Kitchen KDS', icon: <KitchenIcon /> },
      { to: '/dashboard/floor-map', label: 'Floor Map', icon: <FloorMapIcon /> },
      { to: '/dashboard/reviews', label: 'Reviews & Alerts', icon: <ReviewsIcon /> }
    ]
  },
  {
    title: 'Catalog & Tables',
    items: [
      { to: '/dashboard/menu', label: 'Menu Items', icon: <MenuIcon /> },
      { to: '/dashboard/categories', label: 'Categories', icon: <CategoriesIcon /> },
      { to: '/dashboard/tables', label: 'Tables & QR', icon: <TablesIcon /> }
    ]
  },
  {
    title: 'Reports & Admin',
    items: [
      { to: '/dashboard/overview', label: 'Overview', icon: <OverviewIcon /> },
      { to: '/dashboard/day-close', label: 'Day Close / Register', icon: <DayCloseIcon /> },
      { to: '/dashboard/settings', label: 'Settings', icon: <SettingsIcon /> }
    ]
  }
];

const links = navSections.flatMap((s) => s.items);

export function ProtectedDashboard() {
  const staff = useStaff();
  if (staff.isLoading) return <Loading label="Opening your workspace…" />;
  if (staff.error) return <Link to="/login" replace>Sign in to continue</Link>;
  return <Outlet />;
}

export function ManagementOnly({ children }: { children: ReactNode }) {
  const staff = useStaff();
  const role = staff.data?.user.role;
  if (role === 'kitchen') return <Navigate to="/dashboard/kitchen" replace />;
  if (role === 'waiter') return <Navigate to="/dashboard/floor-map" replace />;
  return <>{children}</>;
}

export function OwnerOnly({ children }: { children: ReactNode }) {
  const staff = useStaff();
  if (staff.data?.user.role !== 'owner') return <Navigate to="/dashboard/orders" replace />;
  return <>{children}</>;
}

export default function DashboardLayout() {
  const staff = useStaff();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const reviewsCountQuery = useQuery({
    queryKey: ['restaurant-reviews-count'],
    queryFn: () => api.get<{ summary: { unresolvedComplaints: number } }>('/restaurant/reviews'),
    refetchInterval: 15_000,
    enabled: staff.data?.user.role !== 'kitchen'
  });
  const unresolvedAlertCount = reviewsCountQuery.data?.summary?.unresolvedComplaints ?? 0;

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
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span className="nav-icon" aria-hidden="true">{item.icon}</span>
        <span className="nav-label">{item.label}</span>
      </div>
      {item.to === '/dashboard/reviews' && unresolvedAlertCount > 0 && (
        <span
          className="pill red"
          style={{
            fontSize: 10,
            padding: '1px 6px',
            fontWeight: 800,
            background: '#ef4444',
            color: '#ffffff',
            borderRadius: 10
          }}
          title={`${unresolvedAlertCount} unresolved guest incidents`}
        >
          {unresolvedAlertCount}
        </span>
      )}
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

  const user = staff.data?.user;
  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const userRole = (user?.role as UserRole) || 'owner';
  const perms = user?.permissions;

  const roleLabel =
    userRole === 'owner' ? 'Owner' :
    userRole === 'manager' ? 'Manager' :
    userRole === 'cashier' ? 'Cashier' :
    userRole === 'waiter' ? 'Waiter' :
    userRole === 'kitchen' ? 'Kitchen' :
    'Staff';
  const roleBadgeClass = `role-${userRole}`;

  const isLinkVisible = (to: string): boolean => {
    if (userRole === 'owner') return true;
    if (userRole === 'kitchen') {
      return ['/dashboard/kitchen', '/dashboard/orders'].includes(to);
    }
    if (userRole === 'waiter') {
      if (['/dashboard/floor-map', '/dashboard/orders', '/dashboard/tables'].includes(to)) return true;
      if (to === '/dashboard/menu' && perms?.canManageStock) return true;
      return false;
    }
    if (userRole === 'cashier') {
      if (['/dashboard/orders', '/dashboard/floor-map', '/dashboard/day-close', '/dashboard/tables'].includes(to)) return true;
      if (to === '/dashboard/menu' && perms?.canManageStock) return true;
      return false;
    }
    if (userRole === 'manager') {
      return to !== '/dashboard/settings';
    }
    return to !== '/dashboard/settings';
  };

  const visibleLinks = links.filter((item) => isLinkVisible(item.to));

  const filteredNavSections = navSections.map((section) => ({
    ...section,
    items: section.items.filter((item) => isLinkVisible(item.to))
  })).filter((section) => section.items.length > 0);

  return (
    <div className="staff-layout" style={brandStyle}>
      <aside className="sidebar">
        <Link to="/dashboard/overview" className="brand">
          {restaurant?.logoUrl ? (
            <div style={{ width: 34, height: 34, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-elevated)' }}>
              <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <span className="brand-mark">{name.slice(0, 1).toUpperCase()}</span>
          )}
          <span className="brand-name">{name}</span>
        </Link>
        <nav className="nav-list" aria-label="Restaurant navigation">
          {filteredNavSections.map((section) => (
            <div key={section.title} style={{ marginBottom: 6 }}>
              <div className="sidebar-section-title">{section.title}</div>
              <div style={{ display: 'grid', gap: 3 }}>
                {section.items.map(itemLink)}
              </div>
            </div>
          ))}
        </nav>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--paper-elevated)' }}>
                <img src={restaurant.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div className="eyebrow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Restaurant workspace</div>
              <strong style={{ fontSize: 14, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle variant="compact" />
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="profile-chip-btn"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                aria-label="User profile and quick actions"
                aria-expanded={profileDropdownOpen}
              >
                <div className="profile-chip-avatar">{initials}</div>
                <div className="profile-chip-info">
                  <span className="profile-chip-name">{userName}</span>
                  <span className={`profile-role-badge ${roleBadgeClass}`}>{roleLabel}</span>
                </div>
                <span className="profile-chip-caret" aria-hidden="true">{profileDropdownOpen ? '▲' : '▼'}</span>
              </button>

              {profileDropdownOpen && (
                <>
                  <div className="profile-dropdown-scrim" onClick={() => setProfileDropdownOpen(false)} />
                  <div className="profile-dropdown-menu">
                    <div className="profile-dropdown-header">
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{userName}</div>
                      {userEmail && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {userEmail}
                        </div>
                      )}
                      <div style={{ marginTop: 6 }}>
                        <span className={`profile-role-badge ${roleBadgeClass}`}>{roleLabel}</span>
                      </div>
                    </div>
                    <div className="profile-dropdown-divider" />
                    <div style={{ padding: '8px 12px' }}>
                      <div className="caption-3" style={{ marginBottom: 6, color: 'var(--muted)' }}>Theme mode</div>
                      <ThemeToggle variant="segmented" />
                    </div>
                    <div className="profile-dropdown-divider" />
                  <div className="profile-dropdown-links">
                    {isLinkVisible('/dashboard/reviews') && (
                      <Link
                        to="/dashboard/reviews"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <span aria-hidden="true">⭐</span>
                        <span>Reviews & Table Alerts</span>
                        {unresolvedAlertCount > 0 && (
                          <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                            {unresolvedAlertCount}
                          </span>
                        )}
                      </Link>
                    )}
                    {userRole === 'owner' && (
                      <Link
                        to="/dashboard/settings"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <span>Settings & Team Access</span>
                      </Link>
                    )}
                    {isLinkVisible('/dashboard/day-close') && (
                      <Link
                        to="/dashboard/day-close"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <span>Day Close Z-Report</span>
                      </Link>
                    )}
                    {isLinkVisible('/dashboard/orders') && (
                      <Link
                        to="/dashboard/orders"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <span>Live Order Board</span>
                      </Link>
                    )}
                    {isLinkVisible('/dashboard/floor-map') && (
                      <Link
                        to="/dashboard/floor-map"
                        className="profile-dropdown-item"
                        onClick={() => setProfileDropdownOpen(false)}
                      >
                        <span>Floor Map</span>
                      </Link>
                    )}
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button
                    type="button"
                    className="profile-dropdown-item signout"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout.mutate();
                    }}
                  >
                    <span aria-hidden="true">↪</span>
                    <span>Sign out</span>
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
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
          <>
            <NavLink to="/dashboard/kitchen" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><KitchenIcon /></span>
              <span className="nav-label">Kitchen</span>
            </NavLink>
            <NavLink to="/dashboard/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><OrdersIcon /></span>
              <span className="nav-label">Orders</span>
            </NavLink>
          </>
        ) : (
          <>
            <NavLink to="/dashboard/overview" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><OverviewIcon /></span>
              <span className="nav-label">Overview</span>
            </NavLink>
            <NavLink to="/dashboard/menu" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><MenuIcon /></span>
              <span className="nav-label">Menu</span>
            </NavLink>
            <NavLink to="/dashboard/tables" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><TablesIcon /></span>
              <span className="nav-label">Tables</span>
            </NavLink>
            <NavLink to="/dashboard/orders" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><OrdersIcon /></span>
              <span className="nav-label">Orders</span>
            </NavLink>
            <button
              type="button"
              className="nav-link"
              onClick={() => setMobileDrawerOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <span className="nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>
                </svg>
              </span>
              <span className="nav-label">More</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
