import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions, clearUnreadNotifications } from '../components/TopbarControls';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Discord' },
  { label: 'Ειδοποιήσεις', path: '/notifications', active: true },
  { label: 'Ρυθμίσεις' },
];

const menuSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Ειδοποιήσεις', path: '/notifications', active: true, spacerBefore: true },
];

const notificationGroups = [];

const filters = [
  { label: 'Όλες', value: 'all' },
  { label: 'Πληρωμές', value: 'payments' },
  { label: 'Συνδρομές', value: 'subscriptions' },
  { label: 'Updates', value: 'updates' },
  { label: 'Πελάτες', value: 'clients' },
];

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
        <h1 className="text-2xl font-extrabold">Ειδοποιήσεις</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function Notifications() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [activeFilter, setActiveFilter] = React.useState('all');

  React.useEffect(() => {
    clearUnreadNotifications();
  }, []);

  const visibleGroups = notificationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => matchesFilter(item, activeFilter)),
    }))
    .filter((group) => group.items.length > 0);

  const totalNotifications = notificationGroups.reduce((sum, group) => sum + group.items.length, 0);
  const visibleNotifications = visibleGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-7">
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
              <SummaryCard label="Σύνολο" value={totalNotifications} />
              <SummaryCard label="Σε προβολή" value={visibleNotifications} />
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

          <section className="max-w-5xl space-y-5">
            {visibleGroups.map((group) => (
              <div key={group.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 text-xs font-extrabold uppercase tracking-wide text-slate-500">{group.label}</div>
                <div className="divide-y divide-slate-200">
                  {group.items.map((item) => (
                    <NotificationRow key={item.id} item={item} />
                  ))}
                </div>
              </div>
            ))}

            {!visibleGroups.length && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
                <div className="text-lg font-extrabold">Δεν υπάρχουν ειδοποιήσεις για αυτό το φίλτρο.</div>
                <p className="mt-2 text-sm text-slate-500">Δοκίμασε διαφορετική κατηγορία.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
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
      <div className={`mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full ${toneClasses[item.tone]?.bubble || toneClasses.slate.bubble}`}>
        <NotificationIcon type={item.type} tone={item.tone} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-6">
          <span className="font-extrabold">{item.title}</span>
          <span className="font-semibold text-slate-800"> — {item.detail}</span>
        </div>
        <div className="mt-1 text-sm font-semibold text-slate-500">{item.time}</div>
      </div>
      <Link to={`/clients/${item.clientId}`} className="hidden rounded-md border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:border-red-200 hover:text-red-600 md:block">
        Προβολή
      </Link>
    </div>
  );
}

function NotificationIcon({ type, tone }) {
  const labels = {
    paymentFailed: '€',
    paymentPaid: '€',
    subscription: '⏱',
    updateMissing: '!',
    reward: '%',
    newClient: '+',
    message: '@',
  };

  return <span className={`text-sm font-black ${toneClasses[tone]?.text || toneClasses.slate.text}`}>{labels[type] || '•'}</span>;
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true;
  if (filter === 'payments') return item.type === 'paymentFailed' || item.type === 'paymentPaid';
  if (filter === 'subscriptions') return item.type === 'subscription';
  if (filter === 'updates') return item.type === 'updateMissing' || item.type === 'message';
  if (filter === 'clients') return item.type === 'newClient' || item.type === 'reward';
  return true;
}

const toneClasses = {
  red: { bubble: 'bg-red-50', text: 'text-red-600' },
  amber: { bubble: 'bg-amber-50', text: 'text-amber-600' },
  green: { bubble: 'bg-green-50', text: 'text-green-600' },
  purple: { bubble: 'bg-violet-50', text: 'text-violet-600' },
  blue: { bubble: 'bg-blue-50', text: 'text-blue-600' },
  slate: { bubble: 'bg-slate-100', text: 'text-slate-600' },
};
