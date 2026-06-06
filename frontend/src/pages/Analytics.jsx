import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';

const navSections = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Πελάτες', href: '/clients' },
  { label: 'Βιβλιοθήκη Ασκήσεων', href: '/exercises' },
  { label: 'Media Library', href: '/media-library' },
  { label: 'Team', href: '/team' },
  { label: 'Analytics', href: '/analytics', active: true },
  { label: 'Updates Πελατών', href: '/updates' },
  { label: 'Discord', href: '#' },
  { label: 'Ειδοποιήσεις', href: '/notifications' },
  { label: 'Ρυθμίσεις', href: '#' },
];

const periodData = {
  week: {
    title: 'Αυτή η εβδομάδα',
    revenueLabel: 'Έσοδα εβδομάδας',
    annualRevenue: '€21.740',
    comparison: '+6.1%',
    activeSubscriptions: 98,
    pendingAmount: '€240',
    churnRate: '1.1%',
    endingSoon: 4,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: 'Δευ', value: 120 },
      { label: 'Τρι', value: 80 },
      { label: 'Τετ', value: 160 },
      { label: 'Πεμ', value: 220 },
      { label: 'Παρ', value: 100 },
      { label: 'Σαβ', value: 0 },
      { label: 'Κυρ', value: 0 },
    ],
    clients: [
      { label: 'Δευ', value: 2 },
      { label: 'Τρι', value: 1 },
      { label: 'Τετ', value: 3 },
      { label: 'Πεμ', value: 2 },
      { label: 'Παρ', value: 1 },
      { label: 'Σαβ', value: 0 },
      { label: 'Κυρ', value: 0 },
    ],
  },
  month: {
    title: 'Αυτός ο μήνας',
    revenueLabel: 'Μηνιαία έσοδα',
    annualRevenue: '€21.740',
    comparison: '+12.4%',
    activeSubscriptions: 98,
    pendingAmount: '€390',
    churnRate: '2.4%',
    endingSoon: 12,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: '1η εβδ.', value: 1320 },
      { label: '2η εβδ.', value: 1680 },
      { label: '3η εβδ.', value: 1490 },
      { label: '4η εβδ.', value: 2120 },
    ],
    clients: [
      { label: '1η εβδ.', value: 7 },
      { label: '2η εβδ.', value: 10 },
      { label: '3η εβδ.', value: 6 },
      { label: '4η εβδ.', value: 12 },
    ],
  },
  quarter: {
    title: 'Τρέχον τρίμηνο',
    revenueLabel: 'Έσοδα τριμήνου',
    annualRevenue: '€21.740',
    comparison: '+8.7%',
    activeSubscriptions: 98,
    pendingAmount: '€740',
    churnRate: '3.8%',
    endingSoon: 18,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: 'Απρ', value: 5140 },
      { label: 'Μαι', value: 6220 },
      { label: 'Ιουν', value: 6610 },
    ],
    clients: [
      { label: 'Απρ', value: 18 },
      { label: 'Μαι', value: 23 },
      { label: 'Ιουν', value: 35 },
    ],
  },
  year: {
    title: 'Τρέχον έτος',
    revenueLabel: 'Ετήσια τάση εσόδων',
    annualRevenue: '€21.740',
    comparison: '+18.2%',
    activeSubscriptions: 98,
    pendingAmount: '€1.120',
    churnRate: '6.5%',
    endingSoon: 32,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: 'Ιαν', value: 2620 },
      { label: 'Φεβ', value: 3180 },
      { label: 'Μαρ', value: 3560 },
      { label: 'Απρ', value: 5140 },
      { label: 'Μαι', value: 6220 },
      { label: 'Ιουν', value: 6610 },
    ],
    clients: [
      { label: 'Ιαν', value: 9 },
      { label: 'Φεβ', value: 12 },
      { label: 'Μαρ', value: 14 },
      { label: 'Απρ', value: 18 },
      { label: 'Μαι', value: 23 },
      { label: 'Ιουν', value: 35 },
    ],
  },
};

const payments = [
  { client: 'Νίκος Αντωνίου', plan: 'Premium Coaching', amount: 120, date: '01/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Μαρία Καραλή', plan: 'Nutrition + Training', amount: 95, date: '02/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Κώστας Δημητρίου', plan: 'Premium Coaching', amount: 120, date: '03/06/2026', status: 'pending', renewal: false, subscription: 'ending' },
  { client: 'Έλενα Παπαδάκη', plan: 'Training Plan', amount: 70, date: '04/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Αλέξανδρος Παπαδόπουλος', plan: 'Nutrition Plan', amount: 65, date: '05/06/2026', status: 'failed', renewal: false, subscription: 'inactive' },
  { client: 'Δήμητρα Ιωάννου', plan: 'Premium Coaching', amount: 120, date: '06/06/2026', status: 'pending', renewal: false, subscription: 'ending' },
  { client: 'Γιάννης Παπαδόπουλος', plan: 'Training Plan', amount: 70, date: '07/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Σοφία Νικολάου', plan: 'Premium Coaching', amount: 120, date: '08/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Πέτρος Λάμπρου', plan: 'Nutrition + Training', amount: 95, date: '09/06/2026', status: 'failed', renewal: false, subscription: 'inactive' },
  { client: 'Άννα Γεωργίου', plan: 'Premium Coaching', amount: 120, date: '10/06/2026', status: 'paid', renewal: true, subscription: 'active' },
  { client: 'Μιχάλης Σταύρου', plan: 'Training Plan', amount: 70, date: '11/06/2026', status: 'pending', renewal: false, subscription: 'ending' },
  { client: 'Ιωάννα Πέτρου', plan: 'Nutrition Plan', amount: 65, date: '12/06/2026', status: 'paid', renewal: true, subscription: 'active' },
];

const clientRevenue = [
  { client: 'Νίκος Αντωνίου', revenue: '€480', payments: 4 },
  { client: 'Μαρία Καραλή', revenue: '€380', payments: 4 },
  { client: 'Κώστας Δημητρίου', revenue: '€360', payments: 3 },
  { client: 'Έλενα Παπαδάκη', revenue: '€280', payments: 4 },
  { client: 'Δήμητρα Ιωάννου', revenue: '€240', payments: 2 },
];

function Avatar() {
  return (
    <div className="w-11 h-11 rounded-full bg-slate-200 border border-white shadow-sm overflow-hidden flex items-center justify-center text-xs font-bold text-slate-700">
      CA
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="w-72 bg-[#061421] text-white fixed left-0 top-0 h-full shadow-2xl z-30">
      <div className="h-full flex flex-col">
        <div className="px-6 py-7 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full border-4 border-red-500 text-red-500 flex items-center justify-center text-2xl font-black">K</div>
          <div className="font-bold text-xl">COACH PANEL</div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-2">
          {navSections.map((item) => {
            const className = item.active
              ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
              : 'text-slate-100 hover:bg-white/10';

            if (item.href === '#') {
              return (
                <button key={item.label} className={`w-full text-left px-5 py-4 rounded-md font-semibold transition ${className}`}>
                  {item.label}
                </button>
              );
            }

            return (
              <Link key={item.label} to={item.href} className={`block px-5 py-4 rounded-md font-semibold transition ${className}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-5 flex items-center gap-3">
          <Avatar />
          <div>
            <div className="font-semibold">Coach Admin</div>
            <div className="text-sm text-green-400">● Online</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ sidebarOpen, onToggle }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-slate-200 h-[73px] flex items-center justify-between px-7 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-6">
        <MenuToggle isOpen={sidebarOpen} onClick={onToggle} />
        <h1 className="text-2xl font-bold text-slate-950">Analytics</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function Analytics() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [period, setPeriod] = useState('month');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [subscriptionStatus, setSubscriptionStatus] = useState('all');
  const [view, setView] = useState('all');
  const [visiblePayments, setVisiblePayments] = useState(10);

  const selectedPeriod = periodData[period];
  const totalRevenue = selectedPeriod.revenue.reduce((sum, point) => sum + point.value, 0);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesPayment = paymentStatus === 'all' || payment.status === paymentStatus;
      const matchesSubscription = subscriptionStatus === 'all' || payment.subscription === subscriptionStatus;
      return matchesPayment && matchesSubscription;
    });
  }, [paymentStatus, subscriptionStatus]);

  const visibleRows = filteredPayments.slice(0, visiblePayments);
  const paidCount = filteredPayments.filter((payment) => payment.status === 'paid').length;
  const unpaidCount = filteredPayments.filter((payment) => payment.status !== 'paid').length;
  const showFinancials = view === 'all' || view === 'revenue';
  const showClients = view === 'all' || view === 'clients';
  const showPayments = view === 'all' || view === 'payments';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar />}

      <div className={`min-h-screen transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
        <Topbar sidebarOpen={sidebarOpen} onToggle={() => setSidebarOpen((value) => !value)} />

        <main className="p-7 space-y-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Link to="/dashboard" className="text-blue-600 font-semibold">Dashboard</Link>
                <span>›</span>
                <span>Analytics</span>
              </div>
              <h2 className="text-3xl font-bold">Analytics</h2>
              <p className="text-slate-600 mt-2">Οικονομικά, πελάτες και πληρωμές με φίλτρα περιόδου.</p>
            </div>
            <button className="h-12 px-5 rounded-md bg-red-600 text-white font-semibold shadow-lg shadow-red-900/20">
              Σύνδεση Stripe
            </button>
          </div>

          <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
              <FilterSelect label="Περίοδος" value={period} onChange={setPeriod} options={[
                ['week', 'Εβδομάδα'],
                ['month', 'Μήνας'],
                ['quarter', 'Τρίμηνο'],
                ['year', 'Έτος'],
              ]} />
              <FilterSelect label="Πληρωμές" value={paymentStatus} onChange={setPaymentStatus} options={[
                ['all', 'Όλα τα status'],
                ['paid', 'Paid'],
                ['pending', 'Pending'],
                ['failed', 'Failed'],
              ]} />
              <FilterSelect label="Συνδρομές" value={subscriptionStatus} onChange={setSubscriptionStatus} options={[
                ['all', 'Όλες'],
                ['active', 'Ενεργές'],
                ['ending', 'Λήγουν σύντομα'],
                ['inactive', 'Ανενεργές'],
              ]} />
              <FilterSelect label="Προβολή" value={view} onChange={setView} options={[
                ['all', 'Όλα'],
                ['revenue', 'Οικονομικά'],
                ['clients', 'Πελάτες'],
                ['payments', 'Πληρωμές'],
              ]} />
              <FilterSelect label="Πληρωμές ανά προβολή" value={visiblePayments} onChange={(value) => setVisiblePayments(Number(value))} options={[
                [5, '5'],
                [10, '10'],
                [20, '20'],
                [50, '50'],
              ]} />
              <button
                className="h-[54px] self-end rounded-md border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setPeriod('month');
                  setPaymentStatus('all');
                  setSubscriptionStatus('all');
                  setView('all');
                  setVisiblePayments(10);
                }}
              >
                Reset
              </button>
            </div>
          </section>

          {showFinancials && (
            <section className="space-y-4">
              <SectionHeader title="Οικονομικά" subtitle={selectedPeriod.title} />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <MetricCard title={selectedPeriod.revenueLabel} value={`€${totalRevenue.toLocaleString('el-GR')}`} hint="Σύνολο περιόδου" />
                <MetricCard title="Ετήσια έσοδα" value={selectedPeriod.annualRevenue} hint="YTD" />
                <MetricCard title="Σύγκριση" value={selectedPeriod.comparison} hint="Με προηγούμενη περίοδο" tone="green" />
                <MetricCard title="Ενεργές συνδρομές" value={selectedPeriod.activeSubscriptions} hint="Πληρώνουν τώρα" />
                <MetricCard title="Pending / unpaid" value={selectedPeriod.pendingAmount} hint="Θέλουν έλεγχο" tone="amber" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg">{selectedPeriod.revenueLabel}</h3>
                    <span className="text-sm text-slate-500">{selectedPeriod.title}</span>
                  </div>
                  <LineChart data={selectedPeriod.revenue} prefix="€" />
                </Card>
                <Card>
                  <h3 className="font-bold text-lg mb-5">Έσοδα ανά πελάτη</h3>
                  <div className="space-y-4">
                    {clientRevenue.map((item) => (
                      <RevenueRow key={item.client} item={item} />
                    ))}
                  </div>
                </Card>
              </div>
            </section>
          )}

          {showClients && (
            <section className="space-y-4">
              <SectionHeader title="Πελάτες" subtitle="Νέοι πελάτες, churn και συνδρομές που λήγουν." />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard title="Νέοι πελάτες" value={selectedPeriod.clients.reduce((sum, point) => sum + point.value, 0)} hint={selectedPeriod.title} />
                <MetricCard title="Ενεργοί vs ανενεργοί" value={`${selectedPeriod.activeClients}/${selectedPeriod.inactiveClients}`} hint="Ενεργοί / ανενεργοί" />
                <MetricCard title="Churn rate" value={selectedPeriod.churnRate} hint="Πελάτες που έφυγαν" tone="red" />
                <MetricCard title="Λήγουν αυτή την εβδομάδα" value={selectedPeriod.endingSoon} hint="Χρειάζονται follow-up" tone="amber" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <Card className="xl:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg">Νέοι πελάτες ανά περίοδο</h3>
                    <span className="text-sm text-slate-500">{selectedPeriod.title}</span>
                  </div>
                  <BarChart data={selectedPeriod.clients} />
                </Card>
                <Card>
                  <h3 className="font-bold text-lg mb-5">Ενεργοί vs ανενεργοί</h3>
                  <div className="flex items-center justify-center py-2">
                    <Donut active={selectedPeriod.activeClients} inactive={selectedPeriod.inactiveClients} />
                  </div>
                  <Legend items={[
                    ['Ενεργοί', selectedPeriod.activeClients, 'bg-green-500'],
                    ['Ανενεργοί', selectedPeriod.inactiveClients, 'bg-red-500'],
                  ]} />
                </Card>
              </div>
            </section>
          )}

          {showPayments && (
            <section className="space-y-4">
              <SectionHeader
                title="Πληρωμές"
                subtitle={`Εμφανίζονται ${visibleRows.length} από ${filteredPayments.length} πληρωμές. Paid: ${paidCount}, unpaid: ${unpaidCount}.`}
              />
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr className="text-sm text-slate-600">
                        <th className="px-5 py-4 font-semibold">Πελάτης</th>
                        <th className="px-5 py-4 font-semibold">Πρόγραμμα</th>
                        <th className="px-5 py-4 font-semibold">Ποσό</th>
                        <th className="px-5 py-4 font-semibold">Ημερομηνία</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Ανανέωση</th>
                        <th className="px-5 py-4 font-semibold">Ενέργειες</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRows.map((payment) => (
                        <tr key={`${payment.client}-${payment.date}`} className="hover:bg-slate-50">
                          <td className="px-5 py-4 font-semibold">{payment.client}</td>
                          <td className="px-5 py-4 text-slate-600">{payment.plan}</td>
                          <td className="px-5 py-4 font-bold">€{payment.amount}</td>
                          <td className="px-5 py-4 text-slate-600">{payment.date}</td>
                          <td className="px-5 py-4"><StatusBadge status={payment.status} /></td>
                          <td className="px-5 py-4">{payment.renewal ? 'Ενεργή' : 'Όχι'}</td>
                          <td className="px-5 py-4">
                            <button className="px-3 py-2 rounded-md border border-slate-200 text-sm font-semibold hover:bg-slate-50">
                              Υπενθύμιση
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <IntegrationItem title="Stripe integration" text="Έτοιμη θέση για σύνδεση κάρτας και webhooks." />
                  <IntegrationItem title="Αυτόματη ανανέωση" text="Θα δένει με τη συνδρομή κάθε πελάτη." />
                  <IntegrationItem title="Υπενθυμίσεις" text="Αποστολή σε pending ή failed πληρωμές." />
                </div>
              </Card>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function MetricCard({ title, value, hint, tone = 'slate' }) {
  const colors = {
    slate: 'text-slate-950',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  };

  return (
    <Card>
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 text-3xl font-black ${colors[tone]}`}>{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </Card>
  );
}

function LineChart({ data, prefix = '' }) {
  const max = Math.max(...data.map((point) => point.value), 1);
  const min = Math.min(...data.map((point) => point.value), 0);
  const padding = Math.max(100, Math.round((max - min) * 0.15));
  const chartMax = max + padding;
  const chartMin = Math.max(0, min - padding);
  const range = Math.max(chartMax - chartMin, 1);
  const plot = { left: 9, right: 98, top: 8, bottom: 78 };

  const getX = (index) => {
    if (data.length === 1) return plot.left;
    return plot.left + (index / (data.length - 1)) * (plot.right - plot.left);
  };
  const getY = (value) => plot.bottom - ((value - chartMin) / range) * (plot.bottom - plot.top);
  const points = data.map((point, index) => `${getX(index)},${getY(point.value)}`).join(' ');
  const areaPoints = `${plot.left},${plot.bottom} ${points} ${plot.right},${plot.bottom}`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const value = chartMin + range * step;
    return {
      value,
      y: getY(value),
    };
  });

  return (
    <div className="rounded-lg border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-4">
      <svg viewBox="0 0 100 88" className="h-72 w-full overflow-visible">
        <defs>
          <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.26" />
            <stop offset="72%" stopColor="#2563eb" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
          <filter id="revenueShadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#2563eb" floodOpacity="0.16" />
          </filter>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.y}>
            <line x1={plot.left} x2={plot.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeWidth="0.45" />
            <text x="0.5" y={tick.y + 1.2} className="fill-slate-400 text-[3px] font-semibold">
              {prefix}{Math.round(tick.value).toLocaleString('el-GR')}
            </text>
          </g>
        ))}

        <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} stroke="#cbd5e1" strokeWidth="0.5" />
        <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} stroke="#cbd5e1" strokeWidth="0.5" />

        <polygon points={areaPoints} fill="url(#revenueArea)" />
        <polyline
          points={points}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#revenueShadow)"
        />

        {data.map((point, index) => {
          const x = getX(index);
          const y = getY(point.value);
          const isLast = index === data.length - 1;
          return (
            <g key={point.label}>
              <line x1={x} x2={x} y1={plot.bottom} y2={plot.bottom + 1.7} stroke="#cbd5e1" strokeWidth="0.45" />
              <text x={x} y="86" textAnchor="middle" className="fill-slate-500 text-[3.2px] font-bold">
                {point.label}
              </text>
              {isLast && (
                <g>
                  <rect x={Math.max(plot.left, x - 13)} y={Math.max(plot.top, y - 9.5)} width="25" height="7.5" rx="2" fill="#0f172a" />
                  <text x={Math.max(plot.left, x - 0.5)} y={Math.max(plot.top + 5, y - 4.2)} textAnchor="middle" className="fill-white text-[3px] font-bold">
                    {prefix}{point.value.toLocaleString('el-GR')}
                  </text>
                </g>
              )}
              <circle cx={x} cy={y} r="2.1" fill="#ffffff" stroke="#2563eb" strokeWidth="1.2" />
            </g>
          );
        })}
      </svg>

      <div className="mt-3 grid gap-2 text-xs text-slate-500" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((point) => (
          <div key={point.label} className="rounded-md bg-white px-2 py-2 text-center shadow-sm ring-1 ring-slate-100">
            <div className="font-bold text-slate-600">{point.label}</div>
            <div className="mt-1 font-black text-slate-950">{prefix}{point.value.toLocaleString('el-GR')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div className="h-72 flex items-end gap-4">
      {data.map((point) => (
        <div key={point.label} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full bg-blue-100 rounded-t-md flex items-end h-56">
            <div
              className="w-full bg-blue-600 rounded-t-md min-h-[10px]"
              style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }}
            />
          </div>
          <div className="text-xs font-semibold text-slate-600">{point.label}</div>
          <div className="text-xs text-slate-500">{point.value}</div>
        </div>
      ))}
    </div>
  );
}

function Donut({ active, inactive }) {
  const total = active + inactive;
  const activePercent = total ? Math.round((active / total) * 100) : 0;

  return (
    <div
      className="w-44 h-44 rounded-full flex items-center justify-center"
      style={{ background: `conic-gradient(#22c55e 0 ${activePercent}%, #ef4444 ${activePercent}% 100%)` }}
    >
      <div className="w-28 h-28 rounded-full bg-white flex flex-col items-center justify-center">
        <div className="text-3xl font-black">{activePercent}%</div>
        <div className="text-xs text-slate-500">ενεργοί</div>
      </div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="space-y-3 mt-5">
      {items.map(([label, value, color]) => (
        <div key={label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${color}`} />
            <span className="text-slate-600">{label}</span>
          </div>
          <span className="font-bold">{value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueRow({ item }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold">{item.client}</div>
        <div className="text-sm text-slate-500">{item.payments} πληρωμές</div>
      </div>
      <div className="font-black">{item.revenue}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const labels = {
    paid: 'Paid',
    pending: 'Pending',
    failed: 'Failed',
  };
  const styles = {
    paid: 'bg-green-50 text-green-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-red-50 text-red-700',
  };

  return (
    <span className={`px-3 py-1 rounded-md text-xs font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function IntegrationItem({ title, text }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="font-bold">{title}</div>
      <p className="text-sm text-slate-500 mt-2">{text}</p>
    </div>
  );
}
