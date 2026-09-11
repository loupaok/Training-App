import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CoachShell } from '../components/CoachShell';
import { api } from '../services/api';

const roles = [
  { value: 'admin', label: 'Admin / Coach' },
  { value: 'moderator', label: 'Moderator' },
];

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'moderator',
  specializations: '',
};

export default function Team() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';

  const loadUsers = async () => {
    setError('');
    try {
      const rows = await api.get('/admin/users');
      setUsers(rows);
    } catch (err) {
      setError(err.message || 'Δεν φορτώθηκε το team.');
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((row) => row.role === roleFilter);
  }, [roleFilter, users]);

  const createUser = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.post('/admin/users', form);
      setMessage('Το άτομο προστέθηκε στο team.');
      setForm(emptyForm);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Δεν έγινε προσθήκη.');
    }
  };

  const updateUser = async (targetUser, changes) => {
    setError('');
    setMessage('');
    try {
      await api.put(`/admin/users/${targetUser.id}`, changes);
      setMessage('Ο χρήστης ενημερώθηκε.');
      loadUsers();
    } catch (err) {
      setError(err.message || 'Δεν έγινε ενημέρωση.');
    }
  };

  return (
    <CoachShell title="Team" user={user} logout={logout}>
          <div className="mb-7 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm">
                <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Team</span>
              </div>
              <h2 className="mt-5 text-3xl font-extrabold">Team & Roles</h2>
              <p className="mt-2 text-slate-600">Ορίζεις μόνο την εσωτερική ομάδα: Admin/Coach και Moderator.</p>
            </div>
            {isAdmin && (
              <button onClick={() => setShowForm((value) => !value)} className="h-12 rounded-md bg-red-600 px-6 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
                {showForm ? 'Κλείσιμο' : 'Προσθήκη Ατόμου'}
              </button>
            )}
          </div>

          {!isAdmin && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 font-bold text-red-700">
              Μόνο ο Admin μπορεί να διαχειριστεί το Team.
            </div>
          )}

          {isAdmin && (
            <>
              {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
              {message && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700">{message}</div>}

              {showForm && (
                <form onSubmit={createUser} className="mb-7 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="Ονοματεπώνυμο" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} required />
                    <Input label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} required />
                    <Input label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} required />
                    <label>
                      <span className="text-sm font-bold text-slate-700">Ρόλος</span>
                      <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300">
                        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </label>
                    <Input label="Specializations / Σημείωση" value={form.specializations} onChange={(value) => setForm({ ...form, specializations: value })} />
                  </div>
                  <button type="submit" className="mt-5 h-11 rounded-md bg-slate-950 px-5 font-bold text-white hover:bg-slate-800">Αποθήκευση</button>
                </form>
              )}

              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 p-5">
                  <h3 className="text-xl font-extrabold">Χρήστες</h3>
                  <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-11 rounded-md border border-slate-200 px-3 font-bold outline-none focus:border-red-300">
                    <option value="all">Όλη η ομάδα</option>
                    {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </div>
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-600">
                    <tr>
                      <th className="px-5 py-4">Όνομα</th>
                      <th className="px-5 py-4">Email</th>
                      <th className="px-5 py-4">Ρόλος</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4">Σημείωση</th>
                      <th className="px-5 py-4">Ενέργειες</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 font-bold">{row.full_name}</td>
                        <td className="px-5 py-4 text-slate-600">{row.email}</td>
                        <td className="px-5 py-4">
                          <select value={row.role} onChange={(event) => updateUser(row, { role: event.target.value })} className="h-10 rounded-md border border-slate-200 px-3 font-bold outline-none focus:border-red-300">
                            {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
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
                    {!filteredUsers.length && (
                      <tr><td colSpan="6" className="px-5 py-10 text-center font-semibold text-slate-500">Δεν υπάρχουν χρήστες.</td></tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
    </CoachShell>
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
