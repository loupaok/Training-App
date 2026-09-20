"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Sparkles, Mail, Dumbbell, Apple, CreditCard, Ban, X, AlertTriangle, ChevronDown, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl, getInitials } from "@/lib/media";
import { cn } from "@/lib/utils";
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
import { Alert, AlertTitle, AlertAction } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { AreaChart, SparkLineChart, ProgressCircle, ProgressBar } from "@tremor/react";
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
  type LibraryFood,
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
  { id: "training", label: "Πρόγραμμα Προπόνησης" },
  { id: "nutrition", label: "Πρόγραμμα Διατροφής" },
  { id: "payments", label: "Πληρωμές" },
  { id: "messages", label: "Μηνύματα" },
  { id: "activity", label: "Ιστορικό" },
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

function daysSince(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - date.getTime()) / 86400000);
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
}

function monthsSince(value?: string | null): number {
  const days = daysSince(value);
  if (days === null) return 0;
  return Math.max(0, Math.floor(days / 30));
}

interface HealthScoreResult {
  total: number;
  color: "red" | "amber" | "emerald";
  updatesScore: number;
  paymentScore: number;
  subscriptionScore: number;
}

// Weighted per the coach's own rules: updates 40%, payment 30%, subscription 30%.
// Missing data (no updates/payments/subscription yet) scores 0 on that factor —
// a brand-new client with nothing set up yet is treated as "not yet healthy"
// rather than assumed healthy by default.
function computeHealthScore(client: ClientRecord): HealthScoreResult {
  const lastUpdateDays = daysSince(client.weeklyUpdates?.[0]?.submitted_at);
  const updatesScore = lastUpdateDays === null ? 0 : lastUpdateDays <= 7 ? 100 : lastUpdateDays <= 14 ? 50 : 0;

  const latestPaymentStatus = client.payments?.[0]?.status;
  const paymentScore = latestPaymentStatus === "completed" ? 100 : latestPaymentStatus === "pending" ? 50 : 0;

  const subscriptionDaysLeft = daysUntil(client.subscription?.end_date);
  const subscriptionScore = subscriptionDaysLeft === null || subscriptionDaysLeft < 0 ? 0 : subscriptionDaysLeft <= 7 ? 50 : 100;

  const total = Math.round(updatesScore * 0.4 + paymentScore * 0.3 + subscriptionScore * 0.3);
  const color = total <= 40 ? "red" : total <= 70 ? "amber" : "emerald";

  return { total, color, updatesScore, paymentScore, subscriptionScore };
}

interface NextAction {
  id: string;
  severity: "amber" | "red";
  text: string;
}

function computeNextActions(client: ClientRecord): NextAction[] {
  const actions: NextAction[] = [];

  const lastUpdateDays = daysSince(client.weeklyUpdates?.[0]?.submitted_at);
  if (lastUpdateDays === null || lastUpdateDays > 7) {
    actions.push({ id: "no-update", severity: "amber", text: "Δεν έστειλε update αυτή την εβδομάδα" });
  }

  const subscriptionDaysLeft = daysUntil(client.subscription?.end_date);
  if (subscriptionDaysLeft !== null) {
    if (subscriptionDaysLeft < 0) {
      actions.push({ id: "sub-expired", severity: "red", text: "Η συνδρομή έχει λήξει" });
    } else if (subscriptionDaysLeft <= 7) {
      actions.push({ id: "sub-expiring", severity: "amber", text: `Η συνδρομή λήγει σε ${subscriptionDaysLeft} μέρες` });
    }
  }

  const latestPaymentStatus = client.payments?.[0]?.status;
  if (latestPaymentStatus === "pending" || latestPaymentStatus === "failed") {
    actions.push({
      id: "payment-issue",
      severity: "amber",
      text: latestPaymentStatus === "pending" ? "Εκκρεμεί πληρωμή" : "Απέτυχε η τελευταία πληρωμή",
    });
  }

  return actions;
}

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
  const [foods, setFoods] = useState<LibraryFood[]>([]);
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
  const [quickMessageOpen, setQuickMessageOpen] = useState(false);
  const [quickMessageText, setQuickMessageText] = useState("");
  const [sendingQuickMessage, setSendingQuickMessage] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const loadClientDetail = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<ClientRecord>(`/clients/${clientId}`),
      api.get<LibraryExercise[]>("/exercises").catch(() => []),
      api.get<{ items: LibraryFood[] }>("/foods?limit=500").catch(() => ({ items: [] })),
      api.get<RawTrainingPlan>(`/training-plans/${clientId}/full`).catch(() => ({ days: [] })),
      api.get<RawNutritionPlan>(`/nutrition-plans/${clientId}/full`).catch(() => ({ meals: [] })),
    ])
      .then(([clientData, exerciseRows, foodsResponse, trainingData, nutritionData]) => {
        setClient(clientData);
        setExercises(Array.isArray(exerciseRows) ? exerciseRows : []);
        setFoods(Array.isArray(foodsResponse?.items) ? foodsResponse.items : []);
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

  const sendQuickMessage = async () => {
    const text = quickMessageText.trim();
    if (!text) return;
    setSendingQuickMessage(true);
    setError("");
    try {
      await api.post(`/clients/${clientId}/messages`, { message: text });
      setQuickMessageOpen(false);
      setQuickMessageText("");
      setActiveTab("messages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν στάλθηκε το μήνυμα.");
    } finally {
      setSendingQuickMessage(false);
    }
  };

  const handleQuickNewTrainingPlan = async () => {
    const confirmed = window.confirm("Να δημιουργηθεί νέο πρόγραμμα προπόνησης; Το τρέχον θα μετακινηθεί στο ιστορικό.");
    if (!confirmed) return;
    setActiveTab("training");
    await createNewTrainingPlan();
  };

  const handleQuickNewNutritionPlan = async () => {
    const confirmed = window.confirm("Να δημιουργηθεί νέο πρόγραμμα διατροφής; Το τρέχον θα μετακινηθεί στο ιστορικό.");
    if (!confirmed) return;
    setActiveTab("nutrition");
    await createNewNutritionPlan();
  };

  const handleRenewSubscription = () => {
    setActiveTab("payments");
    setManualPaymentOpen(true);
  };

  const deactivateClient = async () => {
    const confirmed = window.confirm(`Θέλεις σίγουρα να απενεργοποιηθεί ο πελάτης ${displayName};`);
    if (!confirmed) return;
    setDeactivating(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/clients/${clientId}`, { isActive: false });
      setMessage("Ο πελάτης απενεργοποιήθηκε.");
      loadClientDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε απενεργοποίηση.");
    } finally {
      setDeactivating(false);
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

          <HealthScoreCard client={client} />

          <NextActionsPanel client={client} />

          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => setQuickMessageOpen(true)} className="gap-2 font-bold">
              <Mail className="h-4 w-4" /> Μήνυμα
            </Button>
            <Button type="button" variant="outline" onClick={handleQuickNewTrainingPlan} className="gap-2 font-bold">
              <Dumbbell className="h-4 w-4" /> Νέο Πλάνο Προπόνησης
            </Button>
            <Button type="button" variant="outline" onClick={handleQuickNewNutritionPlan} className="gap-2 font-bold">
              <Apple className="h-4 w-4" /> Νέο Πλάνο Διατροφής
            </Button>
            <Button type="button" variant="outline" onClick={handleRenewSubscription} className="gap-2 font-bold">
              <CreditCard className="h-4 w-4" /> Ανανέωση Συνδρομής
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={deactivateClient}
              disabled={deactivating}
              className="gap-2 font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
            >
              <Ban className="h-4 w-4" /> {deactivating ? "Απενεργοποίηση..." : "Απενεργοποίηση"}
            </Button>
          </div>

          <Dialog open={quickMessageOpen} onOpenChange={setQuickMessageOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Μήνυμα προς {displayName}</DialogTitle>
              </DialogHeader>
              <Textarea
                value={quickMessageText}
                onChange={(event) => setQuickMessageText(event.target.value)}
                placeholder="Γράψε ένα μήνυμα..."
                rows={4}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setQuickMessageOpen(false)}>
                  Ακύρωση
                </Button>
                <Button type="button" onClick={sendQuickMessage} disabled={sendingQuickMessage || !quickMessageText.trim()}>
                  {sendingQuickMessage ? "Αποστολή..." : "Αποστολή"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

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
              <OverviewTab
                client={client}
                clientId={clientId}
                onboarding={onboarding}
                onUpdated={loadClientDetail}
                currentStatus={currentStatus}
                onApprovePayment={approvePayment}
                approvingPayment={approvingPayment}
              />
            </TabsContent>

            <TabsContent value="progress" className="mt-6">
              <ProgressTab client={client} />
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
                foods={foods}
                onSave={saveNutritionPlan}
                onCreateNew={createNewNutritionPlan}
                saving={savingNutrition}
                history={nutritionHistory}
              />
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
                manualPaymentOpen={manualPaymentOpen}
                onManualPaymentOpenChange={setManualPaymentOpen}
              />
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessagesTab clientId={clientId} />
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <ActivityTab client={client} trainingHistory={trainingHistory} nutritionHistory={nutritionHistory} />
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
  const sparklineData = useMemo(
    () =>
      [...(client.weeklyUpdates || [])]
        .filter((update) => update.weight_kg)
        .slice(0, 8)
        .reverse()
        .map((update) => ({ date: formatDate(update.submitted_at), Βάρος: Number(update.weight_kg) })),
    [client.weeklyUpdates],
  );
  const memberDays = daysSince(client.created_at) ?? 0;
  const memberMonths = monthsSince(client.created_at);
  const updatesCount = client.weeklyUpdates?.length || 0;

  return (
    <Card className="p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-center gap-4">
          <UserAvatar initials={getInitials(displayName)} photoUrl={client.profile_photo} size="h-16 w-16" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <Badge className={`h-auto rounded-md px-2.5 py-1 text-xs font-bold ${currentStatus.className}`}>{currentStatus.label}</Badge>
              {(client.fitness_goal || onboarding.goal) && (
                <Badge variant="outline" className="h-auto rounded-md px-2.5 py-1 text-xs font-bold">
                  {client.fitness_goal || onboarding.goal}
                </Badge>
              )}
            </div>
            <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
              {client.email || "-"} · {client.phone || "-"}
            </div>
            <div className="mt-1 text-xs font-semibold text-slate-400 dark:text-slate-500">
              {memberMonths >= 1 ? `Μέλος από ${memberMonths} μήνες` : "Μέλος από <1 μήνα"}
            </div>
          </div>
        </div>

        <div className="min-w-0">
          {sparklineData.length > 1 ? (
            <SparkLineChart className="h-14 w-full" data={sparklineData} index="date" categories={["Βάρος"]} colors={["blue"]} />
          ) : (
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">Χωρίς αρκετά δεδομένα για γράφημα.</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <StatChip icon="⚖️" value={client.weight_kg ? `${client.weight_kg}kg` : "-"} />
          <StatChip icon="📅" value={`${memberDays} μέρες`} />
          <StatChip icon="📋" value={`${updatesCount}${updatesCount >= 12 ? "+" : ""} updates`} />
        </div>
      </div>
    </Card>
  );
}

function StatChip({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200">
      <span>{icon}</span>
      <span>{value}</span>
    </div>
  );
}

function factorColor(value: number): "red" | "amber" | "emerald" {
  return value <= 40 ? "red" : value <= 70 ? "amber" : "emerald";
}

function HealthScoreCard({ client }: { client: ClientRecord }) {
  const score = useMemo(() => computeHealthScore(client), [client]);
  const colorClass =
    score.color === "red"
      ? "text-red-600 dark:text-red-400"
      : score.color === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <Card className="p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <ProgressCircle value={score.total} color={score.color} size="lg">
          <span className={cn("text-2xl font-bold", colorClass)}>{score.total}</span>
        </ProgressCircle>
        <div className="w-full flex-1 space-y-3">
          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">Health Score</div>
          <HealthFactorBar label="Ενημερώσεις" value={score.updatesScore} />
          <HealthFactorBar label="Πληρωμές" value={score.paymentScore} />
          <HealthFactorBar label="Συνδρομή" value={score.subscriptionScore} />
        </div>
      </div>
    </Card>
  );
}

function HealthFactorBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <ProgressBar value={value} color={factorColor(value)} />
    </div>
  );
}

function NextActionsPanel({ client }: { client: ClientRecord }) {
  const actions = useMemo(() => computeNextActions(client), [client]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = actions.filter((action) => !dismissed.has(action.id));

  if (!visible.length) return null;

  return (
    <div className="space-y-2">
      {visible.map((action) => (
        <Alert
          key={action.id}
          variant={action.severity === "red" ? "destructive" : "default"}
          className={cn(
            action.severity === "amber" &&
              "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
          )}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{action.text}</AlertTitle>
          <AlertAction>
            <button
              type="button"
              onClick={() => setDismissed((current) => new Set(current).add(action.id))}
              aria-label="Απόρριψη"
              className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </AlertAction>
        </Alert>
      ))}
    </div>
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

const updateDayOptions = [
  { value: 1, label: "Δευτέρα" },
  { value: 2, label: "Τρίτη" },
  { value: 3, label: "Τετάρτη" },
  { value: 4, label: "Πέμπτη" },
  { value: 5, label: "Παρασκευή" },
  { value: 6, label: "Σάββατο" },
  { value: 0, label: "Κυριακή" },
];

function subscriptionProgressPct(client: ClientRecord): number {
  const start = client.subscription?.start_date ? new Date(client.subscription.start_date).getTime() : null;
  const end = client.subscription?.end_date ? new Date(client.subscription.end_date).getTime() : null;
  if (!start || !end || end <= start) return 0;
  const now = Date.now();
  const pct = ((end - now) / (end - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

function OverviewTab({
  client,
  clientId,
  onboarding,
  onUpdated,
  currentStatus,
  onApprovePayment,
  approvingPayment,
}: {
  client: ClientRecord;
  clientId: string;
  onboarding: Onboarding;
  onUpdated: () => void;
  currentStatus: StatusMetaResult;
  onApprovePayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
}) {
  const [form, setForm] = useState<ClientDetailsForm>(() => toDetailsForm(client));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingUpdateDay, setSavingUpdateDay] = useState(false);

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

  const saveUpdateDay = async (value: string) => {
    setSavingUpdateDay(true);
    setSaveMessage("");
    setSaveError("");
    try {
      await api.put(`/clients/${clientId}/update-day`, { updateDay: Number(value) });
      setSaveMessage("Η ημέρα update ενημερώθηκε.");
      onUpdated();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Δεν ενημερώθηκε η ημέρα update.");
    } finally {
      setSavingUpdateDay(false);
    }
  };

  const latestPayment = client.payments?.[0];
  const pendingPayment = latestPayment?.status === "pending" ? latestPayment : null;

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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column — 60% */}
        <div className="space-y-6 lg:col-span-3">
          <InfoCard title="Στοιχεία Επικοινωνίας">
            <div className="space-y-3">
              <Info label="Όνομα" value={client.full_name} />
              <Info label="Email" value={client.email} />
              <Info label="Τηλέφωνο" value={client.phone} />
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
              <EditField
                label="Επαφή έκτακτης ανάγκης"
                value={form.emergencyContactName}
                onChange={(value) => updateField("emergencyContactName", value)}
              />
              <EditField
                label="Τηλέφωνο έκτακτης ανάγκης"
                value={form.emergencyContactPhone}
                onChange={(value) => updateField("emergencyContactPhone", value)}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" onClick={saveDetails} disabled={saving} className="h-10 px-6 font-bold">
                {saving ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
              </Button>
            </div>
          </InfoCard>

          <Separator />

          <InfoCard title="Στόχοι & Επίπεδο">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Στόχος" value={onboarding.goal || "-"} />
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

          <Separator />

          <InfoCard title="Ημέρες Update">
            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Ημέρα εβδομαδιαίου update</Label>
            <Select
              items={updateDayOptions.map((option) => ({ value: String(option.value), label: option.label }))}
              value={client.updateSchedule?.day_of_week !== undefined ? String(client.updateSchedule.day_of_week) : undefined}
              onValueChange={(value) => value && saveUpdateDay(value)}
            >
              <SelectTrigger className="mt-1 h-10 w-full text-sm font-semibold" disabled={savingUpdateDay}>
                <SelectValue placeholder="Επιλογή ημέρας" />
              </SelectTrigger>
              <SelectContent>
                {updateDayOptions.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </InfoCard>

          <Separator />

          <InfoCard title="Social & Discord">
            {client.socialLinks?.length ? (
              client.socialLinks.map((item) => <Info key={`${item.platform}-${item.url}`} label={item.platform} value={item.url} />)
            ) : (
              <EmptyInline text="Δεν υπάρχουν social links." />
            )}
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              <EditField label="Discord ID" value={form.discordId} onChange={(value) => updateField("discordId", value)} />
            </div>
          </InfoCard>
        </div>

        {/* Right column — 40% */}
        <div className="space-y-6 lg:col-span-2">
          <InfoCard title="Συνδρομή">
            <Badge className={`h-auto w-fit rounded-md px-3 py-1.5 text-sm font-bold ${currentStatus.className}`}>{currentStatus.label}</Badge>
            <Info label="Έναρξη" value={formatDate(client.subscription?.start_date)} />
            <Info label="Λήξη" value={formatDate(client.subscription?.end_date)} />
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
                <span>Ημέρες που απομένουν</span>
                <span>{daysRemaining(client.subscription?.end_date)}</span>
              </div>
              <ProgressBar value={subscriptionProgressPct(client)} color={currentStatus.label === "Ανενεργός" ? "red" : "emerald"} />
            </div>
            <Info label="Πακέτο" value={onboarding.selected_package || "-"} />
            <Info
              label="Τρόπος πληρωμής"
              value={latestPayment?.method === "bank_transfer" ? "Τραπεζικό έμβασμα" : latestPayment?.method || "-"}
            />
            {pendingPayment && (
              <Button
                type="button"
                onClick={() => onApprovePayment(pendingPayment.id)}
                disabled={approvingPayment}
                className="mt-2 h-10 w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"
              >
                {approvingPayment ? "Έγκριση..." : "Έγκριση πληρωμής"}
              </Button>
            )}
          </InfoCard>

          <InfoCard title="Ιδιωτικές Σημειώσεις">
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">(Ορατό μόνο σε εσάς)</p>
            <Textarea
              className="min-h-24"
              value={form.coachNotes}
              onChange={(event) => updateField("coachNotes", event.target.value)}
              onBlur={saveDetails}
              placeholder="Δεν υπάρχουν σημειώσεις coach."
            />
          </InfoCard>
        </div>
      </div>
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
  manualPaymentOpen,
  onManualPaymentOpenChange,
}: {
  client: ClientRecord;
  clientId: string;
  onApprovePayment: (paymentId: number | string) => void;
  onRejectPayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
  rejectingPaymentId: number | string | null;
  onUpdated: () => void;
  manualPaymentOpen: boolean;
  onManualPaymentOpenChange: (open: boolean) => void;
}) {
  const payments = client.payments || [];
  const [form, setForm] = useState({ amount: "", method: "cash", status: "completed", referenceNumber: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const submitManualPayment = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post(`/clients/${clientId}/payments`, { ...form, amount: Number(form.amount) });
      onManualPaymentOpenChange(false);
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
          <Dialog open={manualPaymentOpen} onOpenChange={onManualPaymentOpenChange}>
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

  // weeklyUpdates arrives newest-first, so index 0 is the most recent weight
  // entry and the last entry in the filtered list is the oldest one available
  // (bounded by whatever the backend already returns — no new fetch here).
  const weightEntries = weeklyUpdates.filter((update) => update.weight_kg);
  const currentWeight = weightEntries.length ? Number(weightEntries[0].weight_kg) : null;
  const initialWeight = weightEntries.length ? Number(weightEntries[weightEntries.length - 1].weight_kg) : null;
  const weightChange = currentWeight !== null && initialWeight !== null ? currentWeight - initialWeight : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WeightStatCard label="Αρχικό βάρος" value={initialWeight} />
        <WeightStatCard label="Τρέχον βάρος" value={currentWeight} />
        <WeightStatCard label="Αλλαγή" value={weightChange} isChange />
      </div>

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

function WeightStatCard({
  label,
  value,
  isChange = false,
}: {
  label: string;
  value: number | null;
  isChange?: boolean;
}) {
  let toneClass = "text-slate-900 dark:text-slate-50";
  if (isChange) {
    toneClass =
      value === null || value === 0
        ? "text-slate-500 dark:text-slate-400"
        : value < 0
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400";
  }
  const display = value === null ? "-" : `${isChange && value > 0 ? "+" : ""}${value.toFixed(1)} kg`;

  return (
    <Card className="p-5">
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${toneClass}`}>{display}</div>
    </Card>
  );
}

function StateBox({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{text}</div>;
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
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
// Activity tab (Ιστορικό) — assembled client-side from data this page
// already fetches (weekly updates, payments, plan-history, registration).
// No new backend endpoint.
// ---------------------------------------------------------------------------

type ActivityType = "update" | "payment" | "training" | "nutrition" | "registration";

interface ActivityItem {
  id: string;
  type: ActivityType;
  date: string;
  title: string;
  detail: string;
  detailTone?: "amber" | "red";
  notes?: string;
}

const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  update: { icon: "📋", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  payment: { icon: "💳", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" },
  training: { icon: "🏋️", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400" },
  nutrition: { icon: "🥗", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400" },
  registration: { icon: "👤", color: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
};

function activityColorClass(item: ActivityItem): string {
  if (item.type === "payment") {
    if (item.detailTone === "amber") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
    if (item.detailTone === "red") return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
  }
  return ACTIVITY_META[item.type].color;
}

function stars(score?: number | string): string {
  const value = Math.round(Number(score) || 0);
  return value > 0 ? "⭐".repeat(Math.min(5, value)) : "-";
}

function buildActivityFeed(
  client: ClientRecord,
  trainingHistory: PlanHistoryRow[],
  nutritionHistory: PlanHistoryRow[],
): ActivityItem[] {
  const items: ActivityItem[] = [];

  (client.weeklyUpdates || []).forEach((update) => {
    if (!update.submitted_at) return;
    items.push({
      id: `update-${update.id}`,
      type: "update",
      date: update.submitted_at,
      title: "Εβδομαδιαίο update",
      detail: `Βάρος: ${update.weight_kg ? `${update.weight_kg}kg` : "-"} · Προπόνηση ${stars(update.training_score)} · Διατροφή ${stars(update.nutrition_score)}`,
      notes: update.notes || undefined,
    });
  });

  (client.payments || []).forEach((payment) => {
    if (!payment.created_at) return;
    const title =
      payment.status === "completed"
        ? "Πληρωμή επιβεβαιώθηκε"
        : payment.status === "pending"
          ? "Πληρωμή εκκρεμεί"
          : payment.status === "failed"
            ? "Πληρωμή απέτυχε"
            : "Πληρωμή";
    const methodLabel = payment.method === "bank_transfer" ? "Τραπεζικό έμβασμα" : payment.method || "-";
    items.push({
      id: `payment-${payment.id}`,
      type: "payment",
      date: payment.created_at,
      title,
      detail: `${money(payment.amount, payment.currency)} · ${methodLabel}`,
      detailTone: payment.status === "pending" ? "amber" : payment.status === "failed" ? "red" : undefined,
    });
  });

  trainingHistory.forEach((plan) => {
    if (!plan.created_at) return;
    items.push({
      id: `training-${plan.id}`,
      type: "training",
      date: plan.created_at,
      title: "Νέο πρόγραμμα προπόνησης",
      detail: plan.title || "-",
    });
  });

  nutritionHistory.forEach((plan) => {
    if (!plan.created_at) return;
    items.push({
      id: `nutrition-${plan.id}`,
      type: "nutrition",
      date: plan.created_at,
      title: "Νέο πρόγραμμα διατροφής",
      detail: plan.title || "-",
    });
  });

  if (client.created_at) {
    const earliestPayment = [...(client.payments || [])].sort(
      (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
    )[0];
    const goal = client.fitness_goal || client.onboarding?.goal;
    const amountPart = earliestPayment?.amount ? ` · ${money(earliestPayment.amount, earliestPayment.currency)}/μήνα` : "";
    items.push({
      id: "registration",
      type: "registration",
      date: client.created_at,
      title: "Εγγραφή πελάτη",
      detail: `${goal ? `Στόχος: ${goal}` : "Χωρίς καταγεγραμμένο στόχο"}${amountPart}`,
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const GREEK_MONTHS = [
  "ΙΑΝΟΥΑΡΙΟΣ",
  "ΦΕΒΡΟΥΑΡΙΟΣ",
  "ΜΑΡΤΙΟΣ",
  "ΑΠΡΙΛΙΟΣ",
  "ΜΑΙΟΣ",
  "ΙΟΥΝΙΟΣ",
  "ΙΟΥΛΙΟΣ",
  "ΑΥΓΟΥΣΤΟΣ",
  "ΣΕΠΤΕΜΒΡΙΟΣ",
  "ΟΚΤΩΒΡΙΟΣ",
  "ΝΟΕΜΒΡΙΟΣ",
  "ΔΕΚΕΜΒΡΙΟΣ",
];

function activityBucket(dateStr: string): { key: string; label: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mondayOffset = (startOfToday.getDay() + 6) % 7;
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - mondayOffset);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  if (date >= startOfToday) return { key: "today", label: "ΣΗΜΕΡΑ" };
  if (date >= startOfThisWeek) return { key: "this-week", label: "ΑΥΤΗ ΤΗΝ ΕΒΔΟΜΑΔΑ" };
  if (date >= startOfLastWeek) return { key: "last-week", label: "ΠΡΟΗΓΟΥΜΕΝΗ ΕΒΔΟΜΑΔΑ" };
  return { key: `${date.getFullYear()}-${date.getMonth()}`, label: `${GREEK_MONTHS[date.getMonth()]} ${date.getFullYear()}` };
}

function relativeTimeLabel(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return "σήμερα";
  if (diffDays === 1) return "χθες";
  if (diffDays < 7) return `${diffDays} μέρες πριν`;
  const weeks = Math.floor(diffDays / 7);
  if (weeks < 5) return `${weeks} εβδ. πριν`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months} μήνες πριν`;
  return `${Math.floor(diffDays / 365)} χρόνια πριν`;
}

function ActivityTab({
  client,
  trainingHistory,
  nutritionHistory,
}: {
  client: ClientRecord;
  trainingHistory: PlanHistoryRow[];
  nutritionHistory: PlanHistoryRow[];
}) {
  const items = useMemo(() => buildActivityFeed(client, trainingHistory, nutritionHistory), [client, trainingHistory, nutritionHistory]);

  if (!items.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
        <Clock className="h-10 w-10 text-slate-300 dark:text-slate-700" />
        <p className="font-bold text-slate-500 dark:text-slate-400">Δεν υπάρχει ιστορικό ακόμα</p>
      </Card>
    );
  }

  const groups: { key: string; label: string; items: ActivityItem[] }[] = [];
  items.forEach((item) => {
    const bucket = activityBucket(item.date);
    const existing = groups.find((group) => group.key === bucket.key);
    if (existing) existing.items.push(item);
    else groups.push({ key: bucket.key, label: bucket.label, items: [item] });
  });

  return (
    <Card className="p-6">
      <ScrollArea className="h-[70vh] pr-4">
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.key}>
              <h3 className="mb-4 text-xs font-bold tracking-wide text-slate-400 dark:text-slate-500">{group.label}</h3>
              <div className="relative space-y-5 border-l-2 border-slate-200 pl-6 dark:border-slate-800">
                {group.items.map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const [open, setOpen] = useState(false);
  const meta = ACTIVITY_META[item.type];

  return (
    <div className="relative">
      <span
        className={`absolute -left-[31px] top-0 flex h-7 w-7 items-center justify-center rounded-full text-sm ${activityColorClass(item)}`}
      >
        {meta.icon}
      </span>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-bold text-slate-950 dark:text-slate-50">{item.title}</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-slate-400">{item.detail}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{relativeTimeLabel(item.date)}</span>
            {item.notes && (
              <CollapsibleTrigger
                render={
                  <button
                    type="button"
                    aria-label="Περισσότερα"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  />
                }
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
            )}
          </div>
        </div>
        {item.notes && (
          <CollapsibleContent>
            <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {item.notes}
            </p>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
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
