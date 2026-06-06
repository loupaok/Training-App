import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const roleOptions = [
  { value: 'admin', label: 'Admin / Coach', description: 'Ο βασικός coach/admin. Βλέπει και διαχειρίζεται τα πάντα.' },
  { value: 'moderator', label: 'Moderator', description: 'Βλέπει επιλεγμένες ενότητες. Τα permissions θα τα εξειδικεύσουμε μετά.' },
];

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'moderator',
  specializations: '',
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Δεν φορτώθηκαν οι χρήστες.');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((row) => row.role === roleFilter);
  }, [roleFilter, users]);

  const handleAddUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/admin/users', {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        specializations: formData.specializations,
      });

      setMessage('Ο χρήστης δημιουργήθηκε.');
      setFormData(emptyForm);
      setShowAddUser(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateUser = async (targetUser, changes) => {
    setError('');
    setMessage('');

    try {
      await api.put(`/admin/users/${targetUser.id}`, changes);
      setMessage('Ο χρήστης ενημερώθηκε.');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-slate-600">Δεν έχεις δικαίωμα πρόσβασης σε αυτή τη σελίδα.</p>
          <button onClick={() => navigate('/dashboard')} className="mt-5 rounded-md bg-red-600 px-5 py-3 font-bold text-white">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-8 py-5 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-black">Admin Panel</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">Χρήστες, ρόλοι και πρόσβαση.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="rounded-md border border-slate-200 px-4 py-2 font-bold hover:border-red-200 hover:text-red-600">
              Dashboard
            </button>
            <button onClick={logout} className="rounded-md bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-8 py-8">
        {error && <Alert tone="red">{error}</Alert>}
        {message && <Alert tone="green">{message}</Alert>}

        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
            <StatCard title="Admins" value={stats.admins || 0} />
            <StatCard title="Moderators" value={stats.moderators || 0} />
            <StatCard title="Coaches" value={stats.coaches || 0} />
            <StatCard title="Clients" value={stats.clients || 0} />
            <StatCard title="Total Users" value={stats.totalUsers || 0} />
          </div>
        )}

        <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <div>
              <h2 className="text-xl font-black">Προσθήκη ατόμου</h2>
              <p className="mt-1 text-sm text-slate-500">Ο διαχειριστής ορίζει από εδώ μόνο την εσωτερική ομάδα. Οι πελάτες μπαίνουν από τη σελίδα Πελάτες.</p>
            </div>
            <button onClick={() => setShowAddUser((value) => !value)} className="rounded-md bg-red-600 px-5 py-3 font-bold text-white hover:bg-red-700">
              {showAddUser ? 'Κλείσιμο' : 'Προσθήκη Χρήστη'}
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-4 bg-slate-50 p-6 md:grid-cols-2">
              <Input label="Ονοματεπώνυμο" value={formData.fullName} onChange={(value) => setFormData({ ...formData, fullName: value })} required />
              <Input label="Email" type="email" value={formData.email} onChange={(value) => setFormData({ ...formData, email: value })} required />
              <Input label="Password" type="password" autoComplete="new-password" value={formData.password} onChange={(value) => setFormData({ ...formData, password: value })} required />
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Ρόλος</span>
                <select value={formData.role} onChange={(event) => setFormData({ ...formData, role: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300">
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
              </label>
              <Input label="Specializations / σημείωση" value={formData.specializations} onChange={(value) => setFormData({ ...formData, specializations: value })} />
              <div className="md:col-span-2">
                <button type="submit" className="rounded-md bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">
                  Δημιουργία Χρήστη
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          {roleOptions.map((role) => (
            <div key={role.value} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-lg font-black">{role.label}</div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{role.description}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 p-6">
            <h2 className="text-xl font-black">Όλοι οι χρήστες</h2>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-md border border-slate-200 px-3 font-semibold outline-none focus:border-red-300">
              <option value="all">Όλη η ομάδα</option>
              {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-5 py-4">Όνομα</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Ρόλος</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Specializations</th>
                  <th className="px-5 py-4">Ενέργειες</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr><td colSpan="6" className="px-5 py-8 text-center font-semibold text-slate-500">Φόρτωση...</td></tr>
                )}
                {!loading && filteredUsers.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold">{row.full_name}</td>
                    <td className="px-5 py-4 text-slate-600">{row.email}</td>
                    <td className="px-5 py-4">
                      <select value={row.role} onChange={(event) => updateUser(row, { role: event.target.value })} className="h-10 rounded-md border border-slate-200 px-3 font-bold outline-none focus:border-red-300">
                        {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-3 py-1 text-xs font-black ${row.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{row.specializations || '-'}</td>
                    <td className="px-5 py-4">
                      <button onClick={() => updateUser(row, { isActive: !row.is_active })} className="rounded-md border border-slate-200 px-3 py-2 font-bold text-slate-700 hover:border-red-200 hover:text-red-600">
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredUsers.length === 0 && (
                  <tr><td colSpan="6" className="px-5 py-8 text-center font-semibold text-slate-500">Δεν βρέθηκαν χρήστες.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Alert({ children, tone }) {
  const className = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-green-200 bg-green-50 text-green-700';

  return <div className={`mb-5 rounded-lg border px-5 py-4 text-sm font-bold ${className}`}>{children}</div>;
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, required = false, autoComplete }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300"
      />
    </label>
  );
}
