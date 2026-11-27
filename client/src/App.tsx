import { Link, Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout, { ManagementOnly, OwnerOnly, ProtectedDashboard } from './components/DashboardLayout';
import { useStaff } from './hooks/useStaff';
import AuthPage from './pages/AuthPage';
import DemoPage from './pages/DemoPage';
import LandingPage from './pages/LandingPage';
import ScanPage from './pages/customer/ScanPage';
import VerifyPage from './pages/customer/VerifyPage';
import CustomerMenuPage from './pages/customer/MenuPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import TrackingPage from './pages/customer/TrackingPage';
import OverviewPage from './pages/dashboard/OverviewPage';
import FloorMapPage from './pages/dashboard/FloorMapPage';
import MenuPage from './pages/dashboard/MenuPage';
import CategoriesPage from './pages/dashboard/CategoriesPage';
import TablesPage from './pages/dashboard/TablesPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import DayClosePage from './pages/dashboard/DayClosePage';
import SettingsPage from './pages/dashboard/SettingsPage';
import ReviewsPage from './pages/dashboard/ReviewsPage';

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

export default function App() {
  return <Routes>
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
  </Routes>;
}
