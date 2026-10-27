import { Link, Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout, { ManagementOnly, ProtectedDashboard } from './components/DashboardLayout';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import ScanPage from './pages/customer/ScanPage';
import VerifyPage from './pages/customer/VerifyPage';
import CustomerMenuPage from './pages/customer/MenuPage';
import CheckoutPage from './pages/customer/CheckoutPage';
import TrackingPage from './pages/customer/TrackingPage';
import OverviewPage from './pages/dashboard/OverviewPage';
import MenuPage from './pages/dashboard/MenuPage';
import CategoriesPage from './pages/dashboard/CategoriesPage';
import TablesPage from './pages/dashboard/TablesPage';
import OrdersPage from './pages/dashboard/OrdersPage';
import SettingsPage from './pages/dashboard/SettingsPage';

function NotFoundPage() {
  return <main className="page-wrap" style={{ paddingTop: 70 }}><span className="eyebrow">Page not found</span><h1 style={{ letterSpacing: '-.05em' }}>We couldn’t find that page.</h1><Link className="btn" to="/">Go to ProjectQR</Link></main>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/order/:token" element={<ScanPage />} />
    <Route path="/order/:token/verify" element={<VerifyPage />} />
    <Route path="/order/:token/menu" element={<CustomerMenuPage />} />
    <Route path="/order/:token/checkout" element={<CheckoutPage />} />
    <Route path="/order/:token/tracking" element={<TrackingPage />} />
    <Route path="/order/:token/tracking/:orderId" element={<TrackingPage />} />
    <Route element={<ProtectedDashboard />}>
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<OverviewPage />} />
        <Route path="menu" element={<ManagementOnly><MenuPage /></ManagementOnly>} />
        <Route path="categories" element={<ManagementOnly><CategoriesPage /></ManagementOnly>} />
        <Route path="tables" element={<ManagementOnly><TablesPage /></ManagementOnly>} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="kitchen" element={<OrdersPage kitchen />} />
        <Route path="settings" element={<ManagementOnly><SettingsPage /></ManagementOnly>} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}
