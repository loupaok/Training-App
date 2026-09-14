"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import type { AuthUser } from "@/types/auth";

type YesNoFlag = "yes" | "no";

interface OnboardingForm {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  activityLevel: string;
  goal: string;
  updateDay: string;
  healthProblem: string;
  medication: string;
  injuries: string;
  surgery: string;
  otherInfo: string;
  trainingExperience: string;
  weeklyTraining: string;
  trainingType: string;
  trainingDuration: string;
  dietType: string;
  mealsPerDay: string;
  allergies: string;
  occupationSchedule: string;
  cycleHistory: string;
  cardioSessionsPerWeek: string;
  sleepSchedule: string;
  currentTrainingPlan: string;
  currentNutritionPlan: string;
  previousPlanHistory: string;
  subscriptionPackage: string;
  paymentMethod: string;
}

interface OnboardingFlags {
  healthProblem: YesNoFlag;
  medication: YesNoFlag;
  injuries: YesNoFlag;
  surgery: YesNoFlag;
  otherInfo: YesNoFlag;
}

interface OnboardingFiles {
  frontPhoto: File | null;
  sidePhoto: File | null;
  backPhoto: File | null;
  trainingPlanPdf: File | null;
  nutritionPlanPdf: File | null;
  previousPlanPdf: File | null;
  bloodTestsPdf: File | null;
}

interface OnboardingSocials {
  instagram: string;
  tiktok: string;
  facebook: string;
  youtube: string;
}

type UpdateForm = (name: keyof OnboardingForm, value: string) => void;
type UpdateFlag = (name: keyof OnboardingFlags, value: YesNoFlag) => void;
type UpdateFile = (name: keyof OnboardingFiles, file: File | null) => void;

const steps: { key: "details" | "questions"; title: string }[] = [
  { key: "details", title: "Στοιχεία" },
  { key: "questions", title: "Ερωτήσεις" },
];

const countryCodes = ["+30", "+357", "+44", "+49", "+1"];
const goals = ["Γράμμωση", "Όγκος", "Απώλεια κιλών", "Συντήρηση", "Αύξηση δύναμης", "Βελτίωση φυσικής κατάστασης"];
const genders = ["Άνδρας", "Γυναίκα", "Άλλο"];
const activityLevels = ["Χαμηλή δραστηριότητα", "Μέτρια δραστηριότητα", "Υψηλή δραστηριότητα", "Πολύ υψηλή δραστηριότητα"];
const updateDays = [
  { value: "1", label: "Δευτέρα" },
  { value: "2", label: "Τρίτη" },
  { value: "3", label: "Τετάρτη" },
  { value: "4", label: "Πέμπτη" },
  { value: "5", label: "Παρασκευή" },
  { value: "6", label: "Σάββατο" },
  { value: "0", label: "Κυριακή" },
];

function splitName(fullName = ""): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "", lastName: parts.slice(1).join(" ") };
}

function ClientOnboardingContent() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const initialName = splitName(user?.fullName || "");
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingForm>({
    firstName: initialName.firstName,
    lastName: initialName.lastName,
    email: user?.email || "",
    countryCode: "+30",
    phone: "",
    dateOfBirth: "",
    gender: "Άνδρας",
    heightCm: "",
    weightKg: "",
    activityLevel: "Μέτρια δραστηριότητα",
    goal: "Γράμμωση",
    updateDay: "1",
    healthProblem: "",
    medication: "",
    injuries: "",
    surgery: "",
    otherInfo: "",
    trainingExperience: "Ναι, 1-2 χρόνια",
    weeklyTraining: "3-4 φορές",
    trainingType: "Βάρη / Μυϊκή ενδυνάμωση",
    trainingDuration: "Περίπου 1.5 χρόνο",
    dietType: "Όχι συγκεκριμένη",
    mealsPerDay: "3 κύρια + 1-2 σνακ",
    allergies: "Καμία",
    occupationSchedule: "",
    cycleHistory: "",
    cardioSessionsPerWeek: "",
    sleepSchedule: "",
    currentTrainingPlan: "",
    currentNutritionPlan: "",
    previousPlanHistory: "",
    subscriptionPackage: "3_months",
    paymentMethod: "bank_transfer",
  });
  const [flags, setFlags] = useState<OnboardingFlags>({
    healthProblem: "no",
    medication: "no",
    injuries: "no",
    surgery: "no",
    otherInfo: "no",
  });
  const [socials, setSocials] = useState<OnboardingSocials>({ instagram: "", tiktok: "", facebook: "", youtube: "" });
  const [files, setFiles] = useState<OnboardingFiles>({
    frontPhoto: null,
    sidePhoto: null,
    backPhoto: null,
    trainingPlanPdf: null,
    nutritionPlanPdf: null,
    previousPlanPdf: null,
    bloodTestsPdf: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeStep = steps[stepIndex];
  const fullName = `${form.firstName} ${form.lastName}`.trim();

  const updateForm: UpdateForm = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  useEffect(() => {
    api
      .get<{ slug: string }[]>("/pricing-plans?active=true")
      .then((plans) => {
        if (plans.length) updateForm("subscriptionPackage", plans[0].slug);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFlag: UpdateFlag = (name, value) => setFlags((current) => ({ ...current, [name]: value }));
  const updateFile: UpdateFile = (name, file) => setFiles((current) => ({ ...current, [name]: file }));

  const validateStep = () => {
    if (activeStep.key === "details") {
      return Boolean(
        form.firstName && form.lastName && form.email && form.phone && form.dateOfBirth && form.heightCm && form.weightKg,
      );
    }
    if (activeStep.key === "questions") return Boolean(form.goal && form.updateDay !== "");
    return true;
  };

  const next = () => {
    setError("");
    if (!validateStep()) {
      setError("Συμπλήρωσε τα απαραίτητα πεδία αυτού του βήματος.");
      return;
    }
    setStepIndex((value) => Math.min(value + 1, steps.length - 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateStep()) {
      setError("Συμπλήρωσε τα απαραίτητα πεδία.");
      return;
    }
    setSaving(true);
    setError("");

    const healthNotes = [
      flags.healthProblem === "yes" ? `Ιατρικό πρόβλημα: ${form.healthProblem}` : "",
      flags.medication === "yes" ? `Φαρμακευτική αγωγή: ${form.medication}` : "",
      flags.injuries === "yes" ? `Τραυματισμοί/πόνοι: ${form.injuries}` : "",
      flags.surgery === "yes" ? `Χειρουργική επέμβαση: ${form.surgery}` : "",
      flags.otherInfo === "yes" ? `Άλλο: ${form.otherInfo}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const socialLinks = Object.entries(socials)
      .filter(([, url]) => url.trim())
      .map(([platform, url]) => ({ platform, url: url.trim() }));

    const data = new FormData();
    Object.entries({
      fullName,
      email: form.email,
      countryCode: form.countryCode,
      phone: form.phone,
      dateOfBirth: form.dateOfBirth,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      goal: form.goal,
      updateDay: form.updateDay,
      healthProblem: healthNotes,
      injuries: form.injuries,
      occupationSchedule: form.occupationSchedule,
      cycleHistory: form.cycleHistory,
      cardioSessionsPerWeek: form.cardioSessionsPerWeek,
      sleepSchedule: form.sleepSchedule,
      currentTrainingPlan: form.currentTrainingPlan,
      currentNutritionPlan: form.currentNutritionPlan,
      previousPlanHistory: form.previousPlanHistory,
      socialLinks: JSON.stringify(socialLinks),
    }).forEach(([key, value]) => data.append(key, value || ""));
    Object.entries(files).forEach(([key, file]) => {
      if (file) data.append(key, file);
    });

    try {
      await api.upload("/clients/me/onboarding", data);
      updateUser({ ...(user as AuthUser), fullName, email: form.email, onboardingCompleted: true });
      router.push("/client-billing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε το ερωτηματολόγιο.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 rounded-xl border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-8 lg:px-10 dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-8 lg:grid-cols-[1fr_520px] lg:items-center">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-red-600 text-xl font-black text-white">
                    K
                  </div>
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-50">COACH PANEL</div>
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500">Client onboarding</div>
                  </div>
                </div>
                <h1 className="text-3xl font-black tracking-normal sm:text-4xl">
                  Καλωσήρθες, {form.firstName || user?.fullName || "φίλε"}!
                </h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                  Για να σου προσφέρουμε την καλύτερη δυνατή εμπειρία, παρακαλούμε συμπλήρωσε τις παρακάτω πληροφορίες.
                </p>
              </div>
              <Stepper activeIndex={stepIndex} />
            </div>
          </header>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-12 dark:border-slate-800 dark:bg-slate-900">
            {activeStep.key === "details" && <DetailsStep form={form} updateForm={updateForm} />}
            {activeStep.key === "questions" && (
              <QuestionsStep
                form={form}
                flags={flags}
                files={files}
                socials={socials}
                updateForm={updateForm}
                updateFlag={updateFlag}
                updateFile={updateFile}
                setSocials={setSocials}
              />
            )}

            <div className="mt-8 flex flex-col gap-4 rounded-xl bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800">
              <div className="flex min-w-0 items-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <span className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <div className="font-black text-slate-700 dark:text-slate-200">Οι πληροφορίες σου είναι ασφαλείς</div>
                  <div>Δεν κοινοποιούνται πουθενά.</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                {stepIndex > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 px-5 font-bold hover:border-red-200 hover:text-red-600"
                    onClick={() => setStepIndex((value) => value - 1)}
                  >
                    Πίσω
                  </Button>
                )}
                {stepIndex < steps.length - 1 ? (
                  <Button type="button" className="h-12 px-8 font-black shadow-lg shadow-red-200" onClick={next}>
                    Συνέχεια →
                  </Button>
                ) : (
                  <Button type="submit" disabled={saving} className="h-12 px-8 font-black shadow-lg shadow-red-200">
                    {saving ? "Αποθήκευση..." : "Συνέχεια στην πληρωμή"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function DetailsStep({ form, updateForm }: { form: OnboardingForm; updateForm: UpdateForm }) {
  return (
    <Section title="Προσωπικά Στοιχεία">
      <div className="grid grid-cols-1 gap-x-9 gap-y-7 lg:grid-cols-2 2xl:grid-cols-3">
        <FormInput label="Όνομα" value={form.firstName} onChange={(value) => updateForm("firstName", value)} required />
        <FormInput label="Επώνυμο" value={form.lastName} onChange={(value) => updateForm("lastName", value)} required />
        <FormInput
          label="Ημερομηνία Γέννησης"
          type="date"
          value={form.dateOfBirth}
          onChange={(value) => updateForm("dateOfBirth", value)}
          required
        />
        <FormInput label="Email" type="email" value={form.email} onChange={(value) => updateForm("email", value)} required />
        <PhoneField
          countryCode={form.countryCode}
          phone={form.phone}
          onCodeChange={(value) => updateForm("countryCode", value)}
          onPhoneChange={(value) => updateForm("phone", value)}
        />
        <FormSelect
          label="Φύλο"
          value={form.gender}
          onChange={(value) => updateForm("gender", value)}
          options={genders.map((item) => ({ value: item, label: item }))}
        />
        <UnitInput label="Ύψος" unit="cm" value={form.heightCm} onChange={(value) => updateForm("heightCm", value)} required />
        <UnitInput label="Βάρος" unit="kg" value={form.weightKg} onChange={(value) => updateForm("weightKg", value)} required />
        <FormSelect
          label="Επίπεδο Δραστηριότητας"
          value={form.activityLevel}
          onChange={(value) => updateForm("activityLevel", value)}
          options={activityLevels.map((item) => ({ value: item, label: item }))}
        />
      </div>
    </Section>
  );
}

function QuestionsStep({
  form,
  flags,
  files,
  socials,
  updateForm,
  updateFlag,
  updateFile,
  setSocials,
}: {
  form: OnboardingForm;
  flags: OnboardingFlags;
  files: OnboardingFiles;
  socials: OnboardingSocials;
  updateForm: UpdateForm;
  updateFlag: UpdateFlag;
  updateFile: UpdateFile;
  setSocials: Dispatch<SetStateAction<OnboardingSocials>>;
}) {
  return (
    <>
      <Section title="Ερωτήσεις Υγείας & Ιστορικό">
        <div className="space-y-7">
          <YesNoQuestion
            label="Έχεις κάποιο ιατρικό πρόβλημα ή πάθηση;"
            name="healthProblem"
            flags={flags}
            onFlagChange={updateFlag}
            value={form.healthProblem}
            onChange={(value) => updateForm("healthProblem", value)}
            placeholder="Αν ναι, περίγραψε το (προαιρετικό)"
          />
          <YesNoQuestion
            label="Παίρνεις κάποια φαρμακευτική αγωγή;"
            name="medication"
            flags={flags}
            onFlagChange={updateFlag}
            value={form.medication}
            onChange={(value) => updateForm("medication", value)}
            placeholder="Αν ναι, ποια; (προαιρετικό)"
          />
          <YesNoQuestion
            label="Έχεις τραυματισμούς ή πόνους που πρέπει να γνωρίζουμε;"
            name="injuries"
            flags={flags}
            onFlagChange={updateFlag}
            value={form.injuries}
            onChange={(value) => updateForm("injuries", value)}
            placeholder="Περιέγραψε τον τραυματισμό ή πόνο"
          />
          <YesNoQuestion
            label="Έχεις κάνει κάποια χειρουργική επέμβαση;"
            name="surgery"
            flags={flags}
            onFlagChange={updateFlag}
            value={form.surgery}
            onChange={(value) => updateForm("surgery", value)}
            placeholder="Αν ναι, πότε και ποια; (προαιρετικό)"
          />
          <YesNoQuestion
            label="Υπάρχει κάτι άλλο που πρέπει να γνωρίζουμε;"
            name="otherInfo"
            flags={flags}
            onFlagChange={updateFlag}
            value={form.otherInfo}
            onChange={(value) => updateForm("otherInfo", value)}
            placeholder="Γράψε κάτι (προαιρετικό)"
          />
        </div>
      </Section>

      <Section title="Εμπειρία & Προπονητικό Ιστορικό">
        <div className="grid gap-6 md:grid-cols-2">
          <FormSelect
            label="Έχεις γυμναστεί συστηματικά στο παρελθόν;"
            value={form.trainingExperience}
            onChange={(value) => updateForm("trainingExperience", value)}
            options={["Όχι", "Ναι, έως 6 μήνες", "Ναι, 1-2 χρόνια", "Ναι, 3+ χρόνια"].map((item) => ({ value: item, label: item }))}
          />
          <FormSelect
            label="Πόσες φορές την εβδομάδα προπονείσαι αυτή τη στιγμή;"
            value={form.weeklyTraining}
            onChange={(value) => updateForm("weeklyTraining", value)}
            options={["0 φορές", "1-2 φορές", "3-4 φορές", "5+ φορές"].map((item) => ({ value: item, label: item }))}
          />
          <FormSelect
            label="Τι είδους προπόνηση έχεις κάνει κυρίως;"
            value={form.trainingType}
            onChange={(value) => updateForm("trainingType", value)}
            options={["Βάρη / Μυϊκή ενδυνάμωση", "Cross training", "Cardio", "Ομαδικά", "Άλλο"].map((item) => ({
              value: item,
              label: item,
            }))}
          />
          <FormSelect
            label="Για πόσο καιρό;"
            value={form.trainingDuration}
            onChange={(value) => updateForm("trainingDuration", value)}
            options={["Λιγότερο από 6 μήνες", "Περίπου 1 χρόνο", "Περίπου 1.5 χρόνο", "2+ χρόνια"].map((item) => ({
              value: item,
              label: item,
            }))}
          />
        </div>
      </Section>

      <Section title="Διατροφή & Συνήθειες">
        <div className="grid gap-6 md:grid-cols-2">
          <FormSelect
            label="Ακολουθείς κάποια συγκεκριμένη διατροφή;"
            value={form.dietType}
            onChange={(value) => updateForm("dietType", value)}
            options={["Όχι συγκεκριμένη", "Υψηλή πρωτεΐνη", "Χορτοφαγική", "Vegan", "Άλλο"].map((item) => ({
              value: item,
              label: item,
            }))}
          />
          <FormSelect
            label="Πόσα γεύματα κάνεις καθημερινά;"
            value={form.mealsPerDay}
            onChange={(value) => updateForm("mealsPerDay", value)}
            options={["1-2 γεύματα", "3 κύρια + 1-2 σνακ", "4-5 γεύματα", "Άλλο"].map((item) => ({ value: item, label: item }))}
          />
          <FormSelect
            label="Έχεις αλλεργίες ή τροφικές δυσανεξίες;"
            value={form.allergies}
            onChange={(value) => updateForm("allergies", value)}
            options={["Καμία", "Λακτόζη", "Γλουτένη", "Ξηροί καρποί", "Άλλο"].map((item) => ({ value: item, label: item }))}
          />
        </div>
      </Section>

      <Section title="Στόχος & Εβδομαδιαίο Update">
        <div className="grid gap-6 md:grid-cols-2">
          <FormSelect
            label="Στόχος"
            value={form.goal}
            onChange={(value) => updateForm("goal", value)}
            options={goals.map((goal) => ({ value: goal, label: goal }))}
          />
          <FormSelect
            label="Ημέρα αποστολής update"
            value={form.updateDay}
            onChange={(value) => updateForm("updateDay", value)}
            options={updateDays}
          />
          <FormTextarea
            label="Επάγγελμα / καθημερινό πρόγραμμα"
            value={form.occupationSchedule}
            onChange={(value) => updateForm("occupationSchedule", value)}
          />
          <FormTextarea label="Πρόγραμμα ύπνου" value={form.sleepSchedule} onChange={(value) => updateForm("sleepSchedule", value)} />
          <FormInput
            label="Πόσες αερόβιες συνεδρίες την εβδομάδα;"
            value={form.cardioSessionsPerWeek}
            onChange={(value) => updateForm("cardioSessionsPerWeek", value)}
          />
          <FormTextarea
            label="Αν έχεις κάνει κύκλο, ποιος ήταν και πότε ολοκληρώθηκε;"
            value={form.cycleHistory}
            onChange={(value) => updateForm("cycleHistory", value)}
          />
        </div>
      </Section>

      <Section title="Φωτογραφίες & Αρχεία">
        <div className="grid gap-5 lg:grid-cols-4">
          <UploadCard
            label="Front"
            hint="Φωτογραφία προόδου"
            accept="image/*"
            file={files.frontPhoto}
            onChange={(file) => updateFile("frontPhoto", file)}
          />
          <UploadCard
            label="Side"
            hint="Προαιρετικά"
            accept="image/*"
            file={files.sidePhoto}
            onChange={(file) => updateFile("sidePhoto", file)}
          />
          <UploadCard
            label="Back"
            hint="Προαιρετικά"
            accept="image/*"
            file={files.backPhoto}
            onChange={(file) => updateFile("backPhoto", file)}
          />
          <UploadCard
            label="Αιματολογικές"
            hint="Προαιρετικό PDF"
            accept="application/pdf"
            file={files.bloodTestsPdf}
            onChange={(file) => updateFile("bloodTestsPdf", file)}
          />
        </div>
      </Section>

      <Section title="Τρέχοντα και προηγούμενα πλάνα">
        <div className="grid gap-5 lg:grid-cols-3">
          <PlanField
            title="Τρέχον πλάνο προπόνησης"
            value={form.currentTrainingPlan}
            onTextChange={(value) => updateForm("currentTrainingPlan", value)}
            file={files.trainingPlanPdf}
            onFileChange={(file) => updateFile("trainingPlanPdf", file)}
          />
          <PlanField
            title="Τρέχον πλάνο διατροφής"
            value={form.currentNutritionPlan}
            onTextChange={(value) => updateForm("currentNutritionPlan", value)}
            file={files.nutritionPlanPdf}
            onFileChange={(file) => updateFile("nutritionPlanPdf", file)}
          />
          <PlanField
            title="Ιστορικό προηγούμενων πλάνων"
            value={form.previousPlanHistory}
            onTextChange={(value) => updateForm("previousPlanHistory", value)}
            file={files.previousPlanPdf}
            onFileChange={(file) => updateFile("previousPlanPdf", file)}
          />
        </div>
      </Section>

      <Section title="Social Media Links">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(["instagram", "tiktok", "facebook", "youtube"] as const).map((platform) => (
            <FormInput
              key={platform}
              label={platform[0].toUpperCase() + platform.slice(1)}
              value={socials[platform]}
              onChange={(value) => setSocials((current) => ({ ...current, [platform]: value }))}
              placeholder="https://..."
            />
          ))}
        </div>
      </Section>
    </>
  );
}

function Stepper({ activeIndex }: { activeIndex: number }) {
  const progress = ((activeIndex + 1) / steps.length) * 100;

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-800">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Step {activeIndex + 1} / {steps.length}
          </div>
          <div className="mt-1 truncate text-sm font-black text-slate-900 dark:text-slate-50">{steps[activeIndex].title}</div>
        </div>
        <div className="shrink-0 text-sm font-black text-red-600">{Math.round(progress)}%</div>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
        <div className="h-full rounded-full bg-red-600 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-3">
        {steps.map((step, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;

          return (
            <div
              key={step.key}
              className={`min-w-0 rounded-lg border px-2 py-2 sm:px-3 sm:py-3 ${
                isActive
                  ? "border-red-200 bg-white shadow-sm dark:border-red-900 dark:bg-slate-900 dark:shadow-none"
                  : isComplete
                    ? "border-emerald-100 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                    : "border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-900/70"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                    isComplete
                      ? "bg-emerald-500 text-white"
                      : isActive
                        ? "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                  }`}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </div>
                <div
                  className={`min-w-0 truncate text-[11px] font-black sm:text-xs ${
                    isActive
                      ? "text-slate-950 dark:text-slate-50"
                      : isComplete
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {step.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="text-lg font-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function YesNoQuestion({
  label,
  name,
  flags,
  onFlagChange,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: keyof OnboardingFlags;
  flags: OnboardingFlags;
  onFlagChange: UpdateFlag;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="text-sm font-black leading-6 text-slate-700 dark:text-slate-200">
          {label} <span className="text-slate-400 dark:text-slate-500">ⓘ</span>
        </div>
        <RadioGroup
          value={flags[name]}
          onValueChange={(value) => onFlagChange(name, value as YesNoFlag)}
          className="flex min-w-[150px] flex-row items-center gap-4 rounded-md bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
            <RadioGroupItem value="yes" />
            <span>Ναι</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
            <RadioGroupItem value="no" />
            <span>Όχι</span>
          </label>
        </RadioGroup>
      </div>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-4 h-12 text-sm font-semibold"
      />
    </div>
  );
}


function FormInput({
  label,
  type = "text",
  value,
  onChange,
  required = false,
  placeholder = "",
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-12 text-sm font-semibold"
      />
    </label>
  );
}

function UnitInput({
  label,
  unit,
  value,
  onChange,
  required = false,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <div className="flex h-12 items-center rounded-md border border-input bg-transparent px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          className="h-auto flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        />
        <span className="ml-3 shrink-0 text-xs font-black text-slate-500 dark:text-slate-400">{unit}</span>
      </div>
    </label>
  );
}

function PhoneField({
  countryCode,
  phone,
  onCodeChange,
  onPhoneChange,
}: {
  countryCode: string;
  phone: string;
  onCodeChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 space-y-2">
      <span className="text-sm font-black text-slate-700">Τηλέφωνο</span>
      <div className="flex h-12 items-center overflow-hidden rounded-md border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Select value={countryCode} onValueChange={(value) => onCodeChange(value ?? "")}>
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
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          required
          className="h-full flex-1 border-0 bg-transparent px-4 shadow-none focus-visible:ring-0"
        />
      </div>
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="block min-w-0 space-y-2">
      <Label className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</Label>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue ?? "")}>
        <SelectTrigger className="h-12 w-full text-sm font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-black text-slate-700 dark:text-slate-200">{label}</span>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-32 text-sm font-semibold" />
    </label>
  );
}

function UploadCard({
  label,
  hint,
  accept,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <Label className="block cursor-pointer flex-col items-start gap-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 hover:border-red-300 dark:border-slate-700 dark:bg-slate-950">
      <span className="text-base font-black text-slate-800 dark:text-slate-200">{label}</span>
      <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">{hint}</span>
      <span className="mt-4 block w-full rounded-md bg-white px-3 py-3 text-sm font-bold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700">
        {file ? file.name : "Επιλογή αρχείου"}
      </span>
      <input type="file" accept={accept} onChange={(event) => onChange(event.target.files?.[0] || null)} className="hidden" />
    </Label>
  );
}

function PlanField({
  title,
  value,
  onTextChange,
  file,
  onFileChange,
}: {
  title: string;
  value: string;
  onTextChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <label className="block space-y-2">
        <span className="text-sm font-black text-slate-700 dark:text-slate-200">{title}</span>
        <Textarea
          value={value}
          onChange={(event) => onTextChange(event.target.value)}
          className="min-h-28 bg-white text-sm font-semibold dark:bg-slate-900"
        />
      </label>
      <div className="mt-4">
        <UploadCard label="PDF πλάνου" hint="Προαιρετικό αρχείο PDF" accept="application/pdf" file={file} onChange={onFileChange} />
      </div>
    </div>
  );
}

export default function ClientOnboardingPage() {
  return (
    <ProtectedRoute>
      <ClientOnboardingContent />
    </ProtectedRoute>
  );
}
