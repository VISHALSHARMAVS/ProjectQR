import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useStaff } from './hooks/useStaff';
import LandingPage from './pages/LandingPage';
import { Loading } from './components/ui';

const DashboardLayout = lazy(() => import('./components/DashboardLayout'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const ScanPage = lazy(() => import('./pages/customer/ScanPage'));
const VerifyPage = lazy(() => import('./pages/customer/VerifyPage'));
const CustomerMenuPage = lazy(() => import('./pages/customer/MenuPage'));
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage'));
const TrackingPage = lazy(() => import('./pages/customer/TrackingPage'));
const OverviewPage = lazy(() => import('./pages/dashboard/OverviewPage'));
const FloorMapPage = lazy(() => import('./pages/dashboard/FloorMapPage'));
const MenuPage = lazy(() => import('./pages/dashboard/MenuPage'));
const CategoriesPage = lazy(() => import('./pages/dashboard/CategoriesPage'));
const TablesPage = lazy(() => import('./pages/dashboard/TablesPage'));
const OrdersPage = lazy(() => import('./pages/dashboard/OrdersPage'));
const DayClosePage = lazy(() => import('./pages/dashboard/DayClosePage'));
const SettingsPage = lazy(() => import('./pages/dashboard/SettingsPage'));
const ReviewsPage = lazy(() => import('./pages/dashboard/ReviewsPage'));

function NotFoundPage() {
  return <main className="page-wrap" style={{ paddingTop: 70 }}><span className="eyebrow">Page not found</span><h1 style={{ letterSpacing: '-.05em' }}>We couldn’t find that page.</h1><Link className="btn" to="/">Go to Mesa</Link></main>;
}

function DashboardRedirect() {
  const staff = useStaff();
  const role = staff.data?.user.role;
  if (role === 'kitchen') return <Navigate to="kitchen" replace />;
  if (role === 'waiter') return <Navigate to="floor-map" replace />;
  if (role === 'cashier') return <Navigate to="orders" replace />;
  return <Navigate to="overview" replace />;
}

function ProtectedDashboard() {
  const staff = useStaff();
  if (staff.isLoading) return <Loading label="Opening your workspace…" />;
  if (staff.error) return <Link to="/login" replace>Sign in to continue</Link>;
  return <Outlet />;
}

function ManagementOnly({ children }: { children: ReactNode }) {
  const staff = useStaff();
  const role = staff.data?.user.role;
  if (role === 'kitchen') return <Navigate to="/dashboard/kitchen" replace />;
  if (role === 'waiter') return <Navigate to="/dashboard/floor-map" replace />;
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: ReactNode }) {
  const staff = useStaff();
  if (staff.data?.user.role !== 'owner') return <Navigate to="/dashboard/orders" replace />;
  return <>{children}</>;
}

export default function App() {
  return <Suspense fallback={<Loading label="Loading page…" />}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/demo" element={<DemoPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
    <Route path="/order/:token" element={<ScanPage />} />
    <Route path="/order/:token/verify" element={<VerifyPage />} />
    <Route path="/order/:token/menu" element={<CustomerMenuPage />} />
    <Route path="/order/:token/checkout" element={<CheckoutPage />} />
    <Route path="/order/:token/tracking" element={<TrackingPage />} />
    <Route path="/order/:token/tracking/:orderId" element={<TrackingPage />} />
    <Route element={<ProtectedDashboard />}>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardRedirect />} />
        <Route path="overview" element={<ManagementOnly><OverviewPage /></ManagementOnly>} />
        <Route path="floor-map" element={<FloorMapPage />} />
        <Route path="menu" element={<ManagementOnly><MenuPage /></ManagementOnly>} />
        <Route path="categories" element={<ManagementOnly><CategoriesPage /></ManagementOnly>} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="kitchen" element={<OrdersPage kitchen />} />
        <Route path="day-close" element={<ManagementOnly><DayClosePage /></ManagementOnly>} />
        <Route path="reviews" element={<ManagementOnly><ReviewsPage /></ManagementOnly>} />
        <Route path="settings" element={<OwnerOnly><SettingsPage /></OwnerOnly>} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes></Suspense>;
}
