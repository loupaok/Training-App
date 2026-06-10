import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import { clearUnreadNotifications } from '../components/TopbarControls';
import { api } from '../services/api';

export default function ClientNotifications() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    clearUnreadNotifications()
      .catch(() => {})
      .then(() => api.get('/clients/me/notifications'))
      .then(setData)
      .catch((err) => setError(err.message || 'Δεν φορτώθηκαν οι ειδοποιήσεις.'))
      .finally(() => setLoading(false));
  }, []);

  const notifications = useMemo(() => buildClientNotifications(data), [data]);
  const paymentApproved = Boolean(data?.paymentApproved);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <ClientSidebar user={user} paymentApproved={paymentApproved} unreadNotifications={data?.unreadNotifications || 0} active="notifications" />}
      <ClientTopbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Ειδοποιήσεις" />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          <div className="mb-7">
            <h2 className="text-3xl font-extrabold">Ειδοποιήσεις</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Ενημερώσεις που αφορούν μόνο τον δικό σου λογαριασμό.</p>
          </div>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}
          {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Φόρτωση...</div>}

          {!loading && (
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h3 className="text-lg font-black">Οι ενημερώσεις σου</h3>
              </div>
              <div className="divide-y divide-slate-200">
                {notifications.map((item) => (
                  <div key={item.id} className="flex items-start gap-4 px-6 py-5">
                    <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg ${item.tone}`}>{item.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm font-semibold leading-6 text-slate-500">{item.body}</div>
                      <div className="mt-2 text-xs font-bold text-slate-400">{item.date}</div>
                    </div>
                    {item.href && (
                      <Link to={item.href} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-black text-slate-600 hover:border-red-200 hover:text-red-600">
                        Προβολή
                      </Link>
                    )}
                  </div>
                ))}
                {!notifications.length && (
                  <div className="px-6 py-12 text-center font-bold text-slate-500">Δεν υπάρχουν ειδοποιήσεις ακόμα.</div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function buildClientNotifications(data) {
  if (!data) return [];
  const rows = [];

  (data.notifications || []).forEach((item) => {
    rows.push({
      id: `db-${item.id}`,
      title: item.title,
      body: item.body || 'Νέα ενημέρωση από τον coach.',
      date: formatDate(item.created_at),
      href: item.link_url || null,
      icon: iconForType(item.type),
      tone: toneForType(item.type),
    });
  });

  const latestPayment = data.payments?.[0];
  if (latestPayment?.status === 'pending') {
    rows.unshift({
      id: 'payment-pending',
      title: 'Η πληρωμή σου είναι σε εκκρεμότητα',
      body: 'Μόλις εγκριθεί από τον coach, θα ξεκλειδώσουν τα προγράμματα και το progress.',
      date: formatDate(latestPayment.created_at),
      href: '/client-billing',
      icon: '€',
      tone: 'bg-amber-50 text-amber-700',
    });
  }
  if (latestPayment?.status === 'completed') {
    rows.unshift({
      id: 'payment-approved',
      title: 'Η πληρωμή σου εγκρίθηκε',
      body: 'Η συνδρομή σου είναι ενεργή και τα προγράμματα ξεκλειδώθηκαν.',
      date: formatDate(latestPayment.paid_at || latestPayment.created_at),
      href: '/client-dashboard',
      icon: '✓',
      tone: 'bg-emerald-50 text-emerald-700',
    });
  }

  if (data.subscription?.end_date) {
    const daysLeft = daysUntil(data.subscription.end_date);
    if (daysLeft >= 0 && daysLeft <= 7) {
      rows.unshift({
        id: 'subscription-ending',
        title: `Η συνδρομή σου λήγει σε ${daysLeft} ημέρες`,
        body: 'Μπορείς να ανανεώσεις από τη σελίδα Πληρωμές και Συνδρομή.',
        date: formatDate(data.subscription.end_date),
        href: '/client-billing',
        icon: '⏱',
        tone: 'bg-red-50 text-red-700',
      });
    }
  }

  if (data.training?.updated_at) {
    rows.push({
      id: 'training-updated',
      title: 'Ενημερώθηκε το πρόγραμμα προπόνησης',
      body: 'Ο coach έκανε αλλαγές στο προπονητικό σου πλάνο.',
      date: formatDate(data.training.updated_at),
      href: '/client-dashboard',
      icon: '▌',
      tone: 'bg-blue-50 text-blue-700',
    });
  }
  if (data.nutrition?.updated_at) {
    rows.push({
      id: 'nutrition-updated',
      title: 'Ενημερώθηκε η διατροφή σου',
      body: 'Ο coach έκανε αλλαγές στο διατροφικό σου πλάνο.',
      date: formatDate(data.nutrition.updated_at),
      href: '/client-dashboard',
      icon: '●',
      tone: 'bg-emerald-50 text-emerald-700',
    });
  }

  return rows;
}

function iconForType(type = '') {
  if (type.includes('payment')) return '€';
  if (type.includes('subscription')) return '⏱';
  if (type.includes('message')) return '✉';
  if (type.includes('nutrition')) return '●';
  if (type.includes('training')) return '▌';
  return '•';
}

function toneForType(type = '') {
  if (type.includes('payment')) return 'bg-amber-50 text-amber-700';
  if (type.includes('subscription')) return 'bg-red-50 text-red-700';
  if (type.includes('message')) return 'bg-blue-50 text-blue-700';
  if (type.includes('nutrition')) return 'bg-emerald-50 text-emerald-700';
  if (type.includes('training')) return 'bg-indigo-50 text-indigo-700';
  return 'bg-slate-100 text-slate-600';
}

function formatDate(value) {
  if (!value) return 'Σήμερα';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Σήμερα';
  return date.toLocaleDateString('el-GR');
}

function daysUntil(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}
