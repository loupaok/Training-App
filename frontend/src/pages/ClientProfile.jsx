import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';

const API_ORIGIN = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
const socialPlatforms = ['Instagram', 'Facebook', 'YouTube', 'TikTok'];

function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url.replace(/^\/+/, '')}`;
}

function toDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function normalizeSocialLinks(rows = []) {
  return socialPlatforms.map((platform) => {
    const existing = rows.find((item) => item.platform?.toLowerCase() === platform.toLowerCase());
    return { platform, url: existing?.url || '' };
  });
}

async function cropAndCompressImage(file) {
  const imageUrl = URL.createObjectURL(file);
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });

  const size = Math.min(image.width, image.height);
  const sourceX = Math.floor((image.width - size) / 2);
  const sourceY = Math.floor((image.height - size) / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 512, 512);
  URL.revokeObjectURL(imageUrl);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
  });
}

export default function ClientProfile() {
  const { user, logout, updateUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    gender: '',
    dateOfBirth: '',
    heightCm: '',
    weightKg: '',
    updateDay: '',
    goal: '',
    occupationSchedule: '',
    healthProblem: '',
    injuries: '',
    cycleHistory: '',
    cardioSessionsPerWeek: '',
    sleepSchedule: '',
    currentTrainingPlan: '',
    currentNutritionPlan: '',
    previousPlanHistory: '',
    socialLinks: normalizeSocialLinks(),
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    Promise.all([api.get('/clients/me/profile'), api.get('/client-dashboard').catch(() => null)])
      .then(([data, dashboard]) => {
        setPaymentApproved(Boolean(dashboard?.paymentApproved));
        setProfile(data);
        setForm({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          gender: data.gender || '',
          dateOfBirth: toDateInput(data.dateOfBirth),
          heightCm: data.heightCm || '',
          weightKg: data.weightKg || '',
          updateDay: data.updateDay ?? '',
          goal: data.goal || '',
          occupationSchedule: data.occupationSchedule || '',
          healthProblem: data.healthProblem || '',
          injuries: data.injuries || '',
          cycleHistory: data.cycleHistory || '',
          cardioSessionsPerWeek: data.cardioSessionsPerWeek || '',
          sleepSchedule: data.sleepSchedule || '',
          currentTrainingPlan: data.currentTrainingPlan || '',
          currentNutritionPlan: data.currentNutritionPlan || '',
          previousPlanHistory: data.previousPlanHistory || '',
          socialLinks: normalizeSocialLinks(data.socialLinks),
        });
      })
      .catch((err) => setError(err.message || 'Δεν φορτώθηκε το προφίλ.'))
      .finally(() => setLoading(false));
  }, []);

  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);
  const currentProfilePhoto = profile?.profilePhoto || user?.profilePhoto;
  const profilePhoto = resolveMediaUrl(currentProfilePhoto);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSocialLink = (platform, url) => {
    setForm((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((item) => item.platform === platform ? { ...item, url } : item),
    }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const data = await api.put('/clients/me/profile', form);
      updateUser({ ...user, ...data.user, profilePhoto: currentProfilePhoto });
      setMessage('Το προφίλ ενημερώθηκε.');
    } catch (err) {
      setError(err.message || 'Δεν έγινε αποθήκευση.');
    } finally {
      setSaving(false);
    }
  };

  const uploadProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setMessage('');

    try {
      const compressedBlob = await cropAndCompressImage(file);
      const formData = new FormData();
      formData.append('photo', compressedBlob, 'profile-photo.jpg');
      const data = await api.upload('/clients/me/profile-photo', formData);
      setProfile((current) => ({ ...current, profilePhoto: data.profilePhoto }));
      updateUser({ ...user, profilePhoto: data.profilePhoto });
      setMessage('Η φωτογραφία προφίλ ανέβηκε και αποθηκεύτηκε στο Media Library.');
    } catch (err) {
      setError(err.message || 'Δεν ανέβηκε η φωτογραφία.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const deleteProfilePhoto = async () => {
    if (!currentProfilePhoto) return;
    setDeletingPhoto(true);
    setError('');
    setMessage('');

    try {
      const data = await api.delete('/clients/me/profile-photo');
      setProfile((current) => ({ ...current, profilePhoto: data.profilePhoto }));
      updateUser({ ...user, profilePhoto: null });
      setMessage('Η φωτογραφία αφαιρέθηκε από το προφίλ σου.');
    } catch (err) {
      setError(err.message || 'Δεν διαγράφηκε η φωτογραφία.');
    } finally {
      setDeletingPhoto(false);
    }
  };

  const shellUser = { ...user, profilePhoto: currentProfilePhoto };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && <ClientSidebar user={shellUser} paymentApproved={paymentApproved} active="profile" />}
      <ClientTopbar user={shellUser} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Προφίλ" />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="mx-auto max-w-6xl px-8 py-8">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Dashboard / Προφίλ</p>
              <h1 className="mt-2 text-3xl font-black">Το προφίλ μου</h1>
            </div>
            <ThemeToggle theme={theme} setTheme={setTheme} />
          </div>

          {loading ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">Φόρτωση...</div>
          ) : (
            <form onSubmit={saveProfile} className="space-y-6">
              {(error || message) && (
                <div className={`rounded-lg border px-5 py-4 text-sm font-bold ${error ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200' : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200'}`}>
                  {error || message}
                </div>
              )}

              <Section>
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-5">
                    {profilePhoto ? (
                      <img src={profilePhoto} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-red-50 dark:ring-red-950/40" />
                    ) : (
                      <div className="grid h-24 w-24 place-items-center rounded-full bg-slate-900 text-2xl font-black text-white dark:bg-red-600">
                        {(form.fullName || form.email || 'CL').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-black">Φωτογραφία προφίλ</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Η εικόνα γίνεται αυτόματα τετράγωνο crop και συμπίεση πριν αποθηκευτεί.</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <label className={`inline-flex h-12 cursor-pointer items-center justify-center rounded-md px-5 font-bold text-white shadow-lg shadow-red-100 dark:shadow-none ${uploading ? 'bg-slate-400' : 'bg-red-600 hover:bg-red-700'}`}>
                      {uploading ? 'Ανέβασμα...' : 'Αλλαγή φωτογραφίας'}
                      <input type="file" accept="image/*" onChange={uploadProfilePhoto} className="hidden" />
                    </label>
                    <button type="button" disabled={!currentProfilePhoto || deletingPhoto} onClick={deleteProfilePhoto} className="h-12 rounded-md border border-slate-200 px-5 font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 dark:border-slate-700 dark:hover:bg-red-950/30">
                      {deletingPhoto ? 'Διαγραφή...' : 'Διαγραφή'}
                    </button>
                  </div>
                </div>
              </Section>

              <Section title="Προσωπικά στοιχεία">
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <TextField label="Όνομα & Επώνυμο" value={form.fullName} onChange={(value) => updateField('fullName', value)} required />
                  <TextField label="Email" type="email" value={form.email} onChange={(value) => updateField('email', value)} required />
                  <TextField label="Τηλέφωνο" value={form.phone} onChange={(value) => updateField('phone', value)} />
                  <TextField label="Ημερομηνία γέννησης" type="date" value={form.dateOfBirth} onChange={(value) => updateField('dateOfBirth', value)} />
                  <ReadOnlyField label="Ηλικία" value={age ? `${age} ετών` : 'Υπολογίζεται από τη γέννηση'} />
                  <SelectField label="Φύλο" value={form.gender} onChange={(value) => updateField('gender', value)} options={['Άνδρας', 'Γυναίκα', 'Άλλο']} />
                  <TextField label="Ύψος σε cm" value={form.heightCm} onChange={(value) => updateField('heightCm', value)} />
                  <TextField label="Βάρος σε kg" value={form.weightKg} onChange={(value) => updateField('weightKg', value)} />
                  <SelectField label="Ημέρα update" value={form.updateDay} onChange={(value) => updateField('updateDay', value)} options={[
                    ['1', 'Δευτέρα'],
                    ['2', 'Τρίτη'],
                    ['3', 'Τετάρτη'],
                    ['4', 'Πέμπτη'],
                    ['5', 'Παρασκευή'],
                    ['6', 'Σάββατο'],
                    ['0', 'Κυριακή'],
                  ]} />
                </div>
              </Section>

              <Section title="Social Media">
                <div className="grid gap-4 md:grid-cols-2">
                  {form.socialLinks.map((link) => (
                    <label key={link.platform} className="block">
                      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{link.platform}</span>
                      <input
                        value={link.url}
                        onChange={(event) => updateSocialLink(link.platform, event.target.value)}
                        placeholder={`Σύνδεσμος ${link.platform}`}
                        className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-4 font-semibold outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                      />
                    </label>
                  ))}
                </div>
              </Section>

              <div className="flex justify-end">
                <button type="submit" disabled={saving} className="h-12 rounded-md bg-red-600 px-8 font-black text-white shadow-lg shadow-red-100 hover:bg-red-700 disabled:bg-slate-400 dark:shadow-none">
                  {saving ? 'Αποθήκευση...' : 'Αποθήκευση αλλαγών'}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

function ThemeToggle({ theme, setTheme }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button onClick={() => setTheme('light')} className={`h-10 rounded-md px-4 text-sm font-black ${theme === 'light' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10'}`} type="button">
        Light
      </button>
      <button onClick={() => setTheme('dark')} className={`h-10 rounded-md px-4 text-sm font-black ${theme === 'dark' ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/10'}`} type="button">
        Dark
      </button>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {title && <h2 className="mb-6 text-xl font-black">{title}</h2>}
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-4 font-semibold outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-12 w-full rounded-md border border-slate-200 bg-white px-4 font-semibold outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <option value="">Επιλογή</option>
        {options.map((option) => {
          const value = Array.isArray(option) ? option[0] : option;
          const label = Array.isArray(option) ? option[1] : option;
          return <option key={value} value={value}>{label}</option>;
        })}
      </select>
    </label>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <div className="mt-2 flex h-12 items-center rounded-md border border-slate-200 bg-slate-50 px-4 font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{value}</div>
    </div>
  );
}
