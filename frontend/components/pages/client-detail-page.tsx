"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
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
import { type PlanHistoryRow } from "@/components/shared/plan-editor-ui";
import {
  TrainingPlanEditor,
  normalizeTrainingPlan,
  defaultTrainingPlan,
  type TrainingPlanState,
  type RawTrainingPlan,
  type LibraryExercise,
} from "@/components/shared/training-plan-editor";
import {
  NutritionPlanEditor,
  normalizeNutritionPlan,
  defaultNutritionPlan,
  type NutritionPlanState,
  type RawNutritionPlan,
} from "@/components/shared/nutrition-plan-editor";
import { AssignTemplateDialog } from "@/components/shared/assign-template-dialog";

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

interface StatusMetaResult {
  label: string;
  className: string;
}

// ---------------------------------------------------------------------------
// Constants + helpers
// ---------------------------------------------------------------------------

const tabs = [
  { id: "overview", label: "Επισκόπηση" },
  { id: "progress", label: "Πρόοδος" },
  { id: "payments", label: "Ιστορικό Πληρωμών" },
  { id: "training", label: "Πρόγραμμα Προπόνησης" },
  { id: "nutrition", label: "Πρόγραμμα Διατροφής" },
  { id: "messages", label: "Μηνύματα" },
];

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
  const [trainingHistory, setTrainingHistory] = useState<PlanHistoryRow[]>([]);
  const [nutritionHistory, setNutritionHistory] = useState<PlanHistoryRow[]>([]);
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

  const loadPlanHistory = () => {
    api
      .get<PlanHistoryRow[]>(`/training-plans/${clientId}`)
      .then(setTrainingHistory)
      .catch(() => setTrainingHistory([]));
    api
      .get<PlanHistoryRow[]>(`/nutrition-plans/${clientId}`)
      .then(setNutritionHistory)
      .catch(() => setNutritionHistory([]));
  };

  // Re-fetch whenever a save/create-new/assign-template finishes (saving flips back to
  // false) so history reflects the just-archived plan without a full page reload.
  useEffect(() => {
    loadPlanHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, savingTraining, savingNutrition]);

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

            <TabsContent value="training" className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="outline" className="h-auto gap-2 px-3 py-1.5 text-sm font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  {trainingPlan.templateId ? `Βασισμένο σε: ${trainingPlan.templateTitle || "Πρότυπο"}` : "Προσαρμοσμένο πλάνο"}
                </Badge>
                <AssignTemplateDialog
                  kind="training"
                  clientId={clientId}
                  onAssigned={() => {
                    loadClientDetail();
                    loadPlanHistory();
                  }}
                />
              </div>
              <TrainingPlanEditor
                plan={trainingPlan}
                setPlan={setTrainingPlan}
                exercises={exercises}
                onSave={saveTrainingPlan}
                onCreateNew={createNewTrainingPlan}
                saving={savingTraining}
                history={trainingHistory}
              />
            </TabsContent>

            <TabsContent value="nutrition" className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge variant="outline" className="h-auto gap-2 px-3 py-1.5 text-sm font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  {nutritionPlan.templateId ? `Βασισμένο σε: ${nutritionPlan.templateTitle || "Πρότυπο"}` : "Προσαρμοσμένο πλάνο"}
                </Badge>
                <AssignTemplateDialog
                  kind="nutrition"
                  clientId={clientId}
                  onAssigned={() => {
                    loadClientDetail();
                    loadPlanHistory();
                  }}
                />
              </div>
              <NutritionPlanEditor
                plan={nutritionPlan}
                setPlan={setNutritionPlan}
                onSave={saveNutritionPlan}
                onCreateNew={createNewNutritionPlan}
                saving={savingNutrition}
                history={nutritionHistory}
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
