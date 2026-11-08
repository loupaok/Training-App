"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Copy,
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
  packageId?: number;
  durationMonths?: number;
  name: string;
  description?: string;
  price: number | string;
  currency: string;
  period: string;
  pointsReward?: number;
  features: PlanFeature[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
}

interface PackageDuration {
  id: number;
  months: number;
  title?: string | null;
  basePriceCents: number;
  isActive: boolean;
  sortOrder: number;
}

interface CoachingPackage {
  id: number;
  name: string;
  label?: string | null;
  sortOrder: number;
  features: { text: string }[];
  offers?: { months: number; priceCents: number; features: string[]; isActive: boolean }[];
}

interface PackageCatalog {
  packages: CoachingPackage[];
  durations: PackageDuration[];
  pointsPerEuro: number;
}

interface BankDetails {
  bankName: string;
  beneficiary: string;
  iban: string;
  supportEmail: string;
  supportPhone: string;
}

interface PaymentBankAccount {
  bankName: string;
  accountHolder: string;
  iban: string;
  isDefault: boolean;
  isVisible: boolean;
  sortOrder: number;
}

interface PaymentOptions {
  bankTransferEnabled: boolean;
  cashEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  bankAccounts?: PaymentBankAccount[];
}

type RegistrationPaymentMethod = "bank" | "stripe" | "paypal" | "cash";

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
  paymentId: number;
  paymentMethod: RegistrationPaymentMethod;
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
    selectedDurationMonths?: number;
    paymentMethod?: RegistrationPaymentMethod;
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
type ProgressPhotoAngle = "front" | "side" | "back";
type IntakePhoto = { file: File; angle: ProgressPhotoAngle };

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
  const [selectedDurationMonths, setSelectedDurationMonths] = useState(1);

  const [paymentMethod, setPaymentMethod] = useState<RegistrationPaymentMethod>("bank");
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({ bankTransferEnabled: true, cashEnabled: false, stripeEnabled: false, paypalEnabled: false });
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);

  const [intakePhotos, setIntakePhotos] = useState<IntakePhoto[]>([]);
  const [intakePdf, setIntakePdf] = useState<File | null>(null);
  const [filesError, setFilesError] = useState("");

  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [editingFromConfirmation, setEditingFromConfirmation] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    api
      .get<QuestionnaireQuestion[]>("/questionnaire/questions")
      .then((rows) => setQuestions(rows.sort((a, b) => a.sortOrder - b.sortOrder)))
      .catch(() => {});

    api
      .get<PackageCatalog>("/pricing-plans/packages")
      .then((catalog) => {
        const activeDurations = catalog.durations.filter((duration) => duration.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
        const active = activeDurations.flatMap((duration) => [...catalog.packages]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .flatMap((pkg) => {
            const offer = pkg.offers?.find((item) => item.months === duration.months && item.isActive);
            if (!offer) return [];
            const features = offer.features.length ? offer.features : pkg.features.map((feature) => feature.text);
            return [{
              id: `${pkg.id}:${duration.months}`,
              packageId: pkg.id,
              durationMonths: duration.months,
              name: pkg.name,
              description: "",
              price: offer.priceCents / 100,
              pointsReward: Math.round((offer.priceCents / 100) * Number(catalog.pointsPerEuro || 0)),
              currency: "EUR",
              period: duration.title || `${duration.months} ${duration.months === 1 ? "μήνας" : "μήνες"}`,
              features: features.map((text) => ({ text, included: true })),
              isActive: true,
              isPopular: Boolean(pkg.label),
              sortOrder: duration.sortOrder * 100 + pkg.sortOrder,
            } satisfies PricingPlan];
          }));
        setPlans(active);
        const preselected = preselectedPlan ? active.find((plan) => String(plan.id) === preselectedPlan || String(plan.packageId) === preselectedPlan) : null;
        const popular = active.find((plan) => plan.isPopular);
        const initial = preselected || popular || active[0];
        setSelectedPlanId((current) => current ?? initial?.id ?? null);
        setSelectedDurationMonths(initial?.durationMonths || activeDurations[0]?.months || 1);
      })
      .catch(() => {});

    api.get<BankDetails>("/bank-details").then(setBankDetails).catch(() => {});
    api.get<PaymentOptions>("/pricing-plans/payment-options").then((options) => {
      setPaymentOptions(options);
      const available: RegistrationPaymentMethod[] = [
        options.stripeEnabled ? "stripe" : null,
        options.paypalEnabled ? "paypal" : null,
        options.bankTransferEnabled ? "bank" : null,
        options.cashEnabled ? "cash" : null,
      ].filter((value): value is RegistrationPaymentMethod => Boolean(value));
      if (available.length) setPaymentMethod((current) => available.includes(current) ? current : available[0]);
    }).catch(() => {});
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
        if (data.selectedDurationMonths) setSelectedDurationMonths(Number(data.selectedDurationMonths));
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
        if (draft.selectedDurationMonths) setSelectedDurationMonths(Number(draft.selectedDurationMonths));
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

  const addIntakePhotos = (files: FileList | File[], angle: ProgressPhotoAngle) => {
    setFilesError("");
    const incoming = Array.from(files);
    const oversized = incoming.find((file) => file.size > MAX_PHOTO_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setFilesError(`Η φωτογραφία "${oversized.name}" ξεπερνά τα ${MAX_PHOTO_SIZE_MB}MB.`);
      return;
    }
    const [firstFile] = incoming;
    if (!firstFile) return;
    setIntakePhotos((current) => {
      const existing = current.findIndex((photo) => photo.angle === angle);
      if (existing === -1) return [...current, { file: firstFile, angle }];
      return current.map((photo, index) => index === existing ? { file: firstFile, angle } : photo);
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

  const validateRegistration = (): string => {
    if (!account.firstName || !account.lastName || !account.email || !account.phone || account.password.length < 6) {
      return "Συμπλήρωσε όλα τα υποχρεωτικά προσωπικά στοιχεία.";
    }
    if (!birthDateToIso(account.dateOfBirth)) return "Συμπλήρωσε έγκυρη ημερομηνία γέννησης στη μορφή dd/mm/yyyy.";
    if (!account.gender) return "Επίλεξε φύλο για να συνεχίσεις.";
    if (account.password !== confirmPassword) return "Η επιβεβαίωση κωδικού δεν ταιριάζει.";
    if (!bodyGoal.height || !bodyGoal.currentWeight || !bodyGoal.goal) return "Συμπλήρωσε ύψος, τρέχον βάρος και στόχο.";

    const missingRequiredAnswer = questions.some(
      (question) => question.isRequired && isAnswerEmpty(fixedAnswerForQuestion(question) ?? answers[question.id]),
    );
    if (missingRequiredAnswer) return "Συμπλήρωσε όλες τις υποχρεωτικές ερωτήσεις του ερωτηματολογίου.";
    if (!selectedPlanId) return "Επέλεξε ένα πλάνο συνδρομής.";
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
      selectedDurationMonths,
      paymentMethod,
    };
  };

  useEffect(() => {
    if (!draftRestored) return;
    window.sessionStorage.setItem("register-wizard-draft", JSON.stringify({ ...getProgressData(), stepIndex }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftRestored, account, bodyGoal, answers, selectedPlanId, selectedDurationMonths, paymentMethod, stepIndex]);

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
    if (!legalAccepted) {
      setStepError("Χρειάζεται να αποδεχθείς τους Όρους και την Πολιτική Απορρήτου.");
      return;
    }
    const message = validateRegistration();
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
    if (selectedPlan?.packageId && selectedPlan.durationMonths) {
      formData.append("package_id", String(selectedPlan.packageId));
      formData.append("duration_months", String(selectedPlan.durationMonths));
    } else {
      formData.append("plan_id", String(Number(selectedPlanId)));
    }
    formData.append("payment_method", paymentMethod);
    formData.append("privacyConsent", "true");
    formData.append("answers", JSON.stringify(answersPayload));
    intakePhotos.forEach(({ file }) => formData.append("photos", file));
    if (intakePdf) formData.append("pdf", intakePdf);

    try {
      const result = await api.upload<RegisterResponse>("/register", formData);
      justCompletedRegistration.current = true;
      const loginResult = await login(account.email, account.password);
      if (!loginResult.success) {
        throw new Error("Ο λογαριασμός δημιουργήθηκε, αλλά χρειάζεται σύνδεση για να συνεχίσεις στην πληρωμή.");
      }
      updateUser(result.user);

      // Reuse the secure hosted checkout flow used in Συνδρομή & Πληρωμές.
      // The amount and the payment row were created server-side from the plan.
      if (paymentMethod === "stripe" || paymentMethod === "paypal") {
        const endpoint = paymentMethod === "stripe"
          ? `/clients/me/billing/${result.paymentId}/stripe-checkout`
          : `/clients/me/billing/${result.paymentId}/paypal-order`;
        const checkout = await api.post<{ checkoutUrl: string }>(endpoint, {});
        if (!checkout.checkoutUrl) throw new Error("Δεν ήταν δυνατή η έναρξη της ασφαλούς πληρωμής.");
        window.location.assign(checkout.checkoutUrl);
        return;
      }

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
    return <SuccessScreen appName={branding.appName} paymentMethod={paymentMethod} selectedPlan={selectedPlan} onContinue={() => router.push("/client/pending")} />;
  }

  if (showIntro) {
    return <OnboardingIntro appName={branding.appName} logoUrl={branding.logoUrl} imageUrl={branding.loginBackgroundUrl} onStart={() => { window.sessionStorage.setItem("register-onboarding-started", "true"); setShowIntro(false); }} />;
  }

  return (
    <div className="min-h-screen bg-[#f4f4f2] text-foreground dark:bg-background">
      <div className={`min-h-screen lg:grid ${stepIndex >= 4 ? "lg:grid-cols-[290px_minmax(0,1fr)]" : "lg:grid-cols-[290px_minmax(0,1fr)_320px]"}`}>
        <RegistrationSidebar activeIndex={stepIndex} appName={branding.appName} logoUrl={branding.logoUrl} supportEmail={branding.supportEmail} />

        <main className="min-w-0 bg-[#f4f4f2] px-4 py-5 sm:px-8 lg:px-10 lg:py-12 dark:bg-background">
          <div className={`mx-auto ${stepIndex >= 4 ? "max-w-6xl" : "max-w-3xl"}`}>
            <MobileRegistrationHeader appName={branding.appName} logoUrl={branding.logoUrl} activeIndex={stepIndex} />
            <header className={`mb-5 rounded-[20px] border border-border bg-card p-6 shadow-none sm:p-8 ${stepIndex >= 4 ? "hidden" : ""}`}>
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>Βήμα {stepIndex + 1} από {steps.length}</span>
                <span>Περίπου 5 λεπτά</span>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold text-foreground">{stepContent[stepIndex].title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{stepContent[stepIndex].subtitle}</p>
              <div className="mt-5 flex items-center gap-4">
                <Progress value={((stepIndex + 1) / steps.length) * 100} className="h-1.5 flex-1 [&_[data-slot=progress-track]]:bg-muted [&_[data-slot=progress-indicator]]:bg-accent" />
                <span className="text-sm font-medium text-muted-foreground">{Math.round(((stepIndex + 1) / steps.length) * 100)}%</span>
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

            <form onSubmit={submit} className={`${stepIndex >= 4 ? "" : "rounded-[20px] border border-border bg-card p-5 shadow-none sm:p-8"} [&_input:focus-visible]:border-ring [&_textarea:focus-visible]:border-ring`}>
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
              <PlanStep plans={plans} selectedPlanId={selectedPlanId} selectedDurationMonths={selectedDurationMonths} onDurationChange={(months) => { setSelectedDurationMonths(months); const next = plans.find((plan) => plan.durationMonths === months); if (next) setSelectedPlanId(next.id); }} onSelect={setSelectedPlanId} />
            )}
            {stepIndex === 5 && (
              <PaymentStep
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                bankDetails={bankDetails}
                selectedPlan={selectedPlan}
                onChangePlan={() => setStepIndex(4)}
                paymentOptions={paymentOptions}
              />
            )}
            {stepIndex === 6 && (
              <ConfirmationStep account={account} bodyGoal={bodyGoal} questions={questions} answers={answers} selectedPlan={selectedPlan} paymentMethod={paymentMethod} onEdit={(index) => { setEditingFromConfirmation(true); setStepIndex(index); }} />
            )}

            {stepIndex === steps.length - 1 && (
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                <Checkbox checked={legalAccepted} onCheckedChange={(checked) => setLegalAccepted(Boolean(checked))} className="mt-1" />
                <span>Αποδέχομαι τους <Link href="/terms" target="_blank" className="font-semibold text-primary hover:underline">Όρους Χρήσης</Link> και την <Link href="/privacy" target="_blank" className="font-semibold text-primary hover:underline">Πολιτική Απορρήτου</Link>, συμπεριλαμβανομένης της επεξεργασίας των στοιχείων και των φωτογραφιών προόδου που επιλέγω να υποβάλω.</span>
              </label>
            )}

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">
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
                  <Button key="continue" type="button" disabled={savingStep} className="h-12 bg-foreground px-8 font-semibold text-background hover:bg-foreground/90" onClick={goNext}>
                    {savingStep ? "Αποθήκευση..." : "Συνέχεια"} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button key="submit" type="submit" disabled={submitting} className="h-12 bg-foreground px-8 font-semibold text-background hover:bg-foreground/90">
                    {submitting ? "Ολοκλήρωση..." : paymentMethod === "stripe" ? "Συνέχεια στη Stripe" : paymentMethod === "paypal" ? "Συνέχεια στο PayPal" : "Ολοκλήρωση εγγραφής"}
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
        {stepIndex < 4 && <RegistrationAside stepIndex={stepIndex} />}
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
    <main className="min-h-screen bg-[#f4f4f2] p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:p-0 dark:bg-background">
      <section className="relative min-h-72 overflow-hidden rounded-[20px] bg-[#0b0b0b] lg:min-h-screen lg:rounded-none">
        {imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={resolveMediaUrl(imageUrl)} alt="Fitness coaching" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(22,163,74,0.35),transparent_40%),linear-gradient(145deg,#0f172a,#1e293b)]" />
        )}
          <div className="absolute inset-0 bg-[#0b0b0b]/55" />
        <div className="relative flex h-full min-h-72 flex-col justify-between p-6 text-white sm:p-8 lg:p-12">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-10 max-w-36 object-contain" />
            ) : <span className="text-xl font-bold">{appName}</span>}
          </div>
          <div className="max-w-md">
            <p className="inline-flex rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold tracking-[.8px] text-accent-foreground">CONSISTENCY CREATES RESULTS</p>
            <h1 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">Ξεκίνα το ταξίδι σου με ένα πλάνο <span className="text-accent">φτιαγμένο για εσένα.</span></h1>
          </div>
        </div>
      </section>

      <section className="flex items-center bg-card px-5 py-10 sm:px-10 lg:px-16 lg:py-16">
        <div className="mx-auto w-full max-w-xl">
          <p className="text-xs font-extrabold tracking-[.16em] text-foreground">PERSONAL COACHING</p>
          <h2 className="mt-4 text-3xl font-extrabold text-foreground sm:text-4xl">Ας δημιουργήσουμε το πλάνο σου</h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">Για να προσαρμόσουμε την προπόνηση και τη διατροφή σου στις ανάγκες σου, θέλουμε πρώτα να σε γνωρίσουμε λίγο καλύτερα.</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Απάντησε σε μερικές σύντομες ερωτήσεις σχετικά με τον στόχο σου, την προπόνηση, τη διατροφή και την καθημερινότητά σου.</p>

          <div className="mt-8 divide-y divide-border border-y border-border">
            {sections.map(({ number, title, description, icon: Icon }) => (
              <div key={number} className="flex items-center gap-4 py-4">
                <span className="w-7 text-sm font-extrabold text-foreground">{number}</span>
                <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[var(--sp-lime-soft)]"><Icon className="h-4 w-4 text-foreground" /></span>
                <div><p className="text-sm font-extrabold text-foreground">{title}</p><p className="mt-0.5 text-sm text-muted-foreground">{description}</p></div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Clock className="h-4 w-4 text-foreground" />Περίπου 5 λεπτά</span><span>Μπορείς να επιστρέψεις όποτε είσαι έτοιμος.</span></div>
          <Button type="button" size="lg" className="mt-8 h-12 w-full bg-accent font-extrabold text-accent-foreground hover:bg-accent/85 sm:w-auto sm:px-8" onClick={onStart}>Ξεκίνα <ArrowRight className="ml-2 h-4 w-4" /></Button>
          <p className="mt-5 text-sm text-muted-foreground">Έχεις ήδη λογαριασμό; <Link href="/login" className="font-extrabold text-foreground hover:underline">Σύνδεση</Link></p>
        </div>
      </section>
    </main>
  );
}

function MobileRegistrationHeader({ appName, logoUrl, activeIndex }: { appName: string; logoUrl: string | null; activeIndex: number }) {
  return (
    <div className="-mx-4 mb-5 bg-[#0b0b0b] px-4 py-4 text-white sm:-mx-8 sm:px-8 lg:hidden">
      <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-8 max-w-28 object-contain" />
        ) : <span className="text-lg font-extrabold">{appName}</span>}
      </div>
      <span className="text-xs text-neutral-300">Βήμα {activeIndex + 1} / {steps.length}</span>
      </div>
      <div className="mt-3 flex gap-1.5">{steps.map((step, index) => <span key={step.key} className={`h-1 flex-1 rounded-full ${index <= activeIndex ? "bg-accent" : "bg-[#333333]"}`} />)}</div>
      <p className="mt-2 text-[11px] text-neutral-400">{steps[activeIndex]?.title} · Επόμενο: {steps[activeIndex + 1]?.title || "Ολοκλήρωση"}</p>
    </div>
  );
}

function RegistrationSidebar({ activeIndex, appName, logoUrl, supportEmail }: { activeIndex: number; appName: string; logoUrl: string | null; supportEmail: string | null }) {
  return (
    <aside className="hidden min-h-screen w-[290px] shrink-0 flex-col gap-[26px] bg-[#0b0b0b] px-[18px] py-[26px] text-white lg:flex">
      <div className="flex items-center px-[6px]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveMediaUrl(logoUrl)} alt={appName} className="h-[26px] max-w-36 object-contain" />
        ) : <span className="text-2xl font-bold">{appName}</span>}
      </div>
      <div className="px-[6px]"><div className="flex justify-between text-[12px] font-bold text-[#9a9a9a]"><span>Εγγραφή · Βήμα {activeIndex + 1} από 7</span><span className="text-accent">{Math.round(((activeIndex + 1) / steps.length) * 100)}%</span></div><div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#262626]"><span className="block h-full rounded-full bg-accent" style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }} /></div></div>
      <nav className="space-y-[10px]">
        {steps.map((step, index) => {
          const active = index === activeIndex;
          const complete = index < activeIndex;
          return (
            <div key={step.key} className={`relative flex items-center gap-3 rounded-[14px] px-[13px] py-[9px] ${active ? "bg-accent text-accent-foreground" : ""}`}>
              <span className={`grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${active ? "bg-[#0b0b0b] text-accent" : complete ? "bg-accent text-accent-foreground" : "border-[1.5px] border-[#3a3a3a] text-[#8a8a8a]"}`}>
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex flex-col gap-px">
                <span className={`block text-[14px] font-extrabold ${active ? "text-accent-foreground" : complete ? "text-white" : "text-[#8a8a8a]"}`}>{step.title}</span>
                <span className={`block text-[11px] ${active ? "text-[#2c3a00]" : complete ? "text-[#8a8a8a]" : "text-[#5a5a5a]"}`}>{step.subtitle}</span>
              </span>
              {index < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[28px] top-[46px] h-[22px] w-[2px] ${index < activeIndex ? "bg-accent" : "bg-[#2a2a2a]"}`} />}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto rounded-[16px] bg-[#161616] p-4">
        <div className="flex items-center gap-2 text-[14px] font-extrabold"><CircleHelp className="h-4 w-4" /> Έχεις ερωτήσεις;</div>
        <p className="mt-2 text-xs leading-[1.45] text-[#9a9a9a]">Γράψε μας και σου απαντάμε μέσα στη μέρα.</p>
        {supportEmail ? <a href={`mailto:${supportEmail}`} className="mt-[10px] inline-flex h-10 w-full items-center justify-center rounded-full border border-[#333333] text-[13px] font-extrabold text-white transition-colors hover:bg-white hover:text-[#0b0b0b]"><MessageCircle className="mr-2 h-[15px] w-[15px]" /> Επικοινωνία</a> : <Button type="button" variant="outline" disabled className="mt-[10px] h-10 w-full rounded-full border-[#333333] bg-transparent text-[13px] text-white"><MessageCircle className="mr-2 h-[15px] w-[15px]" /> Επικοινωνία</Button>}
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
    <aside className="hidden bg-[#f4f4f2] p-5 dark:bg-background xl:block">
      <div className="sticky top-6 space-y-5">
        <Card className="rounded-[20px] border-border bg-card shadow-none">
          <CardContent className="p-5"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent text-accent-foreground"><ShieldCheck className="h-5 w-5" /></span><h2 className="mt-3 text-base font-extrabold text-foreground">Γιατί αυτά τα στοιχεία;</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{content[1]}</p></CardContent>
        </Card>
        <div className="space-y-4 px-1">
          <h2 className="text-lg font-extrabold text-foreground">Τι κερδίζεις</h2>
          {[[Dumbbell, "Εξατομικευμένο πρόγραμμα"], [HeartPulse, "Σωστή διατροφή"], [MessageCircle, "Συνεχής υποστήριξη"], [Target, "Πραγματικά αποτελέσματα"]].map(([Icon, label]) => {
            const BenefitIcon = Icon as typeof Dumbbell;
            return <div key={label as string} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted"><BenefitIcon className="h-4 w-4 text-foreground" /></span><div><p className="text-sm font-extrabold text-foreground">{label as string}</p><p className="text-xs leading-5 text-muted-foreground">Υποστήριξη προσαρμοσμένη στους στόχους σου.</p></div></div>;
          })}
        </div>
      </div>
    </aside>
  );
}

function SuccessScreen({ appName, paymentMethod, selectedPlan, onContinue }: { appName: string; paymentMethod: RegistrationPaymentMethod; selectedPlan: PricingPlan | null; onContinue: () => void }) {
  const offline = paymentMethod === "bank" || paymentMethod === "cash";
  const methodLabel = paymentMethod === "cash" ? "μετρητά" : paymentMethod === "bank" ? "τραπεζικό έμβασμα" : paymentMethod === "paypal" ? "PayPal" : "κάρτα";
  const amount = Number(selectedPlan?.price || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f4f2] p-5 dark:bg-background">
      <Card className="w-full max-w-[440px] rounded-[28px] border-border bg-card shadow-[0_30px_80px_rgba(0,0,0,.08)]"><CardContent className="flex flex-col items-center gap-[22px] p-8 text-center sm:px-10 sm:pb-9 sm:pt-10">
        <span className={`grid h-[84px] w-[84px] place-items-center rounded-full text-foreground ${offline ? "bg-[var(--sp-lime-soft)]" : "bg-accent shadow-[0_0_0_10px_rgba(176,249,12,.22)]"}`}>{offline ? <Clock className="h-[34px] w-[34px]" /> : <CheckCircle2 className="h-[34px] w-[34px]" />}</span>
        <div><h1 className="text-[28px] font-extrabold tracking-[-.5px] text-foreground">{offline ? "Η εγγραφή σου στάλθηκε!" : "Καλώς ήρθες στην ομάδα!"}</h1><p className="mt-2 text-[15px] leading-6 text-muted-foreground">{offline ? <>Κάνε την πληρωμή <b className="text-foreground">{amount} €</b> με {methodLabel} και η συνδρομή <b className="text-foreground">{selectedPlan?.name || "σου"}</b> ενεργοποιείται μόλις την επιβεβαιώσει ο coach.</> : <>Η πληρωμή ολοκληρώθηκε και η συνδρομή <b className="text-foreground">{selectedPlan?.name || "σου"}</b> είναι ήδη ενεργή.</>}</p></div>
        <div className="w-full space-y-3 rounded-[18px] bg-muted p-[18px] text-left text-[14px]">
          <SuccessTimelineRow complete text={offline ? "Η εγγραφή σου ολοκληρώθηκε" : `Η πληρωμή ${amount} € ολοκληρώθηκε`} />
          <SuccessTimelineRow complete={!offline} text={offline ? `${paymentMethod === "cash" ? "Παράδοση μετρητών" : "Κατάθεση"} με αιτιολογία που θα δεις στην αρχική` : "Ο coach ετοιμάζει το πρόγραμμά σου"} />
          <SuccessTimelineRow text={offline ? "Έγκριση από τον coach" : "Επιβεβαίωσε το email σου"} />
        </div>
        <p className="text-[12px] leading-5 text-muted-foreground">Στείλαμε email επιβεβαίωσης στη διεύθυνσή σου. Πάτησε τον σύνδεσμο για να την επιβεβαιώσεις.</p>
        <Button className={`h-[52px] w-full rounded-full font-extrabold ${offline ? "bg-foreground text-background hover:bg-foreground/90" : "bg-accent text-accent-foreground hover:bg-accent/85"}`} onClick={onContinue}>{offline ? "Δες την κατάσταση πληρωμής" : "Πάμε στην αρχική"} <ArrowRight className="ml-2 h-4 w-4" /></Button>
      </CardContent></Card>
    </main>
  );
}

function SuccessTimelineRow({ complete = false, text }: { complete?: boolean; text: string }) {
  return <p className={`flex items-center gap-3 ${complete ? "text-foreground" : "text-muted-foreground"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${complete ? "bg-accent text-accent-foreground" : "border-[1.5px] border-dashed border-border"}`}>{complete && <CheckCircle2 className="h-3.5 w-3.5" />}</span>{text}</p>;
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

function RegistrationBankAccounts({ accounts, amount, onCopy }: { accounts: PaymentBankAccount[]; amount: number; onCopy: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-[10px]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-extrabold">Στοιχεία κατάθεσης</p>
        {accounts.length > 1 && <span className="inline-flex h-[26px] items-center rounded-full bg-muted px-2.5 text-[12px] font-extrabold">{accounts.length} λογαριασμοί</span>}
      </div>
      <div className="space-y-[10px]">
        {accounts.map((account, index) => (
          <div key={`${account.iban}-${index}`} className="rounded-[14px] border border-border bg-muted p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-extrabold">{account.bankName || "Τραπεζικός λογαριασμός"}</p>
              {index === 0 && <span className="rounded-full bg-card px-2 py-1 text-[10px] font-extrabold text-muted-foreground">Προτεινόμενος</span>}
            </div>
            <div className="grid gap-[10px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
              <RegistrationBankValue label="Δικαιούχος" value={account.accountHolder} onCopy={onCopy} />
              <RegistrationBankValue label="IBAN" value={account.iban} onCopy={onCopy} mono />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-muted-foreground">Στην αιτιολογία γράψε <b className="text-foreground">ονοματεπώνυμο + πλάνο</b> · ποσό {amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €.</p>
    </div>
  );
}

function RegistrationBankValue({ label, value, onCopy, mono = false }: { label: string; value: string; onCopy: (value: string) => void; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-[10px] rounded-[12px] bg-card px-[14px] py-3">
      <div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{label}</p><p className={`truncate text-[14px] font-extrabold ${mono ? "tracking-[.3px] tabular-nums" : ""}`}>{value || "—"}</p></div>
      {value && <button type="button" aria-label={`Αντιγραφή ${label}`} onClick={() => onCopy(value)} className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-border bg-card transition-colors hover:bg-muted"><Copy className="h-[15px] w-[15px]" /></button>}
    </div>
  );
}

function PaymentActivationInfo({ paymentOptions }: { paymentOptions: PaymentOptions }) {
  const instantMethods = [paymentOptions.stripeEnabled && "κάρτα (Stripe)", paymentOptions.paypalEnabled && "PayPal"].filter(Boolean) as string[];
  const instantLabel = instantMethods.length === 2 ? "Κάρτα (Stripe) / PayPal" : instantMethods[0] || "Online πληρωμή";
  const offlineMethods = [paymentOptions.bankTransferEnabled && "έμβασμα", paymentOptions.cashEnabled && "μετρητά"].filter(Boolean) as string[];
  const offlineLabel = offlineMethods.length === 2 ? "έμβασμα ή μετρητά" : offlineMethods[0] || "άλλο τρόπο πληρωμής";

  return (
    <div className="mt-3 space-y-2 text-[13px] leading-5 text-muted-foreground">
      {instantMethods.length > 0 && <p><b className="text-foreground">{instantLabel}:</b> η πληρωμή επιβεβαιώνεται άμεσα.</p>}
      {offlineMethods.length > 0 && <p>Με {offlineLabel}, περιμένει πρώτα την επιβεβαίωση του coach.</p>}
      <p>Έπειτα ο coach αξιολογεί το ερωτηματολόγιό σου και ετοιμάζει το πρόγραμμα προπόνησης και διατροφής.</p>
      <p className="font-bold text-foreground">Ο λογαριασμός σου ενεργοποιείται μόλις σου σταλούν τα πλάνα.</p>
    </div>
  );
}

function displayAnswer(value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.join(", ") || "-";
  if (typeof value === "object") return Object.values(value).filter(Boolean).join(", ") || "-";
  return value;
}

function ConfirmationStep({ account, bodyGoal, questions, answers, selectedPlan, paymentMethod, onEdit }: { account: AccountForm; bodyGoal: BodyGoalForm; questions: QuestionnaireQuestion[]; answers: Record<number, AnswerValue>; selectedPlan: PricingPlan | null; paymentMethod: RegistrationPaymentMethod; onEdit: (index: number) => void }) {
  const sections = [
    { title: "Βασικά στοιχεία", icon: UserRound, step: 0, lines: [`${account.firstName} ${account.lastName}`, account.email, account.phone] },
    { title: "Σώμα & στόχος", icon: Weight, step: 1, lines: [`${bodyGoal.height || "-"} cm · ${bodyGoal.currentWeight || "-"} kg`, `Στόχος: ${bodyGoal.goal || "-"}`] },
    { title: "Ερωτηματολόγιο Coach", icon: ClipboardCheck, step: 2, lines: questions.slice(0, 3).map((question) => `${question.question}: ${displayAnswer(answers[question.id])}`) },
    { title: "Πλάνο & πληρωμή", icon: CreditCard, step: 4, lines: [selectedPlan?.name || "-", ({ bank: "Τραπεζικό έμβασμα", stripe: "Κάρτα", paypal: "PayPal", cash: "Μετρητά" } as const)[paymentMethod]] },
  ];
  return (
    <div className="space-y-3">
      {sections.map(({ title, icon: Icon, step, lines }, index) => (
        <Collapsible key={title} defaultOpen={index === 0}>
          <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-none transition-colors data-[open]:border-foreground/30">
            <CollapsibleTrigger render={<button type="button" className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/60 sm:px-5" />}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[var(--sp-lime-soft)] text-foreground"><Icon className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-extrabold text-foreground">{title}</span><span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{lines.filter(Boolean).slice(0, 2).join(" · ")}</span></span>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-data-[open]:rotate-90">›</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border bg-muted/35 px-4 py-4 sm:px-5">
              <div className="space-y-2.5">
                {lines.filter(Boolean).map((line, lineIndex) => <p key={lineIndex} className="rounded-[11px] border border-border/70 bg-card px-3 py-2.5 text-[13px] leading-5 text-foreground">{line}</p>)}
                <Button type="button" variant="outline" className="mt-1 h-9 rounded-full border-foreground px-4 text-[12px] font-extrabold" onClick={() => onEdit(step)}>Επεξεργασία</Button>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
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
  photos: IntakePhoto[];
  pdf: File | null;
  error: string;
  onAddPhotos: (files: FileList | File[], angle: ProgressPhotoAngle) => void;
  onRemovePhoto: (index: number) => void;
  onSetPdf: (file: File | null) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<ProgressPhotoAngle>("front");
  const angles: { value: ProgressPhotoAngle; label: string }[] = [
    { value: "front", label: "Μπροστά" },
    { value: "side", label: "Πλάι" },
    { value: "back", label: "Πίσω" },
  ];
  const selectedPhoto = photos.find((photo) => photo.angle === selectedAngle);

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
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Φωτογραφίες Προόδου</span>
        <p className="mb-3 text-xs text-muted-foreground">Προαιρετικά, μία φωτογραφία για κάθε πλευρά.</p>
        <div className="mb-4 grid grid-cols-3 rounded-[14px] border border-border bg-muted p-1">
          {angles.map((angle) => <button key={angle.value} type="button" onClick={() => setSelectedAngle(angle.value)} className={`h-10 rounded-[10px] text-[13px] font-extrabold transition-colors ${selectedAngle === angle.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground"}`}>{angle.label}</button>)}
        </div>

        {!selectedPhoto && <>
          <label
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); if (event.dataTransfer.files?.length) onAddPhotos(event.dataTransfer.files, selectedAngle); }}
            className={`hidden cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors sm:flex ${dragActive ? "border-primary bg-primary/5" : "border-slate-300 dark:border-slate-700"}`}
          >
            <ImagePlus className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Σύρε τη φωτογραφία {angles.find((angle) => angle.value === selectedAngle)?.label.toLowerCase()} εδώ ή κάνε κλικ για επιλογή</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · Max {MAX_PHOTO_SIZE_MB}MB</span>
            <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(event) => { if (event.target.files?.length) onAddPhotos(event.target.files, selectedAngle); event.target.value = ""; }} />
          </label>
          <div className="grid gap-2 sm:hidden">
            <label className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-foreground text-[14px] font-extrabold text-background">
              <ImagePlus className="h-4 w-4" /> Επίλεξε φωτογραφία
              <input type="file" accept="image/*" className="hidden" onChange={(event) => { if (event.target.files?.length) onAddPhotos(event.target.files, selectedAngle); event.target.value = ""; }} />
            </label>
            <label className="flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground text-[14px] font-extrabold text-foreground">
              <Camera className="h-4 w-4" /> Βγάλε φωτογραφία
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { if (event.target.files?.length) onAddPhotos(event.target.files, selectedAngle); event.target.value = ""; }} />
            </label>
          </div>
        </>}

        {selectedPhoto && <div className="mt-3"><PhotoThumb file={selectedPhoto.file} label={angles.find((angle) => angle.value === selectedAngle)?.label || ""} onRemove={() => onRemovePhoto(photos.findIndex((photo) => photo.angle === selectedAngle))} /></div>}
        {photos.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{angles.map((angle) => { const photo = photos.find((item) => item.angle === angle.value); return <button key={angle.value} type="button" onClick={() => setSelectedAngle(angle.value)} className={`h-10 rounded-[12px] border text-xs font-extrabold ${selectedAngle === angle.value ? "border-foreground bg-card ring-2 ring-accent" : "border-border bg-muted text-muted-foreground"}`}>{photo ? `✓ ${angle.label}` : angle.label}</button> })}</div>}
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

function PhotoThumb({ file, label, onRemove }: { file: File; label: string; onRemove: () => void }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="group relative aspect-[4/3] max-w-sm overflow-hidden rounded-[14px] bg-slate-100 dark:bg-slate-800">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`Φωτογραφία ${label}`} className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Αφαίρεση φωτογραφίας"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <span className="absolute bottom-2 left-2 rounded-full bg-[#0b0b0b]/80 px-2 py-1 text-[10px] font-extrabold text-white">{label}</span>
    </div>
  );
}

function PlanStep({
  plans,
  selectedPlanId,
  selectedDurationMonths,
  onDurationChange,
  onSelect,
}: {
  plans: PricingPlan[];
  selectedPlanId: number | string | null;
  selectedDurationMonths: number;
  onDurationChange: (months: number) => void;
  onSelect: (id: number | string) => void;
}) {
  if (!plans.length) {
    return <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση πλάνων...</p>;
  }

  const durations = [...new Set(plans.map((plan) => plan.durationMonths).filter((months): months is number => Boolean(months)))].sort((a, b) => a - b)
  const selectedPlan = plans.find((plan) => String(plan.id) === String(selectedPlanId)) || null
  const plansForDuration = plans.filter((plan) => plan.durationMonths === selectedDurationMonths)
  const basePlan = plansForDuration[0]
  const commonFeatures = [...new Set(plans.flatMap((plan) => plan.features.filter((feature) => feature.included).map((feature) => feature.text)))].slice(0, 10)

  return <section className="space-y-6">
    <div><p className="text-[12px] font-extrabold tracking-[1px] text-muted-foreground">ΒΗΜΑ 5 ΑΠΟ 7</p><h2 className="mt-1 text-[28px] font-extrabold tracking-[-.6px]">Διάλεξε το πακέτο σου</h2><p className="mt-1 max-w-3xl text-[14px] leading-6 text-muted-foreground">Εξατομικευμένη καθοδήγηση στην προπόνηση, στη διατροφή και στα συμπληρώματα, με τακτική αξιολόγηση της προόδου σου.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5"><div><p className="mb-2 text-[13px] font-extrabold">Διάρκεια συνεργασίας</p><div className="grid grid-cols-2 rounded-[16px] border border-border bg-card p-[5px] sm:grid-cols-4">{durations.map((months) => { const selected = selectedDurationMonths === months; const oneMonth = plans.find((plan) => plan.durationMonths === 1 && plan.name === plansForDuration[0]?.name); const current = plans.find((plan) => plan.durationMonths === months && plan.name === plansForDuration[0]?.name); const discount = oneMonth && current ? Math.round((1 - Number(current.price) / (Number(oneMonth.price) * months)) * 100) : 0; return <button key={months} type="button" onClick={() => onDurationChange(months)} className={`flex h-[46px] items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-extrabold ${selected ? "bg-foreground text-background" : "text-foreground hover:bg-muted"}`}>{months} {months === 1 ? "μήνας" : "μήνες"}{discount > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${selected ? "bg-accent text-accent-foreground" : "bg-[var(--sp-lime-soft)] text-foreground"}`}>−{discount}%</span>}</button> })}</div></div>
      <RadioGroup value={String(selectedPlanId || "")} onValueChange={(value) => value && onSelect(value)} className="grid gap-[14px] sm:grid-cols-2">{plansForDuration.map((plan) => <PlanOption key={plan.id} plan={plan} selected={String(plan.id) === String(selectedPlanId)} onSelect={() => onSelect(plan.id)} basePrice={Number(basePlan?.price || 0)} />)}</RadioGroup>
      <Card className="rounded-[20px] border-border shadow-none"><CardContent className="p-5"><h3 className="text-[16px] font-extrabold">Όλες οι διάρκειες περιλαμβάνουν τις ίδιες παροχές</h3><div className="mt-4 grid gap-2.5 sm:grid-cols-2">{commonFeatures.map((feature) => <p key={feature} className="flex gap-2 text-[13px] leading-5"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{feature}</p>)}</div><p className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">Η ημέρα update συμφωνείται από Δευτέρα έως Σάββατο. Η Κυριακή εξαιρείται.</p></CardContent></Card></div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start"><Card className="overflow-hidden rounded-[22px] border-[#0b0b0b] bg-[#0b0b0b] text-white shadow-none"><CardContent className="relative flex flex-col gap-4 p-[22px]"><span className="absolute right-[26px] -top-5 h-[70px] w-[10px] -skew-x-[18deg] bg-accent" /><p className="relative text-[11px] font-extrabold tracking-[1px] text-[#9a9a9a]">Η ΕΠΙΛΟΓΗ ΣΟΥ</p><div className="relative flex items-center gap-2"><p className="text-[26px] font-extrabold italic">{selectedPlan?.name || "—"}</p>{selectedPlan?.isPopular && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent px-2 text-[11px] font-extrabold text-accent-foreground">★ Δημοφιλές</span>}</div><div className="relative flex flex-col gap-[10px] border-y border-[#262626] py-[14px] text-[14px]"><p className="flex justify-between"><span className="text-[#9a9a9a]">Διάρκεια</span><b>{selectedDurationMonths} {selectedDurationMonths === 1 ? "μήνας" : "μήνες"}</b></p><p className="flex justify-between"><span className="text-[#9a9a9a]">Πόντοι που κερδίζεις</span><b>+{Number(selectedPlan?.pointsReward || 0).toLocaleString("el-GR")}</b></p></div><p className="relative flex items-baseline justify-between"><span className="text-[14px] text-[#bdbdbd]">Σύνολο</span><b className="text-[30px] text-accent">{Number(selectedPlan?.price || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b></p></CardContent></Card>
      <Card className="rounded-[20px] border-border shadow-none"><CardContent className="p-5"><h3 className="mb-2 text-[15px] font-extrabold">Όλες οι τιμές (€)</h3><div className="overflow-x-auto"><table className="w-full text-[12px]"><thead className="text-[10px] tracking-wide text-muted-foreground"><tr><th></th>{plansForDuration.map((plan) => <th key={plan.id} className="px-1 py-1 text-right">{plan.name.toUpperCase()}</th>)}</tr></thead><tbody>{durations.map((months) => <tr key={months} className="border-t border-border/70"><th className="py-2 text-left">{months}μ</th>{plansForDuration.map((plan) => { const price = plans.find((item) => item.name === plan.name && item.durationMonths === months); const isSelected = price && String(price.id) === String(selectedPlanId); return <td key={plan.id} className={`cursor-pointer rounded-lg px-1 py-2 text-right ${isSelected ? "bg-[var(--sp-lime-soft)] font-extrabold" : ""}`} onClick={() => price && (onDurationChange(months), onSelect(price.id))}>{price ? Number(price.price).toLocaleString("el-GR") : "—"}</td>})}</tr>)}</tbody></table></div></CardContent></Card></aside>
    </div>
  </section>;
}

function PlanOption({ plan, selected, onSelect, basePrice }: { plan: PricingPlan; selected: boolean; onSelect: () => void; basePrice: number }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex min-h-[270px] flex-col rounded-[20px] border-2 p-5 text-left transition ${
        selected ? "border-foreground bg-card shadow-none ring-4 ring-accent/50" : "border-border bg-card hover:border-foreground"
      }`}
    >
      {plan.isPopular && (
        <Badge className="absolute -top-3 left-4 h-auto rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-accent-foreground hover:bg-accent">
          Δημοφιλές
        </Badge>
      )}
      <div className="flex items-center gap-2"><RadioGroupItem value={String(plan.id)} /><span className="text-[18px] font-extrabold">{plan.name}</span><span className="ml-auto flex gap-1">{Array.from({ length: 4 }, (_, index) => <i key={index} className={`h-[5px] w-[14px] rounded-full ${index <= plansLevel(plan.name) ? "bg-accent" : "bg-muted"}`} />)}</span></div>
      <div className="mt-4"><span className="text-[36px] font-extrabold italic leading-none tracking-[-1px]">{Number(plan.price).toLocaleString("el-GR")} €</span><p className="mt-1 text-xs text-muted-foreground">για {plan.durationMonths} μήνες · {(Number(plan.price) / Math.max(1, Number(plan.durationMonths))).toLocaleString("el-GR", { maximumFractionDigits: 2 })} € / μήνα</p><p className="mt-1 text-xs text-muted-foreground">{basePrice && Number(plan.price) > basePrice ? `+${((Number(plan.price) - basePrice) / Math.max(1, Number(plan.durationMonths))).toLocaleString("el-GR")} €/μήνα από το Βασικό` : "η βάση της συνεργασίας"}</p></div>
      <div className="mt-3 inline-flex w-fit items-center rounded-full bg-[var(--sp-lime-soft)] px-2.5 py-1 text-[11px] font-extrabold text-foreground">+{Number(plan.pointsReward || 0).toLocaleString("el-GR")} πόντοι</div>
      <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
        {plan.features
          .filter((feature) => feature.included)
          .map((feature, index) => (
            <li key={index} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              {feature.text}
            </li>
          ))}
      </ul>
    </button>
  );
}

function plansLevel(name: string) { const normalized = name.toLocaleLowerCase("el-GR"); return normalized.includes("direct") ? 3 : normalized.includes("premium") ? 2 : normalized.includes("plus") ? 1 : 0 }

function PaymentStep({
  paymentMethod,
  onPaymentMethodChange,
  bankDetails: fallbackBankDetails,
  selectedPlan,
  onChangePlan,
  paymentOptions,
}: {
  paymentMethod: RegistrationPaymentMethod;
  onPaymentMethodChange: (value: RegistrationPaymentMethod) => void;
  bankDetails: BankDetails | null;
  selectedPlan: PricingPlan | null;
  onChangePlan: () => void;
  paymentOptions: PaymentOptions;
}) {
  const amount = Number(selectedPlan?.price || 0);
  const copy = (value: string) => navigator.clipboard?.writeText(value).catch(() => {});
  const bankAccounts = (paymentOptions.bankAccounts || [])
    .filter((account) => account.isVisible)
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.sortOrder - right.sortOrder);
  if (!bankAccounts.length && fallbackBankDetails?.iban) {
    bankAccounts.push({
      bankName: fallbackBankDetails.bankName,
      accountHolder: fallbackBankDetails.beneficiary,
      iban: fallbackBankDetails.iban,
      isDefault: true,
      isVisible: true,
      sortOrder: 0,
    });
  }
  // The compact legacy account card below is deliberately suppressed. The
  // registration flow now uses the same multi-account layout as client billing.
  const bankDetails: BankDetails | null = (false as boolean) ? fallbackBankDetails : null;
  const methods = [
    paymentOptions.stripeEnabled && { value: "stripe" as const, title: "Κάρτα", description: "Visa · Mastercard", instant: true, icon: CreditCard },
    paymentOptions.paypalEnabled && { value: "paypal" as const, title: "PayPal", description: "λογαριασμός PayPal", instant: true, icon: CreditCard },
    paymentOptions.bankTransferEnabled && { value: "bank" as const, title: "Έμβασμα", description: "έγκριση από coach", instant: false, icon: CreditCard },
    paymentOptions.cashEnabled && { value: "cash" as const, title: "Μετρητά", description: "στον coach", instant: false, icon: CreditCard },
  ].filter((method): method is { value: RegistrationPaymentMethod; title: string; description: string; instant: boolean; icon: typeof CreditCard } => Boolean(method));
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <div><p className="text-[12px] font-extrabold tracking-[1px] text-muted-foreground">ΒΗΜΑ 6 ΑΠΟ 7</p><h2 className="mt-1 text-[30px] font-extrabold tracking-[-.6px]">Πληρωμή</h2><p className="mt-1 text-[15px] text-muted-foreground">Διάλεξε πώς θέλεις να πληρώσεις για να ολοκληρωθεί η εγγραφή σου.</p></div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[16px] border border-border bg-card px-[18px] py-[14px] text-[13px]"><span className="text-muted-foreground">Επιλεγμένο πακέτο</span><b>{selectedPlan?.name || "—"} · {selectedPlan?.durationMonths || "—"} μήνες</b><button type="button" onClick={onChangePlan} className="ml-auto font-extrabold underline underline-offset-2">Αλλαγή</button></div>
        <RadioGroup value={paymentMethod} onValueChange={(value) => onPaymentMethodChange(value as RegistrationPaymentMethod)} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {methods.map(({ value, title, description, instant, icon: Icon }) => { const active = paymentMethod === value; return <label key={value} className={`flex min-h-[112px] cursor-pointer flex-col rounded-[16px] border p-[14px] transition ${active ? "border-2 border-[#0b0b0b] bg-card shadow-[0_0_0_3px_rgba(176,249,12,.5)] dark:border-foreground" : "border-border bg-card hover:border-foreground"}`}><div className="flex items-center gap-2"><Icon className="h-[19px] w-[19px]" />{instant && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-accent-foreground">⚡ Άμεσα</span>}<RadioGroupItem value={value} className="ml-auto" /></div><span className="mt-4 text-[15px] font-extrabold">{title}</span><span className="mt-0.5 text-[12px] text-muted-foreground">{description}</span></label> })}
        </RadioGroup>
        {paymentMethod === "bank" && bankAccounts.length > 0 && <RegistrationBankAccounts accounts={bankAccounts} amount={amount} onCopy={copy} />}
        {(paymentMethod === "stripe" || paymentMethod === "paypal") ? <Card className="rounded-[18px] border-border bg-card shadow-none"><CardContent className="space-y-3 p-[18px]"><div className="flex flex-wrap gap-2">{paymentMethod === "stripe" ? ["VISA", "Mastercard", "Apple Pay", "Google Pay"].map((name) => <span key={name} className="rounded-[8px] border border-border px-2.5 py-1.5 text-[11px] font-extrabold">{name}</span>) : <span className="rounded-[8px] border border-border px-2.5 py-1.5 text-[11px] font-extrabold">PayPal</span>}</div><p className="text-[13px] text-muted-foreground">{paymentMethod === "stripe" ? "Ασφαλής πληρωμή μέσω Stripe. Θα μεταφερθείς στη σελίδα πληρωμής και επιστρέφεις αυτόματα." : "Θα μεταφερθείς με ασφάλεια στο PayPal για να ολοκληρώσεις την πληρωμή σου."}</p><p className="rounded-[12px] bg-[var(--sp-lime-soft)] px-3 py-3 text-[13px] font-bold text-foreground">⚡ Η πληρωμή επιβεβαιώνεται αμέσως. Ο coach θα αξιολογήσει το ερωτηματολόγιό σου πριν σου στείλει τα πλάνα.</p></CardContent></Card> : paymentMethod === "cash" ? <Card className="rounded-[18px] border-border bg-card shadow-none"><CardContent className="p-[18px]"><h3 className="text-[15px] font-extrabold">Πληρωμή με μετρητά</h3><p className="mt-2 text-[13px] leading-5 text-muted-foreground">Δίνεις το ποσό στον coach από κοντά. Η πληρωμή και τα πλάνα σου περιμένουν την επιβεβαίωσή του.</p></CardContent></Card> : bankDetails && <Card className="rounded-[18px] border-border bg-card shadow-none"><CardContent className="p-[18px]"><div className="mb-4 flex items-center justify-between"><h3 className="text-[15px] font-extrabold">Στοιχεία κατάθεσης</h3><span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold">{bankDetails.bankName}</span></div><div className="grid gap-3 sm:grid-cols-2">{[["Δικαιούχος", bankDetails.beneficiary], ["IBAN", bankDetails.iban], ["Ποσό", `${amount.toLocaleString("el-GR", { minimumFractionDigits: 2 })} €`], ["Αιτιολογία", "Θα δοθεί μετά την ολοκλήρωση"]].map(([label, value]) => <div key={label} className="flex min-w-0 items-center gap-2 rounded-[13px] bg-muted p-3"><span className="min-w-0 flex-1"><small className="block text-[11px] text-muted-foreground">{label}</small><b className="block truncate text-[12px]">{value}</b></span>{label !== "Ποσό" && <button type="button" aria-label={`Αντιγραφή ${label}`} onClick={() => copy(value)} className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-border bg-card"><Copy className="h-3.5 w-3.5" /></button>}</div>)}</div><p className="mt-4 text-[12px] text-muted-foreground">Μπορείς να κάνεις την κατάθεση και αργότερα. Τα στοιχεία θα σε περιμένουν στην αρχική σου.</p></CardContent></Card>}
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start"><Card className="overflow-hidden rounded-[22px] border-[#0b0b0b] bg-[#0b0b0b] text-white shadow-none"><CardContent className="relative flex flex-col gap-4 p-[22px]"><span className="absolute right-[26px] -top-5 h-[70px] w-[10px] -skew-x-[18deg] bg-accent" /><p className="relative text-[11px] font-extrabold tracking-[1px] text-[#9a9a9a]">Η ΕΠΙΛΟΓΗ ΣΟΥ</p><div className="relative flex items-center gap-2"><p className="text-[26px] font-extrabold italic">{selectedPlan?.name || "—"}</p>{selectedPlan?.isPopular && <span className="inline-flex h-6 items-center gap-1 rounded-full bg-accent px-2 text-[11px] font-extrabold text-accent-foreground">★ Δημοφιλές</span>}</div><div className="relative flex flex-col gap-[10px] border-y border-[#262626] py-[14px] text-[14px]"><p className="flex justify-between"><span className="text-[#9a9a9a]">Διάρκεια</span><b>{selectedPlan?.durationMonths === 1 ? "1 μήνας" : `${selectedPlan?.durationMonths || "—"} μήνες`}</b></p><p className="flex justify-between"><span className="text-[#9a9a9a]">Πόντοι που κερδίζεις</span><b>+{Number(selectedPlan?.pointsReward || 0).toLocaleString("el-GR")}</b></p></div><p className="relative flex items-baseline justify-between"><span className="text-[14px] text-[#bdbdbd]">Σύνολο</span><b className="text-[30px] text-accent">{amount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</b></p></CardContent></Card><Card className="rounded-[20px] border-border shadow-none"><CardContent className="p-5"><h3 className="text-[15px] font-extrabold">Πότε ξεκινάς</h3><PaymentActivationInfo paymentOptions={paymentOptions} /></CardContent></Card></aside>
    </section>
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
