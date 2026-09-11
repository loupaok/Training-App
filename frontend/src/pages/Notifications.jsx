import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { clearUnreadNotifications } from '../components/TopbarControls';
import { CoachShell } from '../components/CoachShell';
import { api } from '../services/api';

const filters = [
  { label: 'Όλες', value: 'all' },
  { label: 'Πληρωμές', value: 'payments' },
  { label: 'Συνδρομές', value: 'subscriptions' },
  { label: 'Updates', value: 'updates' },
  { label: 'Πελάτες', value: 'clients' },
];

export default function Notifications() {
  const { user, logout } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    clearUnreadNotifications()
      .catch(() => {})
      .then(() => api.get('/clients/admin/notifications'))
      .then((rows) => setNotifications(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(err.message || 'Δεν φορτώθηκαν οι ειδοποιήσεις.'))
      .finally(() => setLoading(false));
  }, []);

  const visibleNotifications = useMemo(() => {
    return notifications.filter((item) => matchesFilter(item, activeFilter));
  }, [activeFilter, notifications]);

  const grouped = useMemo(() => groupNotifications(visibleNotifications), [visibleNotifications]);

  return (
    <CoachShell title="Ειδοποιήσεις" user={user} logout={logout}>
          <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-3 text-sm">
                <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Ειδοποιήσεις</span>
              </div>
              <h2 className="mt-5 text-3xl font-extrabold">Κέντρο Ειδοποιήσεων</h2>
              <p className="mt-2 text-slate-600">Πληρωμές, συνδρομές, updates πελατών και νέα συμβάντα.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:flex">
              <SummaryCard label="Σύνολο" value={notifications.length} />
              <SummaryCard label="Σε προβολή" value={visibleNotifications.length} />
            </div>
          </div>

          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`h-10 rounded-md px-4 text-sm font-bold transition ${activeFilter === filter.value ? 'bg-red-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-red-600'}`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </section>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
          {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Φόρτωση...</div>}

          {!loading && (
            <section className="max-w-5xl space-y-5">
              {grouped.map((group) => (
                <div key={group.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 text-xs font-extrabold uppercase tracking-wide text-slate-500">{group.label}</div>
                  <div className="divide-y divide-slate-200">
                    {group.items.map((item) => <NotificationRow key={item.id} item={item} />)}
                  </div>
                </div>
              ))}

              {!grouped.length && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
                  <div className="text-lg font-extrabold">Δεν υπάρχουν ειδοποιήσεις για αυτό το φίλτρο.</div>
                  <p className="mt-2 text-sm text-slate-500">Οι νέες πληρωμές και ενέργειες πελατών θα εμφανίζονται εδώ.</p>
                </div>
              )}
            </section>
          )}
    </CoachShell>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="min-w-32 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}

function NotificationRow({ item }) {
  return (
    <div className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
      <div className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full ${toneForType(item.type).bubble}`}>
        <span className={`text-sm font-black ${toneForType(item.type).text}`}>{iconForType(item.type)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-6">
          <span className="font-extrabold">{item.title}</span>
          {item.client_name && <span className="font-semibold text-slate-800"> — {item.client_name}</span>}
        </div>
        <div className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.body}</div>
        <div className="mt-1 text-xs font-bold text-slate-400">{formatDateTime(item.created_at)}</div>
      </div>
      {item.client_id && (
        <Link to={`/clients/${item.client_id}`} className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-600 md:block">
          Προβολή
        </Link>
      )}
    </div>
  );
}

function groupNotifications(rows) {
  const today = [];
  const older = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  rows.forEach((item) => {
    const created = new Date(item.created_at);
    if (!Number.isNaN(created.getTime()) && created >= start) today.push(item);
    else older.push(item);
  });

  return [
    today.length ? { label: 'Σήμερα', items: today } : null,
    older.length ? { label: 'Προηγούμενες', items: older } : null,
  ].filter(Boolean);
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'payments') return String(item.type || '').includes('payment');
  if (filter === 'subscriptions') return String(item.type || '').includes('subscription');
  if (filter === 'updates') return String(item.type || '').includes('update');
  if (filter === 'clients') return String(item.type || '').includes('client');
  return true;
}

function iconForType(type = '') {
  if (type.includes('payment')) return '€';
  if (type.includes('subscription')) return '⏱';
  if (type.includes('message')) return '@';
  if (type.includes('update')) return '!';
  if (type.includes('client')) return '+';
  return '•';
}

function toneForType(type = '') {
  if (type.includes('approved')) return { bubble: 'bg-green-50', text: 'text-green-600' };
  if (type.includes('payment')) return { bubble: 'bg-amber-50', text: 'text-amber-600' };
  if (type.includes('subscription')) return { bubble: 'bg-red-50', text: 'text-red-600' };
  if (type.includes('update')) return { bubble: 'bg-blue-50', text: 'text-blue-600' };
  return { bubble: 'bg-slate-100', text: 'text-slate-600' };
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
}
