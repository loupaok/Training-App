import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientOnboarding from './pages/ClientOnboarding';
import ClientBilling from './pages/ClientBilling';
import ClientNotifications from './pages/ClientNotifications';
import ClientProfile from './pages/ClientProfile';
import ClientDashboard from './pages/ClientDashboard';
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

function ProtectedRoute({ children }) {
  const { token, user, authReady } = useAuth();
  const location = useLocation();

  if (!token) return <Navigate to="/login" />;

  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-bold text-slate-500">
        Φόρτωση...
      </div>
    );
  }

  const needsOnboarding = user?.role === 'client' && !user?.onboardingCompleted;
  if (needsOnboarding && location.pathname !== '/client-onboarding') {
    return <Navigate to="/client-onboarding" replace />;
  }

  if (user?.role === 'client' && user?.onboardingCompleted && location.pathname === '/client-onboarding') {
    return <Navigate to="/client-billing" replace />;
  }

  if (user?.role === 'client' && user?.onboardingCompleted && location.pathname === '/dashboard') {
    return <Navigate to="/client-dashboard" replace />;
  }

  return children;
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
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-dashboard"
            element={
              <ProtectedRoute>
                <ClientDashboard />
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
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
