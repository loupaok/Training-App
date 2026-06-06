import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const countryCodes = [
  { value: '+30', label: 'Ελλάδα +30' },
  { value: '+357', label: 'Κύπρος +357' },
  { value: '+44', label: 'Ηνωμένο Βασίλειο +44' },
  { value: '+49', label: 'Γερμανία +49' },
  { value: '+1', label: 'ΗΠΑ +1' },
];

const goals = ['Γράμμωση', 'Όγκος', 'Απώλεια κιλών', 'Συντήρηση', 'Αύξηση δύναμης', 'Βελτίωση φυσικής κατάστασης'];
const updateDays = [
  { value: 1, label: 'Δευτέρα' },
  { value: 2, label: 'Τρίτη' },
  { value: 3, label: 'Τετάρτη' },
  { value: 4, label: 'Πέμπτη' },
  { value: 5, label: 'Παρασκευή' },
  { value: 6, label: 'Σάββατο' },
  { value: 0, label: 'Κυριακή' },
];
const packages = [
  { value: '2_months', title: '2 μήνες', price: '190€', note: 'Ιδανικό ξεκίνημα' },
  { value: '3_months', title: '3 μήνες', price: '270€', note: 'Σταθερή πρόοδος' },
  { value: '4_months', title: '4 μήνες', price: '320€', note: 'Καλύτερη αξία' },
];
const socialPlatforms = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
];
const steps = [
  { key: 'contact', title: 'Στοιχεία' },
  { key: 'goal', title: 'Στόχος' },
  { key: 'questionnaire', title: 'Ερωτηματολόγιο' },
  { key: 'photos', title: 'Φωτογραφίες' },
  { key: 'plans', title: 'Πλάνα' },
  { key: 'payment', title: 'Συνδρομή' },
];

export default function ClientOnboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    countryCode: '+30',
    phone: '',
    dateOfBirth: '',
    heightCm: '',
    goal: 'Γράμμωση',
    updateDay: '1',
    weightKg: '',
    occupationSchedule: '',
    healthProblem: '',
    injuries: '',
    cycleHistory: '',
    cardioSessionsPerWeek: '',
    sleepSchedule: '',
    currentTrainingPlan: '',
    currentNutritionPlan: '',
    previousPlanHistory: '',
    subscriptionPackage: '3_months',
    paymentMethod: 'bank_transfer',
  });
  const [socials, setSocials] = useState({ instagram: '', tiktok: '', facebook: '', youtube: '' });
  const [files, setFiles] = useState({
    frontPhoto: null,
    sidePhoto: null,
    backPhoto: null,
    trainingPlanPdf: null,
    nutritionPlanPdf: null,
    previousPlanPdf: null,
    bloodTestsPdf: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activeStep = steps[stepIndex];
  const progress = useMemo(() => Math.round(((stepIndex + 1) / steps.length) * 100), [stepIndex]);
  const calculatedAge = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);
  const updateForm = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const updateFile = (name, file) => setFiles((current) => ({ ...current, [name]: file }));

  const validateStep = () => {
    if (activeStep.key === 'contact') return form.fullName && form.email && form.phone && form.dateOfBirth && form.heightCm && form.weightKg;
    if (activeStep.key === 'goal') return form.goal && form.updateDay !== '';
    if (activeStep.key === 'photos') return files.frontPhoto;
    if (activeStep.key === 'payment') return form.subscriptionPackage && form.paymentMethod;
    return true;
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

    const socialLinks = Object.entries(socials)
      .filter(([, url]) => url.trim())
      .map(([platform, url]) => ({ platform, url: url.trim() }));

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append('socialLinks', JSON.stringify(socialLinks));
    Object.entries(files).forEach(([key, file]) => {
      if (file) data.append(key, file);
    });

    try {
      await api.upload('/clients/me/onboarding', data);
      updateUser({ ...user, fullName: form.fullName, email: form.email, onboardingCompleted: true });
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Δεν αποθηκεύτηκε το ερωτηματολόγιο.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <header className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 p-7 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-red-600">Client Onboarding</p>
              <h1 className="mt-2 text-3xl font-black">Πες μας τι χρειάζεται να ξέρουμε</h1>
              <p className="mt-3 max-w-2xl text-slate-600">
                Συμπλήρωσε τα βήματα και ο coach θα έχει όλα τα στοιχεία στην καρτέλα σου από την πρώτη μέρα.
              </p>
            </div>
            <div className="rounded-lg bg-slate-950 p-5 text-white">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Πρόοδος</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-4 text-sm text-slate-300">Βήμα {stepIndex + 1} από {steps.length}</div>
            </div>
          </div>
          <nav className="grid border-t border-slate-200" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((step, index) => (
              <button
                key={step.key}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`h-14 border-r border-slate-200 text-sm font-black last:border-r-0 ${index === stepIndex ? 'bg-red-600 text-white' : index < stepIndex ? 'bg-red-50 text-red-700' : 'bg-white text-slate-500'}`}
              >
                {step.title}
              </button>
            ))}
          </nav>
        </header>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>}

        <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {activeStep.key === 'contact' && (
            <Step title="Στοιχεία">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label="Όνομα & Επώνυμο" value={form.fullName} onChange={(value) => updateForm('fullName', value)} required />
                <Input label="Email" type="email" value={form.email} onChange={(value) => updateForm('email', value)} required />
                <div className="grid grid-cols-5 gap-3 md:col-span-2">
                  <label className="col-span-2 block">
                    <span className="text-sm font-bold text-slate-700">Κωδικός χώρας</span>
                    <select value={form.countryCode} onChange={(event) => updateForm('countryCode', event.target.value)} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300">
                      {countryCodes.map((code) => <option key={code.value} value={code.value}>{code.label}</option>)}
                    </select>
                  </label>
                  <Input className="col-span-3" label="Τηλέφωνο" value={form.phone} onChange={(value) => updateForm('phone', value)} required />
                </div>
                <div className="md:col-span-2">
                  <ModernDatePicker
                    value={form.dateOfBirth}
                    onChange={(value) => updateForm('dateOfBirth', value)}
                    calculatedAge={calculatedAge}
                  />
                </div>
                <Input label="Ύψος σε cm" value={form.heightCm} onChange={(value) => updateForm('heightCm', value)} required />
                <Input label="Βάρος σε kg" value={form.weightKg} onChange={(value) => updateForm('weightKg', value)} required />
              </div>
            </Step>
          )}

          {activeStep.key === 'goal' && (
            <Step title="Στόχος και ημέρα update">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select label="Στόχος" value={form.goal} onChange={(value) => updateForm('goal', value)} options={goals.map((goal) => ({ value: goal, label: goal }))} />
                <Select label="Ημέρα αποστολής update" value={form.updateDay} onChange={(value) => updateForm('updateDay', value)} options={updateDays} />
              </div>
            </Step>
          )}

          {activeStep.key === 'questionnaire' && (
            <Step title="Ερωτηματολόγιο">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Textarea label="Επάγγελμα / καθημερινό πρόγραμμα" value={form.occupationSchedule} onChange={(value) => updateForm('occupationSchedule', value)} />
                <Textarea label="Τυχόν πρόβλημα υγείας που θα πρέπει να γνωρίζω" value={form.healthProblem} onChange={(value) => updateForm('healthProblem', value)} />
                <Textarea label="Υπάρχουν τραυματισμοί; (π.χ. γόνατα, μέση, ώμοι)" value={form.injuries} onChange={(value) => updateForm('injuries', value)} />
                <Textarea label="Αν έχεις κάνει κύκλο, ποιος ήταν και πότε ολοκληρώθηκε ο τελευταίος;" value={form.cycleHistory} onChange={(value) => updateForm('cycleHistory', value)} />
                <Input label="Πόσες αερόβιες συνεδρίες την εβδομάδα;" value={form.cardioSessionsPerWeek} onChange={(value) => updateForm('cardioSessionsPerWeek', value)} />
                <Textarea label="Πώς είναι το πρόγραμμα ύπνου σου; (τι ώρα κοιμάσαι, ξυπνάς, δουλεύεις)" value={form.sleepSchedule} onChange={(value) => updateForm('sleepSchedule', value)} />
              </div>
              <div className="mt-5 max-w-xl">
                <UploadCard
                  label="Πρόσφατες αιματολογικές εξετάσεις"
                  hint="Αν υπάρχουν, ανέβασε PDF"
                  accept="application/pdf"
                  file={files.bloodTestsPdf}
                  onChange={(file) => updateFile('bloodTestsPdf', file)}
                />
              </div>
            </Step>
          )}

          {activeStep.key === 'photos' && (
            <Step title="Φωτογραφίες προόδου">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <UploadCard label="Μπροστά" hint="Απαραίτητη φωτογραφία" accept="image/*" file={files.frontPhoto} onChange={(file) => updateFile('frontPhoto', file)} required />
                <UploadCard label="Πλάι" hint="Προαιρετικά" accept="image/*" file={files.sidePhoto} onChange={(file) => updateFile('sidePhoto', file)} />
                <UploadCard label="Πίσω" hint="Προαιρετικά" accept="image/*" file={files.backPhoto} onChange={(file) => updateFile('backPhoto', file)} />
              </div>
            </Step>
          )}

          {activeStep.key === 'plans' && (
            <Step title="Τρέχοντα και προηγούμενα πλάνα">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <PlanField
                  title="Τρέχον πλάνο προπόνησης"
                  value={form.currentTrainingPlan}
                  onTextChange={(value) => updateForm('currentTrainingPlan', value)}
                  file={files.trainingPlanPdf}
                  onFileChange={(file) => updateFile('trainingPlanPdf', file)}
                />
                <PlanField
                  title="Τρέχον πλάνο διατροφής"
                  value={form.currentNutritionPlan}
                  onTextChange={(value) => updateForm('currentNutritionPlan', value)}
                  file={files.nutritionPlanPdf}
                  onFileChange={(file) => updateFile('nutritionPlanPdf', file)}
                />
                <PlanField
                  title="Ιστορικό προηγούμενων πλάνων"
                  value={form.previousPlanHistory}
                  onTextChange={(value) => updateForm('previousPlanHistory', value)}
                  file={files.previousPlanPdf}
                  onFileChange={(file) => updateFile('previousPlanPdf', file)}
                />
              </div>
              <div className="mt-6">
                <h3 className="font-black">Social Media Links</h3>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {socialPlatforms.map((platform) => (
                    <Input
                      key={platform.key}
                      label={platform.label}
                      value={socials[platform.key]}
                      onChange={(value) => setSocials((current) => ({ ...current, [platform.key]: value }))}
                      placeholder="https://..."
                    />
                  ))}
                </div>
              </div>
            </Step>
          )}

          {activeStep.key === 'payment' && (
            <Step title="Συνδρομή και πληρωμή">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {packages.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => updateForm('subscriptionPackage', item.value)}
                    className={`rounded-lg border p-5 text-left transition ${form.subscriptionPackage === item.value ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white hover:border-red-200'}`}
                  >
                    <div className="text-lg font-black">{item.title}</div>
                    <div className="mt-2 text-3xl font-black text-red-600">{item.price}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-500">{item.note}</div>
                  </button>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <PaymentOption active={form.paymentMethod === 'bank_transfer'} title="Τραπεζικό έμβασμα" text="Θα λάβεις οδηγίες πληρωμής μετά την αποστολή." onClick={() => updateForm('paymentMethod', 'bank_transfer')} />
                <PaymentOption active={form.paymentMethod === 'stripe_card'} title="Κάρτα μέσω Stripe" text="Θα ενεργοποιηθεί αργότερα." onClick={() => updateForm('paymentMethod', 'stripe_card')} />
              </div>
            </Step>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => setStepIndex((value) => Math.max(value - 1, 0))}
              disabled={stepIndex === 0}
              className="h-11 rounded-md border border-slate-200 px-5 font-bold text-slate-700 hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Πίσω
            </button>
            {stepIndex < steps.length - 1 ? (
              <button type="button" onClick={next} className="h-11 rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700">
                Συνέχεια
              </button>
            ) : (
              <button disabled={saving} className="h-11 rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700 disabled:bg-slate-400">
                {saving ? 'Αποθήκευση...' : 'Ολοκλήρωση'}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

function Step({ title, children }) {
  return (
    <section>
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function ModernDatePicker({ value, onChange, calculatedAge }) {
  const currentYear = new Date().getFullYear();
  const [year = '', month = '', day = ''] = value ? value.split('-') : [];
  const years = Array.from({ length: 90 }, (_, index) => currentYear - 12 - index);
  const months = [
    ['01', 'Ιανουάριος'],
    ['02', 'Φεβρουάριος'],
    ['03', 'Μάρτιος'],
    ['04', 'Απρίλιος'],
    ['05', 'Μάιος'],
    ['06', 'Ιούνιος'],
    ['07', 'Ιούλιος'],
    ['08', 'Αύγουστος'],
    ['09', 'Σεπτέμβριος'],
    ['10', 'Οκτώβριος'],
    ['11', 'Νοέμβριος'],
    ['12', 'Δεκέμβριος'],
  ];
  const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0'));

  const updatePart = (part, nextValue) => {
    const next = {
      year,
      month,
      day,
      [part]: nextValue,
    };

    if (next.year && next.month && next.day) {
      onChange(`${next.year}-${next.month}-${next.day}`);
      return;
    }

    onChange('');
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-black text-slate-700">Ημερομηνία γέννησης</span>
          <p className="mt-1 text-xs font-semibold text-slate-500">Το σύστημα υπολογίζει αυτόματα την ηλικία.</p>
        </div>
        {calculatedAge !== null && (
          <div className="rounded-md bg-red-600 px-4 py-2 text-center text-white">
            <div className="text-xs font-bold uppercase">Ηλικία</div>
            <div className="text-xl font-black">{calculatedAge}</div>
          </div>
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <DateSelect label="Ημέρα" value={day} onChange={(next) => updatePart('day', next)} options={days.map((item) => [item, item])} />
        <DateSelect label="Μήνας" value={month} onChange={(next) => updatePart('month', next)} options={months} />
        <DateSelect label="Έτος" value={year} onChange={(next) => updatePart('year', next)} options={years.map((item) => [String(item), String(item)])} />
      </div>
    </div>
  );
}

function DateSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-12 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-red-300"
      >
        <option value="">--</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Input({ label, type = 'text', value, onChange, required = false, placeholder = '', className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300" />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-32 w-full rounded-md border border-slate-200 p-3 outline-none focus:border-red-300" />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function UploadCard({ label, hint, accept, file, onChange, required = false }) {
  return (
    <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 hover:border-red-300">
      <span className="text-lg font-black text-slate-800">{label}</span>
      <span className="mt-1 block text-sm text-slate-500">{hint}</span>
      <span className="mt-4 block rounded-md bg-white px-3 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200">
        {file ? file.name : 'Επιλογή αρχείου'}
      </span>
      <input type="file" accept={accept} required={required} onChange={(event) => onChange(event.target.files?.[0] || null)} className="hidden" />
    </label>
  );
}

function PlanField({ title, value, onTextChange, file, onFileChange }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="block">
        <span className="text-sm font-black text-slate-700">{title}</span>
        <textarea value={value} onChange={(event) => onTextChange(event.target.value)} className="mt-3 min-h-32 w-full rounded-md border border-slate-200 bg-white p-3 outline-none focus:border-red-300" />
      </label>
      <UploadCard label="PDF πλάνου" hint="Προαιρετικό αρχείο PDF" accept="application/pdf" file={file} onChange={onFileChange} />
    </div>
  );
}

function PaymentOption({ active, title, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg border p-5 text-left ${active ? 'border-red-500 bg-red-50 ring-2 ring-red-100' : 'border-slate-200 bg-white hover:border-red-200'}`}>
      <div className="font-black">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </button>
  );
}
