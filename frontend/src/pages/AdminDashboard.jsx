import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    specializations: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [coachesData, clientsData, statsData] = await Promise.all([
        api.get('/admin/coaches'),
        api.get('/admin/clients'),
        api.get('/admin/stats')
      ]);
      setCoaches(coachesData);
      setClients(clientsData);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoach = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/admin/coaches', {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        specializations: formData.specializations
      });

      setMessage('Coach created successfully!');
      setFormData({ fullName: '', email: '', password: '', specializations: '' });
      setShowAddCoach(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteCoach = async (coachId) => {
    if (!window.confirm('Are you sure?')) return;

    try {
      await api.delete(`/admin/coaches/${coachId}`);
      setMessage('Coach deleted');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p>You don't have permission to access this page</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Messages */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900">Total Coaches</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.coaches}</p>
            </div>
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900">Total Clients</h3>
              <p className="text-3xl font-bold text-green-600">{stats.clients}</p>
            </div>
            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900">Total Users</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.totalUsers}</p>
            </div>
          </div>
        )}

        {/* Add Coach Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b flex justify-between items-center">
            <h2 className="text-xl font-bold">Manage Coaches</h2>
            <button
              onClick={() => setShowAddCoach(!showAddCoach)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showAddCoach ? 'Cancel' : 'Add Coach'}
            </button>
          </div>

          {showAddCoach && (
            <form onSubmit={handleAddCoach} className="p-6 border-b bg-gray-50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specializations</label>
                  <input
                    type="text"
                    value={formData.specializations}
                    onChange={(e) => setFormData({...formData, specializations: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g. Fitness, Nutrition"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Create Coach
              </button>
            </form>
          )}

          {/* Coaches List */}
          <div className="p-6">
            {coaches.length === 0 ? (
              <p className="text-gray-500">No coaches yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Specializations</th>
                      <th className="px-4 py-2 text-left">Created</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coaches.map((coach) => (
                      <tr key={coach.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{coach.full_name}</td>
                        <td className="px-4 py-2">{coach.email}</td>
                        <td className="px-4 py-2">{coach.specializations || '-'}</td>
                        <td className="px-4 py-2">{new Date(coach.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => deleteCoach(coach.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Clients List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">All Clients</h2>
          </div>
          <div className="p-6">
            {clients.length === 0 ? (
              <p className="text-gray-500">No clients yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2">{client.full_name}</td>
                        <td className="px-4 py-2">{client.email}</td>
                        <td className="px-4 py-2">{new Date(client.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
