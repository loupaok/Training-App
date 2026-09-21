"use client";

import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
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

type RegisterResponse = {
  success: boolean;
  clientId: number;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  redirectTo: string;
};

const steps = [
  { key: "account", title: "Λογαριασμός" },
  { key: "questionnaire", title: "Ερωτηματολόγιο" },
  { key: "plan", title: "Πλάνο" },
  { key: "payment", title: "Πληρωμή" },
] as const;

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

function formatPeriodLabel(period: string): string {
  const normalized = (period || "").toLowerCase();
  if (normalized.includes("μηνια") || normalized.includes("monthly")) return "μήνα";
  return period;
}

function RegisterWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updateUser } = useAuth();
  const preselectedPlan = searchParams.get("plan");

  const [stepIndex, setStepIndex] = useState(0);
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
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"bank" | "stripe">("bank");
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);

  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        setSelectedPlanId((preselected || popular || active[0])?.id ?? null);
      })
      .catch(() => {});

    api.get<BankDetails>("/bank-details").then(setBankDetails).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!/^\S+@\S+\.\S+$/.test(account.email)) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    const timeout = window.setTimeout(() => {
      api
        .post<{ available: boolean }>("/check-email", { email: account.email })
        .then((result) => setEmailStatus(result.available ? "available" : "taken"))
        .catch(() => setEmailStatus("idle"));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [account.email]);

  const updateAccount = (name: keyof AccountForm, value: string) => setAccount((current) => ({ ...current, [name]: value }));
  const updateAnswer = (id: number, value: AnswerValue) => setAnswers((current) => ({ ...current, [id]: value }));

  const selectedPlan = plans.find((plan) => String(plan.id) === String(selectedPlanId)) || null;

  const validateStep = (): string => {
    if (stepIndex === 0) {
      if (!account.firstName || !account.lastName || !account.email || !account.phone || account.password.length < 6) {
        return "Συμπλήρωσε όλα τα υποχρεωτικά πεδία (ο κωδικός θέλει τουλάχιστον 6 χαρακτήρες).";
      }
      if (emailStatus === "taken") return "Αυτό το email χρησιμοποιείται ήδη.";
      return "";
    }
    if (stepIndex === 1) {
      const missing = questions.some((question) => question.isRequired && isAnswerEmpty(answers[question.id]));
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
    if (stepIndex === 2) {
      if (!selectedPlanId) return "Επέλεξε ένα πλάνο συνδρομής.";
      return "";
    }
    return "";
  };

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

    const payload = {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: `${account.countryCode} ${account.phone}`.trim(),
      password: account.password,
      dateOfBirth: account.dateOfBirth || undefined,
      gender: account.gender || undefined,
      answers: questions.map((question) => {
        const value = answers[question.id] ?? "";
        const serialized = typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value;
        return { question_id: question.id, answer: serialized };
      }),
      plan_id: Number(selectedPlanId),
      payment_method: paymentMethod,
    };

    try {
      const result = await api.post<RegisterResponse>("/register", payload);

      window.localStorage.setItem("token", result.accessToken);
      window.localStorage.setItem("refreshToken", result.refreshToken);
      window.localStorage.setItem("user", JSON.stringify(result.user));
      updateUser(result.user);

      router.push(result.redirectTo || "/register/success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Κάτι πήγε στραβά. Δοκίμασε ξανά.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-950 dark:text-slate-50">
      <div className="min-h-screen lg:grid lg:grid-cols-[2fr_3fr]">
        <aside className="hidden min-h-screen flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-primary/80 p-12 text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white lg:flex">
          <div>
            <div className="text-2xl font-bold tracking-tight">CoachApp</div>
            <p className="mt-2 max-w-xs text-sm text-white/70">Η πλατφόρμα για online personal training</p>
          </div>
          <div className="my-auto max-w-md">
            <h1 className="text-4xl font-bold tracking-tight">Ξεκίνα το Ταξίδι σου</h1>
            <ul className="mt-8 space-y-4">
              {[
                "100% εξατομικευμένο πρόγραμμα",
                "Εβδομαδιαία παρακολούθηση",
                "Άμεση επικοινωνία με coach",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-white/80" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <blockquote className="max-w-sm rounded-xl bg-white/10 p-5 text-sm leading-6 text-white/80">
            <p className="mt-3 italic">«Έχασα 12kg σε 4 μήνες! Το καλύτερο επένδυση που έκανα.»</p>
            <footer className="mt-3 text-xs text-white/60">— Μαρία Κ.</footer>
          </blockquote>
        </aside>

        <main className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="mx-auto max-w-3xl">
            <header className="mb-8">
              <div className="text-center lg:text-left">
                <Badge variant="outline" className="mb-4 h-auto w-fit gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold lg:hidden">
                  Online Personal Training
                </Badge>
                <h1 className="text-2xl font-bold sm:text-3xl">Δημιούργησε τον Λογαριασμό σου</h1>
                <p className="mt-2 text-sm text-muted-foreground">4 μικρά βήματα και ξεκινάμε το ταξίδι σου.</p>
              </div>
              <Stepper activeIndex={stepIndex} />
            </header>

            {stepError && <FormError message={stepError} />}
            {submitError && <FormError message={submitError} />}

            <form onSubmit={submit} className="rounded-xl border bg-white p-6 sm:p-8 dark:bg-slate-900">
            {stepIndex === 0 && (
              <AccountStep account={account} updateAccount={updateAccount} emailStatus={emailStatus} />
            )}
            {stepIndex === 1 && (
              <QuestionnaireStep questions={questions} answers={answers} updateAnswer={updateAnswer} />
            )}
            {stepIndex === 2 && (
              <PlanStep plans={plans} selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
            )}
            {stepIndex === 3 && (
              <PaymentStep
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                bankDetails={bankDetails}
                selectedPlan={selectedPlan}
              />
            )}

            <div className="sticky bottom-0 -mx-6 mt-8 flex items-center justify-between gap-3 border-t bg-white px-6 py-4 dark:bg-slate-900 sm:static sm:mx-0 sm:rounded-xl sm:border sm:bg-muted/50 sm:px-5 dark:sm:bg-slate-800">
              {stepIndex > 0 ? (
                <Button type="button" variant="ghost" className="h-11 px-3 font-bold sm:px-5" onClick={goBack}>
                  ← Πίσω
                </Button>
              ) : (
                <span />
              )}
              {stepIndex < steps.length - 1 ? (
                <Button key="continue" type="button" className="h-12 flex-1 px-8 font-bold sm:flex-none" onClick={goNext}>
                  Συνέχεια →
                </Button>
              ) : (
                <Button key="submit" type="submit" disabled={submitting} className="h-12 flex-1 px-8 font-bold sm:flex-none">
                  {submitting ? "Ολοκλήρωση..." : "Ολοκλήρωση Εγγραφής"}
                </Button>
              )}
            </div>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Έχεις ήδη λογαριασμό;{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Σύνδεση
            </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Stepper({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="mt-8 grid grid-cols-4">
        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          return (
            <div key={step.key} className="relative flex min-w-0 flex-col items-center text-center">
              {index < steps.length - 1 && (
                <span className={`absolute left-1/2 top-4 h-0.5 w-full ${index < activeIndex ? "bg-primary" : "bg-muted"}`} />
              )}
              <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs ${isActive ? "bg-primary text-white" : isComplete ? "bg-primary/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className={`mt-2 hidden text-xs sm:block ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{step.title}</span>
            </div>
          );
        })}
    </div>
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
}: {
  account: AccountForm;
  updateAccount: (name: keyof AccountForm, value: string) => void;
  emailStatus: "idle" | "checking" | "available" | "taken";
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
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Ημερομηνία Γέννησης (προαιρετικό)</span>
          <Input
            type="date"
            value={account.dateOfBirth}
            onChange={(event) => updateAccount("dateOfBirth", event.target.value)}
            className="h-12"
          />
        </label>
        <div className="block space-y-2">
          <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">Φύλο (προαιρετικό)</Label>
          <Select
            items={genderOptions}
            value={account.gender}
            onValueChange={(value) => updateAccount("gender", value ?? "")}
          >
            <SelectTrigger className="h-12 w-full">
              <SelectValue placeholder="Επέλεξε..." />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Section>
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
