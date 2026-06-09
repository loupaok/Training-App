import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, getAuthRedirect, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientOnboarding from './pages/ClientOnboarding';
import ClientBilling from './pages/ClientBilling';
import ClientNotifications from './pages/ClientNotifications';
import ClientProfile from './pages/ClientProfile';
import ClientDashboard from './pages/ClientDashboard';
import ClientPending from './pages/ClientPending';
import ClientExpired from './pages/ClientExpired';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import ClientUpdates from './pages/ClientUpdates';
import Exercises from './pages/Exercises';
import MediaLibrary from './pages/MediaLibrary';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Team from './pages/Team';
import PricingPlans from './pages/PricingPlans';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function ProtectedRoute({ children, allow }) {
  const { user, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">
        Φόρτωση...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const needsOnboarding = user?.role === 'client' && !user?.onboardingCompleted;
  if (needsOnboarding && location.pathname !== '/client-onboarding') {
    return <Navigate to="/client-onboarding" replace />;
  }

  if (user?.role === 'client' && user?.onboardingCompleted && location.pathname === '/client-onboarding') {
    return <Navigate to={getAuthRedirect(user)} replace />;
  }

  if (allow === 'coach' && !['coach', 'admin'].includes(user.role)) {
    return <Navigate to={getAuthRedirect(user)} replace />;
  }

  if (allow === 'client-active' && user.role === 'client' && user.status !== 'active') {
    return <Navigate to={getAuthRedirect(user)} replace />;
  }

  if (allow === 'client-pending' && !(user.role === 'client' && user.status === 'pending_payment')) {
    return <Navigate to={getAuthRedirect(user)} replace />;
  }

  if (allow === 'client-expired' && !(user.role === 'client' && user.status === 'expired')) {
    return <Navigate to={getAuthRedirect(user)} replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, authReady } = useAuth();
  if (!authReady) return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">Φόρτωση...</div>;
  return <Navigate to={getAuthRedirect(user)} replace />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/client-onboarding"
            element={
              <ProtectedRoute>
                <ClientOnboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allow="coach">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach/dashboard"
            element={
              <ProtectedRoute allow="coach">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-dashboard"
            element={
              <ProtectedRoute allow="client-active">
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/dashboard"
            element={
              <ProtectedRoute allow="client-active">
                <ClientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/pending"
            element={
              <ProtectedRoute allow="client-pending">
                <ClientPending />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client/expired"
            element={
              <ProtectedRoute allow="client-expired">
                <ClientExpired />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-billing"
            element={
              <ProtectedRoute>
                <ClientBilling />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-notifications"
            element={
              <ProtectedRoute>
                <ClientNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-profile"
            element={
              <ProtectedRoute>
                <ClientProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients/:clientId"
            element={
              <ProtectedRoute>
                <ClientDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/updates"
            element={
              <ProtectedRoute>
                <ClientUpdates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <Exercises />
              </ProtectedRoute>
            }
          />
          <Route
            path="/media-library"
            element={
              <ProtectedRoute>
                <MediaLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute>
                <Team />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing-plans"
            element={
              <ProtectedRoute>
                <PricingPlans />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
