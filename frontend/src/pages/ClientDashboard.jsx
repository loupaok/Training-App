import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import { api } from '../services/api';

const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const mealLabels = {
  breakfast: 'Πρωινό',
  lunch: 'Μεσημεριανό',
  snack: 'Σνακ',
  dinner: 'Βραδινό',
  other: 'Άλλο',
};

export default function ClientDashboard() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState({
    weightKg: '',
    trainingScore: '5',
    nutritionScore: '5',
    notes: '',
    photos: [],
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const result = await api.get('/client-dashboard');
      setData(result);
    } catch (err) {
      setError(err.message || 'Δεν φορτώθηκε η σελίδα σου.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const weights = useMemo(() => {
    return (data?.progress || [])
      .filter((item) => item.weight_kg)
      .slice()
      .reverse();
  }, [data]);

  const paymentApproved = Boolean(data?.paymentApproved);

  const submitWeeklyUpdate = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('weightKg', weeklyForm.weightKg);
    formData.append('trainingScore', weeklyForm.trainingScore);
    formData.append('nutritionScore', weeklyForm.nutritionScore);
    formData.append('notes', weeklyForm.notes);
    weeklyForm.photos.slice(0, 3).forEach((file) => formData.append('photos', file));

    try {
      await api.upload('/client-dashboard/weekly-update', formData);
      setMessage('Το εβδομαδιαίο update υποβλήθηκε.');
      setWeeklyOpen(false);
      setWeeklyForm({ weightKg: '', trainingScore: '5', nutritionScore: '5', notes: '', photos: [] });
      loadDashboard();
    } catch (err) {
      setError(err.message || 'Δεν υποβλήθηκε το update.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && (
        <ClientSidebar
          user={user}
          paymentApproved={paymentApproved}
          unreadNotifications={data?.unreadNotifications || 0}
          active="dashboard"
        />
      )}
      <ClientTopbar
        user={user}
        logout={logout}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
        title="Αρχική"
      />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold">Καλωσήρθες, {user?.fullName || 'Πελάτη'}</h2>
              <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                Η προσωπική σου σελίδα για πρόγραμμα, διατροφή και πρόοδο.
              </p>
            </div>
            <Link to="/client-billing" className="grid h-12 place-items-center rounded-md border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              Πληρωμές και Συνδρομή
            </Link>
          </div>

          {error && <Alert tone="red">{error}</Alert>}
          {message && <Alert tone="green">{message}</Alert>}
          {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">Φόρτωση...</div>}

          {!loading && data && (
            <div className="space-y-6">
              {!paymentApproved && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-amber-900 dark:text-amber-200">Η πληρωμή σου είναι σε εκκρεμότητα</h2>
                      <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-300">
                        Μέχρι να εγκριθεί, τα προγράμματα και το progress παραμένουν κλειδωμένα.
                      </p>
                    </div>
                    <Link to="/client-billing" className="grid h-11 place-items-center rounded-md bg-red-600 px-5 font-black text-white hover:bg-red-700">
                      Πληρωμές και Συνδρομή
                    </Link>
                  </div>
                </div>
              )}

              <div className={paymentApproved ? 'space-y-6' : 'pointer-events-none select-none space-y-6 opacity-40 blur-[2px]'}>
                <section className="grid gap-5 lg:grid-cols-4">
                  <StatusCard title="Πρόγραμμα Προπόνησης" value={data.training?.title || 'Δεν έχει ανατεθεί ακόμα'} />
                  <StatusCard title="Πρόγραμμα Διατροφής" value={data.nutrition?.title || 'Δεν έχει ανατεθεί ακόμα'} />
                  <StatusCard title="Τελευταίο Βάρος" value={weights.at(-1)?.weight_kg ? `${weights.at(-1).weight_kg} kg` : '-'} />
                  <WeeklyUpdateCard data={data.weeklyUpdate} onOpen={() => setWeeklyOpen(true)} />
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <Card title="Εβδομαδιαίο πρόγραμμα προπόνησης">
                    {data.training?.days?.length ? (
                      <div className="space-y-4">
                        {data.training.days.map((day) => (
                          <div key={day.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="font-black">{dayNames[day.day_of_week]} - {day.title || 'Προπόνηση'}</h3>
                            <div className="mt-3 space-y-2">
                              {day.exercises.map((exercise) => (
                                <div key={exercise.id} className="rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                                  <div className="font-black">{exercise.exercise_name}</div>
                                  <div className="mt-1 text-slate-600 dark:text-slate-400">
                                    {exercise.sets || '-'} sets x {exercise.reps || '-'} reps · Ξεκούραση {exercise.rest_seconds || '-'} sec · Στόχος {exercise.target_weight || '-'}
                                  </div>
                                  {exercise.notes && <div className="mt-1 text-slate-500">{exercise.notes}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="Ο coach δεν έχει δημιουργήσει ακόμα εβδομαδιαίο πλάνο." />
                    )}
                  </Card>

                  <Card title="Πρόγραμμα διατροφής">
                    {data.nutrition ? (
                      <div>
                        <div className="grid grid-cols-4 gap-3">
                          <Macro label="Θερμίδες" value={data.nutrition.daily_calories || '-'} />
                          <Macro label="Πρωτεΐνη" value={`${data.nutrition.protein_g || '-'}g`} />
                          <Macro label="Υδατ/κες" value={`${data.nutrition.carbs_g || '-'}g`} />
                          <Macro label="Λίπη" value={`${data.nutrition.fat_g || '-'}g`} />
                        </div>
                        <div className="mt-5 space-y-3">
                          {(data.nutrition.meals || []).map((meal) => (
                            <div key={meal.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                              <h3 className="font-black">{dayNames[meal.day_of_week]} - {mealLabels[meal.meal_type]}</h3>
                              <div className="mt-3 space-y-2">
                                {meal.foods.map((food) => (
                                  <div key={food.id} className="flex items-center justify-between rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-950">
                                    <span className="font-bold">{food.food_name} · {food.quantity || '-'}</span>
                                    <span className="text-slate-500">{food.calories || '-'} kcal</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyState text="Ο coach δεν έχει δημιουργήσει ακόμα πρόγραμμα διατροφής." />
                    )}
                  </Card>
                </section>

                <Card title="Πρόοδος">
                  {weights.length ? <WeightChart rows={weights} /> : <EmptyState text="Δεν υπάρχουν ακόμα αρκετά δεδομένα προόδου." />}
                </Card>
              </div>

              {weeklyOpen && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-6">
                  <form onSubmit={submitWeeklyUpdate} className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black">Εβδομαδιαίο update</h2>
                      <button type="button" onClick={() => setWeeklyOpen(false)} className="text-2xl text-slate-500 hover:text-red-600">×</button>
                    </div>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Input label="Τρέχον βάρος" value={weeklyForm.weightKg} onChange={(value) => setWeeklyForm({ ...weeklyForm, weightKg: value })} required />
                      <Score label="Πώς πήγαν οι προπονήσεις;" value={weeklyForm.trainingScore} onChange={(value) => setWeeklyForm({ ...weeklyForm, trainingScore: value })} />
                      <Score label="Πώς ήταν η διατροφή;" value={weeklyForm.nutritionScore} onChange={(value) => setWeeklyForm({ ...weeklyForm, nutritionScore: value })} />
                      <label className="block">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Φωτογραφίες προόδου (max 3)</span>
                        <input type="file" accept="image/*" multiple onChange={(event) => setWeeklyForm({ ...weeklyForm, photos: Array.from(event.target.files || []).slice(0, 3) })} className="mt-2 block w-full rounded-md border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                      <label className="md:col-span-2">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Σημειώσεις / ερωτήσεις προς τον coach</span>
                        <textarea value={weeklyForm.notes} onChange={(event) => setWeeklyForm({ ...weeklyForm, notes: event.target.value })} className="mt-2 min-h-32 w-full rounded-md border border-slate-200 p-3 outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950" />
                      </label>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" onClick={() => setWeeklyOpen(false)} className="h-11 rounded-md border border-slate-200 px-5 font-bold dark:border-slate-700">Άκυρο</button>
                      <button className="h-11 rounded-md bg-red-600 px-5 font-black text-white">Υποβολή</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Alert({ children, tone }) {
  const className = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
    : 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200';
  return <div className={`mb-5 rounded-lg border px-5 py-4 text-sm font-bold ${className}`}>{children}</div>;
}

function StatusCard({ title, value }) {
  return (
    <div className="min-h-[128px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{title}</div>
      <div className="mt-4 text-xl font-black leading-7">{value}</div>
    </div>
  );
}

function WeeklyUpdateCard({ data, onOpen }) {
  const disabled = !data?.available;
  return (
    <div className="min-h-[128px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Εβδομαδιαίο Update</div>
      <div className="mt-3 text-xl font-black">{data?.available ? 'Ανοιχτό σήμερα' : data?.alreadySubmitted ? 'Υποβλήθηκε' : 'Κλειστό'}</div>
      <button disabled={disabled} onClick={onOpen} className="mt-4 h-11 rounded-md bg-red-600 px-5 font-black text-white disabled:bg-slate-300">
        Συμπλήρωση
      </button>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyState({ text }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-950">{text}</div>;
}

function Macro({ label, value }) {
  return (
    <div className="rounded-md bg-slate-50 p-3 text-center dark:bg-slate-950">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}

function WeightChart({ rows }) {
  const max = Math.max(...rows.map((row) => Number(row.weight_kg)), 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? 0 : (index / (rows.length - 1)) * 100;
    const y = 80 - (Number(row.weight_kg) / max) * 70;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 90" className="h-72 w-full">
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.split(' ').map((point) => {
        const [x, y] = point.split(',');
        return <circle key={point} cx={x} cy={y} r="1.8" fill="#2563eb" />;
      })}
    </svg>
  );
}

function Input({ label, value, onChange, required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950" />
    </label>
  );
}

function Score({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300 dark:border-slate-700 dark:bg-slate-950">
        {[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}
      </select>
    </label>
  );
}
