import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Coach Management</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-3xl font-bold mb-4">Welcome, {user?.fullName}!</h2>
          <p className="text-gray-600 mb-4">Role: <span className="font-semibold capitalize">{user?.role}</span></p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900">Sessions</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
            </div>

            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900">Goals</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">0</p>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900">Clients</h3>
              <p className="text-3xl font-bold text-purple-600 mt-2">0</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
