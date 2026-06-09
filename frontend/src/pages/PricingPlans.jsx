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
  { label: 'Team', path: '/team' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Ειδοποιήσεις', path: '/notifications' },
  {
    label: 'Ρυθμίσεις',
    adminOnly: true,
    children: [
      { label: 'Discord' },
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans', active: true },
      { label: 'Branding' },
    ],
  },
];

const menuSections = [
  { label: 'Dashboard', path: '/dashboard' },
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
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans', active: true },
      { label: 'Branding' },
    ],
  },
];

const emptyPlan = {
  name: 'Νέο Πλάνο',
  badge: '',
  description: '',
  price: 49,
  currency: 'EUR',
  period: 'Μηνιαίο',
  themeColor: '#EF4444',
  features: [
    { text: 'Προπονητικό πλάνο', included: true },
    { text: 'Διατροφικό πλάνο', included: true },
  ],
  isActive: true,
  sortOrder: 0,
};

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
}

function Sidebar({ user }) {
  const settingsIsActive = menuSections.some((section) => section.children?.some((child) => child.active));
  const [settingsOpen, setSettingsOpen] = useState(settingsIsActive);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {menuSections.filter((section) => !section.adminOnly || user?.role === 'admin').map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'}`;
            const item = section.children ? (
              <button onClick={() => setSettingsOpen((value) => !value)} className={className}>
                <span>{section.label}</span>
                <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            ) : section.path ? <Link to={section.path} className={className}>{section.label}</Link> : <button className={className}>{section.label}</button>;
            return (
              <div key={section.label} className={section.spacerBefore ? 'mt-6' : ''}>
                {item}
                {section.children && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => {
                      const childClass = `flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold ${child.active ? 'bg-red-600/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`;
                      return child.path ? <Link key={child.label} to={child.path} className={childClass}>{child.label}</Link> : <button key={child.label} className={childClass}>{child.label}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
        <div>
          <h1 className="text-2xl font-extrabold">Ρυθμίσεις</h1>
          <div className="mt-1 text-sm font-semibold text-slate-500">Dashboard / Ρυθμίσεις / Πλάνα & Τιμές</div>
        </div>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function PricingPlans() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [plans, setPlans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyPlan);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedId) || null, [plans, selectedId]);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedPlan) setForm(selectedPlan);
  }, [selectedPlan]);

  const loadPlans = async () => {
    try {
      const rows = await api.get('/pricing-plans');
      setPlans(rows);
      if (rows.length) {
        setSelectedId(rows[0].id);
        setForm(rows[0]);
      }
    } catch (err) {
      setError(err.message || 'Δεν φορτώθηκαν τα πλάνα.');
    }
  };

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updateFeature = (index, key, value) => {
    update('features', form.features.map((feature, featureIndex) => featureIndex === index ? { ...feature, [key]: value } : feature));
  };

  const savePlan = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form, price: Number(form.price || 0) };
      const saved = form.id ? await api.put(`/pricing-plans/${form.id}`, payload) : await api.post('/pricing-plans', payload);
      setMessage('Το πλάνο αποθηκεύτηκε.');
      await loadPlans();
      setSelectedId(saved.id);
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε το πλάνο.');
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async () => {
    if (!form.id || !window.confirm('Να διαγραφεί αυτό το πλάνο;')) return;
    setSaving(true);
    try {
      await api.delete(`/pricing-plans/${form.id}`);
      setMessage('Το πλάνο διαγράφηκε.');
      setForm(emptyPlan);
      setSelectedId(null);
      await loadPlans();
    } catch (err) {
      setError(err.message || 'Δεν διαγράφηκε το πλάνο.');
    } finally {
      setSaving(false);
    }
  };

  const newPlan = () => {
    setSelectedId(null);
    setForm({ ...emptyPlan, sortOrder: plans.length + 1 });
  };

  if (user?.role !== 'admin') {
    return <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500">Δεν έχεις πρόσβαση σε αυτή τη σελίδα.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />
      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black">Διαχείριση Πλάνων & Τιμών</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500">Δημιούργησε και διαχειρίσου τα πλάνα συνδρομής που βλέπουν οι πελάτες σου.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={newPlan} className="h-11 rounded-md bg-red-600 px-5 font-black text-white shadow-lg shadow-red-200 hover:bg-red-700">+ Νέο Πλάνο</button>
              <button className="h-11 rounded-md border border-slate-200 bg-white px-5 font-bold text-slate-700">Προεπισκόπηση</button>
            </div>
          </div>

          {message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
          {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-6 xl:grid-cols-[290px_1fr]">
              <aside className="rounded-lg border border-slate-200 p-4">
                <h3 className="font-black">Πλάνα Συνδρομής</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">Σύρε για αλλαγή σειράς εμφάνισης</p>
                <div className="mt-5 space-y-3">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedId(plan.id)}
                      className={`flex h-12 w-full items-center justify-between rounded-md border px-4 text-left font-bold ${selectedId === plan.id ? 'border-red-500 bg-red-50 text-slate-950' : 'border-slate-200 hover:border-red-200'}`}
                    >
                      <span className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.themeColor }} />{plan.name}</span>
                      <span className="text-slate-400">⋮⋮</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="rounded-lg border border-slate-200 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-lg font-black">Επεξεργασία Πλάνου</h3>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                      Ενεργό
                      <input type="checkbox" checked={form.isActive} onChange={(event) => update('isActive', event.target.checked)} className="h-5 w-5 accent-emerald-500" />
                    </label>
                    <button onClick={deletePlan} disabled={!form.id || saving} className="h-10 rounded-md border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 disabled:opacity-40">Διαγραφή</button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
                  <div className="space-y-4">
                    <Input label="Όνομα Πλάνου" value={form.name} onChange={(value) => update('name', value)} />
                    <Input label="Badge / Ετικέτα" value={form.badge} onChange={(value) => update('badge', value)} placeholder="Πιο δημοφιλές" />
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Περιγραφή</span>
                      <textarea value={form.description} onChange={(event) => update('description', event.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-slate-200 p-3 outline-none focus:border-red-300" />
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                      <Input label="Τιμή" type="number" value={form.price} onChange={(value) => update('price', value)} />
                      <Select label="Νόμισμα" value={form.currency} onChange={(value) => update('currency', value)} options={['EUR', 'USD', 'GBP']} />
                      <Select label="Περίοδος" value={form.period} onChange={(value) => update('period', value)} options={['Μηνιαίο', '2 μήνες', '3 μήνες', '4 μήνες', 'Ετήσιο']} />
                    </div>
                    <label className="block">
                      <span className="text-sm font-bold text-slate-700">Χρώμα Θέματος</span>
                      <div className="mt-2 flex h-12 items-center gap-3 rounded-md border border-slate-200 px-3">
                        <input type="color" value={form.themeColor} onChange={(event) => update('themeColor', event.target.value)} className="h-7 w-7 rounded border-0 p-0" />
                        <input value={form.themeColor} onChange={(event) => update('themeColor', event.target.value)} className="flex-1 outline-none" />
                      </div>
                    </label>
                  </div>

                  <div>
                    <h4 className="mb-4 font-black">Χαρακτηριστικά Πλάνου</h4>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      {form.features.map((feature, index) => (
                        <div key={index} className="grid grid-cols-[28px_36px_1fr_34px] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                          <span className="text-slate-400">⋮⋮</span>
                          <button onClick={() => updateFeature(index, 'included', !feature.included)} className={`text-lg font-black ${feature.included ? 'text-emerald-600' : 'text-red-600'}`}>{feature.included ? '✓' : '×'}</button>
                          <input value={feature.text} onChange={(event) => updateFeature(index, 'text', event.target.value)} className="h-10 rounded-md border border-transparent px-2 outline-none focus:border-red-200" />
                          <button onClick={() => update('features', form.features.filter((_, i) => i !== index))} className="text-slate-400 hover:text-red-600">×</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => update('features', [...form.features, { text: 'Νέο χαρακτηριστικό', included: true }])} className="mt-4 h-11 rounded-md border border-slate-200 px-5 font-bold text-slate-700 hover:border-red-200 hover:text-red-600">+ Προσθήκη χαρακτηριστικού</button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button onClick={savePlan} disabled={saving} className="h-11 rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700 disabled:bg-slate-400">{saving ? 'Αποθήκευση...' : 'Αποθήκευση Πλάνου'}</button>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-black">Προεπισκόπηση Κάρτας</h3>
              <div className="mt-5 rounded-lg border border-slate-200 p-4">
                <PlanPreview plan={form} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-black">Συμβουλές</h3>
              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-600">
                <p>• Σύρε τα πλάνα για να αλλάξεις τη σειρά εμφάνισης τους στη σελίδα εγγραφής.</p>
                <p>• Η ετικέτα “Πιο δημοφιλές” θα εμφανίζεται στο πλάνο που επιλέγεις.</p>
                <p>• Τα ανενεργά πλάνα δεν εμφανίζονται στο τελευταίο βήμα της φόρμας.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function PlanPreview({ plan }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="relative rounded-lg border p-6 text-center" style={{ borderColor: plan.themeColor }}>
        {plan.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-md px-3 py-1 text-xs font-black text-white" style={{ backgroundColor: plan.themeColor }}>{plan.badge}</div>}
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full text-2xl" style={{ backgroundColor: `${plan.themeColor}18`, color: plan.themeColor }}>🏆</div>
        <h4 className="mt-4 text-2xl font-black" style={{ color: plan.themeColor }}>{plan.name || 'Πλάνο'}</h4>
        <p className="mx-auto mt-3 max-w-56 text-sm leading-6 text-slate-600">{plan.description}</p>
        <div className="mt-5 text-3xl font-black">€{plan.price}<span className="text-base font-bold text-slate-500"> /{formatPlanPeriod(plan.period)}</span></div>
        <button className="mt-5 h-11 w-full rounded-md font-black text-white" style={{ backgroundColor: plan.themeColor }}>Επιλέγω {plan.name}</button>
      </div>
      <div className="space-y-4 py-3">
        {plan.features.map((feature, index) => (
          <div key={index} className="flex items-center gap-4 text-sm font-semibold text-slate-700">
            <span className={feature.included ? 'text-emerald-600' : 'text-red-600'}>{feature.included ? '✓' : '×'}</span>
            {feature.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPlanPeriod(period) {
  if (!period) return 'μήνα';
  const normalized = String(period).toLowerCase();
  if (normalized.includes('μηνια') || normalized.includes('monthly')) return 'μήνα';
  return period;
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300" />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
