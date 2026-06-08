import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const steps = [
  { key: 'details', title: 'Στοιχεία' },
  { key: 'questions', title: 'Ερωτήσεις' },
  { key: 'plans', title: 'Πλάνα & Τιμές' },
];

const countryCodes = ['+30', '+357', '+44', '+49', '+1'];
const goals = ['Γράμμωση', 'Όγκος', 'Απώλεια κιλών', 'Συντήρηση', 'Αύξηση δύναμης', 'Βελτίωση φυσικής κατάστασης'];
const genders = ['Άνδρας', 'Γυναίκα', 'Άλλο'];
const activityLevels = ['Χαμηλή δραστηριότητα', 'Μέτρια δραστηριότητα', 'Υψηλή δραστηριότητα', 'Πολύ υψηλή δραστηριότητα'];
const updateDays = [
  { value: 1, label: 'Δευτέρα' },
  { value: 2, label: 'Τρίτη' },
  { value: 3, label: 'Τετάρτη' },
  { value: 4, label: 'Πέμπτη' },
  { value: 5, label: 'Παρασκευή' },
  { value: 6, label: 'Σάββατο' },
  { value: 0, label: 'Κυριακή' },
];
const fallbackPackages = [
  { value: '2_months', title: '2 μήνες', price: '190€', note: 'Ιδανικό ξεκίνημα', features: [] },
  { value: '3_months', title: '3 μήνες', price: '270€', note: 'Σταθερή πρόοδος', features: [] },
  { value: '4_months', title: '4 μήνες', price: '320€', note: 'Καλύτερη αξία', features: [] },
];

function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export default function ClientOnboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const initialName = splitName(user?.fullName || '');
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    firstName: initialName.firstName,
    lastName: initialName.lastName,
    email: user?.email || '',
    countryCode: '+30',
    phone: '',
    dateOfBirth: '',
    gender: 'Άνδρας',
    heightCm: '',
    weightKg: '',
    activityLevel: 'Μέτρια δραστηριότητα',
    goal: 'Γράμμωση',
    updateDay: '1',
    healthProblem: '',
    medication: '',
    injuries: '',
    surgery: '',
    otherInfo: '',
    trainingExperience: 'Ναι, 1-2 χρόνια',
    weeklyTraining: '3-4 φορές',
    trainingType: 'Βάρη / Μυϊκή ενδυνάμωση',
    trainingDuration: 'Περίπου 1.5 χρόνο',
    dietType: 'Όχι συγκεκριμένη',
    mealsPerDay: '3 κύρια + 1-2 σνακ',
    allergies: 'Καμία',
    occupationSchedule: '',
    cycleHistory: '',
    cardioSessionsPerWeek: '',
    sleepSchedule: '',
    currentTrainingPlan: '',
    currentNutritionPlan: '',
    previousPlanHistory: '',
    subscriptionPackage: '3_months',
    paymentMethod: 'bank_transfer',
  });
  const [flags, setFlags] = useState({ healthProblem: 'no', medication: 'no', injuries: 'no', surgery: 'no', otherInfo: 'no' });
  const [socials, setSocials] = useState({ instagram: '', tiktok: '', facebook: '', youtube: '' });
  const [files, setFiles] = useState({ frontPhoto: null, sidePhoto: null, backPhoto: null, trainingPlanPdf: null, nutritionPlanPdf: null, previousPlanPdf: null, bloodTestsPdf: null });
  const [pricingPlans, setPricingPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeStep = steps[stepIndex];
  const fullName = `${form.firstName} ${form.lastName}`.trim();
  const subscriptionOptions = useMemo(() => {
    if (!pricingPlans.length) return fallbackPackages;
    return pricingPlans.map((plan) => ({
      value: plan.slug,
      title: plan.name,
      price: `${plan.price}€`,
      note: plan.description,
      badge: plan.badge,
      color: plan.themeColor,
      period: plan.period,
      features: plan.features || [],
    }));
  }, [pricingPlans]);

  useEffect(() => {
    api.get('/pricing-plans?active=true')
      .then((plans) => {
        setPricingPlans(plans);
        if (plans.length) updateForm('subscriptionPackage', plans[0].slug);
      })
      .catch(() => {});
  }, []);

  const updateForm = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const updateFlag = (name, value) => setFlags((current) => ({ ...current, [name]: value }));
  const updateFile = (name, file) => setFiles((current) => ({ ...current, [name]: file }));

  const validateStep = () => {
    if (activeStep.key === 'details') return form.firstName && form.lastName && form.email && form.phone && form.dateOfBirth && form.heightCm && form.weightKg;
    if (activeStep.key === 'questions') return form.goal && form.updateDay !== '';
    return form.subscriptionPackage && form.paymentMethod;
  };

  const next = () => {
    setError('');
    if (!validateStep()) {
      setError('Συμπλήρωσε τα απαραίτητα πεδία αυτού του βήματος.');
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validateStep()) {
      setError('Συμπλήρωσε τα απαραίτητα πεδία.');
      return;
    }
    setSaving(true);
    setError('');

    const healthNotes = [
      flags.healthProblem === 'yes' ? `Ιατρικό πρόβλημα: ${form.healthProblem}` : '',
      flags.medication === 'yes' ? `Φαρμακευτική αγωγή: ${form.medication}` : '',
      flags.injuries === 'yes' ? `Τραυματισμοί/πόνοι: ${form.injuries}` : '',
      flags.surgery === 'yes' ? `Χειρουργική επέμβαση: ${form.surgery}` : '',
      flags.otherInfo === 'yes' ? `Άλλο: ${form.otherInfo}` : '',
    ].filter(Boolean).join('\n\n');
    const socialLinks = Object.entries(socials).filter(([, url]) => url.trim()).map(([platform, url]) => ({ platform, url: url.trim() }));

    const data = new FormData();
    Object.entries({
      fullName,
      email: form.email,
      countryCode: form.countryCode,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      goal: form.goal,
      updateDay: form.updateDay,
      healthProblem: healthNotes,
      injuries: form.injuries,
      occupationSchedule: form.occupationSchedule,
      cycleHistory: form.cycleHistory,
      cardioSessionsPerWeek: form.cardioSessionsPerWeek,
      sleepSchedule: form.sleepSchedule,
      currentTrainingPlan: form.currentTrainingPlan,
      currentNutritionPlan: form.currentNutritionPlan,
      previousPlanHistory: form.previousPlanHistory,
      subscriptionPackage: form.subscriptionPackage,
      paymentMethod: form.paymentMethod,
      socialLinks: JSON.stringify(socialLinks),
    }).forEach(([key, value]) => data.append(key, value || ''));
    Object.entries(files).forEach(([key, file]) => {
      if (file) data.append(key, file);
    });

    try {
      await api.upload('/clients/me/onboarding', data);
      updateUser({ ...user, fullName, email: form.email, onboardingCompleted: true });
      navigate('/client-dashboard');
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε το ερωτηματολόγιο.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-center">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-xl font-black text-white">K</div>
                  <div>
                    <div className="text-sm font-black text-slate-900">COACH PANEL</div>
                    <div className="text-xs font-bold text-slate-400">Client onboarding</div>
                  </div>
                </div>
                <h1 className="text-3xl font-black tracking-normal sm:text-4xl">Καλωσήρθες, {form.firstName || user?.fullName || 'φίλε'}!</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500">Για να σου προσφέρουμε την καλύτερη δυνατή εμπειρία, παρακαλούμε συμπλήρωσε τις παρακάτω πληροφορίες.</p>
              </div>
              <Stepper activeIndex={stepIndex} />
            </div>
          </header>

          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

          <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-12">
            {activeStep.key === 'details' && <DetailsStep form={form} updateForm={updateForm} />}
            {activeStep.key === 'questions' && <QuestionsStep form={form} flags={flags} files={files} socials={socials} updateForm={updateForm} updateFlag={updateFlag} updateFile={updateFile} setSocials={setSocials} />}
            {activeStep.key === 'plans' && <PlansStep form={form} updateForm={updateForm} subscriptionOptions={subscriptionOptions} />}

            <div className="mt-8 flex flex-col gap-4 rounded-xl bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 text-sm font-semibold text-slate-500">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white">▣</span>
                <div><div className="font-black text-slate-700">Οι πληροφορίες σου είναι ασφαλείς</div><div>Δεν κοινοποιούνται πουθενά.</div></div>
              </div>
              <div className="flex items-center justify-end gap-3">
                {stepIndex > 0 && <button type="button" onClick={() => setStepIndex((value) => value - 1)} className="h-11 rounded-md border border-slate-200 bg-white px-5 font-bold text-slate-700 hover:border-red-200 hover:text-red-600">Πίσω</button>}
                {stepIndex < steps.length - 1 ? (
                  <button type="button" onClick={next} className="h-12 rounded-md bg-red-600 px-8 font-black text-white shadow-lg shadow-red-200 hover:bg-red-700">Συνέχεια →</button>
                ) : (
                  <button disabled={saving} className="h-12 rounded-md bg-red-600 px-8 font-black text-white shadow-lg shadow-red-200 hover:bg-red-700 disabled:bg-slate-400">{saving ? 'Αποθήκευση...' : 'Ολοκλήρωση'}</button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function DetailsStep({ form, updateForm }) {
  return (
    <Section title="Προσωπικά Στοιχεία">
      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3" style={{ columnGap: '36px', rowGap: '28px' }}>
        <Input label="Όνομα" value={form.firstName} onChange={(value) => updateForm('firstName', value)} required />
        <Input label="Επώνυμο" value={form.lastName} onChange={(value) => updateForm('lastName', value)} required />
        <Input label="Ημερομηνία Γέννησης" type="date" value={form.dateOfBirth} onChange={(value) => updateForm('dateOfBirth', value)} required />
        <Input label="Email" type="email" value={form.email} onChange={(value) => updateForm('email', value)} required />
        <PhoneInput countryCode={form.countryCode} phone={form.phone} onCodeChange={(value) => updateForm('countryCode', value)} onPhoneChange={(value) => updateForm('phone', value)} />
        <Select label="Φύλο" value={form.gender} onChange={(value) => updateForm('gender', value)} options={genders.map((item) => ({ value: item, label: item }))} />
        <UnitInput label="Ύψος" unit="cm" value={form.heightCm} onChange={(value) => updateForm('heightCm', value)} required />
        <UnitInput label="Βάρος" unit="kg" value={form.weightKg} onChange={(value) => updateForm('weightKg', value)} required />
        <Select label="Επίπεδο Δραστηριότητας" value={form.activityLevel} onChange={(value) => updateForm('activityLevel', value)} options={activityLevels.map((item) => ({ value: item, label: item }))} />
      </div>
    </Section>
  );
}

function QuestionsStep({ form, flags, files, socials, updateForm, updateFlag, updateFile, setSocials }) {
  return (
    <>
      <Section title="Ερωτήσεις Υγείας & Ιστορικό">
        <div className="space-y-7">
          <YesNoQuestion label="Έχεις κάποιο ιατρικό πρόβλημα ή πάθηση;" name="healthProblem" flags={flags} onFlagChange={updateFlag} value={form.healthProblem} onChange={(value) => updateForm('healthProblem', value)} placeholder="Αν ναι, περίγραψε το (προαιρετικό)" />
          <YesNoQuestion label="Παίρνεις κάποια φαρμακευτική αγωγή;" name="medication" flags={flags} onFlagChange={updateFlag} value={form.medication} onChange={(value) => updateForm('medication', value)} placeholder="Αν ναι, ποια; (προαιρετικό)" />
          <YesNoQuestion label="Έχεις τραυματισμούς ή πόνους που πρέπει να γνωρίζουμε;" name="injuries" flags={flags} onFlagChange={updateFlag} value={form.injuries} onChange={(value) => updateForm('injuries', value)} placeholder="Περιέγραψε τον τραυματισμό ή πόνο" />
          <YesNoQuestion label="Έχεις κάνει κάποια χειρουργική επέμβαση;" name="surgery" flags={flags} onFlagChange={updateFlag} value={form.surgery} onChange={(value) => updateForm('surgery', value)} placeholder="Αν ναι, πότε και ποια; (προαιρετικό)" />
          <YesNoQuestion label="Υπάρχει κάτι άλλο που πρέπει να γνωρίζουμε;" name="otherInfo" flags={flags} onFlagChange={updateFlag} value={form.otherInfo} onChange={(value) => updateForm('otherInfo', value)} placeholder="Γράψε κάτι (προαιρετικό)" />
        </div>
      </Section>

      <Section title="Εμπειρία & Προπονητικό Ιστορικό">
        <div className="grid gap-6 md:grid-cols-2">
          <Select label="Έχεις γυμναστεί συστηματικά στο παρελθόν;" value={form.trainingExperience} onChange={(value) => updateForm('trainingExperience', value)} options={['Όχι', 'Ναι, έως 6 μήνες', 'Ναι, 1-2 χρόνια', 'Ναι, 3+ χρόνια'].map((item) => ({ value: item, label: item }))} />
          <Select label="Πόσες φορές την εβδομάδα προπονείσαι αυτή τη στιγμή;" value={form.weeklyTraining} onChange={(value) => updateForm('weeklyTraining', value)} options={['0 φορές', '1-2 φορές', '3-4 φορές', '5+ φορές'].map((item) => ({ value: item, label: item }))} />
          <Select label="Τι είδους προπόνηση έχεις κάνει κυρίως;" value={form.trainingType} onChange={(value) => updateForm('trainingType', value)} options={['Βάρη / Μυϊκή ενδυνάμωση', 'Cross training', 'Cardio', 'Ομαδικά', 'Άλλο'].map((item) => ({ value: item, label: item }))} />
          <Select label="Για πόσο καιρό;" value={form.trainingDuration} onChange={(value) => updateForm('trainingDuration', value)} options={['Λιγότερο από 6 μήνες', 'Περίπου 1 χρόνο', 'Περίπου 1.5 χρόνο', '2+ χρόνια'].map((item) => ({ value: item, label: item }))} />
        </div>
      </Section>

      <Section title="Διατροφή & Συνήθειες">
        <div className="grid gap-6 md:grid-cols-2">
          <Select label="Ακολουθείς κάποια συγκεκριμένη διατροφή;" value={form.dietType} onChange={(value) => updateForm('dietType', value)} options={['Όχι συγκεκριμένη', 'Υψηλή πρωτεΐνη', 'Χορτοφαγική', 'Vegan', 'Άλλο'].map((item) => ({ value: item, label: item }))} />
          <Select label="Πόσα γεύματα κάνεις καθημερινά;" value={form.mealsPerDay} onChange={(value) => updateForm('mealsPerDay', value)} options={['1-2 γεύματα', '3 κύρια + 1-2 σνακ', '4-5 γεύματα', 'Άλλο'].map((item) => ({ value: item, label: item }))} />
          <Select label="Έχεις αλλεργίες ή τροφικές δυσανεξίες;" value={form.allergies} onChange={(value) => updateForm('allergies', value)} options={['Καμία', 'Λακτόζη', 'Γλουτένη', 'Ξηροί καρποί', 'Άλλο'].map((item) => ({ value: item, label: item }))} />
        </div>
      </Section>

      <Section title="Στόχος & Εβδομαδιαίο Update">
        <div className="grid gap-6 md:grid-cols-2">
          <Select label="Στόχος" value={form.goal} onChange={(value) => updateForm('goal', value)} options={goals.map((goal) => ({ value: goal, label: goal }))} />
          <Select label="Ημέρα αποστολής update" value={form.updateDay} onChange={(value) => updateForm('updateDay', value)} options={updateDays} />
          <Textarea label="Επάγγελμα / καθημερινό πρόγραμμα" value={form.occupationSchedule} onChange={(value) => updateForm('occupationSchedule', value)} />
          <Textarea label="Πρόγραμμα ύπνου" value={form.sleepSchedule} onChange={(value) => updateForm('sleepSchedule', value)} />
          <Input label="Πόσες αερόβιες συνεδρίες την εβδομάδα;" value={form.cardioSessionsPerWeek} onChange={(value) => updateForm('cardioSessionsPerWeek', value)} />
          <Textarea label="Αν έχεις κάνει κύκλο, ποιος ήταν και πότε ολοκληρώθηκε;" value={form.cycleHistory} onChange={(value) => updateForm('cycleHistory', value)} />
        </div>
      </Section>

      <Section title="Φωτογραφίες & Αρχεία">
        <div className="grid gap-5 lg:grid-cols-4">
          <UploadCard label="Front" hint="Φωτογραφία προόδου" accept="image/*" file={files.frontPhoto} onChange={(file) => updateFile('frontPhoto', file)} />
          <UploadCard label="Side" hint="Προαιρετικά" accept="image/*" file={files.sidePhoto} onChange={(file) => updateFile('sidePhoto', file)} />
          <UploadCard label="Back" hint="Προαιρετικά" accept="image/*" file={files.backPhoto} onChange={(file) => updateFile('backPhoto', file)} />
          <UploadCard label="Αιματολογικές" hint="Προαιρετικό PDF" accept="application/pdf" file={files.bloodTestsPdf} onChange={(file) => updateFile('bloodTestsPdf', file)} />
        </div>
      </Section>

      <Section title="Τρέχοντα και προηγούμενα πλάνα">
        <div className="grid gap-5 lg:grid-cols-3">
          <PlanField title="Τρέχον πλάνο προπόνησης" value={form.currentTrainingPlan} onTextChange={(value) => updateForm('currentTrainingPlan', value)} file={files.trainingPlanPdf} onFileChange={(file) => updateFile('trainingPlanPdf', file)} />
          <PlanField title="Τρέχον πλάνο διατροφής" value={form.currentNutritionPlan} onTextChange={(value) => updateForm('currentNutritionPlan', value)} file={files.nutritionPlanPdf} onFileChange={(file) => updateFile('nutritionPlanPdf', file)} />
          <PlanField title="Ιστορικό προηγούμενων πλάνων" value={form.previousPlanHistory} onTextChange={(value) => updateForm('previousPlanHistory', value)} file={files.previousPlanPdf} onFileChange={(file) => updateFile('previousPlanPdf', file)} />
        </div>
      </Section>

      <Section title="Social Media Links">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {['instagram', 'tiktok', 'facebook', 'youtube'].map((platform) => (
            <Input key={platform} label={platform[0].toUpperCase() + platform.slice(1)} value={socials[platform]} onChange={(value) => setSocials((current) => ({ ...current, [platform]: value }))} placeholder="https://..." />
          ))}
        </div>
      </Section>
    </>
  );
}

function PlansStep({ form, updateForm, subscriptionOptions }) {
  const selectedPlan = subscriptionOptions.find((item) => item.value === form.subscriptionPackage) || subscriptionOptions[0];
  const periodLabel = getPeriodLabel(selectedPlan?.period);
  const paymentMethods = [
    { value: 'stripe_card', title: 'Κάρτα', icon: '▰', meta: 'Visa / Mastercard / Apple Pay' },
    { value: 'bank_transfer', title: 'Τραπεζικό έμβασμα', icon: '◇', meta: 'Οδηγίες πληρωμής μετά την υποβολή' },
  ];

  return (
    <>
      <section className="mt-0">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-normal text-slate-950">Επίλεξε το πακέτο σου</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Διάλεξε το πρόγραμμα που ταιριάζει στους στόχους σου και ξεκίνα σήμερα.</p>
            <div className="mt-3 flex items-center gap-2 text-sm font-black text-emerald-600">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-emerald-200 bg-emerald-50">✓</span>
              Ασφαλής πληρωμή
            </div>
          </div>
          <button type="button" className="flex h-16 items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-5 text-left shadow-sm lg:min-w-64">
            <span className="text-2xl">🎁</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-slate-800">Έχεις κουπόνι;</span>
              <span className="block text-xs font-bold text-slate-500">Εισαγωγή κωδικού</span>
            </span>
            <span className="text-lg font-black text-slate-500">→</span>
          </button>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {subscriptionOptions.map((item) => {
            const itemPrice = getPlanPrice(item);
            const itemYearlyPrice = itemPrice ? itemPrice * 10 : null;
            const itemPeriod = getPeriodLabel(item.period);

            return (
              <button key={item.value} type="button" onClick={() => updateForm('subscriptionPackage', item.value)} className={`relative flex min-h-[420px] flex-col rounded-xl border bg-white p-7 text-left transition ${form.subscriptionPackage === item.value ? 'border-red-500 shadow-xl shadow-red-100 ring-2 ring-red-50' : 'border-slate-200 hover:border-red-200 hover:shadow-lg hover:shadow-slate-100'}`} style={form.subscriptionPackage === item.value && item.color ? { borderColor: item.color } : undefined}>
                {item.badge && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-b-md rounded-t-sm bg-red-600 px-5 py-2 text-xs font-black uppercase text-white shadow-lg shadow-red-100">{item.badge}</span>}
                <div className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-2xl" style={item.color ? { color: item.color, backgroundColor: `${item.color}14` } : undefined}>{getPlanIcon(item.title)}</div>
                <div className="mt-6 text-2xl font-black text-slate-950">{item.title}</div>
                <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">{item.note}</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="text-5xl font-black text-slate-950">{item.price}</span>
                  <span className="pb-2 text-sm font-bold text-slate-500">/{itemPeriod}</span>
                </div>
                {itemYearlyPrice && <div className="mt-2 text-sm font-black text-slate-700">ή €{itemYearlyPrice} /έτος <span className="text-emerald-600">(2 μήνες δωρεάν)</span></div>}
                <div className="mt-6 flex-1 space-y-3 text-sm font-bold text-slate-700">
                  {(item.features?.length ? item.features : [{ included: true, text: 'Προπονητικό πλάνο' }, { included: true, text: 'Διατροφικό πλάνο' }, { included: true, text: 'Progress tracking' }, { included: true, text: 'Υποστήριξη μέσω μηνυμάτων' }]).slice(0, 6).map((feature, index) => (
                    <div key={index} className={`flex items-start gap-3 ${feature.included === false ? 'text-slate-400' : ''}`}>
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs ${feature.included === false ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>{feature.included === false ? '×' : '✓'}</span>
                      <span className="leading-5">{feature.text}</span>
                    </div>
                  ))}
                </div>
                <div className={`mt-7 grid h-12 place-items-center rounded-md border text-sm font-black ${form.subscriptionPackage === item.value ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 text-slate-800'}`}>
                  {form.subscriptionPackage === item.value ? 'Επιλεγμένο πακέτο' : 'Επιλογή'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Τρόποι Πληρωμής</h2>
          <div className="mt-5 space-y-3">
            {paymentMethods.map((method) => (
              <PaymentOption key={method.value} active={form.paymentMethod === method.value} title={method.title} text={method.meta} icon={method.icon} onClick={() => updateForm('paymentMethod', method.value)} />
            ))}
          </div>
          <div className="mt-7 flex items-center gap-2 text-sm font-bold text-slate-500">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">✓</span>
            100% ασφαλής πληρωμή με κρυπτογράφηση SSL
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Σύνοψη Παραγγελίας</h2>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <SummaryRow label="Επιλεγμένο πακέτο" value={selectedPlan?.title || '-'} />
            <SummaryRow label="Χρέωση" value={`${selectedPlan?.price || '-'} /${periodLabel}`} />
            <SummaryRow label="ΦΠΑ (24%)" value="€0.00" />
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-5">
              <span className="text-base font-black text-slate-950">Σύνολο</span>
              <span className="text-2xl font-black text-red-600">{selectedPlan?.price || '-'} <span className="text-sm text-slate-500">/{periodLabel}</span></span>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-800">
            Μπορείς να αλλάξεις ή να ακυρώσεις οποιαδήποτε στιγμή από τον λογαριασμό σου.
          </div>
        </section>
      </div>
    </>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 text-sm">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}

function getPlanPrice(plan) {
  if (!plan?.price) return 0;
  const parsed = Number(String(plan.price).replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPeriodLabel(period) {
  if (!period) return 'μήνα';
  const normalized = String(period).toLowerCase();
  if (normalized.includes('ετ') || normalized.includes('year')) return 'έτος';
  if (normalized.includes('μην') || normalized.includes('month')) return 'μήνα';
  return period;
}

function getPlanIcon(title = '') {
  const normalized = title.toLowerCase();
  if (normalized.includes('premium') || normalized.includes('pro')) return '◇';
  if (normalized.includes('elite')) return '♛';
  return 'ϟ';
}

function Stepper({ activeIndex }) {
  const progress = ((activeIndex + 1) / steps.length) * 100;

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400">Step {activeIndex + 1} / {steps.length}</div>
          <div className="mt-1 truncate text-sm font-black text-slate-900">{steps[activeIndex].title}</div>
        </div>
        <div className="shrink-0 text-sm font-black text-red-600">{Math.round(progress)}%</div>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
        <div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3">
        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <div key={step.key} className={`min-w-0 rounded-lg border px-2 py-2 sm:px-3 sm:py-3 ${isActive ? 'border-red-200 bg-white shadow-sm' : isComplete ? 'border-emerald-100 bg-emerald-50' : 'border-slate-200 bg-white/70'}`}>
              <div className="flex min-w-0 items-center gap-2">
                <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${isComplete ? 'bg-emerald-500 text-white' : isActive ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'}`}>
                  {isComplete ? '✓' : index + 1}
                </div>
                <div className={`min-w-0 truncate text-[11px] font-black sm:text-xs ${isActive ? 'text-slate-950' : isComplete ? 'text-emerald-700' : 'text-slate-500'}`}>{step.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return <section className="mt-9 first:mt-0"><h2 className="text-lg font-black">{title}</h2><div className="mt-5">{children}</div></section>;
}

function YesNoQuestion({ label, name, flags, onFlagChange, value, onChange, placeholder }) {
  return <div className="rounded-lg border border-slate-100 bg-white p-4"><div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center"><div className="text-sm font-black leading-6 text-slate-700">{label} <span className="text-slate-400">ⓘ</span></div><div className="flex min-w-[150px] items-center gap-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"><Radio checked={flags[name] === 'yes'} onChange={() => onFlagChange(name, 'yes')} label="Ναι" /><Radio checked={flags[name] === 'no'} onChange={() => onFlagChange(name, 'no')} label="Όχι" /></div></div><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-4 h-12 w-full rounded-md border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50" /></div>;
}

function Radio({ checked, onChange, label }) {
  return <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap"><input type="radio" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-red-600" /><span>{label}</span></label>;
}

function Input({ label, type = 'text', value, onChange, required = false, placeholder = '' }) {
  return <label className="block min-w-0"><span className="text-sm font-black text-slate-700">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-4 text-sm font-semibold outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50" /></label>;
}

function UnitInput({ label, unit, value, onChange, required = false }) {
  return <label className="block min-w-0"><span className="text-sm font-black text-slate-700">{label}</span><div className="mt-2 flex h-12 items-center rounded-md border border-slate-200 bg-white px-4 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-50"><input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="min-w-0 flex-1 text-sm font-semibold outline-none" /><span className="ml-3 text-xs font-black text-slate-500">{unit}</span></div></label>;
}

function PhoneInput({ countryCode, phone, onCodeChange, onPhoneChange }) {
  return <label className="block min-w-0"><span className="text-sm font-black text-slate-700">Τηλέφωνο</span><div className="mt-2 flex h-12 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-50"><select value={countryCode} onChange={(event) => onCodeChange(event.target.value)} className="h-full w-24 shrink-0 border-0 border-r border-slate-200 bg-white px-3 text-sm font-semibold outline-none">{countryCodes.map((code) => <option key={code} value={code}>{code}</option>)}</select><input value={phone} onChange={(event) => onPhoneChange(event.target.value)} required className="h-full min-w-0 flex-1 px-4 text-sm font-semibold outline-none" /></div></label>;
}

function Select({ label, value, onChange, options }) {
  return <label className="block min-w-0"><span className="text-sm font-black text-slate-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Textarea({ label, value, onChange }) {
  return <label className="block"><span className="text-sm font-black text-slate-700">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-32 w-full rounded-md border border-slate-200 p-4 text-sm font-semibold outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50" /></label>;
}

function UploadCard({ label, hint, accept, file, onChange }) {
  return <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 hover:border-red-300"><span className="text-base font-black text-slate-800">{label}</span><span className="mt-1 block text-sm text-slate-500">{hint}</span><span className="mt-4 block rounded-md bg-white px-3 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">{file ? file.name : 'Επιλογή αρχείου'}</span><input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} className="hidden" /></label>;
}

function PlanField({ title, value, onTextChange, file, onFileChange }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><label className="block"><span className="text-sm font-black text-slate-700">{title}</span><textarea value={value} onChange={(event) => onTextChange(event.target.value)} className="mt-3 min-h-28 w-full rounded-md border border-slate-200 bg-white p-3 text-sm font-semibold outline-none focus:border-red-300" /></label><div className="mt-4"><UploadCard label="PDF πλάνου" hint="Προαιρετικό αρχείο PDF" accept="application/pdf" file={file} onChange={onFileChange} /></div></div>;
}

function PaymentOption({ active, title, text, icon, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition ${active ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white hover:border-red-200'}`}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-black ${active ? 'border-red-600 bg-red-600 text-white' : 'border-slate-300 text-slate-400'}`}>{active ? '●' : ''}</span>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-50 text-lg font-black text-slate-800">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-black text-slate-950">{title}</span>
        <span className="mt-1 block text-xs font-bold text-slate-500">{text}</span>
      </span>
    </button>
  );
}
