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
const tabs = [
  { id: 'overview', label: 'Επισκόπηση' },
  { id: 'payments', label: 'Ιστορικό Πληρωμών' },
  { id: 'training', label: 'Πρόγραμμα Προπόνησης' },
  { id: 'nutrition', label: 'Πρόγραμμα Διατροφής' },
];

const emptyTrainingDay = (dayOfWeek) => ({
  dayOfWeek,
  title: dayLabels[dayOfWeek],
  notes: '',
  exercises: [],
});

const defaultTrainingPlan = () => ({
  title: 'Πρόγραμμα Προπόνησης',
  description: '',
  durationWeeks: 4,
  difficulty: 'intermediate',
  days: [1, 2, 3, 4, 5, 6, 0].map(emptyTrainingDay),
});

const defaultNutritionPlan = () => ({
  title: 'Πρόγραμμα Διατροφής',
  description: '',
  dailyCalories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  notes: '',
  meals: [
    { mealType: 'breakfast', title: 'Πρωινό', notes: '', foods: [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }] },
    { mealType: 'lunch', title: 'Μεσημεριανό', notes: '', foods: [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }] },
    { mealType: 'snack', title: 'Σνακ', notes: '', foods: [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }] },
    { mealType: 'dinner', title: 'Βραδινό', notes: '', foods: [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }] },
  ],
});

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

function normalizeTrainingPlan(plan) {
  const base = defaultTrainingPlan();
  if (!plan?.id && !plan?.days?.length) return base;
  const daysByWeek = new Map((plan.days || []).map((day) => [Number(day.day_of_week ?? day.dayOfWeek), day]));

  return {
    title: plan.title || base.title,
    description: plan.description || '',
    durationWeeks: plan.duration_weeks || plan.durationWeeks || 4,
    difficulty: plan.difficulty || 'intermediate',
    days: base.days.map((defaultDay) => {
      const source = daysByWeek.get(defaultDay.dayOfWeek);
      return {
        dayOfWeek: defaultDay.dayOfWeek,
        title: source?.title || defaultDay.title,
        notes: source?.notes || '',
        exercises: (source?.exercises || []).map((exercise) => ({
          exerciseId: exercise.exercise_id || exercise.exerciseId || '',
          exerciseName: exercise.exercise_name || exercise.exerciseName || '',
          muscleGroup: exercise.muscle_group || exercise.muscleGroup || '',
          sets: exercise.sets || '',
          reps: exercise.reps || '',
          tempo: exercise.tempo || '',
          restSeconds: exercise.rest_seconds || exercise.restSeconds || '',
          targetWeight: exercise.target_weight || exercise.targetWeight || '',
          notes: exercise.notes || '',
        })),
      };
    }),
  };
}

function normalizeNutritionPlan(plan) {
  const base = defaultNutritionPlan();
  if (!plan?.id && !plan?.meals?.length) return base;

  return {
    title: plan.title || base.title,
    description: plan.description || '',
    dailyCalories: plan.daily_calories || '',
    proteinG: plan.protein_g || '',
    carbsG: plan.carbs_g || '',
    fatG: plan.fat_g || '',
    notes: plan.notes || '',
    meals: (plan.meals?.length ? plan.meals : base.meals).map((meal) => ({
      mealType: meal.meal_type || meal.mealType || 'other',
      title: meal.title || '',
      notes: meal.notes || '',
      foods: (meal.foods?.length ? meal.foods : [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }]).map((food) => ({
        foodName: food.food_name || food.foodName || '',
        quantity: food.quantity || '',
        calories: food.calories || '',
        proteinG: food.protein_g || food.proteinG || '',
        carbsG: food.carbs_g || food.carbsG || '',
        fatG: food.fat_g || food.fatG || '',
      })),
    })),
  };
}

function Avatar({ initials, photoUrl, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  const src = resolveMediaUrl(photoUrl);
  if (src) return <img src={src} alt="" className={`${size} rounded-full object-cover shadow-sm`} />;
  return <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>{initials}</div>;
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
                  <Link to={section.path} className={className}><span className="truncate">{section.label}</span></Link>
                )}
                {section.children && canSeeAdmin && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => (
                      child.path
                        ? <Link key={child.label} to={child.path} className="flex h-10 items-center rounded-md px-4 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</Link>
                        : <button key={child.label} type="button" className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</button>
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
  const [activeTab, setActiveTab] = useState('overview');
  const [client, setClient] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [trainingPlan, setTrainingPlan] = useState(defaultTrainingPlan);
  const [nutritionPlan, setNutritionPlan] = useState(defaultNutritionPlan);
  const [loading, setLoading] = useState(true);
  const [savingTraining, setSavingTraining] = useState(false);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [approvingPayment, setApprovingPayment] = useState(false);
  const [rejectingPaymentId, setRejectingPaymentId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadClientDetail();
  }, [clientId]);

  const loadClientDetail = () => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/clients/${clientId}`),
      api.get('/exercises').catch(() => []),
      api.get(`/training-plans/${clientId}/full`).catch(() => ({ days: [] })),
      api.get(`/nutrition-plans/${clientId}/full`).catch(() => ({ meals: [] })),
    ])
      .then(([clientData, exerciseRows, trainingData, nutritionData]) => {
        setClient(clientData);
        setExercises(Array.isArray(exerciseRows) ? exerciseRows : []);
        setTrainingPlan(normalizeTrainingPlan(trainingData));
        setNutritionPlan(normalizeNutritionPlan(nutritionData));
      })
      .catch((err) => setError(err.message || 'Δεν φορτώθηκε ο πελάτης.'))
      .finally(() => setLoading(false));
  };

  const onboarding = client?.onboarding || {};
  const displayName = client?.full_name || client?.email || 'Πελάτης';
  const currentStatus = useMemo(() => statusMeta(client), [client]);
  const updateDay = client?.updateSchedule?.day_of_week ?? onboarding.update_day;

  const saveTrainingPlan = async () => {
    setSavingTraining(true);
    setMessage('');
    setError('');
    try {
      const response = await api.put(`/training-plans/${clientId}/full`, trainingPlan);
      setTrainingPlan(normalizeTrainingPlan(response.plan));
      setMessage('Το πρόγραμμα προπόνησης αποθηκεύτηκε.');
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε το πρόγραμμα προπόνησης.');
    } finally {
      setSavingTraining(false);
    }
  };

  const saveNutritionPlan = async () => {
    setSavingNutrition(true);
    setMessage('');
    setError('');
    try {
      const response = await api.put(`/nutrition-plans/${clientId}/full`, nutritionPlan);
      setNutritionPlan(normalizeNutritionPlan(response.plan));
      setMessage('Το πρόγραμμα διατροφής αποθηκεύτηκε.');
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε το πρόγραμμα διατροφής.');
    } finally {
      setSavingNutrition(false);
    }
  };

  const approvePayment = async (paymentId) => {
    const confirmed = window.confirm('Θέλεις να εγκρίνεις χειροκίνητα την πληρωμή και να ενεργοποιηθεί ο πελάτης;');
    if (!confirmed) return;

    setApprovingPayment(true);
    setMessage('');
    setError('');
    try {
      await api.post(`/clients/${clientId}/approve-payment`, { paymentId });
      setMessage('Η πληρωμή εγκρίθηκε και ο πελάτης ενεργοποιήθηκε.');
      loadClientDetail();
    } catch (err) {
      setError(err.message || 'Δεν εγκρίθηκε η πληρωμή.');
    } finally {
      setApprovingPayment(false);
    }
  };

  const rejectPayment = async (paymentId) => {
    const confirmed = window.confirm('Θέλεις σίγουρα να απορρίψεις αυτή την πληρωμή; Ο πελάτης θα ενημερωθεί.');
    if (!confirmed) return;

    setRejectingPaymentId(paymentId);
    setMessage('');
    setError('');
    try {
      await api.post(`/clients/${clientId}/reject-payment`, { paymentId });
      setMessage('Η πληρωμή απορρίφθηκε και ο πελάτης ενημερώθηκε.');
      loadClientDetail();
    } catch (err) {
      setError(err.message || 'Δεν απορρίφθηκε η πληρωμή.');
    } finally {
      setRejectingPaymentId(null);
    }
  };

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
          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}
          {message && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-700">{message}</div>}

          {!loading && client && (
            <div className="space-y-6">
              <ClientHeader client={client} displayName={displayName} currentStatus={currentStatus} onboarding={onboarding} updateDay={updateDay} />

              {currentStatus.label !== 'Ενεργός' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-amber-900">Ο πελάτης δεν έχει ενεργή πληρωμή</h3>
                      <p className="mt-1 text-sm font-bold text-amber-800">
                        Κατάσταση: {currentStatus.label}. Τα προγράμματα μπορεί να υπάρχουν, αλλά ο πελάτης θα τα βλέπει κλειδωμένα μέχρι να εγκριθεί η πληρωμή του.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`w-fit rounded-md px-4 py-2 text-sm font-black ${currentStatus.className}`}>
                        {currentStatus.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`h-11 rounded-md px-5 text-sm font-black transition ${activeTab === tab.id ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'overview' && (
                <OverviewTab client={client} onboarding={onboarding} currentStatus={currentStatus} onApprovePayment={approvePayment} onRejectPayment={rejectPayment} approvingPayment={approvingPayment} rejectingPaymentId={rejectingPaymentId} />
              )}

              {activeTab === 'payments' && (
                <PaymentsTab client={client} onApprovePayment={approvePayment} onRejectPayment={rejectPayment} approvingPayment={approvingPayment} rejectingPaymentId={rejectingPaymentId} />
              )}

              {activeTab === 'training' && (
                <TrainingPlanEditor
                  plan={trainingPlan}
                  setPlan={setTrainingPlan}
                  exercises={exercises}
                  onSave={saveTrainingPlan}
                  saving={savingTraining}
                />
              )}

              {activeTab === 'nutrition' && (
                <NutritionPlanEditor
                  plan={nutritionPlan}
                  setPlan={setNutritionPlan}
                  onSave={saveNutritionPlan}
                  saving={savingNutrition}
                />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ClientHeader({ client, displayName, currentStatus, onboarding, updateDay }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar initials={getInitials(displayName)} photoUrl={client.profile_photo} size="h-28 w-28" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black">{displayName}</h2>
              <span className={`rounded-md px-3 py-1.5 text-sm font-bold ${currentStatus.className}`}>{currentStatus.label}</span>
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
  );
}

function OverviewTab({ client, onboarding, currentStatus, onApprovePayment, onRejectPayment, approvingPayment, rejectingPaymentId }) {
  return (
    <div className="space-y-6">
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
          {client.socialLinks?.length ? client.socialLinks.map((item) => <Info key={`${item.platform}-${item.url}`} label={item.platform} value={item.url} />) : <EmptyInline text="Δεν υπάρχουν social links." />}
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
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-black">Πληρωμές</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {client.payments?.length ? client.payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-black text-slate-950">{money(payment.amount, payment.currency)}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(payment.created_at)}</div>
                  {payment.method === 'bank_transfer' && (
                    <div className="mt-1 text-xs font-bold text-slate-400">Τραπεζικό έμβασμα · {payment.reference_number || '-'}</div>
                  )}
                </div>
                <span className={`w-fit rounded-md px-3 py-1 text-sm font-black ${payment.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                  {payment.status === 'completed' ? 'Εγκρίθηκε' : payment.status === 'pending' ? 'Εκκρεμής' : payment.status || '-'}
                </span>
                {payment.status === 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onApprovePayment(payment.id)}
                      disabled={approvingPayment}
                      className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {approvingPayment ? 'Έγκριση...' : 'Έγκριση'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectPayment(payment.id)}
                      disabled={rejectingPaymentId === payment.id}
                      className="h-9 rounded-md border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {rejectingPaymentId === payment.id ? 'Απόρριψη...' : 'Απόρριψη'}
                    </button>
                  </div>
                )}
              </div>
            )) : <div className="p-5 text-sm font-semibold text-slate-500">Δεν υπάρχουν πληρωμές ακόμα.</div>}
          </div>
        </section>
        <ListCard title="Εβδομαδιαία updates">
          {client.weeklyUpdates?.length ? client.weeklyUpdates.map((update) => (
            <DataRow key={update.id} title={update.weight_kg ? `${update.weight_kg} kg` : 'Update'} meta={formatDateTime(update.submitted_at)} badge={`${update.training_score || '-'} / ${update.nutrition_score || '-'}`} description={update.notes} />
          )) : <EmptyRow text="Δεν υπάρχουν εβδομαδιαία updates ακόμα." />}
        </ListCard>
      </section>

      <ListCard title="Progress updates">
        {client.progressUpdates?.length ? client.progressUpdates.map((update) => (
          <DataRow key={update.id} title={update.weight_kg ? `${update.weight_kg} kg` : 'Progress update'} meta={formatDateTime(update.submitted_at)} badge={update.photos?.length ? `${update.photos.length} φωτογραφίες` : 'Χωρίς φωτογραφίες'} description={update.notes} />
        )) : <EmptyRow text="Δεν υπάρχει progress ακόμα." />}
      </ListCard>

      <InfoCard title="Ιδιωτικές σημειώσεις coach">
        <div className="min-h-24 rounded-md bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          {client.coach_notes || 'Δεν υπάρχουν σημειώσεις coach.'}
        </div>
      </InfoCard>
    </div>
  );
}

function PaymentsTab({ client, onApprovePayment, onRejectPayment, approvingPayment, rejectingPaymentId }) {
  const payments = client.payments || [];

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h2 className="text-xl font-black">Ιστορικό Πληρωμών</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Όλες οι πληρωμές του πελάτη και οι χειροκίνητες ενέργειες έγκρισης.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">Ημερομηνία</th>
              <th className="px-5 py-4">Ποσό</th>
              <th className="px-5 py-4">Τρόπος</th>
              <th className="px-5 py-4">Reference</th>
              <th className="px-5 py-4">Αποδεικτικό</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Ενέργειες</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <tr key={payment.id} className="align-top">
                <td className="px-5 py-4 font-semibold text-slate-700">{formatDateTime(payment.created_at)}</td>
                <td className="px-5 py-4 font-black text-slate-950">{money(payment.amount, payment.currency)}</td>
                <td className="px-5 py-4 font-semibold text-slate-700">{payment.method === 'bank_transfer' ? 'Τραπεζικό έμβασμα' : payment.method || '-'}</td>
                <td className="px-5 py-4 font-semibold text-slate-500">{payment.reference_number || '-'}</td>
                <td className="px-5 py-4">
                  {payment.proof_url ? (
                    <a href={resolveMediaUrl(payment.proof_url)} target="_blank" rel="noreferrer" className="font-black text-blue-600 hover:text-blue-700">Προβολή</a>
                  ) : (
                    <span className="font-semibold text-slate-400">-</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  <PaymentStatus status={payment.status} />
                </td>
                <td className="px-5 py-4">
                  {payment.status === 'pending' ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onApprovePayment(payment.id)}
                        disabled={approvingPayment}
                        className="h-9 rounded-md bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {approvingPayment ? 'Έγκριση...' : 'Έγκριση'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRejectPayment(payment.id)}
                        disabled={rejectingPaymentId === payment.id}
                        className="h-9 rounded-md border border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {rejectingPaymentId === payment.id ? 'Απόρριψη...' : 'Απόρριψη'}
                      </button>
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td colSpan="7" className="px-5 py-10 text-center font-semibold text-slate-500">Δεν υπάρχουν πληρωμές ακόμα.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentStatus({ status }) {
  const meta = {
    completed: ['Εγκρίθηκε', 'bg-emerald-50 text-emerald-700'],
    pending: ['Εκκρεμής', 'bg-amber-50 text-amber-700'],
    failed: ['Απορρίφθηκε', 'bg-red-50 text-red-700'],
    refunded: ['Επιστροφή', 'bg-slate-100 text-slate-700'],
  }[status] || [status || '-', 'bg-slate-100 text-slate-700'];

  return <span className={`inline-flex rounded-md px-3 py-1 text-sm font-black ${meta[1]}`}>{meta[0]}</span>;
}

function TrainingPlanEditor({ plan, setPlan, exercises, onSave, saving }) {
  const updateDay = (dayIndex, patch) => {
    setPlan((current) => ({
      ...current,
      days: current.days.map((day, index) => index === dayIndex ? { ...day, ...patch } : day),
    }));
  };

  const addExercise = (dayIndex) => {
    updateDay(dayIndex, {
      exercises: [...plan.days[dayIndex].exercises, { exerciseId: '', exerciseName: '', muscleGroup: '', sets: '', reps: '', tempo: '', restSeconds: '', targetWeight: '', notes: '' }],
    });
  };

  const updateExercise = (dayIndex, exerciseIndex, patch) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, {
      exercises: day.exercises.map((exercise, index) => index === exerciseIndex ? { ...exercise, ...patch } : exercise),
    });
  };

  const removeExercise = (dayIndex, exerciseIndex) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <PlanHeader
        title="Πρόγραμμα Προπόνησης"
        subtitle="Ο admin επιλέγει ασκήσεις από τη βιβλιοθήκη και ο πελάτης τις βλέπει read-only στο δικό του dashboard."
        onSave={onSave}
        saving={saving}
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-4">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <Field label="Διάρκεια εβδομάδες" type="number" value={plan.durationWeeks} onChange={(value) => setPlan({ ...plan, durationWeeks: value })} />
          <SelectField label="Επίπεδο" value={plan.difficulty} onChange={(value) => setPlan({ ...plan, difficulty: value })} options={[['beginner', 'Αρχάριο'], ['intermediate', 'Μεσαίο'], ['advanced', 'Προχωρημένο']]} />
          <Field label="Περιγραφή" value={plan.description} onChange={(value) => setPlan({ ...plan, description: value })} />
        </div>

        {plan.days.map((day, dayIndex) => {
          const muscleGroups = [...new Set(day.exercises.map((exercise) => exercise.muscleGroup).filter(Boolean))];
          return (
            <div key={day.dayOfWeek} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid flex-1 gap-4 md:grid-cols-2">
                  <Field label="Ημέρα" value={day.title} onChange={(value) => updateDay(dayIndex, { title: value })} />
                  <Field label="Οδηγίες ημέρας" value={day.notes} onChange={(value) => updateDay(dayIndex, { notes: value })} />
                </div>
                <div className="min-w-[260px] rounded-md border border-slate-200 bg-white p-3">
                  <div className="text-xs font-black uppercase text-slate-500">Μυϊκές ομάδες ημέρας</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {muscleGroups.length ? muscleGroups.map((group) => <span key={group} className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{group}</span>) : <span className="text-sm font-semibold text-slate-400">Θα συμπληρωθούν αυτόματα.</span>}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {day.exercises.map((exercise, exerciseIndex) => (
                  <div key={`${day.dayOfWeek}-${exerciseIndex}`} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[2fr_0.7fr_0.7fr_0.7fr_0.7fr_1fr_auto]">
                    <label className="block">
                      <span className="text-xs font-black text-slate-500">Άσκηση</span>
                      <select
                        value={exercise.exerciseId}
                        onChange={(event) => {
                          const selected = exercises.find((item) => String(item.id) === event.target.value);
                          updateExercise(dayIndex, exerciseIndex, {
                            exerciseId: selected?.id || '',
                            exerciseName: selected?.name || '',
                            muscleGroup: selected?.muscleGroup || '',
                          });
                        }}
                        className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-red-300"
                      >
                        <option value="">Επιλογή από βιβλιοθήκη</option>
                        {exercises.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.muscleGroup}</option>)}
                      </select>
                    </label>
                    <Field compact label="Sets" value={exercise.sets} onChange={(value) => updateExercise(dayIndex, exerciseIndex, { sets: value })} />
                    <Field compact label="Reps" value={exercise.reps} onChange={(value) => updateExercise(dayIndex, exerciseIndex, { reps: value })} />
                    <Field compact label="Tempo" value={exercise.tempo} onChange={(value) => updateExercise(dayIndex, exerciseIndex, { tempo: value })} />
                    <Field compact label="Rest sec" value={exercise.restSeconds} onChange={(value) => updateExercise(dayIndex, exerciseIndex, { restSeconds: value })} />
                    <Field compact label="Οδηγίες" value={exercise.notes} onChange={(value) => updateExercise(dayIndex, exerciseIndex, { notes: value })} />
                    <button type="button" onClick={() => removeExercise(dayIndex, exerciseIndex)} className="self-end rounded-md border border-red-200 px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50">Διαγραφή</button>
                  </div>
                ))}
                <button type="button" onClick={() => addExercise(dayIndex)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:border-red-200 hover:text-red-600">+ Προσθήκη άσκησης</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NutritionPlanEditor({ plan, setPlan, onSave, saving }) {
  const updateMeal = (mealIndex, patch) => {
    setPlan((current) => ({
      ...current,
      meals: current.meals.map((meal, index) => index === mealIndex ? { ...meal, ...patch } : meal),
    }));
  };

  const updateFood = (mealIndex, foodIndex, patch) => {
    const meal = plan.meals[mealIndex];
    updateMeal(mealIndex, {
      foods: meal.foods.map((food, index) => index === foodIndex ? { ...food, ...patch } : food),
    });
  };

  const addMeal = () => {
    setPlan((current) => ({
      ...current,
      meals: [...current.meals, { mealType: 'other', title: 'Γεύμα', notes: '', foods: [{ foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }] }],
    }));
  };

  const addFood = (mealIndex) => {
    updateMeal(mealIndex, {
      foods: [...plan.meals[mealIndex].foods, { foodName: '', quantity: '', calories: '', proteinG: '', carbsG: '', fatG: '' }],
    });
  };

  const removeMeal = (mealIndex) => {
    setPlan((current) => ({ ...current, meals: current.meals.filter((_, index) => index !== mealIndex) }));
  };

  const removeFood = (mealIndex, foodIndex) => {
    updateMeal(mealIndex, { foods: plan.meals[mealIndex].foods.filter((_, index) => index !== foodIndex) });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <PlanHeader
        title="Πρόγραμμα Διατροφής"
        subtitle="Ένα ενεργό πρόγραμμα διατροφής για τον πελάτη. Το ανανεώνει μόνο ο admin όταν χρειαστεί."
        onSave={onSave}
        saving={saving}
      />
      <div className="space-y-6 p-6">
        <div className="grid gap-4 lg:grid-cols-5">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <Field label="Θερμίδες" type="number" value={plan.dailyCalories} onChange={(value) => setPlan({ ...plan, dailyCalories: value })} />
          <Field label="Πρωτεΐνη g" type="number" value={plan.proteinG} onChange={(value) => setPlan({ ...plan, proteinG: value })} />
          <Field label="Υδατάνθρακες g" type="number" value={plan.carbsG} onChange={(value) => setPlan({ ...plan, carbsG: value })} />
          <Field label="Λίπη g" type="number" value={plan.fatG} onChange={(value) => setPlan({ ...plan, fatG: value })} />
        </div>
        <Field label="Γενικές οδηγίες διατροφής" value={plan.notes} onChange={(value) => setPlan({ ...plan, notes: value })} />

        {plan.meals.map((meal, mealIndex) => (
          <div key={mealIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Γεύμα" value={meal.title} onChange={(value) => updateMeal(mealIndex, { title: value })} />
              <SelectField label="Τύπος" value={meal.mealType} onChange={(value) => updateMeal(mealIndex, { mealType: value })} options={[['breakfast', 'Πρωινό'], ['lunch', 'Μεσημεριανό'], ['snack', 'Σνακ'], ['dinner', 'Βραδινό'], ['other', 'Άλλο']]} />
              <button type="button" onClick={() => removeMeal(mealIndex)} className="self-end rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50">Διαγραφή γεύματος</button>
            </div>
            <Field label="Οδηγίες γεύματος" value={meal.notes} onChange={(value) => updateMeal(mealIndex, { notes: value })} className="mt-4" />

            <div className="mt-4 space-y-3">
              {meal.foods.map((food, foodIndex) => (
                <div key={foodIndex} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto]">
                  <Field compact label="Τρόφιμο" value={food.foodName} onChange={(value) => updateFood(mealIndex, foodIndex, { foodName: value })} />
                  <Field compact label="Ποσότητα" value={food.quantity} onChange={(value) => updateFood(mealIndex, foodIndex, { quantity: value })} />
                  <Field compact label="Kcal" type="number" value={food.calories} onChange={(value) => updateFood(mealIndex, foodIndex, { calories: value })} />
                  <Field compact label="Πρωτ." type="number" value={food.proteinG} onChange={(value) => updateFood(mealIndex, foodIndex, { proteinG: value })} />
                  <Field compact label="Υδ/κες" type="number" value={food.carbsG} onChange={(value) => updateFood(mealIndex, foodIndex, { carbsG: value })} />
                  <Field compact label="Λίπη" type="number" value={food.fatG} onChange={(value) => updateFood(mealIndex, foodIndex, { fatG: value })} />
                  <button type="button" onClick={() => removeFood(mealIndex, foodIndex)} className="self-end rounded-md border border-red-200 px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50">Διαγραφή</button>
                </div>
              ))}
              <button type="button" onClick={() => addFood(mealIndex)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:border-red-200 hover:text-red-600">+ Προσθήκη τροφίμου</button>
            </div>
          </div>
        ))}

        <button type="button" onClick={addMeal} className="h-11 rounded-md border border-slate-200 px-5 text-sm font-black text-slate-700 hover:border-red-200 hover:text-red-600">+ Προσθήκη γεύματος</button>
      </div>
    </section>
  );
}

function PlanHeader({ title, subtitle, onSave, saving }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
      <button type="button" onClick={onSave} disabled={saving} className="h-11 rounded-md bg-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:opacity-60">
        {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', compact = false, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-black text-slate-500">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className={`${compact ? 'h-10' : 'h-11'} mt-1 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-red-300`}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-500">{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-red-300">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function StateBox({ text }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">{text}</div>;
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
