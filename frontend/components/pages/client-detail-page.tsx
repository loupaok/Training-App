"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface ProgressUpdate {
  id: number | string;
  weight_kg?: number | string;
  submitted_at?: string;
  photos?: unknown[];
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
  { id: "payments", label: "Ιστορικό Πληρωμών" },
  { id: "training", label: "Πρόγραμμα Προπόνησης" },
  { id: "nutrition", label: "Πρόγραμμα Διατροφής" },
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

function statusMeta(client: ClientRecord | null): StatusMetaResult {
  const userStatus = client?.user_status || client?.status;
  const paymentStatus = client?.payments?.[0]?.status;
  const subscriptionStatus = client?.subscription?.status;

  if (userStatus === "active" || subscriptionStatus === "active") {
    return { label: "Ενεργός", className: "bg-emerald-50 text-emerald-700" };
  }
  if (userStatus === "pending_payment" || paymentStatus === "pending") {
    return { label: "Εκκρεμής", className: "bg-amber-50 text-amber-700" };
  }
  return { label: "Ανενεργός", className: "bg-red-50 text-red-700" };
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
  const updateDay = client?.updateSchedule?.day_of_week ?? onboarding.update_day;

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
        <span className="text-slate-400">/</span>
        <Link href="/clients" className="text-blue-600 hover:text-blue-700">Πελάτες</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">{displayName}</span>
      </div>

      {loading && <StateBox text="Φόρτωση πελάτη..." />}
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}
      {message && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-700">{message}</div>}

      {!loading && client && (
        <div className="space-y-6">
          <ClientHeader client={client} displayName={displayName} currentStatus={currentStatus} onboarding={onboarding} updateDay={updateDay} />

          {currentStatus.label !== "Ενεργός" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-black text-amber-900">Ο πελάτης δεν έχει ενεργή πληρωμή</h3>
                  <p className="mt-1 text-sm font-bold text-amber-800">
                    Κατάσταση: {currentStatus.label}. Τα προγράμματα μπορεί να υπάρχουν, αλλά ο πελάτης θα τα βλέπει κλειδωμένα μέχρι να εγκριθεί η πληρωμή του.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={`h-auto w-fit rounded-md px-4 py-2 text-sm font-black ${currentStatus.className}`}>
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
                    className="h-11 rounded-md px-5 text-sm font-black text-slate-600 data-active:bg-red-600 data-active:text-white data-active:shadow-sm hover:bg-slate-100 hover:text-slate-950 dark:data-active:bg-red-600 dark:data-active:text-white"
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Card>

            <TabsContent value="overview" className="mt-6">
              <OverviewTab
                client={client}
                onboarding={onboarding}
                currentStatus={currentStatus}
                onApprovePayment={approvePayment}
                onRejectPayment={rejectPayment}
                approvingPayment={approvingPayment}
                rejectingPaymentId={rejectingPaymentId}
              />
            </TabsContent>

            <TabsContent value="payments" className="mt-6">
              <PaymentsTab
                client={client}
                onApprovePayment={approvePayment}
                onRejectPayment={rejectPayment}
                approvingPayment={approvingPayment}
                rejectingPaymentId={rejectingPaymentId}
              />
            </TabsContent>

            <TabsContent value="training" className="mt-6">
              <TrainingPlanEditor
                plan={trainingPlan}
                setPlan={setTrainingPlan}
                exercises={exercises}
                onSave={saveTrainingPlan}
                saving={savingTraining}
              />
            </TabsContent>

            <TabsContent value="nutrition" className="mt-6">
              <NutritionPlanEditor plan={nutritionPlan} setPlan={setNutritionPlan} onSave={saveNutritionPlan} saving={savingNutrition} />
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
  updateDay,
}: {
  client: ClientRecord;
  displayName: string;
  currentStatus: StatusMetaResult;
  onboarding: Onboarding;
  updateDay?: number;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar initials={getInitials(displayName)} photoUrl={client.profile_photo} size="h-28 w-28" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-black">{displayName}</h2>
              <Badge className={`h-auto rounded-md px-3 py-1.5 text-sm font-bold ${currentStatus.className}`}>{currentStatus.label}</Badge>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
              <span>{client.email || "-"}</span>
              <span>{client.phone || "-"}</span>
              <span>Μέλος από: {formatDate(client.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Τρέχον βάρος" value={client.weight_kg ? `${client.weight_kg} kg` : "-"} />
          <Metric label="Στόχος" value={client.fitness_goal || onboarding.goal || "-"} />
          <Metric label="Επόμενο update" value={client.updateSchedule?.next_due_date ? formatDate(client.updateSchedule.next_due_date) : "-"} />
          <Metric label="Ημέρα update" value={updateDay === null || updateDay === undefined ? "-" : dayLabels[Number(updateDay)]} />
        </div>
      </div>
    </Card>
  );
}

function OverviewTab({
  client,
  onboarding,
  currentStatus,
  onApprovePayment,
  onRejectPayment,
  approvingPayment,
  rejectingPaymentId,
}: {
  client: ClientRecord;
  onboarding: Onboarding;
  currentStatus: StatusMetaResult;
  onApprovePayment: (paymentId: number | string) => void;
  onRejectPayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
  rejectingPaymentId: number | string | null;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-3">
        <InfoCard title="Στοιχεία">
          <Info label="Ημερομηνία γέννησης" value={formatDate(client.date_of_birth || onboarding.date_of_birth)} />
          <Info label="Ύψος" value={client.height_cm ? `${client.height_cm} cm` : "-"} />
          <Info label="Φύλο" value={client.gender || "-"} />
          <Info label="Ιατρικές σημειώσεις" value={client.medical_notes || "-"} />
        </InfoCard>
        <InfoCard title="Συνδρομή">
          <Info label="Κατάσταση" value={client.subscription?.status || currentStatus.label} />
          <Info label="Έναρξη" value={formatDate(client.subscription?.start_date)} />
          <Info label="Λήξη" value={formatDate(client.subscription?.end_date)} />
          <Info label="Πακέτο" value={onboarding.selected_package || "-"} />
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

      <section className="grid gap-6 xl:grid-cols-2">
        <ListCard title="Πληρωμές">
          {client.payments?.length ? (
            client.payments.map((payment) => (
              <div key={payment.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-black text-slate-950">{money(payment.amount, payment.currency)}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">{formatDateTime(payment.created_at)}</div>
                  {payment.method === "bank_transfer" && (
                    <div className="mt-1 text-xs font-bold text-slate-400">Τραπεζικό έμβασμα · {payment.reference_number || "-"}</div>
                  )}
                </div>
                <Badge
                  className={`h-auto w-fit rounded-md px-3 py-1 text-sm font-black ${
                    payment.status === "completed"
                      ? "bg-emerald-50 text-emerald-700"
                      : payment.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {payment.status === "completed" ? "Εγκρίθηκε" : payment.status === "pending" ? "Εκκρεμής" : payment.status || "-"}
                </Badge>
                {payment.status === "pending" && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => onApprovePayment(payment.id)}
                      disabled={approvingPayment}
                      className="h-9 bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      {approvingPayment ? "Έγκριση..." : "Έγκριση"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRejectPayment(payment.id)}
                      disabled={rejectingPaymentId === payment.id}
                      className="h-9 border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50"
                    >
                      {rejectingPaymentId === payment.id ? "Απόρριψη..." : "Απόρριψη"}
                    </Button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyRow text="Δεν υπάρχουν πληρωμές ακόμα." />
          )}
        </ListCard>
        <ListCard title="Εβδομαδιαία updates">
          {client.weeklyUpdates?.length ? (
            client.weeklyUpdates.map((update) => (
              <DataRow
                key={update.id}
                title={update.weight_kg ? `${update.weight_kg} kg` : "Update"}
                meta={formatDateTime(update.submitted_at)}
                badge={`${update.training_score || "-"} / ${update.nutrition_score || "-"}`}
                description={update.notes}
              />
            ))
          ) : (
            <EmptyRow text="Δεν υπάρχουν εβδομαδιαία updates ακόμα." />
          )}
        </ListCard>
      </section>

      <ListCard title="Progress updates">
        {client.progressUpdates?.length ? (
          client.progressUpdates.map((update) => (
            <DataRow
              key={update.id}
              title={update.weight_kg ? `${update.weight_kg} kg` : "Progress update"}
              meta={formatDateTime(update.submitted_at)}
              badge={update.photos?.length ? `${update.photos.length} φωτογραφίες` : "Χωρίς φωτογραφίες"}
              description={update.notes}
            />
          ))
        ) : (
          <EmptyRow text="Δεν υπάρχει progress ακόμα." />
        )}
      </ListCard>

      <InfoCard title="Ιδιωτικές σημειώσεις coach">
        <div className="min-h-24 rounded-md bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
          {client.coach_notes || "Δεν υπάρχουν σημειώσεις coach."}
        </div>
      </InfoCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payments tab
// ---------------------------------------------------------------------------

function PaymentsTab({
  client,
  onApprovePayment,
  onRejectPayment,
  approvingPayment,
  rejectingPaymentId,
}: {
  client: ClientRecord;
  onApprovePayment: (paymentId: number | string) => void;
  onRejectPayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
  rejectingPaymentId: number | string | null;
}) {
  const payments = client.payments || [];

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-slate-200 px-6 py-5">
        <CardTitle className="text-xl font-black">Ιστορικό Πληρωμών</CardTitle>
        <p className="mt-1 text-sm font-semibold text-slate-500">Όλες οι πληρωμές του πελάτη και οι χειροκίνητες ενέργειες έγκρισης.</p>
      </CardHeader>

      <Table>
        <TableHeader className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase text-slate-500">
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
        <TableBody className="divide-y divide-slate-100">
          {payments.map((payment) => (
            <TableRow key={payment.id} className="align-top">
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700">{formatDateTime(payment.created_at)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-black text-slate-950">{money(payment.amount, payment.currency)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700">
                {payment.method === "bank_transfer" ? "Τραπεζικό έμβασμα" : payment.method || "-"}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-500">{payment.reference_number || "-"}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                {payment.proof_url ? (
                  <a href={resolveMediaUrl(payment.proof_url)} target="_blank" rel="noreferrer" className="font-black text-blue-600 hover:text-blue-700">
                    Προβολή
                  </a>
                ) : (
                  <span className="font-semibold text-slate-400">-</span>
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
                      className="h-9 bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"
                    >
                      {approvingPayment ? "Έγκριση..." : "Έγκριση"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRejectPayment(payment.id)}
                      disabled={rejectingPaymentId === payment.id}
                      className="h-9 border-red-200 px-4 text-sm font-black text-red-600 hover:bg-red-50"
                    >
                      {rejectingPaymentId === payment.id ? "Απόρριψη..." : "Απόρριψη"}
                    </Button>
                  </div>
                ) : (
                  <span className="font-semibold text-slate-400">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!payments.length && (
            <TableRow>
              <TableCell colSpan={7} className="whitespace-normal px-5 py-10 text-center font-semibold text-slate-500">
                Δεν υπάρχουν πληρωμές ακόμα.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function PaymentStatus({ status }: { status?: string }) {
  const meta: Record<string, [string, string]> = {
    completed: ["Εγκρίθηκε", "bg-emerald-50 text-emerald-700"],
    pending: ["Εκκρεμής", "bg-amber-50 text-amber-700"],
    failed: ["Απορρίφθηκε", "bg-red-50 text-red-700"],
    refunded: ["Επιστροφή", "bg-slate-100 text-slate-700"],
  };
  const [label, className] = meta[status || ""] || [status || "-", "bg-slate-100 text-slate-700"];

  return <Badge className={`h-auto rounded-md px-3 py-1 text-sm font-black ${className}`}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Training plan editor
// ---------------------------------------------------------------------------

function TrainingPlanEditor({
  plan,
  setPlan,
  exercises,
  onSave,
  saving,
}: {
  plan: TrainingPlanState;
  setPlan: React.Dispatch<React.SetStateAction<TrainingPlanState>>;
  exercises: LibraryExercise[];
  onSave: () => void;
  saving: boolean;
}) {
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
        saving={saving}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.7fr_0.7fr_1fr]">
          <Field label="Τίτλος" value={plan.title} onChange={(value) => setPlan({ ...plan, title: value })} />
          <div className="block">
            <Label className="text-xs font-black text-slate-500">Ημέρες προγράμματος</Label>
            <Select value={String(plan.dayCount || visibleDays.length)} onValueChange={(value) => setDayCount(Number(value ?? 0))}>
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

        <div className="flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
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
                <div className="text-sm font-black">Ημέρα {index + 1}</div>
                <div className={`mt-1 truncate text-xs font-bold ${activeDayIndex === index ? "text-white/90" : "text-slate-500"}`}>
                  {groups.length ? groups.join(" / ") : "Χωρίς ασκήσεις"}
                </div>
              </Button>
            );
          })}
        </div>

        {selectedDay && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black">Ημέρα {activeDayIndex + 1}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {muscleGroups.length ? (
                    muscleGroups.map((group) => (
                      <span key={group} className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
                        {group}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-slate-500">Οι μυϊκές ομάδες θα μπουν αυτόματα από τις ασκήσεις.</span>
                  )}
                </div>
              </div>
              <Button type="button" onClick={() => addExercise(activeDayIndex)} className="h-10 gap-2 bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700">
                <Plus className="h-4 w-4" />
                Προσθήκη άσκησης
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(selectedDay.exercises || []).map((exercise, exerciseIndex) => (
                <div
                  key={`${selectedDay.dayOfWeek}-${exerciseIndex}`}
                  className="grid gap-3 rounded-md border border-slate-200 bg-white p-3 xl:grid-cols-[minmax(240px,2fr)_88px_100px_100px_96px_auto]"
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
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              {!selectedDay.exercises?.length && (
                <div className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                  Πρόσθεσε την πρώτη άσκηση για αυτή την ημέρα.
                </div>
              )}
            </div>
          </div>
        )}

        <Field label="Γενικές σημειώσεις προγράμματος" value={plan.description} onChange={(value) => setPlan({ ...plan, description: value })} />
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
      <Label className="text-xs font-black text-slate-500">Άσκηση</Label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
        <div className="absolute left-0 right-0 top-[62px] z-30 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl">
          {filteredExercises.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseExercise(item)}
              className="h-auto w-full justify-start gap-3 whitespace-normal rounded-none border-b border-slate-100 px-3 py-3 text-left last:border-b-0"
            >
              <span className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {item.imageUrl || item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(item.imageUrl || item.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[10px] font-black text-slate-400">PHOTO</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-950">{item.name}</span>
                <span className="mt-1 block truncate text-xs font-bold text-slate-500">{item.muscleGroup || "Χωρίς μυϊκή ομάδα"}</span>
              </span>
              {item.equipment && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">{item.equipment}</span>}
            </Button>
          ))}
          {!filteredExercises.length && <div className="px-3 py-4 text-center text-sm font-bold text-slate-500">Δεν βρέθηκε άσκηση.</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nutrition plan editor
// ---------------------------------------------------------------------------

function NutritionPlanEditor({
  plan,
  setPlan,
  onSave,
  saving,
}: {
  plan: NutritionPlanState;
  setPlan: React.Dispatch<React.SetStateAction<NutritionPlanState>>;
  onSave: () => void;
  saving: boolean;
}) {
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
                className="h-auto self-end gap-2 border-red-200 bg-white px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Διαγραφή γεύματος
              </Button>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeFood(mealIndex, foodIndex)}
                    className="h-auto self-end border-red-200 px-3 py-2 text-sm font-black text-red-600 hover:bg-red-50"
                  >
                    Διαγραφή
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => addFood(mealIndex)}
                className="h-10 w-full gap-2 text-sm font-black text-slate-700 hover:border-red-200 hover:text-red-600 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Προσθήκη τροφίμου
              </Button>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addMeal} className="h-11 gap-2 px-5 text-sm font-black text-slate-700 hover:border-red-200 hover:text-red-600">
          <Plus className="h-4 w-4" />
          Προσθήκη γεύματος
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared small components
// ---------------------------------------------------------------------------

function PlanHeader({ title, subtitle, onSave, saving }: { title: string; subtitle: string; onSave: () => void; saving: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
      </div>
      <Button type="button" onClick={onSave} disabled={saving} className="h-11 bg-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-200 hover:bg-red-700">
        {saving ? "Αποθήκευση..." : "Αποθήκευση"}
      </Button>
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
      <Label className="text-xs font-black text-slate-500">{label}</Label>
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
      <Label className="text-xs font-black text-slate-500">{label}</Label>
      <Select value={value ?? ""} onValueChange={(next) => onChange(next ?? "")}>
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
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">{text}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[150px] rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-black uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-black">{value || "-"}</div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </Card>
  );
}

function ListCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="border-b border-slate-200 px-6 py-5">
        <CardTitle className="text-xl font-black">{title}</CardTitle>
      </CardHeader>
      <div className="divide-y divide-slate-200">{children}</div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-slate-900">{value || "-"}</div>
    </div>
  );
}

function DataRow({ title, meta, badge, description }: { title: string; meta: string; badge: string; description?: string }) {
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

function EmptyRow({ text }: { text: string }) {
  return <div className="p-5 text-sm font-semibold text-slate-500">{text}</div>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="text-sm font-semibold text-slate-500">{text}</div>;
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
