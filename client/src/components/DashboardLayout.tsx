import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useStaff } from '../hooks/useStaff';
import { api } from '../lib/api';
import { Brand, Loading } from './ui';

const links = [
  { to: '/dashboard/overview', label: 'Overview', icon: '⌂' },
  { to: '/dashboard/menu', label: 'Menu', icon: '▤' },
  { to: '/dashboard/categories', label: 'Categories', icon: '◈' },
  { to: '/dashboard/tables', label: 'Tables & QR', icon: '⌗' },
  { to: '/dashboard/orders', label: 'Orders', icon: '▣' },
  { to: '/dashboard/kitchen', label: 'Kitchen', icon: '◷' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙' }
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
  const logout = useMutation({ mutationFn: () => api.post('/auth/logout'), onSuccess: async () => { await queryClient.clear(); navigate('/', { replace: true }); } });
  const itemLink = (item: typeof links[number]) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><span aria-hidden="true">{item.icon}</span><span>{item.label}</span></NavLink>;
  const name = staff.data?.restaurant.name ?? 'Restaurant';
  const visibleLinks = staff.data?.user.role === 'kitchen' ? links.filter((item) => ['/dashboard/orders', '/dashboard/kitchen'].includes(item.to)) : links;

  return <div className="staff-layout">
    <aside className="sidebar"><Link to="/dashboard/overview"><Brand /></Link><div className="sidebar-label">Workspace</div><nav className="nav-list" aria-label="Restaurant navigation">{visibleLinks.map(itemLink)}</nav><div className="sidebar-bottom"><div className="sidebar-label">Signed in as</div><div style={{ padding: '0 10px 8px', fontSize: 12, lineHeight: 1.5 }}><strong>{staff.data?.user.name}</strong><br /><span className="muted">{name}</span></div><button className="nav-link" onClick={() => logout.mutate()} disabled={logout.isPending}><span aria-hidden="true">↪</span><span>Sign out</span></button></div></aside>
    <div className="staff-main"><header className="staff-topbar"><div><div className="eyebrow">Restaurant workspace</div><strong style={{ fontSize: 14 }}>{name}</strong></div><span className="pill">{staff.data?.user.role ?? 'owner'}</span></header><main className="staff-content"><Outlet /></main></div>
    <nav className="mobile-nav" aria-label="Quick navigation">{visibleLinks.filter((item) => staff.data?.user.role === 'kitchen' || ['/dashboard/overview', '/dashboard/menu', '/dashboard/tables', '/dashboard/kitchen', '/dashboard/settings'].includes(item.to)).map(itemLink)}</nav>
  </div>;
}
