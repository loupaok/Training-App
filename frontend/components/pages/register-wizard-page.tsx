"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock,
  CreditCard,
  Dumbbell,
  FileText,
  Flame,
  HeartPulse,
  ImagePlus,
  Info,
  Link2,
  Mars,
  MessageCircle,
  Ruler,
  Scale,
  ShieldCheck,
  Target,
  UserRound,
  Venus,
  Weight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";
import type { AuthUser } from "@/types/auth";

interface QuestionnaireQuestion {
  id: number;
  question: string;
  type: "single_select" | "multi_select" | "text" | "number" | "textarea" | "url";
  options: string[];
  isRequired: boolean;
  placeholder: string;
  sortOrder: number;
}

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  id: number | string;
  name: string;
  description?: string;
  price: number | string;
  currency: string;
  period: string;
  features: PlanFeature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
}

interface BankDetails {
  bankName: string;
  beneficiary: string;
  iban: string;
  supportEmail: string;
  supportPhone: string;
}

interface AccountForm {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  password: string;
  dateOfBirth: string;
  gender: string;
}

interface BodyGoalForm {
  height: string;
  currentWeight: string;
  targetWeight: string;
  goal: string;
}

type RegisterResponse = {
  success: boolean;
  clientId: number;
  user: AuthUser;
  redirectTo: string;
};

type RegistrationProgress = {
  status: "not_started" | "in_progress" | "completed";
  currentStep: number;
  completed: boolean;
  data: {
    account?: Omit<AccountForm, "password">;
    bodyGoal?: BodyGoalForm;
    answers?: Record<number, AnswerValue>;
    selectedPlanId?: number | string | null;
    paymentMethod?: "bank" | "stripe";
  };
  files: { id: number; file_url: string; file_type: "photo" | "pdf"; original_name: string }[];
};

const steps = [
  { key: "account", title: "Βασικά στοιχεία", subtitle: "Πες μας για εσένα" },
  { key: "body-goal", title: "Σώμα & στόχος", subtitle: "Οι στόχοι και τα στοιχεία σου" },
  { key: "questionnaire", title: "Ερωτηματολόγιο Coach", subtitle: "Η εμπειρία και οι προτιμήσεις σου" },
  { key: "files", title: "Φωτογραφίες & αρχεία", subtitle: "Προαιρετικό βήμα" },
  { key: "plan", title: "Πλάνο", subtitle: "Επίλεξε τη συνδρομή σου" },
  { key: "payment", title: "Πληρωμή", subtitle: "Ολοκλήρωσε την εγγραφή" },
  { key: "confirmation", title: "Επιβεβαίωση", subtitle: "Έλεγξε τα στοιχεία σου" },
] as const;

const stepContent = [
  { title: "Βασικά στοιχεία", subtitle: "Ας γνωριστούμε! Συμπλήρωσε τα βασικά σου στοιχεία για να δημιουργήσουμε το πρόγραμμα που σου ταιριάζει." },
  { title: "Σώμα & στόχος", subtitle: "Τα στοιχεία αυτά βοηθούν τον coach να σχεδιάσει το σωστό σημείο εκκίνησης." },
  { title: "Ερωτηματολόγιο Coach", subtitle: "Απάντησε στις ερωτήσεις του coach για ένα πλάνο προσαρμοσμένο σε εσένα." },
  { title: "Φωτογραφίες & αρχεία", subtitle: "Προαιρετικά στοιχεία που βοηθούν στην παρακολούθηση της προόδου σου." },
  { title: "Επίλεξε πλάνο", subtitle: "Διάλεξε το πλάνο που ταιριάζει καλύτερα στους στόχους σου." },
  { title: "Πληρωμή", subtitle: "Επίλεξε τον τρόπο πληρωμής για να ολοκληρωθεί η αίτησή σου." },
  { title: "Επιβεβαίωση στοιχείων", subtitle: "Έλεγξε τα στοιχεία σου πριν ολοκληρώσεις την εγγραφή." },
];

const MAX_INTAKE_PHOTOS = 4;
const MAX_PHOTO_SIZE_MB = 5;
const MAX_PDF_SIZE_MB = 10;

const countryCodes = ["+30", "+357", "+44", "+49", "+1"];
const genderOptions = [
  { value: "male", label: "Άνδρας" },
  { value: "female", label: "Γυναίκα" },
  { value: "other", label: "Άλλο" },
];

type AnswerValue = string | string[] | Record<string, string>;

function isAnswerEmpty(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every((entry) => !entry.trim());
  return value.trim() === "";
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthDateToIso(value: string): string | undefined {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return undefined;
  return `${year}-${month}-${day}`;
}

function birthDateToDate(value: string): Date | undefined {
  const iso = birthDateToIso(value);
  return iso ? new Date(`${iso}T12:00:00`) : undefined;
}

function dateToBirthDate(value: Date): string {
  return `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
}

function formatPeriodLabel(period: string): string {
  const normalized = (period || "").toLowerCase();
  if (normalized.includes("μηνια") || normalized.includes("monthly")) return "μήνα";
  return period;
}

function RegisterWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authReady, login, updateUser, user } = useAuth();
  const { branding } = useBranding();
  const preselectedPlan = searchParams.get("plan");

  const [stepIndex, setStepIndex] = useState(0);
  const justCompletedRegistration = useRef(false);
  // Starts true to match the server-rendered markup, then corrects on the client
  // after mount — reading sessionStorage in the initializer itself caused a
  // hydration mismatch whenever the flag was already set (server always sees
  // no window and renders the intro, client could skip straight to the wizard).
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (window.sessionStorage.getItem("register-onboarding-started") === "true") {
      setShowIntro(false);
    }
  }, []);
  const [account, setAccount] = useState<AccountForm>({
    firstName: "",
    lastName: "",
    email: "",
    countryCode: "+30",
    phone: "",
    password: "",
    dateOfBirth: "",
    gender: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [bodyGoal, setBodyGoal] = useState<BodyGoalForm>({ height: "", currentWeight: "", targetWeight: "", goal: "" });
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"bank" | "stripe">("bank");
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);

  const [intakePhotos, setIntakePhotos] = useState<File[]>([]);
  const [intakePdf, setIntakePdf] = useState<File | null>(null);
  const [filesError, setFilesError] = useState("");

  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [editingFromConfirmation, setEditingFromConfirmation] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    api
      .get<QuestionnaireQuestion[]>("/questionnaire/questions")
      .then((rows) => setQuestions(rows.sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => {});

    api
      .get<PricingPlan[]>("/pricing-plans")
      .then((rows) => {
        const active = rows.filter((plan) => plan.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
        setPlans(active);
        const preselected = preselectedPlan ? active.find((plan) => String(plan.id) === preselectedPlan) : null;
        const popular = active.find((plan) => plan.isPopular);
        setSelectedPlanId((current) => current ?? (preselected || popular || active[0])?.id ?? null);
      })
      .catch(() => {});

    api.get<BankDetails>("/bank-details").then(setBankDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!/^\S+@\S+\.\S+$/.test(account.email)) return;
    const timeout = window.setTimeout(() => {
      api
        .post<{ available: boolean }>("/check-email", { email: account.email })
        .then((result) => setEmailStatus(result.available ? "available" : "taken"))
        .catch(() => setEmailStatus("idle"));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [account.email]);

  // Backward compatibility only: an account created under the old per-step
  // flow (before account creation moved to final submit) may still be
  // mid-registration and logged in. Brand new visitors are never
  // authenticated at this point, so this simply never fires for them.
  useEffect(() => {
    if (!authReady || user?.role !== "client") return;
    let active = true;
    api.get<RegistrationProgress>("/register/progress")
      .then((progress) => {
        if (!active) return;
        if ((progress.completed || progress.status === "completed") && !justCompletedRegistration.current) {
          router.replace("/client/dashboard");
          return;
        }
        if (progress.status !== "in_progress") return;
        const data = progress.data || {};
        if (data.account) setAccount((current) => ({ ...current, ...data.account, password: "" }));
        if (data.bodyGoal) setBodyGoal(data.bodyGoal);
        if (data.answers) setAnswers(data.answers);
        if (data.selectedPlanId !== undefined) setSelectedPlanId(data.selectedPlanId);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
        setStepIndex(Math.max(0, Math.min(Number(progress.currentStep || 0), steps.length - 1)));
        setShowIntro(false);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [authReady, router, user?.role]);

  // No account exists until final submit, so this sessionStorage draft is
  // the only thing that survives an accidental refresh. The password is
  // deliberately never included (getProgressData() already omits it).
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem("register-wizard-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.account) setAccount((current) => ({ ...current, ...draft.account }));
        if (draft.bodyGoal) setBodyGoal(draft.bodyGoal);
        if (draft.answers) setAnswers(draft.answers);
        if (draft.selectedPlanId !== undefined) setSelectedPlanId(draft.selectedPlanId);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (typeof draft.stepIndex === "number" && draft.stepIndex > 0) {
          setStepIndex(Math.min(draft.stepIndex, steps.length - 1));
          setShowIntro(false);
        }
      }
    } catch {
      // Ignore malformed/unavailable session data and start fresh.
    }
    setDraftRestored(true);
  }, []);

  const updateAccount = (name: keyof AccountForm, value: string) => {
    if (name === "email") setEmailStatus(/^\S+@\S+\.\S+$/.test(value) ? "checking" : "idle");
    setAccount((current) => ({ ...current, [name]: value }));
  };
  const updateBodyGoal = (name: keyof BodyGoalForm, value: string) => setBodyGoal((current) => ({ ...current, [name]: value }));
  const updateAnswer = (id: number, value: AnswerValue) => setAnswers((current) => ({ ...current, [id]: value }));

  const addIntakePhotos = (files: FileList | File[]) => {
    setFilesError("");
    const incoming = Array.from(files);
    const oversized = incoming.find((file) => file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setFilesError(`Η φωτογραφία "${oversized.name}" ξεπερνά τα ${MAX_PHOTO_SIZE_MB}MB.`);
      return;
    }
    setIntakePhotos((current) => {
      const combined = [...current, ...incoming];
      if (combined.length > MAX_INTAKE_PHOTOS) {
        setFilesError(`Μπορείς να ανεβάσεις μέχρι ${MAX_INTAKE_PHOTOS} φωτογραφίες.`);
        return combined.slice(0, MAX_INTAKE_PHOTOS);
      }
      return combined;
    });
  };

  const removeIntakePhoto = (index: number) => {
    setFilesError("");
    setIntakePhotos((current) => current.filter((_, i) => i !== index));
  };

  const setIntakePdfFile = (file: File | null) => {
    setFilesError("");
    if (file && file.size > MAX_PDF_SIZE_MB * 1024 * 1024) {
      setFilesError(`Το PDF ξεπερνά τα ${MAX_PDF_SIZE_MB}MB.`);
      return;
    }
    setIntakePdf(file);
  };

  const selectedPlan = plans.find((plan) => String(plan.id) === String(selectedPlanId)) || null;
  const normalizeQuestion = (question: string) => question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("el-GR");
  const fixedAnswerForQuestion = (question: QuestionnaireQuestion): string | undefined => {
    const label = normalizeQuestion(question.question);
    if (label.includes("υψ")) return bodyGoal.height;
    if (label.includes("επιθυμητ") && label.includes("βαρ")) return bodyGoal.targetWeight;
    if (label.includes("τρεχ") && label.includes("βαρ")) return bodyGoal.currentWeight;
    if (label.includes("στοχ")) return bodyGoal.goal;
    return undefined;
  };

  const validateStep = (): string => {
    if (stepIndex === 0) {
      if (!account.firstName || !account.lastName || !account.email || !account.phone || account.password.length < 6) {
        return "Συμπλήρωσε όλα τα υποχρεωτικά πεδία (ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες).";
      }
      if (!birthDateToIso(account.dateOfBirth)) return "Συμπλήρωσε έγκυρη ημερομηνία γέννησης στη μορφή dd/mm/yyyy.";
      if (!account.gender) return "Επίλεξε φύλο για να συνεχίσεις.";
      if (account.password !== confirmPassword) return "Η επιβεβαίωση κωδικού δεν ταιριάζει.";
      if (emailStatus === "taken") return "Αυτό το email χρησιμοποιείται ήδη.";
      return "";
    }
    if (stepIndex === 1) {
      if (!bodyGoal.height || !bodyGoal.currentWeight || !bodyGoal.goal) return "Συμπλήρωσε ύψος, τρέχον βάρος και στόχο.";
      return "";
    }
    if (stepIndex === 2) {
      const missing = questions.some((question) => question.isRequired && isAnswerEmpty(fixedAnswerForQuestion(question) ?? answers[question.id]));
      if (missing) return "Συμπλήρωσε τις υποχρεωτικές ερωτήσεις πριν συνεχίσεις.";
      const invalidUrl = questions.some((question) => {
        if (question.type !== "url") return false;
        const value = answers[question.id];
        if (value === undefined) return false;
        if (typeof value === "string") return value.trim() !== "" && !isValidUrl(value);
        if (typeof value === "object" && !Array.isArray(value)) {
          return Object.values(value).some((entry) => entry.trim() !== "" && !isValidUrl(entry));
        }
        return false;
      });
      if (invalidUrl) return "Έλεγξε ότι ο σύνδεσμος που έδωσες είναι έγκυρο URL (π.χ. https://...).";
      return "";
    }
    if (stepIndex === 4) {
      if (!selectedPlanId) return "Επέλεξε ένα πλάνο συνδρομής.";
      return "";
    }
    return "";
  };

  const getProgressData = () => {
    const savedAccount: Omit<AccountForm, "password"> = {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      countryCode: account.countryCode,
      phone: account.phone,
      dateOfBirth: account.dateOfBirth,
      gender: account.gender,
    };
    return {
      account: savedAccount,
      bodyGoal,
      answers,
      selectedPlanId,
      paymentMethod,
    };
  };

  useEffect(() => {
    if (!draftRestored) return;
    window.sessionStorage.setItem("register-wizard-draft", JSON.stringify({ ...getProgressData(), stepIndex }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRestored, account, bodyGoal, answers, selectedPlanId, paymentMethod, stepIndex]);

  const goNext = () => {
    const message = validateStep();
    if (message) {
      setStepError(message);
      return;
    }
    setStepError("");
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepError("");
    setStepIndex((value) => Math.max(value - 1, 0));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = validateStep();
    if (message) {
      setStepError(message);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    const answersPayload = questions.map((question) => {
      const value = fixedAnswerForQuestion(question) ?? answers[question.id] ?? "";
      const serialized = typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value;
      return { question_id: question.id, answer: serialized };
    });

    const formData = new FormData();
    formData.append("firstName", account.firstName);
    formData.append("lastName", account.lastName);
    formData.append("email", account.email);
    formData.append("password", account.password);
    formData.append("phone", `${account.countryCode} ${account.phone}`.trim());
    const isoDob = birthDateToIso(account.dateOfBirth);
    if (isoDob) formData.append("dateOfBirth", isoDob);
    if (account.gender) formData.append("gender", account.gender);
    formData.append("heightCm", bodyGoal.height);
    formData.append("weightKg", bodyGoal.currentWeight);
    formData.append("fitnessGoal", bodyGoal.goal);
    if (bodyGoal.targetWeight) formData.append("targetWeightKg", bodyGoal.targetWeight);
    formData.append("plan_id", String(Number(selectedPlanId)));
    formData.append("payment_method", paymentMethod);
    formData.append("answers", JSON.stringify(answersPayload));
    intakePhotos.forEach((file) => formData.append("photos", file));
    if (intakePdf) formData.append("pdf", intakePdf);

    try {
      const result = await api.upload<RegisterResponse>("/register", formData);
      justCompletedRegistration.current = true;
      const loginResult = await login(account.email, account.password);
      if (loginResult.success) updateUser(result.user);

      setStepError("");
      window.sessionStorage.removeItem("register-onboarding-started");
      window.sessionStorage.removeItem("register-wizard-draft");
      setStepIndex(steps.length);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    } finally {
      setSubmitting(false);
    }
  };

  if (stepIndex === steps.length) {
    return <SuccessScreen appName={branding.appName} onContinue={() => router.push("/client-dashboard")} />;
  }

  if (showIntro) {
    return <OnboardingIntro appName={branding.appName} logoUrl={branding.logoUrl} imageUrl={branding.loginBackgroundUrl} onStart={() => { window.sessionStorage.setItem("register-onboarding-started", "true"); setShowIntro(false); }} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <div className="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        <RegistrationSidebar activeIndex={stepIndex} appName={branding.appName} logoUrl={branding.logoUrl} />

        <main className="min-w-0 bg-slate-50 px-4 py-5 sm:px-8 lg:px-10 lg:py-12">
          <div className="mx-auto max-w-3xl">
            <MobileRegistrationHeader appName={branding.appName} logoUrl={branding.logoUrl} />
            <header className="mb-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center justify-between gap-4 text-sm text-slate-500">
                <span>Βήμα {stepIndex + 1} από {steps.length}</span>
                <span>Περίπου 5 λεπτά</span>
              </div>
              <h1 className="mt-4 text-3xl font-bold text-slate-900">{stepContent[stepIndex].title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-green-700">{stepContent[stepIndex].subtitle}</p>
              <div className="mt-5 flex items-center gap-4">
                <Progress value={((stepIndex + 1) / steps.length) * 100} className="h-1.5 flex-1 [&_[data-slot=progress-track]]:bg-slate-200 [&_[data-slot=progress-indicator]]:bg-[#16a34a]" />
                <span className="text-sm font-medium text-slate-600">{Math.round(((stepIndex + 1) / steps.length) * 100)}%</span>
              </div>
            </header>

            {stepError && <FormError message={stepError} />}
            {submitError && <FormError message={submitError} />}
            {saveMessage && <p className="mb-4 text-right text-sm font-medium text-green-700">{saveMessage}</p>}
            {editingFromConfirmation && stepIndex < steps.length - 1 && (
              <ReviewNavigation
                stepIndex={stepIndex}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 [&_input:focus-visible]:border-green-600 [&_textarea:focus-visible]:border-green-600">
            {stepIndex === 0 && (
              <AccountStep account={account} updateAccount={updateAccount} emailStatus={emailStatus} confirmPassword={confirmPassword} onConfirmPasswordChange={setConfirmPassword} />
            )}
            {stepIndex === 1 && (
              <BodyGoalStep bodyGoal={bodyGoal} updateBodyGoal={updateBodyGoal} />
            )}
            {stepIndex === 2 && (
              <QuestionnaireStep questions={questions} answers={answers} updateAnswer={updateAnswer} />
            )}
            {stepIndex === 3 && (
              <FilesStep
                photos={intakePhotos}
                pdf={intakePdf}
                error={filesError}
                onAddPhotos={addIntakePhotos}
                onRemovePhoto={removeIntakePhoto}
                onSetPdf={setIntakePdfFile}
              />
            )}
            {stepIndex === 4 && (
              <PlanStep plans={plans} selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
            )}
            {stepIndex === 5 && (
              <PaymentStep
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                bankDetails={bankDetails}
                selectedPlan={selectedPlan}
              />
            )}
            {stepIndex === 6 && (
              <ConfirmationStep account={account} bodyGoal={bodyGoal} questions={questions} answers={answers} selectedPlan={selectedPlan} paymentMethod={paymentMethod} onEdit={(index) => { setEditingFromConfirmation(true); setStepIndex(index); }} />
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
              {stepIndex > 0 ? (
                <Button type="button" variant="outline" className="h-11 px-4 font-semibold" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Πίσω
                </Button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                {stepIndex === 3 && (
                  <Button type="button" variant="ghost" className="h-11 px-3 font-bold sm:px-5" onClick={goNext} disabled={savingStep}>
                    Παράλειψη →
                  </Button>
                )}
                {stepIndex < steps.length - 1 ? (
                  <Button key="continue" type="button" disabled={savingStep} className="h-12 bg-[#1a1f2e] px-8 font-semibold text-white hover:bg-slate-800" onClick={goNext}>
                    {savingStep ? "Αποθήκευση..." : "Συνέχεια"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button key="submit" type="submit" disabled={submitting} className="h-12 bg-[#1a1f2e] px-8 font-semibold text-white hover:bg-slate-800">
                    {submitting ? "Ολοκλήρωση..." : "Ολοκλήρωση Εγγραφής"}
                  </Button>
                )}
              </div>
            </div>
            </form>

            <p className="mt-6 hidden text-center text-sm text-slate-600 lg:block">
            Έχεις ήδη λογαριασμό;{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Σύνδεση
            </Link>
            </p>
          </div>
        </main>
        <RegistrationAside stepIndex={stepIndex} />
      </div>
    </div>
  );
}

function OnboardingIntro({ appName, logoUrl, imageUrl, onStart }: { appName: string; logoUrl: string | null; imageUrl: string | null; onStart: () => void }) {
  const sections = [
    { number: "01", title: "Στόχος", description: "Τι θέλεις να πετύχεις", icon: Target },
    { number: "02", title: "Προπόνηση", description: "Εμπειρία, χρόνος και εξοπλισμός", icon: Dumbbell },
    { number: "03", title: "Διατροφή", description: "Προτιμήσεις και καθημερινές συνήθειες", icon: HeartPulse },
    { number: "04", title: "Υγεία", description: "Πληροφορίες που βοηθούν τον coach σου", icon: ShieldCheck },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:p-0">
      <section className="relative min-h-72 overflow-hidden rounded-xl bg-slate-900 lg:min-h-screen lg:rounded-none">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={resolveMediaUrl(imageUrl)} alt="Fitness coaching" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(22,163,74,0.35),transparent_40%),linear-gradient(145deg,#0f172a,#1e293b)]" />
        )}
        <div className="absolute inset-0 bg-slate-950/45" />
        <div className="relative flex h-full min-h-72 flex-col justify-between p-6 text-white sm:p-8 lg:p-12">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-10 max-w-36 object-contain" />
            ) : <span className="text-xl font-bold">{appName}</span>}
          </div>
          <div className="max-w-md">
            <p className="text-sm font-semibold text-green-300">PERSONAL COACHING</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Ξεκίνα το ταξίδι σου με ένα πλάνο φτιαγμένο για εσένα.</h1>
          </div>
        </div>
      </section>

      <section className="flex items-center bg-white px-5 py-10 sm:px-10 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-green-700">PERSONAL COACHING</p>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">Ας δημιουργήσουμε το πλάνο σου</h2>
          <p className="mt-5 text-base leading-7 text-slate-600">Για να προσαρμόσουμε την προπόνηση και τη διατροφή σου στις ανάγκες σου, θέλουμε πρώτα να σε γνωρίσουμε λίγο καλύτερα.</p>
          <p className="mt-3 text-sm leading-6 text-slate-500">Απάντησε σε μερικές σύντομες ερωτήσεις σχετικά με τον στόχο σου, την προπόνηση, τη διατροφή και την καθημερινότητά σου.</p>

          <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {sections.map(({ number, title, description, icon: Icon }) => (
              <div key={number} className="flex items-center gap-4 py-4">
                <span className="w-7 text-sm font-semibold text-green-700">{number}</span>
                <Icon className="h-5 w-5 text-slate-600" />
                <div><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-0.5 text-sm text-slate-500">{description}</p></div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-green-700" />Περίπου 5 λεπτά</span><span>Μπορείς να επιστρέψεις όποτε είσαι έτοιμος.</span></div>
          <Button type="button" size="lg" className="mt-8 h-12 w-full bg-[#1a1f2e] font-semibold text-white hover:bg-slate-800 sm:w-auto sm:px-8" onClick={onStart}>Ξεκίνα <ArrowRight className="ml-2 h-4 w-4" /></Button>
          <p className="mt-5 text-sm text-slate-600">Έχεις ήδη λογαριασμό; <Link href="/login" className="font-semibold text-green-700 hover:underline">Σύνδεση</Link></p>
        </div>
      </section>
    </main>
  );
}

function MobileRegistrationHeader({ appName, logoUrl }: { appName: string; logoUrl: string | null }) {
  return (
    <div className="mb-5 flex items-center justify-between lg:hidden">
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-8 max-w-28 object-contain" />
        ) : <span className="text-lg font-bold text-slate-900">{appName}</span>}
      </div>
      <span className="text-xs text-slate-500">Έχεις ήδη λογαριασμό; <Link href="/login" className="font-semibold text-slate-900">Σύνδεση</Link></span>
    </div>
  );
}

function RegistrationSidebar({ activeIndex, appName, logoUrl }: { activeIndex: number; appName: string; logoUrl: string | null }) {
  return (
    <aside className="hidden min-h-screen flex-col bg-[#1a1f2e] px-4 py-5 text-white lg:flex">
      <div className="flex items-center gap-3 px-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-9 max-w-32 object-contain" />
        ) : <span className="text-2xl font-bold">{appName}</span>}
      </div>
      <nav className="mt-10 space-y-2">
        {steps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <div key={step.key} className={`flex gap-3 rounded-lg px-3 py-3 ${active ? "bg-white/10" : ""}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${active ? "bg-[#16a34a] text-white" : complete ? "bg-green-900 text-green-200" : "bg-slate-700 text-slate-300"}`}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm ${active ? "font-semibold text-white" : "text-slate-300"}`}>{step.title}</span>
                <span className={`mt-1 block text-xs ${active ? "text-green-300" : "text-slate-500"}`}>{step.subtitle}</span>
              </span>
            </div>
          );
        })}
      </nav>
      <div className="mt-auto rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><CircleHelp className="h-4 w-4" /> Έχεις ερωτήσεις;</div>
        <p className="mt-2 text-xs leading-5 text-slate-300">Είμαστε εδώ για να σε βοηθήσουμε.</p>
        <Button type="button" variant="outline" className="mt-4 w-full border-white/30 bg-transparent text-white hover:bg-white hover:text-[#1a1f2e]"><MessageCircle className="mr-2 h-4 w-4" /> Επικοινωνία</Button>
      </div>
    </aside>
  );
}

function RegistrationAside({ stepIndex }: { stepIndex: number }) {
  const content = [
    ["Κάθε μεγάλο ταξίδι ξεκινάει με ένα πρώτο βήμα.", "Τα στοιχεία σου βοηθούν να σχεδιαστεί ένα πρόγραμμα που ταιριάζει στις ανάγκες σου."],
    ["Το σωστό σημείο εκκίνησης", "Οι στόχοι και οι μετρήσεις σου δίνουν στον coach μια καθαρή εικόνα."],
    ["Ο coach σε γνωρίζει καλύτερα", "Οι απαντήσεις σου κάνουν το πλάνο πιο προσωπικό και πρακτικό."],
    ["Η πρόοδος μετράει", "Οι αρχικές φωτογραφίες είναι προαιρετικές και μένουν ιδιωτικές."],
    ["Διάλεξε το πλάνο σου", "Κάθε πλάνο περιλαμβάνει υποστήριξη και προσαρμογή από τον coach."],
    ["Σχεδόν έτοιμοι", "Η εγγραφή σου θα σταλεί στον coach μόλις ολοκληρώσεις την πληρωμή."],
    ["Έλεγχος πριν την ολοκλήρωση", "Επιβεβαίωσε τα στοιχεία σου για να προχωρήσουμε σωστά."],
  ][stepIndex] || ["Καλώς ήρθες", ""];

  return (
    <aside className="hidden bg-white p-5 xl:block">
      <div className="sticky top-6 space-y-5">
        <Card className="overflow-hidden border-slate-200 bg-slate-50 shadow-sm">
          <div className="min-h-52 bg-[linear-gradient(145deg,#dbeafe,#f8fafc_55%,#bbf7d0)] p-6">
            <p className="text-xl font-medium italic leading-8 text-slate-800">“{content[0]}”</p>
          </div>
        </Card>
        <Card className="border-green-100 bg-green-50 shadow-none">
          <CardContent className="p-5"><ShieldCheck className="h-6 w-6 text-green-600" /><h2 className="mt-3 text-base font-semibold text-slate-900">Γιατί αυτά τα στοιχεία;</h2><p className="mt-2 text-sm leading-6 text-slate-600">{content[1]}</p></CardContent>
        </Card>
        <div className="space-y-4 px-1">
          <h2 className="text-lg font-bold text-slate-900">Τι κερδίζεις</h2>
          {[[Dumbbell, "Εξατομικευμένο πρόγραμμα"], [HeartPulse, "Σωστή διατροφή"], [MessageCircle, "Συνεχής υποστήριξη"], [Target, "Πραγματικά αποτελέσματα"]].map(([Icon, label]) => {
            const BenefitIcon = Icon as typeof Dumbbell;
            return <div key={label as string} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100"><BenefitIcon className="h-4 w-4 text-slate-700" /></span><div><p className="text-sm font-semibold text-slate-800">{label as string}</p><p className="text-xs leading-5 text-slate-500">Υποστήριξη προσαρμοσμένη στους στόχους σου.</p></div></div>;
          })}
        </div>
      </div>
    </aside>
  );
}

function SuccessScreen({ appName, onContinue }: { appName: string; onContinue: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
      <Card className="w-full max-w-lg border-slate-200 bg-white shadow-xl"><CardContent className="p-8 text-center sm:p-12">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-11 w-11" /></span>
        <h1 className="mt-6 text-3xl font-bold text-slate-900">Καλώς ήρθες!</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Η εγγραφή σου στο {appName} ολοκληρώθηκε επιτυχώς.</p>
        <div className="mt-7 space-y-3 text-left text-sm text-slate-700">
          {["Έλεγχος email επιβεβαίωσης", "Ο coach θα εξετάσει τα στοιχεία σου", "Θα λάβεις το προσωπικό σου πρόγραμμα"].map((item) => <p key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-green-600" />{item}</p>)}
        </div>
        <Button className="mt-8 h-12 w-full bg-[#1a1f2e] text-white hover:bg-slate-800" onClick={onContinue}>Μετάβαση στον λογαριασμό μου <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </CardContent></Card>
    </main>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm font-medium text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}

function ReviewNavigation({ stepIndex, onBack, onNext }: { stepIndex: number; onBack: () => void; onNext: () => void }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
      <p className="text-sm font-medium text-green-900">Επεξεργασία βήματος {stepIndex + 1} από {steps.length}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={stepIndex === 0}><ArrowLeft className="mr-1.5 h-4 w-4" />Προηγούμενο</Button>
        <Button type="button" size="sm" className="bg-[#1a1f2e] text-white hover:bg-slate-800" onClick={onNext}>Επόμενο<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AccountStep({
  account,
  updateAccount,
  emailStatus,
  confirmPassword,
  onConfirmPasswordChange,
}: {
  account: AccountForm;
  updateAccount: (name: keyof AccountForm, value: string) => void;
  emailStatus: "idle" | "checking" | "available" | "taken";
  confirmPassword: string;
  onConfirmPasswordChange: (value: string) => void;
}) {
  return (
    <Section title="Τα Στοιχεία σου">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Όνομα</span>
          <Input
            value={account.firstName}
            onChange={(event) => updateAccount("firstName", event.target.value)}
            required
            className="h-12"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Επώνυμο</span>
          <Input
            value={account.lastName}
            onChange={(event) => updateAccount("lastName", event.target.value)}
            required
            className="h-12"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Email</span>
          <Input
            type="email"
            value={account.email}
            onChange={(event) => updateAccount("email", event.target.value)}
            required
            className="h-12"
          />
          {emailStatus === "checking" && <span className="text-xs font-semibold text-slate-400">Έλεγχος...</span>}
          {emailStatus === "available" && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />Διαθέσιμο</span>}
          {emailStatus === "taken" && <span className="text-xs font-semibold text-red-600">Το email χρησιμοποιείται ήδη.</span>}
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Τηλέφωνο</span>
          <div className="flex h-12 items-center overflow-hidden rounded-md border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Select value={account.countryCode} onValueChange={(value) => updateAccount("countryCode", value ?? "")}>
              <SelectTrigger className="h-full w-24 shrink-0 rounded-none border-0 border-r border-input shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countryCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={account.phone}
              onChange={(event) => updateAccount("phone", event.target.value)}
              required
              className="h-full flex-1 border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
            />
          </div>
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Κωδικός</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={account.password}
            onChange={(event) => updateAccount("password", event.target.value)}
            required
            className="h-12"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Επιβεβαίωση κωδικού <span className="text-red-600">*</span></span>
          <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => onConfirmPasswordChange(event.target.value)} required className="h-12" />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ημερομηνία Γέννησης <span className="text-red-600">*</span></span>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              value={account.dateOfBirth}
              onChange={(event) => updateAccount("dateOfBirth", formatBirthDate(event.target.value))}
              placeholder="dd/mm/yyyy"
              maxLength={10}
              required
              className="h-12 rounded-lg border-slate-200 pl-10 pr-11"
            />
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Άνοιγμα ημερολογίου" className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-500 hover:text-green-700" />}>
                <CalendarDays className="h-4 w-4" />
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={birthDateToDate(account.dateOfBirth)}
                  defaultMonth={birthDateToDate(account.dateOfBirth) || new Date(1995, 0)}
                  captionLayout="dropdown"
                  startMonth={new Date(1920, 0)}
                  endMonth={new Date()}
                  onSelect={(date) => date && updateAccount("dateOfBirth", dateToBirthDate(date))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </label>
        <div className="block space-y-2">
          <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">Φύλο <span className="text-red-600">*</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {genderOptions.map((option) => {
              const selected = account.gender === option.value;
              const Icon = option.value === "male" ? Mars : option.value === "female" ? Venus : UserRound;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant="outline"
                  className={`h-12 gap-2 rounded-lg border-slate-200 px-2 text-sm font-semibold ${selected ? "border-2 border-green-600 bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700" : "text-slate-700"}`}
                  onClick={() => updateAccount("gender", option.value)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}

function BodyGoalStep({ bodyGoal, updateBodyGoal }: { bodyGoal: BodyGoalForm; updateBodyGoal: (name: keyof BodyGoalForm, value: string) => void }) {
  const goals = [
    { value: "Απώλεια λίπους", icon: Flame },
    { value: "Μυϊκή ανάπτυξη", icon: Dumbbell },
    { value: "Διατήρηση βάρους", icon: Scale },
    { value: "Βελτίωση φυσικής κατάστασης", icon: Target },
  ];
  return (
    <Section title="Στοιχεία σώματος">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block space-y-2"><span className="text-sm font-semibold text-slate-700">Ύψος <span className="text-red-600">*</span></span><div className="relative"><Ruler className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input type="number" inputMode="decimal" value={bodyGoal.height} onChange={(event) => updateBodyGoal("height", event.target.value)} placeholder="π.χ. 178" className="h-12 pl-10 pr-12" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">cm</span></div></label>
        <label className="block space-y-2"><span className="text-sm font-semibold text-slate-700">Τρέχον βάρος <span className="text-red-600">*</span></span><div className="relative"><Weight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input type="number" inputMode="decimal" value={bodyGoal.currentWeight} onChange={(event) => updateBodyGoal("currentWeight", event.target.value)} placeholder="π.χ. 75" className="h-12 pl-10 pr-12" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">kg</span></div></label>
        <label className="block space-y-2 sm:col-span-2"><span className="text-sm font-semibold text-slate-700">Επιθυμητό βάρος <span className="font-normal text-slate-400">(προαιρετικό)</span></span><div className="relative w-full"><Weight className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input type="number" inputMode="decimal" value={bodyGoal.targetWeight} onChange={(event) => updateBodyGoal("targetWeight", event.target.value)} placeholder="π.χ. 68" className="h-12 pl-10 pr-12" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">kg</span></div></label>
      </div>
      <div className="mt-8"><h2 className="text-lg font-bold text-slate-900">Κύριος στόχος</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{goals.map(({ value, icon: Icon }) => { const selected = bodyGoal.goal === value; return <button key={value} type="button" onClick={() => updateBodyGoal("goal", value)} className={`relative flex min-h-24 items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${selected ? "border-green-600 bg-green-50 text-green-800" : "border-slate-200 bg-white text-slate-700 hover:border-green-300"}`}><Icon className="h-6 w-6" /><span className="text-sm font-semibold">{value}</span>{selected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-green-600" />}</button>; })}</div></div>
    </Section>
  );
}

function displayAnswer(value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "object") return Object.values(value).filter(Boolean).join(", ") || "-";
  return value;
}

function ConfirmationStep({ account, bodyGoal, questions, answers, selectedPlan, paymentMethod, onEdit }: { account: AccountForm; bodyGoal: BodyGoalForm; questions: QuestionnaireQuestion[]; answers: Record<number, AnswerValue>; selectedPlan: PricingPlan | null; paymentMethod: "bank" | "stripe"; onEdit: (index: number) => void }) {
  const sections = [
    { title: "Βασικά στοιχεία", icon: UserRound, step: 0, lines: [`${account.firstName} ${account.lastName}`, account.email, account.phone] },
    { title: "Σώμα & στόχος", icon: Weight, step: 1, lines: [`${bodyGoal.height || "-"} cm · ${bodyGoal.currentWeight || "-"} kg`, `Στόχος: ${bodyGoal.goal || "-"}`] },
    { title: "Ερωτηματολόγιο Coach", icon: ClipboardCheck, step: 2, lines: questions.slice(0, 3).map((question) => `${question.question}: ${displayAnswer(answers[question.id])}`) },
    { title: "Πλάνο & πληρωμή", icon: CreditCard, step: 4, lines: [selectedPlan?.name || "-", paymentMethod === "bank" ? "Τραπεζικό έμβασμα" : "Κάρτα"] },
  ];
  return <div className="space-y-3">{sections.map(({ title, icon: Icon, step, lines }) => <Collapsible key={title} defaultOpen><div className="rounded-xl border border-slate-200"><CollapsibleTrigger render={<button type="button" className="flex w-full items-center gap-3 p-4 text-left" />}><span className="grid h-9 w-9 place-items-center rounded-full bg-green-50"><Icon className="h-4 w-4 text-green-700" /></span><span className="flex-1 text-sm font-semibold text-slate-900">{title}</span></CollapsibleTrigger><CollapsibleContent className="border-t border-slate-100 px-4 pb-4 pt-3"><div className="space-y-1.5 pl-12 text-sm text-slate-600">{lines.map((line, index) => <p key={index}>{line}</p>)}<Button type="button" variant="link" className="mt-2 h-auto px-0 text-green-700" onClick={() => onEdit(step)}>Επεξεργασία</Button></div></CollapsibleContent></div></Collapsible>)}</div>;
}

function QuestionnaireStep({
  questions,
  answers,
  updateAnswer,
}: {
  questions: QuestionnaireQuestion[];
  answers: Record<number, AnswerValue>;
  updateAnswer: (id: number, value: AnswerValue) => void;
}) {
  if (!questions.length) {
    return <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση ερωτηματολογίου...</p>;
  }

  const answeredCount = questions.filter((question) => !isAnswerEmpty(answers[question.id])).length;

  return (
    <Section title="Πες μας λίγα λόγια για σένα">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm font-medium">
          <span>Απάντησες {answeredCount} από {questions.length}</span>
          <span className="text-muted-foreground">{questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%</span>
        </div>
        <Progress value={questions.length ? (answeredCount / questions.length) * 100 : 0} />
      </div>
      <div className="space-y-7">
        {questions.map((question) => (
          <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 font-medium leading-6 text-slate-700 dark:text-slate-200">
              {question.question}
              {question.isRequired && <span className="ml-1 text-destructive">*</span>}
            </div>
            <QuestionField question={question} value={answers[question.id]} onChange={(value) => updateAnswer(question.id, value)} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: QuestionnaireQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  if (question.type === "textarea") {
    return (
      <Textarea
        value={(value as string) || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.placeholder}
        className="min-h-28"
      />
    );
  }
  if (question.type === "number") {
    return (
      <Input
        type="number"
        value={(value as string) || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.placeholder}
        className="h-12"
      />
    );
  }
  if (question.type === "text") {
    return (
      <Input
        value={(value as string) || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.placeholder}
        className="h-12"
      />
    );
  }
  if (question.type === "url") {
    if (question.options.length) {
      const labelValues = typeof value === "object" && !Array.isArray(value) ? value : {};
      return (
        <div className="space-y-4">
          {question.options.map((label) => (
            <label key={label} className="block space-y-2">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
              <div className="relative">
                <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  type="url"
                  autoComplete="off"
                  value={labelValues[label] || ""}
                  onChange={(event) => onChange({ ...labelValues, [label]: event.target.value })}
                  placeholder={`${label} URL`}
                  className="h-12 pl-9"
                />
              </div>
            </label>
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
          placeholder={question.placeholder}
          className="h-12 pl-9"
        />
      </div>
    );
  }
  if (question.type === "single_select") {
    return (
      <RadioGroup value={(value as string) || ""} onValueChange={(next) => onChange(next ?? "")} className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => (
          <label
            key={option}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
              value === option ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
            }`}
          >
            <RadioGroupItem value={option} />
            {option}
            {value === option && <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />}
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (question.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => {
          const checked = selected.includes(option);
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition-colors ${
                checked ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
              }`}
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
  return null;
}

function FilesStep({
  photos,
  pdf,
  error,
  onAddPhotos,
  onRemovePhoto,
  onSetPdf,
}: {
  photos: File[];
  pdf: File | null;
  error: string;
  onAddPhotos: (files: FileList | File[]) => void;
  onRemovePhoto: (index: number) => void;
  onSetPdf: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);

  return (
    <Section title="Αρχικές Φωτογραφίες & Αρχεία">
      <p className="mb-6 text-sm text-muted-foreground">Βοηθά τον coach να παρακολουθεί την πρόοδό σου</p>

      <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
        <Info className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Αυτό το βήμα είναι προαιρετικό. Μπορείς να προσθέσεις φωτογραφίες αργότερα.
        </AlertDescription>
      </Alert>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="mb-8">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">📷 Φωτογραφίες Προόδου</span>
        <p className="mb-3 text-xs text-muted-foreground">Μέχρι {MAX_INTAKE_PHOTOS} φωτογραφίες</p>

        {photos.length < MAX_INTAKE_PHOTOS && (
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (event.dataTransfer.files?.length) onAddPhotos(event.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-slate-300 dark:border-slate-700"
            }`}
          >
            <ImagePlus className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Σύρε φωτογραφίες εδώ ή κάνε κλικ για επιλογή
            </span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · Max {MAX_PHOTO_SIZE_MB}MB</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              multiple
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) onAddPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        )}

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((file, index) => (
              <PhotoThumb key={`${file.name}-${index}`} file={file} onRemove={() => onRemovePhoto(index)} />
            ))}
          </div>
        )}
      </div>

      <div>
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">📄 Ιατρικά Έγγραφα</span>
        <p className="mb-3 text-xs text-muted-foreground">(Προαιρετικό)</p>

        {pdf ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <FileText className="h-4 w-4 text-slate-400" />
              {pdf.name}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSetPdf(null)}
              className="h-8 w-8 text-slate-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-primary dark:border-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4" />
            Επιλογή PDF
            <input type="file" accept=".pdf" className="hidden" onChange={(event) => onSetPdf(event.target.files?.[0] || null)} />
          </label>
        )}
      </div>
    </Section>
  );
}

function PhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={file.name} className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Αφαίρεση φωτογραφίας"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function PlanStep({
  plans,
  selectedPlanId,
  onSelect,
}: {
  plans: PricingPlan[];
  selectedPlanId: number | string | null;
  onSelect: (id: number | string) => void;
}) {
  if (!plans.length) {
    return <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση πλάνων...</p>;
  }

  return (
    <Section title="Επέλεξε το Πλάνο σου">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {plans.map((plan) => (
          <PlanOption key={plan.id} plan={plan} selected={String(plan.id) === String(selectedPlanId)} onSelect={() => onSelect(plan.id)} />
        ))}
      </div>
    </Section>
  );
}

function PlanOption({ plan, selected, onSelect }: { plan: PricingPlan; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative rounded-xl border-2 p-5 text-left transition ${
        selected ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
      }`}
    >
      {plan.isPopular && (
        <Badge className="absolute -top-3 left-4 h-auto rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-white hover:bg-primary">
          Δημοφιλές
        </Badge>
      )}
      {selected && (
        <div className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
          <CheckCircle2 className="h-4 w-4" />
        </div>
      )}
      <div className="font-bold text-slate-950 dark:text-slate-50">{plan.name}</div>
      <div className="mt-2">
        <span className="text-2xl font-bold text-slate-950 dark:text-slate-50">€{Number(plan.price).toFixed(0)}</span>
        <span className="ml-1 text-xs text-muted-foreground">/{formatPeriodLabel(plan.period)}</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {plan.features
          .filter((feature) => feature.included)
          .map((feature, index) => (
            <li key={index} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              {feature.text}
            </li>
          ))}
      </ul>
    </button>
  );
}

function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
  bankDetails,
  selectedPlan,
}: {
  paymentMethod: "bank" | "stripe";
  onPaymentMethodChange: (value: "bank" | "stripe") => void;
  bankDetails: BankDetails | null;
  selectedPlan: PricingPlan | null;
}) {
  return (
    <Section title="Τρόπος Πληρωμής">
      <div className="mb-6 rounded-xl bg-muted p-4">
        <div className="text-sm font-medium text-muted-foreground">Επιλεγμένο πλάνο</div>
        {selectedPlan ? (
          <div className="mt-2 flex items-end justify-between gap-4">
            <span className="font-semibold">{selectedPlan.name}</span>
            <span className="text-xl font-bold">€{Number(selectedPlan.price).toFixed(0)}<span className="ml-1 text-sm font-normal text-muted-foreground">/{formatPeriodLabel(selectedPlan.period)}</span></span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">Δεν έχει επιλεγεί πλάνο.</div>
        )}
      </div>
      <RadioGroup value={paymentMethod} onValueChange={(value) => onPaymentMethodChange((value as "bank" | "stripe") ?? "bank")} className="space-y-3">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${
            paymentMethod === "bank" ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <RadioGroupItem value="bank" />
          Τραπεζικό έμβασμα
        </label>
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${
            paymentMethod === "stripe" ? "border-primary bg-primary/5" : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <RadioGroupItem value="stripe" />
          Πιστωτική/Χρεωστική κάρτα
          <span className="ml-auto text-xs font-semibold text-slate-400">Σύντομα διαθέσιμο</span>
        </label>
      </RadioGroup>

      {paymentMethod === "bank" && bankDetails && (
        <div className="mt-4 space-y-3 rounded-xl border bg-muted/50 p-5 text-sm dark:bg-slate-800">
          <div><span className="text-muted-foreground">Τράπεζα</span><div className="mt-1 font-semibold">{bankDetails.bankName}</div></div>
          <div><span className="text-muted-foreground">Δικαιούχος</span><div className="mt-1 font-semibold">{bankDetails.beneficiary}</div></div>
          <div><span className="text-muted-foreground">IBAN</span><div className="mt-1 break-all font-semibold tracking-wide">{bankDetails.iban}</div></div>
          <div className="pt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Θα λάβεις αριθμό αναφοράς πληρωμής μετά την ολοκλήρωση της εγγραφής.
          </div>
        </div>
      )}
    </Section>
  );
}

export default function RegisterWizardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#f7f8fb] text-sm font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Φόρτωση...
        </div>
      }
    >
      <RegisterWizardContent />
    </Suspense>
  );
}
