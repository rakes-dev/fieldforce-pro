import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';

// Lazy loading or component placeholders
import AdminDashboard from './pages/admin/Dashboard';
import AdminTracking from './pages/admin/Tracking';
import AdminEmployees from './pages/admin/Employees';
import AdminShops from './pages/admin/Shops';
import ShopDetail from './pages/admin/ShopDetail';
import AdminOrders from './pages/admin/Orders';
import AdminAttendance from './pages/admin/Attendance';

import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeAttendance from './pages/employee/Attendance';
import EmployeeShopVisits from './pages/employee/ShopVisits';
import EmployeeNewShop from './pages/employee/NewShop';
import EmployeeOrders from './pages/employee/Orders';
import Profile from './pages/shared/Profile';

import Layout from './components/Layout';

const ProtectedRoute = ({ children, allowedRole }: { children: React.ReactNode, allowedRole: 'admin' | 'employee' }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (role !== allowedRole) return <Navigate to="/unauthorized" />;

  return <>{children}</>;
};

export default function App() {
  const { user, role } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={role === 'admin' ? '/admin' : '/employee'} /> : <Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Admin Portal */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRole="admin">
          <Layout portal="admin" />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="tracking" element={<AdminTracking />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="shops" element={<AdminShops />} />
        <Route path="shops/:id" element={<ShopDetail />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="attendance" element={<AdminAttendance />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      {/* Employee Portal */}
      <Route path="/employee" element={
        <ProtectedRoute allowedRole="employee">
          <Layout portal="employee" />
        </ProtectedRoute>
      }>
        <Route index element={<EmployeeDashboard />} />
        <Route path="attendance" element={<EmployeeAttendance />} />
        <Route path="visits" element={<EmployeeShopVisits />} />
        <Route path="new-shop" element={<EmployeeNewShop />} />
        <Route path="orders" element={<EmployeeOrders />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/" element={<Navigate to="/login" />} />
    </Routes>
  );
}
