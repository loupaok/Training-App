import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';
import { api } from '../services/api';

const API_ORIGIN = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients', active: true },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
  {
    label: 'Ρυθμίσεις',
    adminOnly: true,
    spacerBefore: true,
    children: [
      { label: 'Discord' },
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans' },
      { label: 'Branding' },
    ],
  },
];

const dayLabels = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${String(url).replace(/^\/+/, '')}`;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('el-GR');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
}

function getInitials(name) {
  return String(name || 'CL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CL';
}

function money(amount, currency = 'EUR') {
  if (amount === null || amount === undefined || amount === '') return '-';
  return `${Number(amount).toFixed(2)} ${currency || 'EUR'}`;
}

function statusMeta(client) {
  const userStatus = client?.user_status || client?.status;
  const paymentStatus = client?.payments?.[0]?.status;
  const subscriptionStatus = client?.subscription?.status;

  if (userStatus === 'active' || subscriptionStatus === 'active') {
    return { label: 'Ενεργός', className: 'bg-emerald-50 text-emerald-700' };
  }
  if (userStatus === 'pending_payment' || paymentStatus === 'pending') {
    return { label: 'Εκκρεμής', className: 'bg-amber-50 text-amber-700' };
  }
  return { label: 'Ανενεργός', className: 'bg-red-50 text-red-700' };
}

function Avatar({ initials, photoUrl, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  const src = resolveMediaUrl(photoUrl);
  if (src) return <img src={src} alt="" className={`${size} rounded-full object-cover shadow-sm`} />;
  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

function Sidebar({ user }) {
  const canSeeAdmin = user?.role === 'admin' || user?.role === 'coach';
  const settingsIsActive = navSections.some((section) => section.children?.some((child) => child.active));
  const [settingsOpen, setSettingsOpen] = useState(settingsIsActive);

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections.filter((section) => !section.adminOnly || canSeeAdmin).map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              section.active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'
            }`;

            return (
              <div key={section.label} className={section.spacerBefore ? 'mt-6' : ''}>
                {section.children ? (
                  <button type="button" onClick={() => setSettingsOpen((value) => !value)} className={className}>
                    <span className="truncate">{section.label}</span>
                    <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
                  </button>
                ) : (
                  <Link to={section.path} className={className}>
                    <span className="truncate">{section.label}</span>
                  </Link>
                )}

                {section.children && canSeeAdmin && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => (
                      child.path ? (
                        <Link key={child.label} to={child.path} className="flex h-10 items-center rounded-md px-4 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</Link>
                      ) : (
                        <button key={child.label} type="button" className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</button>
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
          <Avatar initials={(user?.fullName || 'CA').slice(0, 2).toUpperCase()} tone="bg-red-600" />
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
        <h1 className="text-2xl font-extrabold">Καρτέλα Πελάτη</h1>
      </div>
      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

export default function ClientDetail() {
  const { user, logout } = useAuth();
  const { clientId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.get(`/clients/${clientId}`)
      .then(setClient)
      .catch((err) => setError(err.message || 'Δεν φορτώθηκε ο πελάτης.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const onboarding = client?.onboarding || {};
  const displayName = client?.full_name || client?.email || 'Πελάτης';
  const currentStatus = useMemo(() => statusMeta(client), [client]);
  const updateDay = client?.updateSchedule?.day_of_week ?? onboarding.update_day;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm font-bold">
            <Link to="/dashboard" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
            <span className="text-slate-400">/</span>
            <Link to="/clients" className="text-blue-600 hover:text-blue-700">Πελάτες</Link>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{displayName}</span>
          </div>

          {loading && <StateBox text="Φόρτωση πελάτη..." />}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}

          {!loading && client && (
            <div className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <Avatar initials={getInitials(displayName)} photoUrl={client.profile_photo} size="h-28 w-28" />
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-3xl font-black">{displayName}</h2>
                        <span className={`rounded-md px-3 py-1.5 text-sm font-bold ${currentStatus.className}`}>
                          {currentStatus.label}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
                        <span>{client.email || '-'}</span>
                        <span>{client.phone || '-'}</span>
                        <span>Μέλος από: {formatDate(client.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Τρέχον βάρος" value={client.weight_kg ? `${client.weight_kg} kg` : '-'} />
                    <Metric label="Στόχος" value={client.fitness_goal || onboarding.goal || '-'} />
                    <Metric label="Επόμενο update" value={client.updateSchedule?.next_due_date ? formatDate(client.updateSchedule.next_due_date) : '-'} />
                    <Metric label="Ημέρα update" value={updateDay === null || updateDay === undefined ? '-' : dayLabels[Number(updateDay)]} />
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <InfoCard title="Στοιχεία">
                  <Info label="Ημερομηνία γέννησης" value={formatDate(client.date_of_birth || onboarding.date_of_birth)} />
                  <Info label="Ύψος" value={client.height_cm ? `${client.height_cm} cm` : '-'} />
                  <Info label="Φύλο" value={client.gender || '-'} />
                  <Info label="Ιατρικές σημειώσεις" value={client.medical_notes || '-'} />
                </InfoCard>

                <InfoCard title="Συνδρομή">
                  <Info label="Κατάσταση" value={client.subscription?.status || currentStatus.label} />
                  <Info label="Έναρξη" value={formatDate(client.subscription?.start_date)} />
                  <Info label="Λήξη" value={formatDate(client.subscription?.end_date)} />
                  <Info label="Πακέτο" value={onboarding.selected_package || '-'} />
                </InfoCard>

                <InfoCard title="Social Media">
                  {client.socialLinks?.length ? (
                    client.socialLinks.map((item) => <Info key={`${item.platform}-${item.url}`} label={item.platform} value={item.url} />)
                  ) : (
                    <EmptyInline text="Δεν υπάρχουν social links." />
                  )}
                </InfoCard>
              </section>

              <InfoCard title="Onboarding φόρμα">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Info label="Επάγγελμα / πρόγραμμα" value={onboarding.occupation_schedule || '-'} />
                  <Info label="Πρόβλημα υγείας" value={onboarding.health_problem || '-'} />
                  <Info label="Τραυματισμοί" value={onboarding.injuries || '-'} />
                  <Info label="Κύκλος" value={onboarding.cycle_history || '-'} />
                  <Info label="Αερόβιες / εβδομάδα" value={onboarding.cardio_sessions_per_week || '-'} />
                  <Info label="Ύπνος" value={onboarding.sleep_schedule || '-'} />
                  <Info label="Προπόνηση τώρα" value={onboarding.current_training_plan || '-'} />
                  <Info label="Διατροφή τώρα" value={onboarding.current_nutrition_plan || '-'} />
                  <Info label="Ιστορικό πλάνων" value={onboarding.previous_plan_history || '-'} />
                </div>
              </InfoCard>

              <section className="grid gap-6 xl:grid-cols-2">
                <ListCard title="Πληρωμές">
                  {client.payments?.length ? client.payments.map((payment) => (
                    <DataRow
                      key={payment.id}
                      title={money(payment.amount, payment.currency)}
                      meta={formatDateTime(payment.created_at)}
                      badge={payment.status || '-'}
                    />
                  )) : <EmptyRow text="Δεν υπάρχουν πληρωμές ακόμα." />}
                </ListCard>

                <ListCard title="Εβδομαδιαία updates">
                  {client.weeklyUpdates?.length ? client.weeklyUpdates.map((update) => (
                    <DataRow
                      key={update.id}
                      title={update.weight_kg ? `${update.weight_kg} kg` : 'Update'}
                      meta={formatDateTime(update.submitted_at)}
                      badge={`${update.training_score || '-'} / ${update.nutrition_score || '-'}`}
                      description={update.notes}
                    />
                  )) : <EmptyRow text="Δεν υπάρχουν εβδομαδιαία updates ακόμα." />}
                </ListCard>
              </section>

              <ListCard title="Progress updates">
                {client.progressUpdates?.length ? client.progressUpdates.map((update) => (
                  <DataRow
                    key={update.id}
                    title={update.weight_kg ? `${update.weight_kg} kg` : 'Progress update'}
                    meta={formatDateTime(update.submitted_at)}
                    badge={update.photos?.length ? `${update.photos.length} φωτογραφίες` : 'Χωρίς φωτογραφίες'}
                    description={update.notes}
                  />
                )) : <EmptyRow text="Δεν υπάρχει progress ακόμα." />}
              </ListCard>

              <InfoCard title="Ιδιωτικές σημειώσεις coach">
                <div className="min-h-24 rounded-md bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
                  {client.coach_notes || 'Δεν υπάρχουν σημειώσεις coach.'}
                </div>
              </InfoCard>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StateBox({ text }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
      {text}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-black uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black">{value || '-'}</div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function ListCard({ title, children }) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-black">{title}</h2>
      </div>
      <div className="divide-y divide-slate-200">{children}</div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{value || '-'}</div>
    </div>
  );
}

function DataRow({ title, meta, badge, description }) {
  return (
    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="font-black text-slate-950">{title}</div>
        <div className="mt-1 text-sm font-semibold text-slate-500">{meta}</div>
        {description && <div className="mt-2 text-sm font-semibold text-slate-700">{description}</div>}
      </div>
      <div className="w-fit rounded-md bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">{badge}</div>
    </div>
  );
}

function EmptyRow({ text }) {
  return <div className="p-5 text-sm font-semibold text-slate-500">{text}</div>;
}

function EmptyInline({ text }) {
  return <div className="text-sm font-semibold text-slate-500">{text}</div>;
}
