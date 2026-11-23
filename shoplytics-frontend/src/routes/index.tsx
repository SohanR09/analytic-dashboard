import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { FullPageSpinner } from '@/components/common/ui';
import { BusinessLayout } from '@/components/layout/BusinessLayout';
import { P } from '@/utils/permissions';
import { GuestOnly, RequireAuth, RequirePermission } from './guards';

const Landing = lazy(() => import('@/pages/Landing/Landing'));
const Login = lazy(() => import('@/pages/Auth/Login'));
const Register = lazy(() => import('@/pages/Auth/Register'));
const Forgot = lazy(() => import('@/pages/Auth/ForgotPassword'));
const Reset = lazy(() => import('@/pages/Auth/ResetPassword'));
const Businesses = lazy(() => import('@/pages/Businesses/Businesses'));
const Dashboard = lazy(() => import('@/pages/Dashboard/Dashboard'));
const Sales = lazy(() => import('@/pages/Sales/Sales'));
const Revenue = lazy(() => import('@/pages/Revenue/Revenue'));
const Inventory = lazy(() => import('@/pages/Inventory/Inventory'));
const Products = lazy(() => import('@/pages/Products/Products'));
const ProductDetail = lazy(() => import('@/pages/Products/ProductDetail'));
const Customers = lazy(() => import('@/pages/Customers/Customers'));
const CustomerDetail = lazy(() => import('@/pages/Customers/CustomerDetail'));
const Orders = lazy(() => import('@/pages/Orders/Orders'));
const OrderDetail = lazy(() => import('@/pages/Orders/OrderDetail'));
const Reports = lazy(() => import('@/pages/Reports/Reports'));
const Team = lazy(() => import('@/pages/Settings/Team'));
const Settings = lazy(() => import('@/pages/Settings/Settings'));
const Profile = lazy(() => import('@/pages/Profile/Profile'));

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route path="/forgot-password" element={<Forgot />} />
        <Route path="/reset-password" element={<Reset />} />

        <Route element={<RequireAuth />}>
          <Route path="/businesses" element={<Businesses />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/businesses/:businessId" element={<BusinessLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sales" element={<Sales />} />
            <Route path="revenue" element={<Revenue />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="products" element={<Products />} />
            <Route path="products/:productId" element={<ProductDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:customerId" element={<CustomerDetail />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:orderId" element={<OrderDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="team" element={<RequirePermission permission={P.MEMBER_READ}><Team /></RequirePermission>} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<div className="flex h-full flex-col items-center justify-center gap-3"><h1 className="text-4xl font-bold">404</h1><p className="text-muted">That page doesn't exist.</p><a className="btn-primary" href="/">Go home</a></div>} />
      </Routes>
    </Suspense>
  );
}
