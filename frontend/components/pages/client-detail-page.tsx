"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl, getInitials } from "@/lib/media";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AreaChart } from "@tremor/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SocialLink {
  platform: string;
  url: string;
}

interface Payment {
  id: number | string;
  amount?: number | string | null;
  currency?: string;
  created_at?: string;
  method?: string;
  reference_number?: string;
  proof_url?: string;
  status?: string;
}

interface WeeklyUpdate {
  id: number | string;
  weight_kg?: number | string;
  submitted_at?: string;
  training_score?: number | string;
  nutrition_score?: number | string;
  notes?: string;
}

interface ProgressPhoto {
  id: number | string;
  photo_url?: string;
  angle?: string;
}

interface ProgressUpdate {
  id: number | string;
  weight_kg?: number | string;
  submitted_at?: string;
  photos?: ProgressPhoto[];
  notes?: string;
}

interface Onboarding {
  goal?: string;
  date_of_birth?: string;
  occupation_schedule?: string;
  health_problem?: string;
  injuries?: string;
  cycle_history?: string;
  cardio_sessions_per_week?: string | number;
  sleep_schedule?: string;
  current_training_plan?: string;
  current_nutrition_plan?: string;
  previous_plan_history?: string;
  selected_package?: string;
  update_day?: number;
  [key: string]: unknown;
}

interface Subscription {
  status?: string;
  start_date?: string;
  end_date?: string;
}

interface UpdateSchedule {
  day_of_week?: number;
  next_due_date?: string;
}

interface ClientRecord {
  id?: number | string;
  full_name?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  weight_kg?: number | string;
  height_cm?: number | string;
  date_of_birth?: string;
  gender?: string;
  medical_notes?: string;
  fitness_goal?: string;
  coach_notes?: string;
  discord_id?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  profile_photo?: string | null;
  user_status?: string;
  status?: string;
  onboarding?: Onboarding;
  payments?: Payment[];
  weeklyUpdates?: WeeklyUpdate[];
  progressUpdates?: ProgressUpdate[];
  socialLinks?: SocialLink[];
  subscription?: Subscription;
  updateSchedule?: UpdateSchedule;
}

interface LibraryExercise {
  id: number | string;
  name?: string;
  muscleGroup?: string;
  equipment?: string;
  type?: string;
  imageUrl?: string;
  image_url?: string;
  videoUrl?: string;
  video_url?: string;
}

interface TrainingExerciseEntry {
  exerciseId: string | number;
  exerciseName: string;
  muscleGroup: string;
  imageUrl: string;
  videoUrl: string;
  sets: string | number;
  reps: string | number;
  tempo: string;
  restSeconds: string | number;
  targetWeight: string | number;
  notes: string;
}

interface TrainingDayEntry {
  dayOfWeek: number;
  title: string;
  notes: string;
  exercises: TrainingExerciseEntry[];
}

interface TrainingPlanState {
  title: string;
  description: string;
  durationWeeks: number | string;
  difficulty: string;
  dayCount?: number;
  days: TrainingDayEntry[];
}

interface RawTrainingExercise {
  exercise_id?: string | number;
  exerciseId?: string | number;
  exercise_name?: string;
  exerciseName?: string;
  muscle_group?: string;
  muscleGroup?: string;
  image_url?: string;
  imageUrl?: string;
  video_url?: string;
  videoUrl?: string;
  sets?: string | number;
  reps?: string | number;
  tempo?: string;
  rest_seconds?: string | number;
  restSeconds?: string | number;
  target_weight?: string | number;
  targetWeight?: string | number;
  notes?: string;
}

interface RawTrainingDay {
  day_of_week?: number;
  dayOfWeek?: number;
  title?: string;
  notes?: string;
  exercises?: RawTrainingExercise[];
}

interface RawTrainingPlan {
  id?: number | string;
  days?: RawTrainingDay[];
  day_count?: number;
  dayCount?: number;
  title?: string;
  description?: string;
  duration_weeks?: number | string;
  durationWeeks?: number | string;
  difficulty?: string;
}

interface FoodEntry {
  foodName: string;
  quantity: string | number;
  calories: string | number;
  proteinG: string | number;
  carbsG: string | number;
  fatG: string | number;
}

interface MealEntry {
  mealType: string;
  title: string;
  notes: string;
  foods: FoodEntry[];
}

interface NutritionPlanState {
  title: string;
  description: string;
  dailyCalories: string | number;
  proteinG: string | number;
  carbsG: string | number;
  fatG: string | number;
  notes: string;
  meals: MealEntry[];
}

interface RawFood {
  food_name?: string;
  foodName?: string;
  quantity?: string | number;
  calories?: string | number;
  protein_g?: string | number;
  proteinG?: string | number;
  carbs_g?: string | number;
  carbsG?: string | number;
  fat_g?: string | number;
  fatG?: string | number;
}

interface RawMeal {
  meal_type?: string;
  mealType?: string;
  title?: string;
  notes?: string;
  foods?: RawFood[];
}

interface RawNutritionPlan {
  id?: number | string;
  meals?: RawMeal[];
  title?: string;
  description?: string;
  daily_calories?: string | number;
  protein_g?: string | number;
  carbs_g?: string | number;
  fat_g?: string | number;
  notes?: string;
}

interface StatusMetaResult {
  label: string;
  className: string;
}

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const dayLabels = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];
const tabs = [
  { id: "overview", label: "Επισκόπηση" },
  { id: "progress", label: "Πρόοδος" },
  { id: "payments", label: "Ιστορικό Πληρωμών" },
  { id: "training", label: "Πρόγραμμα Προπόνησης" },
  { id: "nutrition", label: "Πρόγραμμα Διατροφής" },
  { id: "messages", label: "Μηνύματα" },
];

function emptyTrainingDay(dayOfWeek: number): TrainingDayEntry {
  return {
    dayOfWeek,
    title: dayLabels[dayOfWeek],
    notes: "",
    exercises: [],
  };
}

function defaultTrainingPlan(): TrainingPlanState {
  return {
    title: "Πρόγραμμα Προπόνησης",
    description: "",
    durationWeeks: 4,
    difficulty: "intermediate",
    days: [1, 2, 3, 4, 5, 6, 0].map(emptyTrainingDay),
  };
}

function defaultNutritionPlan(): NutritionPlanState {
  return {
    title: "Πρόγραμμα Διατροφής",
    description: "",
    dailyCalories: "",
    proteinG: "",
    carbsG: "",
    fatG: "",
    notes: "",
    meals: [
      { mealType: "breakfast", title: "Πρωινό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "lunch", title: "Μεσημεριανό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "snack", title: "Σνακ", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
      { mealType: "dinner", title: "Βραδινό", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] },
    ],
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("el-GR");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
}

function money(amount?: number | string | null, currency = "EUR"): string {
  if (amount === null || amount === undefined || amount === "") return "-";
  return `${Number(amount).toFixed(2)} ${currency || "EUR"}`;
}

function daysRemaining(endDate?: string | null): string {
  if (!endDate) return "-";
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return "-";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "Έληξε";
  if (days === 0) return "Λήγει σήμερα";
  return `${days} ημέρες`;
}

const paymentStatusLabels: Record<string, string> = {
  completed: "Πληρωμένο",
  pending: "Εκκρεμεί",
  failed: "Απέτυχε",
  refunded: "Επιστράφηκε",
};

function statusMeta(client: ClientRecord | null): StatusMetaResult {
  const userStatus = client?.user_status || client?.status;
  const paymentStatus = client?.payments?.[0]?.status;
  const subscriptionStatus = client?.subscription?.status;

  if (userStatus === "active" || subscriptionStatus === "active") {
    return { label: "Ενεργός", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" };
  }
  if (userStatus === "pending_payment" || paymentStatus === "pending") {
    return { label: "Εκκρεμής", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" };
  }
  return { label: "Ανενεργός", className: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" };
}

function normalizeTrainingPlan(plan?: RawTrainingPlan | null): TrainingPlanState {
  const base = defaultTrainingPlan();
  if (!plan?.id && !plan?.days?.length) return base;
  const daysByWeek = new Map((plan.days || []).map((day) => [Number(day.day_of_week ?? day.dayOfWeek), day]));
  const dayCount = Number(plan.day_count || plan.dayCount || plan.days?.length || base.days.length);

  return {
    title: plan.title || base.title,
    description: plan.description || "",
    durationWeeks: plan.duration_weeks || plan.durationWeeks || 4,
    difficulty: plan.difficulty || "intermediate",
    dayCount,
    days: base.days.slice(0, dayCount).map((defaultDay) => {
      const source = daysByWeek.get(defaultDay.dayOfWeek);
      return {
        dayOfWeek: defaultDay.dayOfWeek,
        title: source?.title || defaultDay.title,
        notes: source?.notes || "",
        exercises: (source?.exercises || []).map((exercise) => ({
          exerciseId: exercise.exercise_id || exercise.exerciseId || "",
          exerciseName: exercise.exercise_name || exercise.exerciseName || "",
          muscleGroup: exercise.muscle_group || exercise.muscleGroup || "",
          imageUrl: exercise.image_url || exercise.imageUrl || "",
          videoUrl: exercise.video_url || exercise.videoUrl || "",
          sets: exercise.sets || "",
          reps: exercise.reps || "",
          tempo: exercise.tempo || "",
          restSeconds: exercise.rest_seconds || exercise.restSeconds || "",
          targetWeight: exercise.target_weight || exercise.targetWeight || "",
          notes: exercise.notes || "",
        })),
      };
    }),
  };
}

function normalizeNutritionPlan(plan?: RawNutritionPlan | null): NutritionPlanState {
  const base = defaultNutritionPlan();
  if (!plan?.id && !plan?.meals?.length) return base;

  return {
    title: plan.title || base.title,
    description: plan.description || "",
    dailyCalories: plan.daily_calories || "",
    proteinG: plan.protein_g || "",
    carbsG: plan.carbs_g || "",
    fatG: plan.fat_g || "",
    notes: plan.notes || "",
    meals: (plan.meals?.length ? (plan.meals as RawMeal[]) : (base.meals as RawMeal[])).map((meal) => ({
      mealType: meal.meal_type || meal.mealType || "other",
      title: meal.title || "",
      notes: meal.notes || "",
      foods: (
        meal.foods?.length
          ? (meal.foods as RawFood[])
          : ([{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] as RawFood[])
      ).map((food) => ({
        foodName: food.food_name || food.foodName || "",
        quantity: food.quantity || "",
        calories: food.calories || "",
        proteinG: food.protein_g || food.proteinG || "",
        carbsG: food.carbs_g || food.carbsG || "",
        fatG: food.fat_g || food.fatG || "",
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function ClientDetailContent({ clientId }: { clientId: string }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [client, setClient] = useState<ClientRecord | null>(null);
  const [exercises, setExercises] = useState<LibraryExercise[]>([]);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlanState>(defaultTrainingPlan);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanState>(defaultNutritionPlan);
  const [loading, setLoading] = useState(true);
  const [savingTraining, setSavingTraining] = useState(false);
  const [savingNutrition, setSavingNutrition] = useState(false);
  const [approvingPayment, setApprovingPayment] = useState(false);
  const [rejectingPaymentId, setRejectingPaymentId] = useState<number | string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadClientDetail = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<ClientRecord>(`/clients/${clientId}`),
      api.get<LibraryExercise[]>("/exercises").catch(() => []),
      api.get<RawTrainingPlan>(`/training-plans/${clientId}/full`).catch(() => ({ days: [] })),
      api.get<RawNutritionPlan>(`/nutrition-plans/${clientId}/full`).catch(() => ({ meals: [] })),
    ])
      .then(([clientData, exerciseRows, trainingData, nutritionData]) => {
        setClient(clientData);
        setExercises(Array.isArray(exerciseRows) ? exerciseRows : []);
        setTrainingPlan(normalizeTrainingPlan(trainingData));
        setNutritionPlan(normalizeNutritionPlan(nutritionData));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκε ο πελάτης."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClientDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const onboarding = client?.onboarding || {};
  const displayName = client?.full_name || client?.email || "Πελάτης";
  const currentStatus = useMemo(() => statusMeta(client), [client]);

  const createNewTrainingPlan = async () => {
    const blank = defaultTrainingPlan();
    setSavingTraining(true);
    setMessage("");
    setError("");
    try {
      const response = await api.put<{ plan: RawTrainingPlan }>(`/training-plans/${clientId}/full`, { ...blank, createNew: true });
      setTrainingPlan(normalizeTrainingPlan(response.plan));
      setMessage("Δημιουργήθηκε νέο πρόγραμμα προπόνησης. Το προηγούμενο μετακινήθηκε στο ιστορικό.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν δημιουργήθηκε νέο πρόγραμμα.");
    } finally {
      setSavingTraining(false);
    }
  };

  const saveTrainingPlan = async () => {
    setSavingTraining(true);
    setMessage("");
    setError("");
    try {
      const response = await api.put<{ plan: RawTrainingPlan }>(`/training-plans/${clientId}/full`, trainingPlan);
      setTrainingPlan(normalizeTrainingPlan(response.plan));
      setMessage("Το πρόγραμμα προπόνησης αποθηκεύτηκε.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε το πρόγραμμα προπόνησης.");
    } finally {
      setSavingTraining(false);
    }
  };

  const saveNutritionPlan = async () => {
    setSavingNutrition(true);
    setMessage("");
    setError("");
    try {
      const response = await api.put<{ plan: RawNutritionPlan }>(`/nutrition-plans/${clientId}/full`, nutritionPlan);
      setNutritionPlan(normalizeNutritionPlan(response.plan));
      setMessage("Το πρόγραμμα διατροφής αποθηκεύτηκε.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε το πρόγραμμα διατροφής.");
    } finally {
      setSavingNutrition(false);
    }
  };

  const createNewNutritionPlan = async () => {
    const blank = defaultNutritionPlan();
    setSavingNutrition(true);
    setMessage("");
    setError("");
    try {
      const response = await api.put<{ plan: RawNutritionPlan }>(`/nutrition-plans/${clientId}/full`, { ...blank, createNew: true });
      setNutritionPlan(normalizeNutritionPlan(response.plan));
      setMessage("Δημιουργήθηκε νέο πρόγραμμα διατροφής. Το προηγούμενο μετακινήθηκε στο ιστορικό.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν δημιουργήθηκε νέο πρόγραμμα.");
    } finally {
      setSavingNutrition(false);
    }
  };

  const approvePayment = async (paymentId: number | string) => {
    const confirmed = window.confirm("Θέλεις να εγκρίνεις χειροκίνητα την πληρωμή και να ενεργοποιηθεί ο πελάτης;");
    if (!confirmed) return;

    setApprovingPayment(true);
    setMessage("");
    setError("");
    try {
      await api.post(`/clients/${clientId}/approve-payment`, { paymentId });
      setMessage("Η πληρωμή εγκρίθηκε και ο πελάτης ενεργοποιήθηκε.");
      loadClientDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν εγκρίθηκε η πληρωμή.");
    } finally {
      setApprovingPayment(false);
    }
  };

  const rejectPayment = async (paymentId: number | string) => {
    const confirmed = window.confirm("Θέλεις σίγουρα να απορρίψεις αυτή την πληρωμή; Ο πελάτης θα ενημερωθεί.");
    if (!confirmed) return;

    setRejectingPaymentId(paymentId);
    setMessage("");
    setError("");
    try {
      await api.post(`/clients/${clientId}/reject-payment`, { paymentId });
      setMessage("Η πληρωμή απορρίφθηκε και ο πελάτης ενημερώθηκε.");
      loadClientDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν απορρίφθηκε η πληρωμή.");
    } finally {
      setRejectingPaymentId(null);
    }
  };

  return (
    <CoachShell title="Καρτέλα Πελάτη" user={user} logout={logout}>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm font-bold">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700">Dashboard</Link>
        <span className="text-slate-400 dark:text-slate-500">/</span>
        <Link href="/clients" className="text-blue-600 hover:text-blue-700">Πελάτες</Link>
        <span className="text-slate-400 dark:text-slate-500">/</span>
        <span className="text-slate-500 dark:text-slate-400">{displayName}</span>
      </div>

      {loading && <StateBox text="Φόρτωση πελάτη..." />}
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
      {message && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">{message}</div>}

      {!loading && client && (
        <div className="space-y-6">
          <ClientHeader client={client} displayName={displayName} currentStatus={currentStatus} onboarding={onboarding} />

          {currentStatus.label !== "Ενεργός" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-amber-900 dark:text-amber-300">Ο πελάτης δεν έχει ενεργή πληρωμή</h3>
                  <p className="mt-1 text-sm font-bold text-amber-800 dark:text-amber-400">
                    Κατάσταση: {currentStatus.label}. Τα προγράμματα μπορεί να υπάρχουν, αλλά ο πελάτης θα τα βλέπει κλειδωμένα μέχρι να εγκριθεί η πληρωμή του.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={`h-auto w-fit rounded-md px-4 py-2 text-sm font-bold ${currentStatus.className}`}>
                    {currentStatus.label}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <Card className="p-2">
              <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-11 rounded-md px-5 text-sm font-bold text-slate-600 data-active:bg-red-600 data-active:text-white data-active:shadow-sm hover:bg-slate-100 hover:text-slate-950 dark:data-active:bg-red-600 dark:data-active:text-white"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Card>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab client={client} clientId={clientId} onboarding={onboarding} onUpdated={loadClientDetail} />
            </TabsContent>

            <TabsContent value="progress" className="mt-6">
              <ProgressTab client={client} />
            </TabsContent>

            <TabsContent value="payments" className="mt-6">
              <PaymentsTab
                client={client}
                clientId={clientId}
                onApprovePayment={approvePayment}
                onRejectPayment={rejectPayment}
                approvingPayment={approvingPayment}
                rejectingPaymentId={rejectingPaymentId}
                onUpdated={loadClientDetail}
              />
            </TabsContent>

            <TabsContent value="training" className="mt-6">
              <TrainingPlanEditor
                clientId={clientId}
                plan={trainingPlan}
                setPlan={setTrainingPlan}
                exercises={exercises}
                onSave={saveTrainingPlan}
                onCreateNew={createNewTrainingPlan}
                saving={savingTraining}
              />
            </TabsContent>

            <TabsContent value="nutrition" className="mt-6">
              <NutritionPlanEditor
                clientId={clientId}
                plan={nutritionPlan}
                setPlan={setNutritionPlan}
                onSave={saveNutritionPlan}
                onCreateNew={createNewNutritionPlan}
                saving={savingNutrition}
              />
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessagesTab clientId={clientId} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </CoachShell>
  );
}

// ---------------------------------------------------------------------------
// Header + overview
// ---------------------------------------------------------------------------

function ClientHeader({
  client,
  displayName,
  currentStatus,
  onboarding,
}: {
  client: ClientRecord;
  displayName: string;
  currentStatus: StatusMetaResult;
  onboarding: Onboarding;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar initials={getInitials(displayName)} photoUrl={client.profile_photo} size="h-28 w-28" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold">{displayName}</h2>
              <Badge className={`h-auto rounded-md px-3 py-1.5 text-sm font-bold ${currentStatus.className}`}>{currentStatus.label}</Badge>
              {(client.fitness_goal || onboarding.goal) && (
                <Badge variant="outline" className="h-auto rounded-md px-3 py-1.5 text-sm font-bold">
                  {client.fitness_goal || onboarding.goal}
                </Badge>
              )}
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400">
              <span>{client.email || "-"}</span>
              <span>{client.phone || "-"}</span>
              <span>Μέλος από: {formatDate(client.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Τρέχον βάρος" value={client.weight_kg ? `${client.weight_kg} kg` : "-"} />
          <Metric label="Ημέρες συνδρομής" value={daysRemaining(client.subscription?.end_date)} />
          <Metric label="Επόμενο update" value={client.updateSchedule?.next_due_date ? formatDate(client.updateSchedule.next_due_date) : "-"} />
          <Metric
            label="Πληρωμή"
            value={client.payments?.[0]?.status ? paymentStatusLabels[client.payments[0].status] || client.payments[0].status : "-"}
          />
        </div>
      </div>
    </Card>
  );
}

interface ClientDetailsForm {
  dateOfBirth: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  fitnessGoal: string;
  medicalNotes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  discordId: string;
  coachNotes: string;
}

function toDetailsForm(client: ClientRecord): ClientDetailsForm {
  return {
    dateOfBirth: client.date_of_birth ? String(client.date_of_birth).slice(0, 10) : "",
    gender: client.gender || "",
    heightCm: client.height_cm !== undefined && client.height_cm !== null ? String(client.height_cm) : "",
    weightKg: client.weight_kg !== undefined && client.weight_kg !== null ? String(client.weight_kg) : "",
    fitnessGoal: client.fitness_goal || "",
    medicalNotes: client.medical_notes || "",
    emergencyContactName: client.emergency_contact_name || "",
    emergencyContactPhone: client.emergency_contact_phone || "",
    discordId: client.discord_id || "",
    coachNotes: client.coach_notes || "",
  };
}

function OverviewTab({
  client,
  clientId,
  onboarding,
  onUpdated,
}: {
  client: ClientRecord;
  clientId: string;
  onboarding: Onboarding;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<ClientDetailsForm>(() => toDetailsForm(client));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setForm(toDetailsForm(client));
  }, [client]);

  const updateField = <K extends keyof ClientDetailsForm>(field: K, value: ClientDetailsForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveDetails = async () => {
    setSaving(true);
    setSaveMessage("");
    setSaveError("");
    try {
      await api.put(`/clients/${clientId}/details`, form);
      setSaveMessage("Τα στοιχεία αποθηκεύτηκαν.");
      onUpdated();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Δεν έγινε αποθήκευση.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {(saveMessage || saveError) && (
        <div
          className={`rounded-lg border p-4 text-sm font-bold ${
            saveError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
          }`}
        >
          {saveError || saveMessage}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        <InfoCard title="Στοιχεία">
          <div className="space-y-3">
            <EditField label="Ημερομηνία γέννησης" type="date" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} />
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Φύλο</Label>
              <Select
                items={[
                  { value: "male", label: "Άνδρας" },
                  { value: "female", label: "Γυναίκα" },
                  { value: "other", label: "Άλλο" },
                ]}
                value={form.gender}
                onValueChange={(value) => updateField("gender", value ?? "")}
              >
                <SelectTrigger className="mt-1 h-10 w-full text-sm font-semibold">
                  <SelectValue placeholder="Επιλογή" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Άνδρας</SelectItem>
                  <SelectItem value="female">Γυναίκα</SelectItem>
                  <SelectItem value="other">Άλλο</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <EditField label="Ύψος (cm)" type="number" value={form.heightCm} onChange={(value) => updateField("heightCm", value)} />
            <EditField label="Βάρος (kg)" type="number" value={form.weightKg} onChange={(value) => updateField("weightKg", value)} />
            <EditField label="Στόχος" value={form.fitnessGoal} onChange={(value) => updateField("fitnessGoal", value)} />
            <div>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ιατρικές σημειώσεις</Label>
              <Textarea className="mt-1" value={form.medicalNotes} onChange={(event) => updateField("medicalNotes", event.target.value)} />
            </div>
          </div>
        </InfoCard>
        <InfoCard title="Συνδρομή">
          <Info label="Κατάσταση" value={client.subscription?.status || "-"} />
          <Info label="Έναρξη" value={formatDate(client.subscription?.start_date)} />
          <Info label="Λήξη" value={formatDate(client.subscription?.end_date)} />
          <Info label="Πακέτο" value={onboarding.selected_package || "-"} />
          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <EditField label="Επαφή έκτακτης ανάγκης" value={form.emergencyContactName} onChange={(value) => updateField("emergencyContactName", value)} />
            <EditField label="Τηλέφωνο έκτακτης ανάγκης" value={form.emergencyContactPhone} onChange={(value) => updateField("emergencyContactPhone", value)} />
          </div>
        </InfoCard>
        <InfoCard title="Social Media & Discord">
          {client.socialLinks?.length ? (
            client.socialLinks.map((item) => <Info key={`${item.platform}-${item.url}`} label={item.platform} value={item.url} />)
          ) : (
            <EmptyInline text="Δεν υπάρχουν social links." />
          )}
          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <EditField label="Discord ID" value={form.discordId} onChange={(value) => updateField("discordId", value)} />
          </div>
        </InfoCard>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={saveDetails} disabled={saving} className="h-10 px-6 font-bold">
          {saving ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
        </Button>
      </div>

      <InfoCard title="Onboarding φόρμα">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Info label="Επάγγελμα / πρόγραμμα" value={onboarding.occupation_schedule || "-"} />
          <Info label="Πρόβλημα υγείας" value={onboarding.health_problem || "-"} />
          <Info label="Τραυματισμοί" value={onboarding.injuries || "-"} />
          <Info label="Κύκλος" value={onboarding.cycle_history || "-"} />
          <Info label="Αερόβιες / εβδομάδα" value={onboarding.cardio_sessions_per_week || "-"} />
          <Info label="Ύπνος" value={onboarding.sleep_schedule || "-"} />
          <Info label="Προπόνηση τώρα" value={onboarding.current_training_plan || "-"} />
          <Info label="Διατροφή τώρα" value={onboarding.current_nutrition_plan || "-"} />
          <Info label="Ιστορικό πλάνων" value={onboarding.previous_plan_history || "-"} />
        </div>
      </InfoCard>

      <ListCard title="Πληρωμές">
        {client.payments?.length ? (
          client.payments.slice(0, 5).map((payment) => (
            <div key={payment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-bold text-slate-950 dark:text-slate-50">{money(payment.amount, payment.currency)}</div>
                <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{formatDateTime(payment.created_at)}</div>
              </div>
              <Badge
                className={`h-auto w-fit rounded-md px-3 py-1 text-sm font-bold ${
                  payment.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                    : payment.status === "pending"
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {payment.status === "completed" ? "Εγκρίθηκε" : payment.status === "pending" ? "Εκκρεμής" : payment.status || "-"}
              </Badge>
            </div>
          ))
        ) : (
          <EmptyRow text="Δεν υπάρχουν πληρωμές ακόμα." />
        )}
      </ListCard>

      <InfoCard title="Ιδιωτικές σημειώσεις coach">
        <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Ορατές μόνο σε coach/admin — ο πελάτης δεν τις βλέπει ποτέ.</p>
        <Textarea
          className="min-h-24"
          value={form.coachNotes}
          onChange={(event) => updateField("coachNotes", event.target.value)}
          placeholder="Δεν υπάρχουν σημειώσεις coach."
        />
      </InfoCard>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Input type={type} className="mt-1 h-10 text-sm font-semibold" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments tab
// ---------------------------------------------------------------------------

function PaymentsTab({
  client,
  clientId,
  onApprovePayment,
  onRejectPayment,
  approvingPayment,
  rejectingPaymentId,
  onUpdated,
}: {
  client: ClientRecord;
  clientId: string;
  onApprovePayment: (paymentId: number | string) => void;
  onRejectPayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
  rejectingPaymentId: number | string | null;
  onUpdated: () => void;
}) {
  const payments = client.payments || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "cash", status: "completed", referenceNumber: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const submitManualPayment = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post(`/clients/${clientId}/payments`, { ...form, amount: Number(form.amount) });
      setOpen(false);
      setForm({ amount: "", method: "cash", status: "completed", referenceNumber: "", notes: "" });
      onUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Δεν καταχωρήθηκε η πληρωμή.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Info label="Κατάσταση πληρωμής" value={client.payments?.[0]?.status ? paymentStatusLabels[client.payments[0].status] || client.payments[0].status : "-"} />
          <Info label="Συνδρομή" value={`${formatDate(client.subscription?.start_date)} — ${formatDate(client.subscription?.end_date)}`} />
          <Info label="Ημέρες που απομένουν" value={daysRemaining(client.subscription?.end_date)} />
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <CardTitle className="text-xl font-bold">Ιστορικό Πληρωμών</CardTitle>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Όλες οι πληρωμές του πελάτη και οι χειροκίνητες ενέργειες έγκρισης.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>Νέα Πληρωμή</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Νέα Πληρωμή</DialogTitle>
                <DialogDescription>Καταχώρησε μια πληρωμή που έγινε εκτός εφαρμογής (μετρητά, κάρτα κ.λπ.).</DialogDescription>
              </DialogHeader>
              <form onSubmit={submitManualPayment} className="space-y-4">
                {formError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                    {formError}
                  </div>
                )}
                <EditField label="Ποσό (EUR)" type="number" value={form.amount} onChange={(value) => setForm((f) => ({ ...f, amount: value }))} />
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Τρόπος πληρωμής</Label>
                  <Select
                    items={[
                      { value: "cash", label: "Μετρητά" },
                      { value: "bank_transfer", label: "Τραπεζικό έμβασμα" },
                      { value: "card", label: "Κάρτα" },
                      { value: "paypal", label: "PayPal" },
                      { value: "stripe", label: "Stripe" },
                      { value: "other", label: "Άλλο" },
                    ]}
                    value={form.method}
                    onValueChange={(value) => value && setForm((f) => ({ ...f, method: value }))}
                  >
                    <SelectTrigger className="mt-1 h-10 w-full text-sm font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Μετρητά</SelectItem>
                      <SelectItem value="bank_transfer">Τραπεζικό έμβασμα</SelectItem>
                      <SelectItem value="card">Κάρτα</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="other">Άλλο</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <EditField label="Reference" value={form.referenceNumber} onChange={(value) => setForm((f) => ({ ...f, referenceNumber: value }))} />
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Αποθήκευση..." : "Καταχώρηση"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

      <Table>
        <TableHeader className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
          <TableRow>
            <TableHead className="px-5 py-4">Ημερομηνία</TableHead>
            <TableHead className="px-5 py-4">Ποσό</TableHead>
            <TableHead className="px-5 py-4">Τρόπος</TableHead>
            <TableHead className="px-5 py-4">Reference</TableHead>
            <TableHead className="px-5 py-4">Αποδεικτικό</TableHead>
            <TableHead className="px-5 py-4">Status</TableHead>
            <TableHead className="px-5 py-4">Ενέργειες</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
          {payments.map((payment) => (
            <TableRow key={payment.id} className="align-top">
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(payment.created_at)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-bold text-slate-950 dark:text-slate-50">{money(payment.amount, payment.currency)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                {payment.method === "bank_transfer" ? "Τραπεζικό έμβασμα" : payment.method || "-"}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-500 dark:text-slate-400">{payment.reference_number || "-"}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                {payment.proof_url ? (
                  <a href={resolveMediaUrl(payment.proof_url)} target="_blank" rel="noreferrer" className="font-bold text-blue-600 hover:text-blue-700">
                    Προβολή
                  </a>
                ) : (
                  <span className="font-semibold text-slate-400 dark:text-slate-500">-</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                <PaymentStatus status={payment.status} />
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                {payment.status === "pending" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => onApprovePayment(payment.id)}
                      disabled={approvingPayment}
                      className="h-9 bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                    >
                      {approvingPayment ? "Έγκριση..." : "Έγκριση"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRejectPayment(payment.id)}
                      disabled={rejectingPaymentId === payment.id}
                      className="h-9 border-red-200 px-4 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      {rejectingPaymentId === payment.id ? "Απόρριψη..." : "Απόρριψη"}
                    </Button>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-400 dark:text-slate-500">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!payments.length && (
            <TableRow>
              <TableCell colSpan={7} className="whitespace-normal px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                Δεν υπάρχουν πληρωμές ακόμα.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </Card>
    </div>
  );
}

function PaymentStatus({ status }: { status?: string }) {
  const meta: Record<string, [string, string]> = {
    completed: ["Εγκρίθηκε", "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"],
    pending: ["Εκκρεμής", "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"],
    failed: ["Απορρίφθηκε", "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"],
    refunded: ["Επιστροφή", "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"],
  };
  const [label, className] = meta[status || ""] || [status || "-", "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"];

  return <Badge className={`h-auto rounded-md px-3 py-1 text-sm font-bold ${className}`}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Progress tab
// ---------------------------------------------------------------------------

function exportWeeklyUpdatesCsv(updates: WeeklyUpdate[], clientName: string) {
  const header = ["Ημερομηνία", "Βάρος (kg)", "Training rating", "Nutrition rating", "Notes"];
  const rows = updates.map((update) => [
    formatDateTime(update.submitted_at),
    update.weight_kg ?? "",
    update.training_score ?? "",
    update.nutrition_score ?? "",
    (update.notes || "").replace(/"/g, '""'),
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `weekly-updates-${slugifyName(clientName)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function slugifyName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
}

function ProgressTab({ client }: { client: ClientRecord }) {
  const weeklyUpdates = client.weeklyUpdates || [];
  const chartData = [...weeklyUpdates]
    .filter((update) => update.weight_kg)
    .reverse()
    .map((update) => ({ date: formatDate(update.submitted_at), Βάρος: Number(update.weight_kg) }));

  const recentPhotos = (client.progressUpdates || [])
    .flatMap((update) => update.photos || [])
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Εξέλιξη βάρους</h3>
        </div>
        {chartData.length ? (
          <AreaChart className="h-64" data={chartData} index="date" categories={["Βάρος"]} colors={["blue"]} showLegend={false} showAnimation />
        ) : (
          <EmptyRow text="Δεν υπάρχουν αρκετά δεδομένα για γράφημα ακόμα." />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-4 text-lg font-bold">Πρόσφατες φωτογραφίες προόδου</h3>
        {recentPhotos.length ? (
          <div className="grid grid-cols-3 gap-3">
            {recentPhotos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={photo.id}
                src={resolveMediaUrl(photo.photo_url)}
                alt=""
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        ) : (
          <EmptyRow text="Δεν υπάρχουν φωτογραφίες προόδου ακόμα." />
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <CardTitle className="text-xl font-bold">Εβδομαδιαία Updates</CardTitle>
          <Button
            type="button"
            variant="outline"
            disabled={!weeklyUpdates.length}
            onClick={() => exportWeeklyUpdatesCsv(weeklyUpdates, client.full_name || client.email || "client")}
          >
            Export CSV
          </Button>
        </CardHeader>
        <Table>
          <TableHeader className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <TableRow>
              <TableHead className="px-5 py-4">Ημερομηνία</TableHead>
              <TableHead className="px-5 py-4">Βάρος</TableHead>
              <TableHead className="px-5 py-4">Training rating</TableHead>
              <TableHead className="px-5 py-4">Nutrition rating</TableHead>
              <TableHead className="px-5 py-4">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
            {weeklyUpdates.map((update) => (
              <TableRow key={update.id}>
                <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(update.submitted_at)}</TableCell>
                <TableCell className="px-5 py-4 font-bold text-slate-950 dark:text-slate-50">{update.weight_kg ? `${update.weight_kg} kg` : "-"}</TableCell>
                <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{update.training_score ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{update.nutrition_score ?? "-"}</TableCell>
                <TableCell className="px-5 py-4 font-semibold text-slate-500 dark:text-slate-400">{update.notes || "-"}</TableCell>
              </TableRow>
            ))}
            {!weeklyUpdates.length && (
              <TableRow>
                <TableCell colSpan={5} className="px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                  Δεν υπάρχουν εβδομαδιαία updates ακόμα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Training plan editor
// ---------------------------------------------------------------------------

function TrainingPlanEditor({
  clientId,
  plan,
  setPlan,
  exercises,
  onSave,
  onCreateNew,
  saving,
}: {
  clientId: string;
  plan: TrainingPlanState;
  setPlan: React.Dispatch<React.SetStateAction<TrainingPlanState>>;
  exercises: LibraryExercise[];
  onSave: () => void;
  onCreateNew: () => void;
  saving: boolean;
}) {
  const [history, setHistory] = useState<PlanHistoryRow[]>([]);
  useEffect(() => {
    api
      .get<PlanHistoryRow[]>(`/training-plans/${clientId}`)
      .then(setHistory)
      .catch(() => setHistory([]));
    // Re-fetch once a save/create-new finishes (saving flips back to false) so history
    // reflects the just-archived plan without needing a full page reload.
  }, [clientId, saving]);

  const initialIndex = plan.days?.findIndex((day) => day.exercises?.length) ?? 0;
  const [activeDayIndex, setActiveDayIndex] = useState(Math.max(0, initialIndex));
  const visibleDays = (plan.days || []).slice(0, plan.dayCount || plan.days?.length || 1);
  const selectedDay = visibleDays[activeDayIndex] || visibleDays[0];
  const muscleGroups = [...new Set((selectedDay?.exercises || []).map((exercise) => exercise.muscleGroup).filter(Boolean))];

  const setDayCount = (count: number) => {
    const nextCount = Number(count);
    setPlan((current) => {
      const nextDays = [...current.days];
      while (nextDays.length < nextCount) {
        const dayOfWeek = nextDays.length + 1 > 6 ? 0 : nextDays.length + 1;
        nextDays.push(emptyTrainingDay(dayOfWeek));
      }
      return { ...current, dayCount: nextCount, days: nextDays.slice(0, nextCount) };
    });
    setActiveDayIndex((index) => Math.min(index, nextCount - 1));
  };

  const updateDay = (dayIndex: number, patch: Partial<TrainingDayEntry>) => {
    setPlan((current) => ({
      ...current,
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
    }));
  };

  const addExercise = (dayIndex: number) => {
    updateDay(dayIndex, {
      exercises: [
        ...(plan.days[dayIndex]?.exercises || []),
        { exerciseId: "", exerciseName: "", muscleGroup: "", imageUrl: "", videoUrl: "", sets: "", reps: "", tempo: "", restSeconds: "", targetWeight: "", notes: "" },
      ],
    });
  };

  const updateExercise = (dayIndex: number, exerciseIndex: number, patch: Partial<TrainingExerciseEntry>) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, {
      exercises: day.exercises.map((exercise, index) => (index === exerciseIndex ? { ...exercise, ...patch } : exercise)),
    });
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const day = plan.days[dayIndex];
    updateDay(dayIndex, { exercises: day.exercises.filter((_, index) => index !== exerciseIndex) });
  };

  return (
    <Card className="p-0">
      <PlanHeader
        title="Πρόγραμμα Προπόνησης"
        subtitle="Διάλεξε ημέρες, βάλε ασκήσεις από τη βιβλιοθήκη και συμπλήρωσε Σετ, Επαναλ., Tempo και Rest."
        onSave={onSave}
        onCreateNew={onCreateNew}
        saving={saving}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <div className="block">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ημέρες προγράμματος</Label>
            <Select
              items={[1, 2, 3, 4, 5, 6, 7].map((count) => ({ value: String(count), label: `${count} ημέρες` }))}
              value={String(plan.dayCount || visibleDays.length)}
              onValueChange={(value) => setDayCount(Number(value ?? 0))}
            >
              <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {count} ημέρες
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SelectField
            label="Επίπεδο"
            value={plan.difficulty}
            onChange={(value) => setPlan({ ...plan, difficulty: value })}
            options={[
              ["beginner", "Αρχάριο"],
              ["intermediate", "Μεσαίο"],
              ["advanced", "Προχωρημένο"],
            ]}
          />
          <Field label="Διάρκεια εβδομάδες" type="number" value={plan.durationWeeks} onChange={(value) => setPlan({ ...plan, durationWeeks: value })} />
        </div>

        <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800">
          {visibleDays.map((day, index) => {
            const groups = [...new Set((day.exercises || []).map((exercise) => exercise.muscleGroup).filter(Boolean))];
            return (
              <Button
                key={`${day.dayOfWeek}-${index}`}
                type="button"
                variant={activeDayIndex === index ? "default" : "outline"}
                onClick={() => setActiveDayIndex(index)}
                className="h-auto min-w-[132px] flex-col items-start whitespace-normal px-4 py-3 text-left"
              >
                <div className="text-sm font-bold">Ημέρα {index + 1}</div>
                <div className={`mt-1 truncate text-xs font-bold ${activeDayIndex === index ? "text-white/90" : "text-slate-500 dark:text-slate-400"}`}>
                  {groups.length ? groups.join(" / ") : "Χωρίς ασκήσεις"}
                </div>
              </Button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-bold">Ημέρα {activeDayIndex + 1}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {muscleGroups.length ? (
                    muscleGroups.map((group) => (
                      <span key={group} className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Οι μυϊκές ομάδες θα μπουν αυτόματα από τις ασκήσεις.</span>
                  )}
                </div>
              </div>
              <Button type="button" onClick={() => addExercise(activeDayIndex)} className="h-10 gap-2 bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700">
                <Plus className="h-4 w-4" />
                Προσθήκη άσκησης
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(selectedDay.exercises || []).map((exercise, exerciseIndex) => (
                <div
                  key={`${selectedDay.dayOfWeek}-${exerciseIndex}`}
                  className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(240px,2fr)_88px_100px_100px_96px_auto] dark:border-slate-800 dark:bg-slate-900"
                >
                  <ExercisePicker
                    exercises={exercises}
                    value={exercise}
                    onSelect={(selected) =>
                      updateExercise(activeDayIndex, exerciseIndex, {
                        exerciseId: selected?.id || "",
                        exerciseName: selected?.name || "",
                        muscleGroup: selected?.muscleGroup || "",
                        imageUrl: selected?.imageUrl || selected?.image_url || "",
                        videoUrl: selected?.videoUrl || selected?.video_url || "",
                      })
                    }
                  />
                  <Field compact label="Σετ" value={exercise.sets} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { sets: value })} />
                  <Field compact label="Επαναλ." value={exercise.reps} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { reps: value })} />
                  <Field compact label="Tempo" value={exercise.tempo} onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { tempo: value })} />
                  <Field
                    compact
                    label="Rest"
                    value={exercise.restSeconds}
                    onChange={(value) => updateExercise(activeDayIndex, exerciseIndex, { restSeconds: value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeExercise(activeDayIndex, exerciseIndex)}
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              {!selectedDay.exercises?.length && (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                  Πρόσθεσε την πρώτη άσκηση για αυτή την ημέρα.
                </div>
              )}
            </div>
          </div>
        )}

        <Field label="Γενικές σημειώσεις προγράμματος" value={plan.description} onChange={(value) => setPlan({ ...plan, description: value })} />

        <PlanHistory rows={history} countLabel={(row) => `${row.day_count ?? 0} ημέρες, ${row.exercise_count ?? 0} ασκήσεις`} />
      </div>
    </Card>
  );
}

function ExercisePicker({
  exercises,
  value,
  onSelect,
}: {
  exercises: LibraryExercise[];
  value: TrainingExerciseEntry;
  onSelect: (exercise: LibraryExercise | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedLabel = value?.exerciseName || "";
  const searchValue = open ? query : selectedLabel;
  const normalizedQuery = searchValue.trim().toLowerCase();
  const filteredExercises = (exercises || [])
    .filter((item) => {
      if (!normalizedQuery) return true;
      return [item.name, item.muscleGroup, item.equipment, item.type].join(" ").toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 12);

  const chooseExercise = (exercise: LibraryExercise) => {
    onSelect(exercise);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative block">
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Άσκηση</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          value={searchValue}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder="Αναζήτηση άσκησης..."
          className="h-10 pl-9 text-sm font-semibold"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-[62px] z-30 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {filteredExercises.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseExercise(item)}
              className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-slate-100 px-3 py-3 text-left last:border-b-0 dark:border-slate-800"
            >
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                {item.imageUrl || item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(item.imageUrl || item.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px] font-bold text-slate-400 dark:text-slate-500">PHOTO</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-950 dark:text-slate-50">{item.name}</span>
                <span className="mt-1 block truncate text-xs font-bold text-slate-500 dark:text-slate-400">{item.muscleGroup || "Χωρίς μυϊκή ομάδα"}</span>
              </span>
              {item.equipment && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{item.equipment}</span>}
            </Button>
          ))}
          {!filteredExercises.length && <div className="px-3 py-4 text-center text-sm font-bold text-slate-500 dark:text-slate-400">Δεν βρέθηκε άσκηση.</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nutrition plan editor
// ---------------------------------------------------------------------------

function NutritionPlanEditor({
  clientId,
  plan,
  setPlan,
  onSave,
  onCreateNew,
  saving,
}: {
  clientId: string;
  plan: NutritionPlanState;
  setPlan: React.Dispatch<React.SetStateAction<NutritionPlanState>>;
  onSave: () => void;
  onCreateNew: () => void;
  saving: boolean;
}) {
  const [history, setHistory] = useState<PlanHistoryRow[]>([]);
  useEffect(() => {
    api
      .get<PlanHistoryRow[]>(`/nutrition-plans/${clientId}`)
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [clientId, saving]);

  const updateMeal = (mealIndex: number, patch: Partial<MealEntry>) => {
    setPlan((current) => ({
      ...current,
      meals: current.meals.map((meal, index) => (index === mealIndex ? { ...meal, ...patch } : meal)),
    }));
  };

  const updateFood = (mealIndex: number, foodIndex: number, patch: Partial<FoodEntry>) => {
    const meal = plan.meals[mealIndex];
    updateMeal(mealIndex, {
      foods: meal.foods.map((food, index) => (index === foodIndex ? { ...food, ...patch } : food)),
    });
  };

  const addMeal = () => {
    setPlan((current) => ({
      ...current,
      meals: [...current.meals, { mealType: "other", title: "Γεύμα", notes: "", foods: [{ foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }] }],
    }));
  };

  const addFood = (mealIndex: number) => {
    updateMeal(mealIndex, {
      foods: [...plan.meals[mealIndex].foods, { foodName: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" }],
    });
  };

  const removeMeal = (mealIndex: number) => {
    setPlan((current) => ({ ...current, meals: current.meals.filter((_, index) => index !== mealIndex) }));
  };

  const removeFood = (mealIndex: number, foodIndex: number) => {
    updateMeal(mealIndex, { foods: plan.meals[mealIndex].foods.filter((_, index) => index !== foodIndex) });
  };

  return (
    <Card className="p-0">
      <PlanHeader
        title="Πρόγραμμα Διατροφής"
        subtitle="Ένα ενεργό πρόγραμμα διατροφής για τον πελάτη. Το ανανεώνει μόνο ο admin όταν χρειαστεί."
        onSave={onSave}
        onCreateNew={onCreateNew}
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
          <div key={mealIndex} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <Field label="Γεύμα" value={meal.title} onChange={(value) => updateMeal(mealIndex, { title: value })} />
              <SelectField
                label="Τύπος"
                value={meal.mealType}
                onChange={(value) => updateMeal(mealIndex, { mealType: value })}
                options={[
                  ["breakfast", "Πρωινό"],
                  ["lunch", "Μεσημεριανό"],
                  ["snack", "Σνακ"],
                  ["dinner", "Βραδινό"],
                  ["other", "Άλλο"],
                ]}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => removeMeal(mealIndex)}
                className="h-auto self-end gap-2 border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Διαγραφή γεύματος
              </Button>
            </div>
            <Field label="Οδηγίες γεύματος" value={meal.notes} onChange={(value) => updateMeal(mealIndex, { notes: value })} className="mt-4" />

            <div className="mt-4 space-y-3">
              {meal.foods.map((food, foodIndex) => (
                <div key={foodIndex} className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[2fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] dark:border-slate-800 dark:bg-slate-900">
                  <Field compact label="Τρόφιμο" value={food.foodName} onChange={(value) => updateFood(mealIndex, foodIndex, { foodName: value })} />
                  <Field compact label="Ποσότητα" value={food.quantity} onChange={(value) => updateFood(mealIndex, foodIndex, { quantity: value })} />
                  <Field compact label="Kcal" type="number" value={food.calories} onChange={(value) => updateFood(mealIndex, foodIndex, { calories: value })} />
                  <Field compact label="Πρωτ." type="number" value={food.proteinG} onChange={(value) => updateFood(mealIndex, foodIndex, { proteinG: value })} />
                  <Field compact label="Υδ/κες" type="number" value={food.carbsG} onChange={(value) => updateFood(mealIndex, foodIndex, { carbsG: value })} />
                  <Field compact label="Λίπη" type="number" value={food.fatG} onChange={(value) => updateFood(mealIndex, foodIndex, { fatG: value })} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeFood(mealIndex, foodIndex)}
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addFood(mealIndex)}
                className="h-10 w-full gap-2 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 sm:w-auto dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400"
              >
                <Plus className="h-4 w-4" />
                Προσθήκη τροφίμου
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addMeal} className="h-11 gap-2 px-5 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200 dark:hover:border-red-500/30 dark:hover:text-red-400">
          <Plus className="h-4 w-4" />
          Προσθήκη γεύματος
        </Button>

        <PlanHistory rows={history} countLabel={(row) => (row.daily_calories ? `${row.daily_calories} kcal` : "-")} />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function PlanHeader({
  title,
  subtitle,
  onSave,
  onCreateNew,
  saving,
}: {
  title: string;
  subtitle: string;
  onSave: () => void;
  onCreateNew?: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {onCreateNew && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm("Το τρέχον πλάνο θα μετακινηθεί στο ιστορικό και θα ξεκινήσει ένα καινούργιο, κενό πλάνο. Συνέχεια;")) {
                onCreateNew();
              }
            }}
            disabled={saving}
            className="h-11 px-5 text-sm font-bold"
          >
            Νέο Πλάνο
          </Button>
        )}
        <Button type="button" onClick={onSave} disabled={saving} className="h-11 bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
          {saving ? "Αποθήκευση..." : "Αποθήκευση"}
        </Button>
      </div>
    </div>
  );
}

interface PlanHistoryRow {
  id: number | string;
  title: string;
  created_at?: string;
  status?: string;
  day_count?: number;
  exercise_count?: number;
  daily_calories?: number;
}

function PlanHistory({ rows, countLabel }: { rows: PlanHistoryRow[]; countLabel: (row: PlanHistoryRow) => string }) {
  const [open, setOpen] = useState(false);
  const previous = rows.filter((row) => row.status !== "active");
  if (!previous.length) return null;

  const statusLabels: Record<string, string> = { archived: "Αρχειοθετημένο", completed: "Ολοκληρωμένο", draft: "Πρόχειρο" };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-200"
      >
        Ιστορικό πλάνων ({previous.length})
        <span className="text-xs font-bold text-slate-400">{open ? "Απόκρυψη" : "Εμφάνιση"}</span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {previous.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-50">{row.title}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {formatDate(row.created_at)} · {countLabel(row)}
                </div>
              </div>
              <Badge variant="outline" className="font-bold">
                {statusLabels[row.status || ""] || row.status || "-"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  compact = false,
  className = "",
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`block ${className}`}>
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${compact ? "h-10" : "h-11"} mt-1 w-full text-sm font-semibold`}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="block">
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Select
        items={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))}
        value={value ?? ""}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StateBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{text}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-bold">{value || "-"}</div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <div className="divide-y divide-slate-200 dark:divide-slate-800">{children}</div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900 dark:text-slate-50">{value || "-"}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="p-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{text}</div>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{text}</div>;
}

// ---------------------------------------------------------------------------
// Messages tab
// ---------------------------------------------------------------------------

interface MessageRow {
  id: number | string;
  sender_role: "coach" | "client";
  body: string;
  created_at?: string;
}

function MessagesTab({ clientId }: { clientId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = () => {
    api
      .get<MessageRow[]>(`/clients/${clientId}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const sendMessage = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.post(`/clients/${clientId}/messages`, { message: draft.trim() });
      setDraft("");
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν στάλθηκε το μήνυμα.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
        <CardTitle className="text-xl font-bold">Μηνύματα</CardTitle>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Ασύγχρονη επικοινωνία με τον πελάτη.</p>
      </CardHeader>

      <div className="max-h-96 space-y-3 overflow-y-auto p-6">
        {loading && <EmptyRow text="Φόρτωση μηνυμάτων..." />}
        {!loading && !messages.length && <EmptyRow text="Δεν υπάρχουν μηνύματα ακόμα." />}
        {messages.map((item) => (
          <div key={item.id} className={`flex ${item.sender_role === "coach" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 text-sm font-semibold ${
                item.sender_role === "coach"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50"
              }`}
            >
              <div>{item.body}</div>
              <div className={`mt-1 text-xs font-bold ${item.sender_role === "coach" ? "text-red-100" : "text-slate-500 dark:text-slate-400"}`}>
                {formatDateTime(item.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-slate-200 p-6 dark:border-slate-800">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Γράψε ένα μήνυμα..."
          className="min-h-20"
        />
        <div className="flex justify-end">
          <Button type="button" onClick={sendMessage} disabled={sending || !draft.trim()}>
            {sending ? "Αποστολή..." : "Αποστολή"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function ClientDetailPage({ clientId }: { clientId: string }) {
  return (
    <ProtectedRoute>
      <ClientDetailContent clientId={clientId} />
    </ProtectedRoute>
  );
}
