import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';
import { api } from '../services/api';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team', active: true },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Discord' },
  { label: 'Ειδοποιήσεις', path: '/notifications' },
  { label: 'Ρυθμίσεις' },
];

const menuSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team', active: true },
  { label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
];

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

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
}

function Sidebar({ user }) {
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {menuSections.map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'}`;
            return <Link key={section.label} to={section.path} className={`${className} ${section.spacerBefore ? 'mt-6' : ''}`}>{section.label}</Link>;
          })}
          {user?.role === 'admin' && (
            <div>
              <button onClick={() => setSettingsOpen((value) => !value)} className="flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold text-slate-100 hover:bg-white/10">
                <span>Ρυθμίσεις</span>
                <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
              <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                {['Discord', 'Πλάνα & Τιμές', 'Branding'].map((label) => (
                  label === 'Πλάνα & Τιμές'
                    ? <Link key={label} to="/pricing-plans" className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{label}</Link>
                    : <button key={label} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{label}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>
      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <Avatar initials={(user?.fullName || 'Coach Admin').slice(0, 2).toUpperCase()} tone="bg-red-600" />
          <div>
            <div className="font-bold">{user?.fullName || 'Coach Admin'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />Online</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ user, logout, sidebarOpen, onToggleSidebar }) {
  return (
    <header className={`fixed ${sidebarOpen ? 'left-[300px]' : 'left-0'} right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm transition-all duration-200`}>
      <div className="flex items-center gap-9">
        <MenuToggle onClick={onToggleSidebar} />
        <h1 className="text-2xl font-extrabold">Team</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function Team() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
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
        </div>
      </main>
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
