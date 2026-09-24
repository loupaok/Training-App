"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, Sparkles, Star, Trash2, Undo2, GripVertical, Link2, Pencil, X } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AreaChart, SparkLineChart, ProgressBar } from "@tremor/react";
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
  notes?: string | null;
  paid_at?: string | null;
}

interface PricingPlanOption {
  id: number | string;
  name: string;
  price: number | string;
  period?: string;
  isActive?: boolean;
}

interface WeeklyUpdate {
  id: number | string;
  weight_kg?: number | string;
  submitted_at?: string;
  training_score?: number | string;
  nutrition_score?: number | string;
  notes?: string;
}

interface ProgressWeeklyUpdate {
  id: number | string;
  submittedAt?: string;
  weekStart?: string;
  isRead?: boolean;
  weight: number | null;
  trainingRating: number | null;
  nutritionRating: number | null;
  generalRating: number | null;
  notes: string | null;
  photos: string[];
}

interface ProgressWorkout {
  id: number | string;
  day_name: string | null;
  completed_at: string;
  duration_seconds: number | null;
  total_sets_completed: number | null;
  total_volume_kg: number | null;
  workout_feeling: "easy" | "good" | "hard" | "pr" | null;
  notes: string | null;
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
  plan_name?: string;
  price?: number | string | null;
  currency?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  daysRemaining?: number | null;
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
  is_active?: number | boolean;
  deleted_at?: string | null;
  deleted_by?: number | string | null;
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

interface ClientActivityLogEntry {
  id: number | string;
  action: string;
  performedBy: number | string;
  performedByName?: string | null;
  details?: string | null;
  createdAt?: string | null;
}

interface RegistrationQuestionnaireAnswer {
  question_id: number;
  question: string;
  answer?: string | null;
  type: string;
  options?: string | string[] | null;
  placeholder?: string | null;
}

type QuestionnaireAnswerValue = string | string[] | Record<string, string>;

function parseQuestionOptions(options?: string | string[] | null): string[] {
  if (Array.isArray(options)) return options;
  if (!options) return [];
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseAnswerValue(answer: string | null | undefined, type: string): QuestionnaireAnswerValue {
  if (!answer) return type === "multi_select" ? [] : "";
  if (type === "multi_select") {
    try {
      const parsed = JSON.parse(answer);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (type === "url") {
    try {
      const parsed = JSON.parse(answer);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // Plain URL answers remain as-is.
    }
    return answer;
  }
  return answer;
}

function isValidHttpUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
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

function relativeTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Μόλις τώρα";
  if (seconds < 3600) return `πριν από ${Math.floor(seconds / 60)} λεπτά`;
  if (seconds < 86400) return `πριν από ${Math.floor(seconds / 3600)} ώρες`;
  return `πριν από ${Math.floor(seconds / 86400)} ημέρες`;
}

function formatQuestionnaireAnswer(answer?: string | null, type?: string): string {
  const value = answer?.trim();
  if (!value) return "-";

  if (type === "multi_select") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(", ") || "-";
    } catch {
      // Older answers may be stored as plain text instead of JSON.
    }
  }

  if (type === "url") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>)
          .filter(([, url]) => typeof url === "string" && url.trim())
          .map(([label, url]) => `${label}: ${String(url).trim()}`);
        return entries.join(" · ") || "-";
      }
    } catch {
      // Plain URL answers remain readable without transformation.
    }
  }

  return value;
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
  confirmed: "Εγκρίθηκε",
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

function monthsSince(value?: string | null): number {
  const days = daysSince(value);
  if (days === null) return 0;
  return Math.max(0, Math.floor(days / 30));
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
  const router = useRouter();
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
  const [togglingActive, setTogglingActive] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoringClient, setRestoringClient] = useState(false);

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

  const setClientActive = async (active: boolean) => {
    setTogglingActive(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/clients/${clientId}`, { isActive: active });
      setMessage(active ? "Ο πελάτης ενεργοποιήθηκε." : "Ο πελάτης απενεργοποιήθηκε.");
      loadClientDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν ενημερώθηκε η κατάσταση.");
    } finally {
      setTogglingActive(false);
    }
  };

  const resetClientPassword = async (newPassword: string) => {
    setResettingPassword(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/admin/users/${clientId}/reset-password`, { newPassword });
      setMessage("Ο κωδικός του πελάτη ενημερώθηκε.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε επαναφορά κωδικού.");
    } finally {
      setResettingPassword(false);
    }
  };

  const deleteClient = async () => {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/clients/${clientId}`);
      router.push("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε διαγραφή.");
      setDeleting(false);
    }
  };

  const restoreClient = async () => {
    setRestoringClient(true);
    setMessage("");
    setError("");
    try {
      await api.put(`/clients/${clientId}/restore`);
      setMessage("Ο πελάτης επανήλθε στη λίστα ενεργών.");
      loadClientDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε επαναφορά του πελάτη.");
    } finally {
      setRestoringClient(false);
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

      {!loading && client?.deleted_at && (
        <Alert variant="destructive" className="mb-4 border-destructive bg-destructive text-white [&_[data-slot=alert-description]]:text-white/90">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ο πελάτης βρίσκεται στον Κάδο</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Διαγράφηκε την {formatDateTime(client.deleted_at)}.</span>
            {(user?.role === "coach" || user?.role === "admin") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white text-white hover:bg-white hover:text-destructive"
                onClick={restoreClient}
                disabled={restoringClient}
              >
                <Undo2 className="h-4 w-4" />
                {restoringClient ? "Επαναφορά..." : "Επαναφορά"}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loading && <StateBox text="Φόρτωση πελάτη..." />}
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
      {message && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5 font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">{message}</div>}

      {!loading && client && (
        <div className="space-y-6">
          <ClientHeader
            client={client}
            displayName={displayName}
            currentStatus={currentStatus}
            onboarding={onboarding}
            onSetActive={setClientActive}
            togglingActive={togglingActive}
            canManageStatus={user?.role === "coach" || user?.role === "admin"}
            canDelete={user?.role === "admin"}
            onDelete={deleteClient}
            deleting={deleting}
          />

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
                canEdit={Boolean(user && ["coach", "admin", "moderator"].includes(user.role))}
                onApprovePayment={approvePayment}
                approvingPayment={approvingPayment}
                onResetPassword={resetClientPassword}
                resettingPassword={resettingPassword}
                canResetPassword={user?.role === "admin"}
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
              />
            </TabsContent>

            <TabsContent value="messages" className="mt-6">
              <MessagesTab clientId={clientId} />
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <ActivityLogTab clientId={clientId} active={activeTab === "activity"} />
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
  onSetActive,
  togglingActive,
  canManageStatus,
  canDelete,
  onDelete,
  deleting,
}: {
  client: ClientRecord;
  displayName: string;
  currentStatus: StatusMetaResult;
  onboarding: Onboarding;
  onSetActive: (active: boolean) => void;
  togglingActive: boolean;
  canManageStatus: boolean;
  canDelete: boolean;
  onDelete: () => Promise<void>;
  deleting: boolean;
}) {
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isActive = Boolean(client.is_active);

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

      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        {canManageStatus && isActive && (
          <Button type="button" variant="outline" onClick={() => setDeactivateOpen(true)} className="border-destructive text-destructive hover:bg-destructive hover:text-white">
            Απενεργοποίηση
          </Button>
        )}
        {canManageStatus && !isActive && (
          <Button type="button" variant="outline" onClick={() => setActivateOpen(true)} className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white">
            Ενεργοποίηση
          </Button>
        )}
        {canDelete && (
          <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)} className="border-destructive text-destructive hover:bg-destructive hover:text-white">
            Διαγραφή
          </Button>
        )}
      </div>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Απενεργοποίηση πελάτη;</AlertDialogTitle>
            <AlertDialogDescription>Ο πελάτης δεν θα διαγραφεί.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              disabled={togglingActive}
              onClick={async () => {
                await onSetActive(false);
                setDeactivateOpen(false);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {togglingActive ? "Απενεργοποίηση..." : "Απενεργοποίηση"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ενεργοποίηση πελάτη;</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              disabled={togglingActive}
              onClick={async () => {
                await onSetActive(true);
                setActivateOpen(false);
              }}
            >
              {togglingActive ? "Ενεργοποίηση..." : "Ενεργοποίηση"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Οριστική διαγραφή πελάτη;</AlertDialogTitle>
            <AlertDialogDescription>Αυτή η ενέργεια δεν αναιρείται.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? "Διαγραφή..." : "Διαγραφή"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ResetPasswordDialog({
  onResetPassword,
  resettingPassword,
}: {
  onResetPassword: (newPassword: string) => Promise<void>;
  resettingPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const passwordsMatch = newPassword === confirmPassword;
  const validPassword = newPassword.length >= 8 && passwordsMatch;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Επαναφορά Κωδικού
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Επαναφορά Κωδικού</AlertDialogTitle>
          <AlertDialogDescription>Εισάγετε νέο κωδικό για τον πελάτη.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-client-password">Νέος Κωδικός</Label>
            <Input id="new-client-password" type="password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-client-password">Επιβεβαίωση</Label>
            <Input id="confirm-client-password" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {confirmPassword && !passwordsMatch && <p className="text-sm text-destructive">Οι κωδικοί δεν ταιριάζουν.</p>}
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
          <AlertDialogAction
            disabled={!validPassword || resettingPassword}
            onClick={async () => {
              await onResetPassword(newPassword);
              setNewPassword("");
              setConfirmPassword("");
              setOpen(false);
            }}
          >
            {resettingPassword ? "Αποθήκευση..." : "Αποθήκευση"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

interface ClientDetailsForm {
  fullName: string;
  email: string;
  phone: string;
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
    fullName: client.full_name || "",
    email: client.email || "",
    phone: client.phone || "",
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

const OVERVIEW_LAYOUT_STORAGE_KEY = "coach-client-overview-layout-v1";

const DEFAULT_SECTION_ORDER: { id: string; column: "left" | "right" }[] = [
  { id: "contact", column: "left" },
  { id: "questionnaire", column: "left" },
  { id: "subscription", column: "right" },
  { id: "notes", column: "right" },
];

function subscriptionElapsedPct(client: ClientRecord): number {
  const start = client.subscription?.start_date ? new Date(client.subscription.start_date).getTime() : null;
  const end = client.subscription?.end_date ? new Date(client.subscription.end_date).getTime() : null;
  if (!start || !end || end <= start) return 0;
  const now = Date.now();
  const pct = ((now - start) / (end - start)) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

function subscriptionStatusMeta(status?: string, endDate?: string | null): { label: string; className: string } {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: { label: "Ενεργός", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300" },
    expiring_soon: { label: "Λήγει σύντομα", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" },
    expired: { label: "Έληξε", className: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300" },
    pending_payment: { label: "Εκκρεμής έγκριση", className: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
  };

  if (endDate) {
    const days = Math.ceil((new Date(`${endDate}T00:00:00`).getTime() - Date.now()) / 86400000);
    if (days < 0) return statusMap.expired;
    if (days <= 7) return statusMap.expiring_soon;
  }

  return statusMap[status || ""] || statusMap.pending_payment;
}

function paymentMethodLabel(method?: string): string {
  const labels: Record<string, string> = {
    card: "Κάρτα",
    bank: "Τραπεζικό Έμβασμα",
    bank_transfer: "Τραπεζικό Έμβασμα",
    stripe: "Stripe",
    cash: "Μετρητά",
  };
  return method ? labels[method] || method : "-";
}

function dateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function planDurationMonths(period?: string): number {
  const value = (period || "").toLocaleLowerCase("el-GR");
  if (value.includes("12") || value.includes("έτος") || value.includes("year")) return 12;
  if (value.includes("6") || value.includes("εξάμη")) return 6;
  if (value.includes("3") || value.includes("τρίμη") || value.includes("quarter")) return 3;
  if (value.includes("4")) return 4;
  if (value.includes("2")) return 2;
  return 1;
}

function endDateForPlan(startDate: string, period?: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return startDate;
  start.setMonth(start.getMonth() + planDurationMonths(period));
  return dateInputValue(start);
}

function defaultPaymentEndDate(startDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return startDate;
  start.setDate(start.getDate() + 30);
  return dateInputValue(start);
}

function shortDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("el-GR", { day: "numeric", month: "short" });
}

function formatGreekPaymentDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("el-GR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function euroAmount(value?: number | string | null): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `€${amount.toFixed(2)}` : "-";
}

function OverviewTab({
  client,
  clientId,
  onboarding,
  onUpdated,
  currentStatus,
  canEdit,
  onApprovePayment,
  approvingPayment,
  onResetPassword,
  resettingPassword,
  canResetPassword,
}: {
  client: ClientRecord;
  clientId: string;
  onboarding: Onboarding;
  onUpdated: () => void;
  currentStatus: StatusMetaResult;
  canEdit: boolean;
  onApprovePayment: (paymentId: number | string) => void;
  approvingPayment: boolean;
  onResetPassword: (newPassword: string) => Promise<void>;
  resettingPassword: boolean;
  canResetPassword: boolean;
}) {
  const [form, setForm] = useState<ClientDetailsForm>(() => toDetailsForm(client));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingUpdateDay, setSavingUpdateDay] = useState(false);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<RegistrationQuestionnaireAnswer[]>([]);
  const [loadingQuestionnaireAnswers, setLoadingQuestionnaireAnswers] = useState(true);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState(false);
  const [questionnaireDraft, setQuestionnaireDraft] = useState<Record<number, QuestionnaireAnswerValue>>({});
  const [savingQuestionnaire, setSavingQuestionnaire] = useState(false);
  const [questionnaireError, setQuestionnaireError] = useState("");
  const [sectionOrder, setSectionOrder] = useState<{ id: string; column: "left" | "right" }[]>(DEFAULT_SECTION_ORDER);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(OVERVIEW_LAYOUT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_SECTION_ORDER.length) setSectionOrder(parsed);
      }
    } catch {
      // Ignore malformed/blocked storage — fall back to the default layout.
    }
  }, []);

  const persistSectionOrder = (next: { id: string; column: "left" | "right" }[]) => {
    setSectionOrder(next);
    try {
      window.localStorage.setItem(OVERVIEW_LAYOUT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage write failures (private mode, quota, etc.).
    }
  };

  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeItem = sectionOrder.find((item) => item.id === activeId);
    if (!activeItem) return;

    const isColumnDrop = overId === "column-left" || overId === "column-right";
    const targetColumn: "left" | "right" = isColumnDrop ? (overId === "column-left" ? "left" : "right") : sectionOrder.find((item) => item.id === overId)?.column ?? activeItem.column;

    if (targetColumn === activeItem.column && !isColumnDrop) {
      const columnIds = sectionOrder.filter((item) => item.column === activeItem.column).map((item) => item.id);
      const oldIndex = columnIds.indexOf(activeId);
      const newIndex = columnIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reorderedColumn = arrayMove(columnIds, oldIndex, newIndex);
      const otherItems = sectionOrder.filter((item) => item.column !== activeItem.column);
      const reordered = [...otherItems, ...reorderedColumn.map((id) => ({ id, column: activeItem.column }))];
      persistSectionOrder(reordered);
      return;
    }

    const withoutActive = sectionOrder.filter((item) => item.id !== activeId);
    const moved = { id: activeId, column: targetColumn };
    const insertAt = isColumnDrop ? withoutActive.length : withoutActive.findIndex((item) => item.id === overId);
    const next = [...withoutActive];
    next.splice(insertAt === -1 ? next.length : insertAt, 0, moved);
    persistSectionOrder(next);
  };

  useEffect(() => {
    setForm(toDetailsForm(client));
  }, [client]);

  useEffect(() => {
    let active = true;
    setLoadingQuestionnaireAnswers(true);

    api
      .get<RegistrationQuestionnaireAnswer[]>(`/clients/${clientId}/questionnaire-answers`)
      .then((answers) => {
        if (active) setQuestionnaireAnswers(answers);
      })
      .catch(() => {
        if (active) setQuestionnaireAnswers([]);
      })
      .finally(() => {
        if (active) setLoadingQuestionnaireAnswers(false);
      });

    return () => {
      active = false;
    };
  }, [clientId]);

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

  const startEditingQuestionnaire = () => {
    const draft: Record<number, QuestionnaireAnswerValue> = {};
    questionnaireAnswers.forEach((item) => {
      draft[item.question_id] = parseAnswerValue(item.answer, item.type);
    });
    setQuestionnaireDraft(draft);
    setQuestionnaireError("");
    setEditingQuestionnaire(true);
  };

  const updateQuestionnaireDraft = (questionId: number, value: QuestionnaireAnswerValue) => {
    setQuestionnaireDraft((current) => ({ ...current, [questionId]: value }));
  };

  const cancelEditingQuestionnaire = () => {
    setEditingQuestionnaire(false);
    setQuestionnaireError("");
  };

  const saveQuestionnaireAnswers = async () => {
    const invalidUrl = questionnaireAnswers.some((item) => {
      if (item.type !== "url") return false;
      const value = questionnaireDraft[item.question_id];
      if (value === undefined) return false;
      if (typeof value === "string") return value.trim() !== "" && !isValidHttpUrl(value);
      if (typeof value === "object" && !Array.isArray(value)) {
        return Object.values(value).some((entry) => entry.trim() !== "" && !isValidHttpUrl(entry));
      }
      return false;
    });
    if (invalidUrl) {
      setQuestionnaireError("Έλεγξε ότι οι σύνδεσμοι που έδωσες είναι έγκυρα URL (π.χ. https://...).");
      return;
    }

    setSavingQuestionnaire(true);
    setQuestionnaireError("");
    try {
      const answers = questionnaireAnswers.map((item) => ({
        question_id: item.question_id,
        answer: questionnaireDraft[item.question_id] ?? "",
      }));
      const updated = await api.put<RegistrationQuestionnaireAnswer[]>(`/clients/${clientId}/questionnaire-answers`, { answers }).then(
        () => api.get<RegistrationQuestionnaireAnswer[]>(`/clients/${clientId}/questionnaire-answers`),
      );
      setQuestionnaireAnswers(updated);
      setEditingQuestionnaire(false);
    } catch (err) {
      setQuestionnaireError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκαν οι απαντήσεις.");
    } finally {
      setSavingQuestionnaire(false);
    }
  };

  const latestPayment = client.payments?.[0];
  const pendingPayment = latestPayment?.status === "pending" ? latestPayment : null;

  const sectionsMap: Record<string, ReactNode> = {
    contact: (
      <InfoCard title="Στοιχεία Επικοινωνίας">
        <div className="space-y-3">
          <EditField label="Όνομα" value={form.fullName} onChange={(value) => updateField("fullName", value)} disabled={!canEdit} />
          <EditField label="Email" type="email" value={form.email} onChange={(value) => updateField("email", value)} disabled={!canEdit} />
          <EditField label="Τηλέφωνο" value={form.phone} onChange={(value) => updateField("phone", value)} disabled={!canEdit} />
          <EditField label="Ημερομηνία γέννησης" type="date" value={form.dateOfBirth} onChange={(value) => updateField("dateOfBirth", value)} disabled={!canEdit} />
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
              <SelectTrigger className="mt-1 h-10 w-full text-sm font-semibold" disabled={!canEdit}>
                <SelectValue placeholder="Επιλογή" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Άνδρας</SelectItem>
                <SelectItem value="female">Γυναίκα</SelectItem>
                <SelectItem value="other">Άλλο</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={saveDetails} disabled={saving || !canEdit} className="h-10 px-6 font-bold">
            {saving ? "Αποθήκευση..." : "Αποθήκευση στοιχείων"}
          </Button>
        </div>
      </InfoCard>
    ),
    questionnaire: (
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-lg">Στοιχεία Φόρμας Εγγραφής</CardTitle>
            <p className="text-sm text-muted-foreground">Απαντήσεις κατά την εγγραφή</p>
          </div>
        </CardHeader>
        <CardContent>
          {questionnaireError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              {questionnaireError}
            </div>
          )}
          {loadingQuestionnaireAnswers ? (
            <p className="text-sm text-muted-foreground">Φόρτωση απαντήσεων...</p>
          ) : !questionnaireAnswers.length ? (
            <p className="italic text-muted-foreground">Δεν υπάρχουν απαντήσεις από τη φόρμα εγγραφής</p>
          ) : editingQuestionnaire ? (
            <div className="space-y-5">
              {questionnaireAnswers.map((item) => (
                <div key={item.question_id}>
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">{item.question}</p>
                  <QuestionnaireAnswerField
                    type={item.type}
                    options={parseQuestionOptions(item.options)}
                    placeholder={item.placeholder || ""}
                    value={questionnaireDraft[item.question_id]}
                    onChange={(value) => updateQuestionnaireDraft(item.question_id, value)}
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={cancelEditingQuestionnaire} disabled={savingQuestionnaire} className="h-10 px-5 font-bold">
                  Άκυρο
                </Button>
                <Button type="button" onClick={saveQuestionnaireAnswers} disabled={savingQuestionnaire} className="h-10 px-6 font-bold">
                  {savingQuestionnaire ? "Αποθήκευση..." : "Αποθήκευση απαντήσεων"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {questionnaireAnswers.map((item, index) => (
                <div key={item.question_id} className={index > 0 ? "border-t pt-4" : ""}>
                  {index > 0 && <div className="mb-4" />}
                  <p className="text-sm text-muted-foreground">{item.question}</p>
                  <p className="mt-1 text-sm font-medium">{formatQuestionnaireAnswer(item.answer, item.type)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    ),
    subscription: client.subscription ? (
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="text-lg">Συνδρομή</CardTitle>
          {(() => {
            const status = subscriptionStatusMeta(client.subscription?.status, client.subscription?.end_date);
            return <Badge className={`h-auto w-full justify-center rounded-md px-3 py-2 text-sm font-bold ${status.className}`}>{status.label}</Badge>;
          })()}
        </CardHeader>
        <CardContent className="space-y-5">
          {client.subscription.start_date && client.subscription.end_date && (() => {
            const start = new Date(client.subscription!.start_date!).getTime();
            const end = new Date(client.subscription!.end_date!).getTime();
            const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
            const remainingDays = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
            const remainingRatio = remainingDays / totalDays;
            const progressColor = remainingRatio > 0.5 ? "bg-emerald-500" : remainingRatio >= 0.2 ? "bg-amber-500" : "bg-red-500";

            return (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{remainingDays}</span>
                  <span className="text-sm text-muted-foreground">μέρες απομένουν</span>
                </div>
                <Progress value={subscriptionElapsedPct(client)} indicatorClassName={progressColor} className="mt-3" />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{shortDate(client.subscription.start_date)}</span>
                  <span>{shortDate(client.subscription.end_date)}</span>
                </div>
              </div>
            );
          })()}

          <Separator />

          <div className="grid grid-cols-2 divide-x rounded-lg border">
            <div className="p-3">
              <p className="text-xs text-muted-foreground">Πακέτο</p>
              <p className="mt-1 text-sm font-semibold">{onboarding.selected_package || "-"}</p>
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground">Τρόπος πληρωμής</p>
              <p className="mt-1 text-sm font-semibold">{paymentMethodLabel(latestPayment?.method)}</p>
            </div>
          </div>

          {pendingPayment && (
            <Button type="button" onClick={() => onApprovePayment(pendingPayment.id)} disabled={approvingPayment} className="h-10 w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700">
              {approvingPayment ? "Έγκριση..." : "Έγκριση πληρωμής"}
            </Button>
          )}
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Συνδρομή</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-center">
          <p className="text-sm text-muted-foreground">Δεν υπάρχει ενεργή συνδρομή</p>
        </CardContent>
      </Card>
    ),
    notes: (
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
    ),
  };

  const leftIds = sectionOrder.filter((item) => item.column === "left").map((item) => item.id);
  const rightIds = sectionOrder.filter((item) => item.column === "right").map((item) => item.id);

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

      <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <div className="grid gap-6 lg:grid-cols-5">
          <OverviewColumn columnId="column-left" ids={leftIds} className="lg:col-span-3">
            {leftIds.map((id) => (
              <DraggableSection key={id} id={id}>
                {sectionsMap[id]}
              </DraggableSection>
            ))}
          </OverviewColumn>
          <OverviewColumn columnId="column-right" ids={rightIds} className="lg:col-span-2">
            {rightIds.map((id) => (
              <DraggableSection key={id} id={id}>
                {sectionsMap[id]}
              </DraggableSection>
            ))}
          </OverviewColumn>
        </div>
      </DndContext>
    </div>
  );
}

function OverviewColumn({
  columnId,
  ids,
  className,
  children,
}: {
  columnId: string;
  ids: string[];
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: columnId });
  return (
    <div ref={setNodeRef} className={cn("space-y-6", className)}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}

function DraggableSection({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "z-10 opacity-60")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute -left-2 top-3 z-10 flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500"
        aria-label="Μετακίνηση ενότητας"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  );
}

function QuestionnaireAnswerField({
  type,
  options,
  placeholder,
  value,
  onChange,
}: {
  type: string;
  options: string[];
  placeholder: string;
  value: QuestionnaireAnswerValue | undefined;
  onChange: (value: QuestionnaireAnswerValue) => void;
}) {
  if (type === "textarea") {
    return <Textarea value={(value as string) || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-20" />;
  }
  if (type === "number") {
    return (
      <Input type="number" value={(value as string) || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10" />
    );
  }
  if (type === "url") {
    if (options.length) {
      const labelValues = typeof value === "object" && !Array.isArray(value) ? value : {};
      return (
        <div className="space-y-3">
          {options.map((label) => (
            <div key={label}>
              <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
              <div className="relative mt-1">
                <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  type="url"
                  autoComplete="off"
                  value={labelValues[label] || ""}
                  onChange={(event) => onChange({ ...labelValues, [label]: event.target.value })}
                  placeholder={`${label} URL`}
                  className="h-10 pl-9"
                />
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="relative">
        <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <Input
          type="url"
          autoComplete="off"
          value={(value as string) || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-10 pl-9"
        />
      </div>
    );
  }
  if (type === "single_select") {
    return (
      <RadioGroup value={(value as string) || ""} onValueChange={(next) => onChange(next ?? "")} className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
              value === option ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700",
            )}
          >
            <RadioGroupItem value={option} />
            {option}
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                checked ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) => {
                  const nextSelected = next === true ? [...selected, option] : selected.filter((item) => item !== option);
                  onChange(nextSelected);
                }}
              />
              {option}
            </label>
          );
        })}
      </div>
    );
  }
  return <Input value={(value as string) || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10" />;
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Input type={type} className="mt-1 h-10 text-sm font-semibold" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
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
  const [payments, setPayments] = useState<Payment[]>(client.payments || []);
  const [open, setOpen] = useState(false);
  const today = dateInputValue(new Date());
  const [plans, setPlans] = useState<PricingPlanOption[]>([]);
  const [form, setForm] = useState({ amount: "", method: "cash", planId: "", startDate: today, endDate: defaultPaymentEndDate(today), notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);

  const loadPayments = async () => {
    const rows = await api.get<Payment[]>(`/clients/${clientId}/payments`);
    setPayments(rows);
  };

  useEffect(() => {
    setPayments(client.payments || []);
  }, [client.payments]);

  useEffect(() => {
    loadPayments().catch(() => {
      // The detail response remains a usable fallback while the payment list loads.
    });
  }, [clientId]);

  useEffect(() => {
    let active = true;
    api
      .get<PricingPlanOption[]>("/pricing-plans?active=true")
      .then((rows) => {
        if (!active) return;
        const activePlans = rows.filter((plan) => plan.isActive !== false);
        setPlans(activePlans);
        if (activePlans[0]) {
          setForm((current) => current.planId ? current : {
            ...current,
            planId: String(activePlans[0].id),
            amount: String(activePlans[0].price),
            endDate: endDateForPlan(current.startDate, activePlans[0].period),
          });
        }
      })
      .catch(() => {
        if (active) setPlans([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const submitManualPayment = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await api.post(`/clients/${clientId}/payments`, {
        ...form,
        amount: Number(form.amount),
        planId: form.planId ? Number(form.planId) : undefined,
      });
      setOpen(false);
      setForm({ amount: "", method: "cash", planId: "", startDate: today, endDate: defaultPaymentEndDate(today), notes: "" });
      onUpdated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Δεν καταχωρήθηκε η πληρωμή.");
    } finally {
      setSaving(false);
    }
  };

  const deletePayment = async () => {
    if (!paymentToDelete) return;
    setDeletingPayment(true);
    try {
      await api.delete(`/clients/${clientId}/payments/${paymentToDelete.id}`);
      setPaymentToDelete(null);
      await loadPayments();
      onUpdated();
    } finally {
      setDeletingPayment(false);
    }
  };

  const subscriptionMeta = client.subscription
    ? subscriptionStatusMeta(client.subscription.status, client.subscription.end_date)
    : null;

  const openPaymentDialog = (nextOpen: boolean) => {
    if (nextOpen) {
      const todayValue = dateInputValue(new Date());
      const currentEndDate = client.subscription?.end_date;
      const currentEnd = currentEndDate ? new Date(`${currentEndDate}T00:00:00`) : null;
      const isActiveSubscription = client.subscription?.status === "active" || client.subscription?.status === "expiring_soon";
      const continuesSubscription = isActiveSubscription && currentEnd && !Number.isNaN(currentEnd.getTime()) && currentEnd.getTime() >= new Date(`${todayValue}T00:00:00`).getTime();
      const startDate = continuesSubscription ? currentEndDate! : todayValue;
      const selectedPlan = plans.find((plan) => String(plan.id) === form.planId);
      setForm((current) => ({
        ...current,
        startDate,
        endDate: selectedPlan ? endDateForPlan(startDate, selectedPlan.period) : defaultPaymentEndDate(startDate),
      }));
    }
    setOpen(nextOpen);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Κατάσταση</p>
            {subscriptionMeta ? <Badge className={`mt-2 h-auto rounded-md px-3 py-1.5 text-sm font-bold ${subscriptionMeta.className}`}>{subscriptionMeta.label}</Badge> : <p className="mt-2 text-lg font-semibold">-</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Πλάνο</p>
            <p className="mt-2 text-lg font-semibold">{client.subscription?.plan_name || "-"}</p>
            <p className="text-sm text-muted-foreground">{client.subscription?.price !== undefined && client.subscription?.price !== null ? `${euroAmount(client.subscription.price)}/μήνα` : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Λήγει σε</p>
            <p className="mt-2 text-lg font-semibold">{daysRemaining(client.subscription?.end_date)}</p>
            <p className="text-sm text-muted-foreground">{shortDate(client.subscription?.end_date)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <CardTitle className="text-xl font-bold">Ιστορικό Πληρωμών</CardTitle>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Όλες οι πληρωμές του πελάτη και οι χειροκίνητες ενέργειες έγκρισης.</p>
          </div>
          <Dialog open={open} onOpenChange={openPaymentDialog}>
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
                {client.subscription?.end_date && (client.subscription.status === "active" || client.subscription.status === "expiring_soon") && (
                  <p className="text-sm text-muted-foreground">Τρέχουσα λήξη: {shortDate(client.subscription.end_date)}</p>
                )}
                <EditField label="Ποσό * (EUR)" type="number" value={form.amount} onChange={(value) => setForm((f) => ({ ...f, amount: value }))} />
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Τρόπος πληρωμής</Label>
                  <Select
                    items={[
                      { value: "cash", label: "Μετρητά" },
                      { value: "bank_transfer", label: "Τραπεζικό έμβασμα" },
                      { value: "card", label: "Κάρτα" },
                      { value: "stripe", label: "Stripe" },
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
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Πλάνο</Label>
                  <Select
                    items={plans.map((plan) => ({ value: String(plan.id), label: `${plan.name} - ${money(plan.price)}` }))}
                    value={form.planId}
                    onValueChange={(value) => {
                      const plan = plans.find((item) => String(item.id) === value);
                      setForm((current) => ({
                        ...current,
                        planId: value || "",
                        amount: plan ? String(plan.price) : current.amount,
                        endDate: plan ? endDateForPlan(current.startDate, plan.period) : current.endDate,
                      }));
                    }}
                  >
                    <SelectTrigger className="mt-1 h-10 w-full text-sm font-semibold"><SelectValue placeholder="Επιλογή πλάνου" /></SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name} - {money(plan.price)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <EditField
                    label="Ημερομηνία έναρξης *"
                    type="date"
                    value={form.startDate}
                    onChange={(value) => setForm((current) => ({
                      ...current,
                      startDate: value,
                      endDate: endDateForPlan(value, plans.find((plan) => String(plan.id) === current.planId)?.period),
                    }))}
                  />
                  <EditField label="Ημερομηνία λήξης *" type="date" value={form.endDate} onChange={(value) => setForm((current) => ({ ...current, endDate: value }))} />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">Σημειώσεις</Label>
                  <Textarea className="mt-1 min-h-20" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
                </div>
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
            <TableHead className="px-5 py-4">Status</TableHead>
            <TableHead className="px-5 py-4">Σημειώσεις</TableHead>
            <TableHead className="px-5 py-4">Ενέργειες</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
          {payments.map((payment) => (
            <TableRow key={payment.id} className="align-top">
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{formatGreekPaymentDate(payment.paid_at || payment.created_at)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-bold text-slate-950 dark:text-slate-50">{euroAmount(payment.amount)}</TableCell>
              <TableCell className="whitespace-normal px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">
                {paymentMethodLabel(payment.method)}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                <PaymentStatus status={payment.status} />
              </TableCell>
              <TableCell className="max-w-44 whitespace-normal px-5 py-4">
                {payment.notes ? (
                  <Tooltip>
                    <TooltipTrigger render={<span className="block cursor-default truncate text-sm text-muted-foreground" />}>{payment.notes}</TooltipTrigger>
                    <TooltipContent>{payment.notes}</TooltipContent>
                  </Tooltip>
                ) : <span className="text-muted-foreground">-</span>}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {payment.status === "pending" && (
                    <>
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
                    </>
                  )}
                  <Button type="button" variant="ghost" size="icon" onClick={() => setPaymentToDelete(payment)} className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Διαγραφή πληρωμής">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!payments.length && (
            <TableRow>
              <TableCell colSpan={6} className="whitespace-normal px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                Δεν υπάρχουν πληρωμές ακόμα.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </Card>
      <AlertDialog open={Boolean(paymentToDelete)} onOpenChange={(open) => !open && setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Διαγραφή πληρωμής;</AlertDialogTitle>
            <AlertDialogDescription>
              {`Διαγραφή πληρωμής ${euroAmount(paymentToDelete?.amount)}; Αυτή η ενέργεια δεν αναιρείται.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPayment}>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction onClick={deletePayment} disabled={deletingPayment} className="bg-destructive text-white hover:bg-destructive/90">
              {deletingPayment ? "Διαγραφή..." : "Διαγραφή"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

function PaymentStatus({ status }: { status?: string }) {
  const meta: Record<string, [string, string]> = {
    completed: ["Εγκρίθηκε", "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"],
    confirmed: ["Εγκρίθηκε", "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"],
    pending: ["Εκκρεμεί", "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"],
    failed: ["Απέτυχε", "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"],
    refunded: ["Επιστροφή", "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"],
  };
  const [label, className] = meta[status || ""] || [status || "-", "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"];

  return <Badge className={`h-auto rounded-md px-3 py-1 text-sm font-bold ${className}`}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// Progress tab
// ---------------------------------------------------------------------------

function exportWeeklyUpdatesCsv(updates: ProgressWeeklyUpdate[], clientName: string) {
  const header = ["Ημερομηνία", "Βάρος (kg)", "Προπόνηση", "Διατροφή", "Σημειώσεις"];
  const rows = updates.map((update) => [
    formatDateTime(update.submittedAt),
    update.weight ?? "",
    update.trainingRating ?? "",
    update.nutritionRating ?? "",
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

function RatingStars({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-500 dark:text-slate-400">-</span>;

  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} στα 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn("h-3.5 w-3.5", index < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600")}
        />
      ))}
    </span>
  );
}

const workoutFeelingMeta: Record<string, { emoji: string; label: string }> = {
  easy: { emoji: "😊", label: "Εύκολο" },
  good: { emoji: "😄", label: "Καλά" },
  hard: { emoji: "😤", label: "Δύσκολο" },
  pr: { emoji: "🏆", label: "PR" },
};

function ProgressTab({ client }: { client: ClientRecord }) {
  const [weeklyUpdates, setWeeklyUpdates] = useState<ProgressWeeklyUpdate[]>([]);
  const [workouts, setWorkouts] = useState<ProgressWorkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (!client.id) return;
    let cancelled = false;
    setIsLoading(true);
    api
      .get<ProgressWeeklyUpdate[]>(`/clients/${client.id}/weekly-updates`)
      .then((updates) => {
        if (!cancelled) setWeeklyUpdates(updates);
      })
      .catch(() => {
        if (!cancelled) setWeeklyUpdates([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    setWorkoutsLoading(true);
    api
      .get<ProgressWorkout[]>(`/clients/${client.id}/workouts`)
      .then((rows) => {
        if (!cancelled) setWorkouts(rows);
      })
      .catch(() => {
        if (!cancelled) setWorkouts([]);
      })
      .finally(() => {
        if (!cancelled) setWorkoutsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client.id]);

  const chartData = [...weeklyUpdates]
    .filter((update) => update.weight !== null)
    .reverse()
    .map((update) => ({ date: formatDate(update.submittedAt), Βάρος: update.weight as number }));

  const recentPhotos = weeklyUpdates.flatMap((update) => update.photos).slice(0, 3);
  const weightEntries = weeklyUpdates.filter((update) => update.weight !== null);
  const currentWeight = weightEntries.length ? weightEntries[0].weight : null;
  const initialWeight = weightEntries.length ? weightEntries[weightEntries.length - 1].weight : null;
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
              <button
                key={photo}
                type="button"
                className="overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setSelectedPhoto(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveMediaUrl(photo)} alt="Φωτογραφία προόδου" className="aspect-square w-full object-cover" />
              </button>
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
            disabled={isLoading || !weeklyUpdates.length}
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
              <TableHead className="px-5 py-4">Προπόνηση</TableHead>
              <TableHead className="px-5 py-4">Διατροφή</TableHead>
              <TableHead className="px-5 py-4">Σημειώσεις</TableHead>
              <TableHead className="px-5 py-4">Φωτογραφίες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
            {weeklyUpdates.map((update) => (
              <TableRow key={update.id}>
                <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(update.submittedAt)}</TableCell>
                <TableCell className="px-5 py-4 font-bold text-slate-950 dark:text-slate-50">{update.weight !== null ? `${update.weight} kg` : "-"}</TableCell>
                <TableCell className="px-5 py-4"><RatingStars value={update.trainingRating} /></TableCell>
                <TableCell className="px-5 py-4"><RatingStars value={update.nutritionRating} /></TableCell>
                <TableCell className="max-w-xs px-5 py-4 font-semibold text-slate-500 dark:text-slate-400">{update.notes || "-"}</TableCell>
                <TableCell className="px-5 py-4">
                  <div className="flex gap-1">
                    {update.photos.map((photo) => (
                      <button key={photo} type="button" className="overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setSelectedPhoto(photo)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resolveMediaUrl(photo)} alt="Φωτογραφία προόδου" className="h-8 w-8 object-cover" />
                      </button>
                    ))}
                    {!update.photos.length && <span className="text-slate-500 dark:text-slate-400">-</span>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!weeklyUpdates.length && (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                  {isLoading ? "Φόρτωση εβδομαδιαίων updates..." : "Δεν υπάρχουν εβδομαδιαία updates ακόμα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <CardTitle className="text-xl font-bold">Προπονήσεις</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
            <TableRow>
              <TableHead className="px-5 py-4">Ημερομηνία</TableHead>
              <TableHead className="px-5 py-4">Ημέρα</TableHead>
              <TableHead className="px-5 py-4">Διάρκεια</TableHead>
              <TableHead className="px-5 py-4">Κιλά</TableHead>
              <TableHead className="px-5 py-4">Διάθεση</TableHead>
              <TableHead className="px-5 py-4">Σημειώσεις</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
            {workouts.map((workout) => {
              const feeling = workout.workout_feeling ? workoutFeelingMeta[workout.workout_feeling] : null;
              return (
                <TableRow key={workout.id}>
                  <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{formatDateTime(workout.completed_at)}</TableCell>
                  <TableCell className="px-5 py-4 font-semibold text-slate-700 dark:text-slate-200">{workout.day_name || "-"}</TableCell>
                  <TableCell className="px-5 py-4 text-slate-500 dark:text-slate-400">{workout.duration_seconds ? `${Math.round(workout.duration_seconds / 60)} λεπτά` : "-"}</TableCell>
                  <TableCell className="px-5 py-4 font-bold text-slate-950 dark:text-slate-50">{workout.total_volume_kg ? `${workout.total_volume_kg} kg` : "-"}</TableCell>
                  <TableCell className="px-5 py-4">{feeling ? <span className="inline-flex items-center gap-1.5"><span className="text-lg">{feeling.emoji}</span>{feeling.label}</span> : "-"}</TableCell>
                  <TableCell className="max-w-xs px-5 py-4 font-semibold text-slate-500 dark:text-slate-400">{workout.notes || "-"}</TableCell>
                </TableRow>
              );
            })}
            {!workouts.length && (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                  {workoutsLoading ? "Φόρτωση προπονήσεων..." : "Δεν υπάρχουν προπονήσεις ακόμα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">Φωτογραφία προόδου</DialogTitle>
          {selectedPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={resolveMediaUrl(selectedPhoto)} alt="Φωτογραφία προόδου" className="max-h-[80vh] w-full rounded object-contain" />
          )}
        </DialogContent>
      </Dialog>
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

function activityDotClass(entry: ClientActivityLogEntry): string {
  const action = entry.action.toLowerCase();
  const details = entry.details?.toLowerCase() || "";

  if (action.includes("created")) return "bg-blue-500";
  if (action.includes("status")) return details.includes("inactive") ? "bg-red-500" : "bg-emerald-500";
  if (action.includes("payment")) return "bg-emerald-500";
  if (action.includes("plan") || action.includes("training") || action.includes("nutrition")) return "bg-violet-500";
  if (action.includes("password")) return "bg-orange-500";
  if (action.includes("deleted")) return "bg-red-500";
  if (action.includes("subscription")) return "bg-teal-500";
  if (action.includes("personal") || action.includes("profile")) return "bg-slate-400";
  return "bg-slate-400";
}

function activityLabel(entry: ClientActivityLogEntry): string {
  const action = entry.action.toLowerCase();
  const details = entry.details?.toLowerCase() || "";

  if (action.includes("created")) return "Δημιουργία πελάτη";
  if (action.includes("status")) return `Αλλαγή κατάστασης${details.includes("inactive") ? " → Ανενεργός" : details.includes("active") ? " → Ενεργός" : ""}`;
  if (action.includes("payment") && action.includes("approved")) return "Έγκριση πληρωμής";
  if (action.includes("payment") && action.includes("rejected")) return "Απόρριψη πληρωμής";
  if (action.includes("training")) return "Ανάθεση προγράμματος προπόνησης";
  if (action.includes("nutrition")) return "Ανάθεση προγράμματος διατροφής";
  if (action.includes("password")) return "Επαναφορά κωδικού";
  if (action.includes("deleted")) return "Διαγραφή πελάτη";
  if (action.includes("subscription")) return "Ανανέωση συνδρομής";
  if (action.includes("personal") || action.includes("profile")) return "Ενημέρωση προσωπικών στοιχείων";
  return entry.action;
}

function ActivityLogSkeleton() {
  return (
    <div className="space-y-6 py-2">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex gap-4">
          <Skeleton className="mt-1 h-3 w-3 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityLogTab({ clientId, active }: { clientId: string; active: boolean }) {
  const [entries, setEntries] = useState<ClientActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedClientId, setLoadedClientId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active || loadedClientId === clientId) return;

    setLoading(true);
    setError("");
    api
      .get<ClientActivityLogEntry[]>(`/clients/${clientId}/log?limit=20&offset=0`)
      .then((rows) => {
        setEntries(rows);
        setHasMore(rows.length === 20);
        setLoadedClientId(clientId);
      })
      .catch((requestError) => {
        setEntries([]);
        setHasMore(false);
        setLoadedClientId(clientId);
        setError(requestError instanceof Error ? requestError.message : "Δεν φορτώθηκε το ιστορικό.");
      })
      .finally(() => setLoading(false));
  }, [active, clientId, loadedClientId]);

  const loadMore = async () => {
    setLoadingMore(true);
    setError("");
    try {
      const rows = await api.get<ClientActivityLogEntry[]>(`/clients/${clientId}/log?limit=20&offset=${entries.length}`);
      setEntries((current) => [...current, ...rows]);
      setHasMore(rows.length === 20);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Δεν φορτώθηκε επιπλέον ιστορικό.");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Card className="p-6">
      <CardHeader className="p-0">
        <CardTitle className="text-lg font-semibold">Ιστορικό Δραστηριότητας</CardTitle>
      </CardHeader>

      <CardContent className="p-0 pt-6">
        {loading ? (
          <ActivityLogSkeleton />
        ) : !entries.length ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Clock className="h-8 w-8" />
            <p className="text-sm">{error || "Δεν υπάρχει ιστορικό ακόμα"}</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[34rem] pr-4">
              <div className="relative ml-2 border-l border-border pl-6">
                {entries.map((entry) => (
                  <div key={entry.id} className="relative pb-7 last:pb-1">
                    <span className={`absolute -left-[1.84rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-background ${activityDotClass(entry)}`} />
                    <p className="text-sm font-medium text-foreground">{activityLabel(entry)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Από: {entry.performedByName || "-"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {relativeTime(entry.createdAt)} · {formatDateTime(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

              {hasMore && (
                <div className="mt-6 flex justify-center pb-2">
                  <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? "Φόρτωση..." : "Δείτε περισσότερα"}
                  </Button>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
