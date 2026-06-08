import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';

const navSections = [
  { label: 'Dashboard', path: '/dashboard', active: true },
  { label: 'Πελάτες', path: '/clients' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
  {
    label: 'Ρυθμίσεις',
    adminOnly: true,
    children: [
      { label: 'Discord' },
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans' },
      { label: 'Branding' },
    ],
  },
];

const stats = [
  { label: 'Σύνολο Πελατών', value: '124', note: '+8 αυτόν τον μήνα', icon: '👥', color: 'text-blue-600' },
  { label: 'Ενεργοί Πελάτες', value: '98', note: '79% του συνόλου', icon: '◌', color: 'text-indigo-600' },
  { label: 'Λήγουν Σύντομα', value: '12', note: 'Εντός 7 ημερών', icon: '◷', color: 'text-amber-500' },
  { label: 'Ανενεργοί Πελάτες', value: '14', note: 'Ανενεργοί', icon: '⊖', color: 'text-red-500' },
  { label: 'Νέα Updates', value: '7', note: 'Εκκρεμούν έλεγχος', icon: '☑', color: 'text-sky-600' },
];

const updates = [
  { name: 'Νίκος Αντωνίου', date: '18/05/2024', weight: '78.4 kg', initials: 'ΝΑ', tone: 'bg-slate-900' },
  { name: 'Μαρία Καραλή', date: '18/05/2024', weight: '65.2 kg', initials: 'ΜΚ', tone: 'bg-rose-500' },
  { name: 'Κώστας Δημητρίου', date: '18/05/2024', weight: '84.1 kg', initials: 'ΚΔ', tone: 'bg-orange-600' },
  { name: 'Έλενα Παπαδάκη', date: '18/05/2024', weight: '58.6 kg', initials: 'ΕΠ', tone: 'bg-zinc-800' },
];

const topClients = [
  { name: 'Νίκος Αντωνίου', change: '-2.4 kg', initials: 'ΝΑ', tone: 'bg-slate-900' },
  { name: 'Κώστας Δημητρίου', change: '-1.8 kg', initials: 'ΚΔ', tone: 'bg-orange-600' },
  { name: 'Μαρία Καραλή', change: '-1.2 kg', initials: 'ΜΚ', tone: 'bg-rose-500' },
];

const tasks = [
  { label: 'Έλεγχος 7 νέων updates', done: true },
  { label: 'Έλεγχος εκκρεμών συνδρομών' },
  { label: 'Ενημέρωση προγράμματος πελατών', done: true },
  { label: 'Αποστολή υπενθυμίσεων' },
];

const quickActions = [
  { label: 'Προσθήκη Νέου Πελάτη', icon: '♟', color: 'text-orange-600' },
  { label: 'Δημιουργία Προγράμματος Προπόνησης', icon: '▌▌', color: 'text-blue-600' },
  { label: 'Δημιουργία Προγράμματος Διατροφής', icon: '●', color: 'text-green-600' },
  { label: 'Αποστολή Μηνύματος', icon: '✉', color: 'text-indigo-600' },
];

const chartPoints = [
  [8, 24],
  [18, 24],
  [28, 30],
  [39, 42],
  [50, 42],
  [60, 49],
  [70, 58],
  [80, 58],
  [88, 72],
  [96, 60],
  [98, 60],
];

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-10 w-10' }) {
  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function ViewAllButton({ children = 'Προβολή όλων' }) {
  return (
    <button className="mt-5 h-11 w-full rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-600">
      {children}
    </button>
  );
}

function Sidebar({ user }) {
  const settingsIsActive = navSections.some((section) => section.children?.some((child) => child.active));
  const [settingsOpen, setSettingsOpen] = React.useState(settingsIsActive);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">
          K
        </div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections.filter((section) => !section.adminOnly || user?.role === 'admin').map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              section.active
                ? 'bg-red-600 text-white shadow-lg shadow-red-950/30'
                : 'text-slate-100 hover:bg-white/10'
            }`;

            const item = section.children ? (
              <button onClick={() => setSettingsOpen((value) => !value)} className={className}>
                <span className="truncate">{section.label}</span>
                <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            ) : section.path ? (
              <Link to={section.path} className={className}>
                <span className="truncate">{section.label}</span>
              </Link>
            ) : (
              <button className={className}>
                <span className="truncate">{section.label}</span>
              </button>
            );

            return (
              <div key={section.label} className={section.spacerBefore ? 'mt-6' : ''}>
                {item}
                {section.children && user?.role === 'admin' && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => (
                      child.path ? (
                        <Link key={child.label} to={child.path} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</Link>
                      ) : (
                        <button key={child.label} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</button>
                      )
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <Avatar initials={(user?.fullName || 'Coach Admin').slice(0, 2).toUpperCase()} tone="bg-red-600" size="h-12 w-12" />
          <div>
            <div className="font-bold">{user?.fullName || 'Coach Admin'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Online
            </div>
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
        <h1 className="text-2xl font-extrabold">Dashboard</h1>
      </div>

      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

function WeightChart() {
  const polyline = chartPoints.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <Card className="p-6 lg:col-span-5">
      <div className="mb-7 flex items-start justify-between">
        <h2 className="text-lg font-extrabold">Γράφημα Βάρους (Όλοι οι Πελάτες)</h2>
        <button className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300">
          Τελευταίες 30 ημέρες⌄
        </button>
      </div>
      <div className="relative h-[250px]">
        <div className="absolute inset-x-0 top-0 h-px bg-slate-100" />
        <div className="absolute inset-x-0 top-1/4 h-px bg-slate-100" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-100" />
        <div className="absolute inset-x-0 top-3/4 h-px bg-slate-100" />
        <div className="absolute left-0 top-0 flex h-full flex-col justify-between text-sm text-slate-500">
          <span>90</span>
          <span>85</span>
          <span>80</span>
          <span>75</span>
          <span>70</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute left-10 right-0 top-4 h-[185px] w-[calc(100%-2.5rem)] overflow-visible">
          <polyline points={polyline} fill="none" stroke="#2563eb" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          {chartPoints.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" fill="#2563eb" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="absolute bottom-0 left-10 right-0 flex justify-between text-sm text-slate-500">
          <span>01/04</span>
          <span>08/04</span>
          <span>15/04</span>
          <span>22/04</span>
          <span>29/04</span>
        </div>
      </div>
    </Card>
  );
}

function SubscriptionCard() {
  return (
    <Card className="p-6 lg:col-span-4">
      <h2 className="text-lg font-extrabold">Κατάσταση Συνδρομών</h2>
      <div className="mt-9 flex items-center gap-10">
        <div className="relative h-44 w-44 shrink-0 rounded-full bg-[conic-gradient(#22c55e_0_79%,#fbbf24_79%_89%,#ef4444_89%_100%)]">
          <div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center">
            <div>
              <div className="text-sm text-slate-500">Σύνολο</div>
              <div className="text-3xl font-extrabold">124</div>
            </div>
          </div>
        </div>
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full bg-green-500" /> Ενεργοί <span className="ml-5 text-slate-500">98 (79%)</span></div>
          <div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full bg-amber-400" /> Λήγουν <span className="ml-6 text-slate-500">12 (10%)</span></div>
          <div className="flex items-center gap-3"><span className="h-4 w-4 rounded-full bg-red-500" /> Ανενεργοί <span className="ml-2 text-slate-500">14 (11%)</span></div>
        </div>
      </div>
      <ViewAllButton />
    </Card>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-extrabold">Καλωσήρθες, Coach! 👋</h2>
              <p className="mt-2 text-lg text-slate-600">Εδώ είναι μια συνοπτική εικόνα της επιχείρησής σου.</p>
            </div>
            <button className="flex h-12 items-center gap-3 rounded-md bg-red-600 px-6 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
              <span className="text-2xl leading-none">＋</span>
              Προσθήκη Νέου
            </button>
          </div>

          <div className="grid grid-cols-5 gap-5">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center gap-5">
                  <span className={`grid h-8 w-8 place-items-center text-2xl ${stat.color}`}>{stat.icon}</span>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </div>
                <div className="mt-5 text-3xl font-extrabold">{stat.value}</div>
                <div className="mt-3 text-sm text-slate-600">{stat.note}</div>
              </Card>
            ))}
          </div>

          <div id="progress" className="mt-6 grid scroll-mt-28 grid-cols-12 gap-6">
            <WeightChart />

            <Card className="p-6 lg:col-span-3">
              <h2 className="text-lg font-extrabold">Τελευταία Updates</h2>
              <div className="mt-5 space-y-4">
                {updates.map((update) => (
                  <div key={update.name} className="flex items-center gap-4">
                    <Avatar initials={update.initials} tone={update.tone} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{update.name}</div>
                      <div className="text-sm text-slate-500">{update.date}</div>
                    </div>
                    <div className="font-extrabold">{update.weight}</div>
                  </div>
                ))}
              </div>
              <ViewAllButton />
            </Card>

            <SubscriptionCard />

            <Card className="p-6 lg:col-span-4">
              <h2 className="text-lg font-extrabold">Κορυφαίοι Πελάτες (Αυτόν τον Μήνα)</h2>
              <div className="mt-7 space-y-6">
                {topClients.map((client, index) => (
                  <div key={client.name} className="flex items-center gap-5">
                    <div className="w-6 text-2xl font-extrabold">{index + 1}</div>
                    <Avatar initials={client.initials} tone={client.tone} />
                    <div className="min-w-0 flex-1 truncate font-bold">{client.name}</div>
                    <div className="font-extrabold text-emerald-600">{client.change}</div>
                  </div>
                ))}
              </div>
              <ViewAllButton />
            </Card>

            <Card className="p-6 lg:col-span-4">
              <h2 className="text-lg font-extrabold">Σημερινές Εργασίες</h2>
              <div className="mt-5 space-y-3">
                {tasks.map((task) => (
                  <label key={task.label} className="flex h-11 items-center gap-4 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700">
                    <input type="checkbox" defaultChecked={task.done} className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                    {task.label}
                  </label>
                ))}
              </div>
              <button className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-600">
                <span>▦</span>
                Προβολή Ημερολογίου
              </button>
            </Card>

            <Card className="p-6 lg:col-span-4">
              <h2 className="text-lg font-extrabold">Γρήγορες Ενέργειες</h2>
              <div className="mt-5 space-y-3">
                {quickActions.map((action) => (
                  <button key={action.label} className="flex h-11 w-full items-center gap-5 rounded-md border border-slate-200 px-5 text-left text-sm font-medium text-slate-700 hover:border-red-200 hover:text-red-600">
                    <span className={`grid h-5 w-5 place-items-center text-xl ${action.color}`}>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

