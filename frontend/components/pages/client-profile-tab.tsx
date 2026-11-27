"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle, Pencil, FileText, KeyRound, Download, UserX, ChevronRight, ImageOff,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardLabel, CardValue, CardHint } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResetPasswordDialog } from "@/components/pages/client-detail-page";

// ---------------------------------------------------------------------------
// Types — mirror backend getClientProfile() in backend/src/routes/clients.js
// ---------------------------------------------------------------------------

interface ProfileBasic {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  discordId: string | null;
  discordConnected: boolean;
  howFoundUs: string | null;
  referral: string | null;
}

interface ProfileBody {
  heightCm: number | null;
  bmi: number | null;
  initialWeightKg: number | null;
  initialWeightDate: string | null;
  currentWeightKg: number | null;
  currentWeightDate: string | null;
  weightDeltaFromInitial: number | null;
}

interface ProfileGoal {
  fitnessGoal: string | null;
  targetWeightKg: number | null;
  remainingToGoalKg: number | null;
  activityLevel: string | null;
  timeHorizon: string | null;
  motivation: string | null;
}

interface ProfileQuestionnaireItem {
  questionId: number;
  question: string;
  answer: string | null;
  type: string;
  category: "training" | "nutrition" | "health";
}

interface ProfileHealthFlag {
  type: "injury" | "allergy" | "medication";
  label: string;
  detail: string;
}

interface ProfileSettings {
  updateDayOfWeek: number | null;
  reminderEnabled: boolean;
  coachId: number | null;
  coachName: string | null;
  cycleProtocolVisible: boolean;
  eshopAccess: boolean;
}

interface ProfileFile {
  id: string;
  type: string;
  section: "registration" | "update" | "document";
  source: "coach" | "payment";
  url: string;
  name: string | null;
  createdAt: string | null;
}

interface ProfileAccount {
  memberSince: string | null;
  lastLoginAt: string | null;
  lastLoginDevice: string | null;
  isActive: boolean;
  deletedAt: string | null;
}

interface ProfileAuditEntry {
  id: number | string;
  action: string;
  details: string | null;
  actor: "client" | "coach" | "system";
  createdAt: string | null;
}

interface ClientProfile {
  basic: ProfileBasic;
  body: ProfileBody;
  goal: ProfileGoal;
  questionnaire: ProfileQuestionnaireItem[];
  healthFlags: ProfileHealthFlag[];
  settings: ProfileSettings;
  files: ProfileFile[];
  account: ProfileAccount;
  audit: ProfileAuditEntry[];
}

interface Coach {
  id: number | string;
  full_name: string;
  email: string;
}

const UPDATE_DAYS = [
  { value: 1, label: "Δευ" },
  { value: 2, label: "Τρι" },
  { value: 3, label: "Τετ" },
  { value: 4, label: "Πεμ" },
  { value: 5, label: "Παρ" },
  { value: 6, label: "Σαβ" },
];

const QUESTIONNAIRE_GROUPS = [
  { key: "training" as const, label: "Προπόνηση" },
  { key: "nutrition" as const, label: "Διατροφή" },
  { key: "health" as const, label: "Υγεία & lifestyle" },
];

const GENDER_LABELS: Record<string, string> = { male: "Άνδρας", female: "Γυναίκα", other: "Άλλο" };

function fmtDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("el-GR", { day: "numeric", month: "short" });
}

function fmtDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
}

function fmtWeight(value?: number | null): string {
  return value === null || value === undefined ? "-" : `${Number(value).toFixed(1)} kg`;
}

function toDateInputValue(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function ClientProfileTab({
  clientId,
  canEdit,
  onResetPassword,
  resettingPassword,
  canResetPassword,
  onSetActive,
  togglingActive,
  onOpenActivity,
}: {
  clientId: string;
  canEdit: boolean;
  onResetPassword: (newPassword: string) => Promise<void>;
  resettingPassword: boolean;
  canResetPassword: boolean;
  onSetActive: (active: boolean) => Promise<void>;
  togglingActive: boolean;
  onOpenActivity: () => void;
}) {
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      await api.download(`/clients/${clientId}/export`, `client-${clientId}-export.zip`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Δεν έγινε το export.");
    } finally {
      setExporting(false);
    }
  };

  const load = () => {
    setLoading(true);
    setError("");
    api.get<ClientProfile>(`/clients/${clientId}/profile`)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκε το προφίλ."))
      .finally(() => setLoading(false));
  };

  useEffect(load, [clientId]);

  useEffect(() => {
    api.get<Coach[]>("/coaches").then(setCoaches).catch(() => setCoaches([]));
  }, []);

  if (loading && !profile) {
    return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-5"><Skeleton className="h-48 w-full rounded-[20px]" /><Skeleton className="h-64 w-full rounded-[20px]" /></div>
      <div className="space-y-5"><Skeleton className="h-56 w-full rounded-[20px]" /><Skeleton className="h-56 w-full rounded-[20px]" /></div>
    </div>;
  }

  if (error || !profile) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error || "Δεν βρέθηκαν δεδομένα προφίλ."}</div>;
  }

  const saveSettings = async (patch: Record<string, unknown>, successMessage: string) => {
    const previous = profile;
    try {
      const response = await api.put<{ profile: ClientProfile }>(`/clients/${clientId}/settings`, patch);
      setProfile(response.profile);
      toast.success(successMessage);
    } catch (err) {
      setProfile(previous);
      toast.error(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε η ρύθμιση.");
    }
  };

  return (
    <div className="space-y-5">
      {profile.healthFlags.length > 0 && (
        <Alert className="border-l-amber-500 bg-amber-50 dark:bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-200">Υγεία & περιορισμοί</AlertTitle>
          <AlertDescription>
            <div className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {profile.healthFlags.map((flag) => (
                <p key={flag.type} className="text-sm text-amber-950 dark:text-amber-100"><b>{flag.label}:</b> {flag.detail}</p>
              ))}
            </div>
            <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/70">Φαίνεται και στον builder προπόνησης/διατροφής.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <BasicInfoCard profile={profile} clientId={clientId} canEdit={canEdit} isMobile={isMobile} onSaved={setProfile} />
          <BodyGoalCard profile={profile} clientId={clientId} canEdit={canEdit} isMobile={isMobile} onSaved={setProfile} />
          <QuestionnaireCard questionnaire={profile.questionnaire} isMobile={isMobile} />
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Ρυθμίσεις συνεργασίας</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label className="text-xs font-bold text-muted-foreground">Ημέρα update</Label>
                <ToggleGroup
                  className="mt-2 w-full"
                  value={profile.settings.updateDayOfWeek ? [String(profile.settings.updateDayOfWeek)] : []}
                  onValueChange={(value) => {
                    const day = value[0];
                    if (!day || !canEdit) return;
                    saveSettings({ updateDay: Number(day) }, "Η ημέρα update ενημερώθηκε.");
                  }}
                >
                  {UPDATE_DAYS.map((day) => (
                    <ToggleGroupItem key={day.value} value={String(day.value)} disabled={!canEdit} className="flex-1 data-[pressed]:bg-foreground data-[pressed]:text-background">
                      {day.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <p className="mt-1.5 text-xs text-muted-foreground">Η αλλαγή ενημερώνει τον πελάτη και επηρεάζει τον υπολογισμό εκκρεμοτήτων.</p>
              </div>

              <div>
                <Label className="text-xs font-bold text-muted-foreground">Coach</Label>
                <Select
                  value={profile.settings.coachId ? String(profile.settings.coachId) : undefined}
                  onValueChange={(value) => value && canEdit && saveSettings({ coachId: Number(value) }, "Ο coach ενημερώθηκε.")}
                >
                  <SelectTrigger className="mt-2 h-11 w-full" disabled={!canEdit}>
                    <SelectValue placeholder="Επιλογή coach">{profile.settings.coachName || "—"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((coach) => <SelectItem key={coach.id} value={String(coach.id)}>{coach.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <SettingSwitchRow
                label="Υπενθύμιση update"
                checked={profile.settings.reminderEnabled}
                disabled={!canEdit}
                onChange={(checked) => saveSettings({ reminderEnabled: checked }, `Η υπενθύμιση ${checked ? "ενεργοποιήθηκε" : "απενεργοποιήθηκε"}.`)}
              />
              <SettingSwitchRow
                label="Cycle Protocol ορατό στον πελάτη"
                checked={profile.settings.cycleProtocolVisible}
                disabled={!canEdit}
                onChange={(checked) => saveSettings({ cycleProtocolVisible: checked }, "Η ορατότητα του Cycle Protocol ενημερώθηκε.")}
              />
              <SettingSwitchRow
                label="Πρόσβαση στο eshop"
                checked={profile.settings.eshopAccess}
                disabled={!canEdit}
                onChange={(checked) => saveSettings({ eshopAccess: checked }, "Η πρόσβαση στο eshop ενημερώθηκε.")}
              />
            </CardContent>
          </Card>

          <FilesCard files={profile.files} />

          <Card>
            <CardHeader><CardTitle>Λογαριασμός</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs font-bold text-muted-foreground">Μέλος από</p><p className="mt-1 font-bold">{fmtDate(profile.account.memberSince)}</p></div>
                <div><p className="text-xs font-bold text-muted-foreground">Τελευταία σύνδεση</p><p className="mt-1 font-bold">{fmtDateTime(profile.account.lastLoginAt)}</p></div>
              </div>

              <div className="divide-y rounded-xl border">
                {canResetPassword && (
                  <div className="flex items-center gap-3 p-3">
                    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted"><KeyRound className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 text-sm font-bold">Κωδικός πρόσβασης</span>
                    <ResetPasswordDialog onResetPassword={onResetPassword} resettingPassword={resettingPassword} />
                  </div>
                )}
                <button type="button" disabled={exporting} onClick={() => void exportData()} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/50 disabled:opacity-60">
                  <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-muted"><Download className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Export δεδομένων (GDPR)</span><span className="block text-xs text-muted-foreground">{exporting ? "Προετοιμασία ZIP..." : "Λήψη όλων των δεδομένων σε ZIP"}</span></span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                {canEdit && profile.account.isActive && (
                  <button type="button" onClick={() => setDeactivateOpen(true)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-red-50 dark:hover:bg-red-500/10">
                    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-red-50 text-red-600 dark:bg-red-500/10"><UserX className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 text-sm font-bold text-red-600">Απενεργοποίηση λογαριασμού</span>
                    <ChevronRight className="h-4 w-4 text-red-400" />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          <HistoryCard audit={profile.audit} onOpenActivity={onOpenActivity} />
        </div>
      </div>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Απενεργοποίηση λογαριασμού;</AlertDialogTitle>
            <AlertDialogDescription>Ο πελάτης δεν θα διαγραφεί — μπορείς να τον ενεργοποιήσεις ξανά όποτε θες.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction
              disabled={togglingActive}
              onClick={async () => { await onSetActive(false); setDeactivateOpen(false); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {togglingActive ? "Απενεργοποίηση..." : "Απενεργοποίηση"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingSwitchRow({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-sm font-bold">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Βασικά στοιχεία
// ---------------------------------------------------------------------------

function BasicInfoCard({ profile, clientId, canEdit, isMobile, onSaved }: { profile: ClientProfile; clientId: string; canEdit: boolean; isMobile: boolean; onSaved: (profile: ClientProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    fullName: profile.basic.fullName || "",
    email: profile.basic.email || "",
    phone: profile.basic.phone || "",
    dateOfBirth: toDateInputValue(profile.basic.dateOfBirth),
    gender: profile.basic.gender || "",
    city: profile.basic.city || "",
    discordId: profile.basic.discordId || "",
  }));

  const openSheet = () => {
    setForm({
      fullName: profile.basic.fullName || "",
      email: profile.basic.email || "",
      phone: profile.basic.phone || "",
      dateOfBirth: toDateInputValue(profile.basic.dateOfBirth),
      gender: profile.basic.gender || "",
      city: profile.basic.city || "",
      discordId: profile.basic.discordId || "",
    });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.put<{ profile: ClientProfile }>(`/clients/${clientId}/profile`, form);
      onSaved(response.profile);
      toast.success("Τα βασικά στοιχεία ενημερώθηκαν.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Βασικά στοιχεία</CardTitle>
          <CardDescription>από την εγγραφή · ο πελάτης τα αλλάζει από το προφίλ του</CardDescription>
        </div>
        {canEdit && <Button type="button" variant="outline" size="sm" onClick={openSheet}><Pencil className="mr-1.5 h-3.5 w-3.5" />Επεξεργασία</Button>}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ονοματεπώνυμο" value={profile.basic.fullName} />
          <Field label="Email" value={profile.basic.email} />
          <Field label="Τηλέφωνο" value={profile.basic.phone} />
          <Field label="Ημ. γέννησης" value={profile.basic.dateOfBirth ? `${fmtDate(profile.basic.dateOfBirth)}${profile.basic.age !== null ? ` · ${profile.basic.age} ετών` : ""}` : null}>
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400">🎂 +1.500 πόντοι</span>
          </Field>
          <Field label="Φύλο" value={profile.basic.gender ? GENDER_LABELS[profile.basic.gender] || profile.basic.gender : null} />
          <Field label="Πόλη" value={profile.basic.city} />
          <Field label="Discord" value={profile.basic.discordId || (profile.basic.discordConnected ? "Συνδεδεμένο" : null)} placeholder="— δεν έχει συνδεθεί" />
          <Field label="Πώς μας βρήκε" value={profile.basic.referral ? `Σύσταση · ${profile.basic.referral}` : profile.basic.howFoundUs} />
        </div>
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[85vh] w-full" : "w-full sm:max-w-md")}>
          <SheetHeader><SheetTitle>Επεξεργασία βασικών στοιχείων</SheetTitle></SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5"><Label>Ονοματεπώνυμο</Label><Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Τηλέφωνο</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Ημερομηνία γέννησης</Label><Input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Φύλο</Label>
              <Select items={[{ value: "male", label: "Άνδρας" }, { value: "female", label: "Γυναίκα" }, { value: "other", label: "Άλλο" }]} value={form.gender} onValueChange={(value) => setForm((f) => ({ ...f, gender: value || "" }))}>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Επιλογή" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Άνδρας</SelectItem>
                  <SelectItem value="female">Γυναίκα</SelectItem>
                  <SelectItem value="other">Άλλο</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Πόλη</Label><Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Discord</Label><Input value={form.discordId} onChange={(e) => setForm((f) => ({ ...f, discordId: e.target.value }))} /></div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

function Field({ label, value, placeholder = "-", children }: { label: string; value?: string | number | null; placeholder?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-bold">{value || placeholder}{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Σώμα & στόχος
// ---------------------------------------------------------------------------

function BodyGoalCard({ profile, clientId, canEdit, isMobile, onSaved }: { profile: ClientProfile; clientId: string; canEdit: boolean; isMobile: boolean; onSaved: (profile: ClientProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ fitnessGoal: profile.goal.fitnessGoal || "", targetWeightKg: profile.goal.targetWeightKg?.toString() || "" });

  const openSheet = () => {
    setForm({ fitnessGoal: profile.goal.fitnessGoal || "", targetWeightKg: profile.goal.targetWeightKg?.toString() || "" });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.put<{ profile: ClientProfile }>(`/clients/${clientId}/profile`, {
        fitnessGoal: form.fitnessGoal,
        targetWeightKg: form.targetWeightKg === "" ? null : Number(form.targetWeightKg),
      });
      onSaved(response.profile);
      toast.success("Ο στόχος ενημερώθηκε.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>Σώμα & στόχος</CardTitle>
        {canEdit && <Button type="button" variant="outline" size="sm" onClick={openSheet}><Pencil className="mr-1.5 h-3.5 w-3.5" />Επεξεργασία</Button>}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card variant="stat" className="p-4"><CardLabel>Ύψος</CardLabel><CardValue>{profile.body.heightCm ? `${profile.body.heightCm} cm` : "-"}</CardValue><CardHint>{profile.body.bmi ? `BMI ${profile.body.bmi}` : ""}</CardHint></Card>
          <Card variant="stat" className="p-4"><CardLabel>Αρχικό βάρος</CardLabel><CardValue>{fmtWeight(profile.body.initialWeightKg)}</CardValue><CardHint>{fmtDate(profile.body.initialWeightDate)}</CardHint></Card>
          <Card variant="stat" className="p-4"><CardLabel>Τρέχον</CardLabel><CardValue>{fmtWeight(profile.body.currentWeightKg)}</CardValue><CardHint>{profile.body.weightDeltaFromInitial !== null ? `${profile.body.weightDeltaFromInitial > 0 ? "+" : ""}${profile.body.weightDeltaFromInitial} kg` : ""}</CardHint></Card>
          <Card variant="lime" className="gap-1 p-4"><CardLabel>Στόχος</CardLabel><CardValue>{fmtWeight(profile.goal.targetWeightKg)}</CardValue><CardHint>{profile.goal.remainingToGoalKg !== null ? `μένουν ${Math.abs(profile.goal.remainingToGoalKg)} kg` : ""}</CardHint></Card>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Κύριος στόχος" value={profile.goal.fitnessGoal} />
          <Field label="Δραστηριότητα" value={profile.goal.activityLevel} />
          <Field label="Χρονικός ορίζοντας" value={profile.goal.timeHorizon} />
          <Field label="Κίνητρο" value={profile.goal.motivation} />
        </div>
      </CardContent>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[85vh] w-full" : "w-full sm:max-w-md")}>
          <SheetHeader><SheetTitle>Επεξεργασία στόχου</SheetTitle></SheetHeader>
          <div className="space-y-4 p-4">
            <div className="space-y-1.5"><Label>Κύριος στόχος</Label><Input value={form.fitnessGoal} onChange={(e) => setForm((f) => ({ ...f, fitnessGoal: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Στόχος βάρους (kg)</Label><Input type="number" step="0.1" value={form.targetWeightKg} onChange={(e) => setForm((f) => ({ ...f, targetWeightKg: e.target.value }))} /></div>
          </div>
          <SheetFooter>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Αποθήκευση..." : "Αποθήκευση"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ερωτηματολόγιο εγγραφής
// ---------------------------------------------------------------------------

function QuestionnaireCard({ questionnaire, isMobile }: { questionnaire: ProfileQuestionnaireItem[]; isMobile: boolean }) {
  const [fullFormOpen, setFullFormOpen] = useState(false);
  const grouped = useMemo(() => {
    return QUESTIONNAIRE_GROUPS.map((group) => ({
      ...group,
      items: questionnaire.filter((item) => item.category === group.key),
    }));
  }, [questionnaire]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Ερωτηματολόγιο εγγραφής</CardTitle>
          <CardDescription>μόνο ανάγνωση</CardDescription>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setFullFormOpen(true)}>Πλήρης φόρμα</Button>
      </CardHeader>
      <CardContent>
        <Accordion key={isMobile ? "mobile" : "desktop"} defaultValue={isMobile ? ["training"] : ["training", "nutrition"]}>
          {grouped.map((group) => (
            <AccordionItem key={group.key} value={group.key}>
              <AccordionTrigger>
                <span className="flex items-center gap-2 text-sm font-extrabold">{group.label}<Badge variant="outline">{group.items.length} απαντήσεις</Badge></span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="divide-y rounded-xl border">
                  {group.items.length === 0 && <p className="p-3 text-sm text-muted-foreground">Δεν υπάρχουν απαντήσεις.</p>}
                  {group.items.map((item) => (
                    <div key={item.questionId} className="flex items-start justify-between gap-4 p-3 text-sm">
                      <span className="text-muted-foreground">{item.question}</span>
                      <span className="max-w-[55%] text-right font-bold">{item.answer || "-"}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>

      <Dialog open={fullFormOpen} onOpenChange={setFullFormOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Πλήρης φόρμα εγγραφής</DialogTitle></DialogHeader>
          <div className="divide-y rounded-xl border">
            {questionnaire.map((item) => (
              <div key={item.questionId} className="p-3 text-sm">
                <p className="text-muted-foreground">{item.question}</p>
                <p className="mt-1 font-bold">{item.answer || "-"}</p>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Αρχεία & φωτογραφίες
// ---------------------------------------------------------------------------

const PHOTO_FILTERS = [
  { key: "all" as const, label: "Όλα" },
  { key: "registration" as const, label: "Εγγραφή" },
  { key: "update" as const, label: "Updates" },
];

function FilesCard({ files }: { files: ProfileFile[] }) {
  const [photoFilter, setPhotoFilter] = useState<(typeof PHOTO_FILTERS)[number]["key"]>("all");
  const [preview, setPreview] = useState<ProfileFile | null>(null);

  const photos = useMemo(() => files.filter((f) => f.type === "photo" || f.type === "video"), [files]);
  const documents = useMemo(() => files.filter((f) => f.type !== "photo" && f.type !== "video"), [files]);

  const photoCounts = useMemo(() => {
    const result: Record<string, number> = { all: photos.length };
    for (const section of ["registration", "update"] as const) result[section] = photos.filter((f) => f.section === section).length;
    return result;
  }, [photos]);

  const visiblePhotos = photoFilter === "all" ? photos : photos.filter((f) => f.section === photoFilter);

  const photoGroups = useMemo(() => {
    const groups = new Map<string, ProfileFile[]>();
    for (const photo of visiblePhotos) {
      const key = photo.section === "registration" ? "Εγγραφή" : fmtDate(photo.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }
    return Array.from(groups.entries());
  }, [visiblePhotos]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Αρχεία & φωτογραφίες</CardTitle>
        <CardDescription>μόνο για coach / admin</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="photos">
          <TabsList className="w-full">
            <TabsTrigger value="photos">Φωτογραφίες <Badge variant="outline" className="ml-1">{photos.length}</Badge></TabsTrigger>
            <TabsTrigger value="documents">Αρχεία <Badge variant="outline" className="ml-1">{documents.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent value="photos" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {PHOTO_FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPhotoFilter(item.key)}
                  className={cn("h-8 rounded-full px-3 text-xs font-extrabold transition-colors", photoFilter === item.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70")}
                >
                  {item.label} {photoCounts[item.key] ?? 0}
                </button>
              ))}
            </div>

            {photoGroups.length === 0 && <p className="text-sm text-muted-foreground">Δεν υπάρχουν φωτογραφίες.</p>}

            {photoGroups.map(([group, items]) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">{group} <span className="text-muted-foreground/70">· {items.length}</span></p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <button key={item.id} type="button" onClick={() => setPreview(item)} className="group relative h-16 w-16 overflow-hidden rounded-lg border bg-muted">
                      {item.type === "photo" ? (
                        <img src={resolveMediaUrl(item.url)} alt="" className={cn("h-full w-full object-cover", item.section === "registration" && "grayscale")} />
                      ) : <span className="grid h-full w-full place-items-center"><ImageOff className="h-4 w-4 text-muted-foreground" /></span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="documents" className="pt-4">
            {documents.length === 0 ? <p className="text-sm text-muted-foreground">Δεν υπάρχουν αρχεία.</p> : (
              <div className="divide-y rounded-xl border">
                {documents.map((doc) => (
                  <a key={doc.id} href={resolveMediaUrl(doc.url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/50">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-muted"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{doc.name || "Αρχείο"}</span><span className="block text-xs text-muted-foreground">{fmtDate(doc.createdAt)}</span></span>
                    <Badge variant="outline">{doc.source === "payment" ? "πληρωμή" : "coach"}</Badge>
                  </a>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl p-2 sm:max-w-3xl">
          {preview?.type === "photo" && <img src={resolveMediaUrl(preview.url)} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Ιστορικό αλλαγών
// ---------------------------------------------------------------------------

function HistoryCard({ audit, onOpenActivity }: { audit: ProfileAuditEntry[]; onOpenActivity: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Ιστορικό αλλαγών</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={onOpenActivity}>Όλο</Button>
      </CardHeader>
      <CardContent>
        {audit.length === 0 ? <p className="text-sm text-muted-foreground">Δεν υπάρχουν αλλαγές ακόμα.</p> : (
          <div className="space-y-4">
            {audit.slice(0, 3).map((entry) => (
              <div key={entry.id} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.actor === "coach" ? "Coach" : entry.actor === "client" ? "Πελάτης" : "Σύστημα"} · {fmtDate(entry.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
