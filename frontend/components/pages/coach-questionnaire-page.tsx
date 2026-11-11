"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, X, Link2, Star, Settings2, Trophy, Trash2 } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { CoachUpdateFormBuilder } from "@/components/pages/coach-update-form-builder";

type QuestionType =
  | "single_select"
  | "multi_select"
  | "text"
  | "number"
  | "textarea"
  | "url"
  | "rating"
  | "photos"
  | "pdf";

interface Question {
  id: number;
  question: string;
  type: QuestionType;
  options: string[];
  isRequired: boolean;
  placeholder: string;
  helpText: string;
  allowPhotos: boolean;
  maxPhotos: number;
  allowPdf: boolean;
  sortOrder: number;
  isActive: boolean;
  standardKey: string | null;
  section: "weight" | "nutrition_training" | "sleep_recovery" | "health_week" | "photos";
}

interface TypeOption {
  value: QuestionType;
  label: string;
}

interface StandardKeyOption {
  value: string;
  label: string;
}

interface QuestionEndpoints {
  manage: string;
  create: string;
  update: (id: number) => string;
  remove: (id: number) => string;
  reorder: string;
}

interface UpdateScoreTier {
  id?: number;
  minScore: number;
  maxScore: number;
  title: string;
  message: string;
  sortOrder?: number;
}

interface UpdateBuilderSettings {
  deadlineTime: string;
  reminder: string;
  photosRequired: boolean;
  showScoreToClient: boolean;
  autosave: boolean;
  scoreNote: string;
}

const emptyQuestion: Question = {
  id: 0,
  question: "",
  type: "single_select",
  options: ["Επιλογή 1"],
  isRequired: true,
  placeholder: "",
  helpText: "",
  allowPhotos: false,
  maxPhotos: 4,
  allowPdf: false,
  sortOrder: 0,
  isActive: true,
  standardKey: null,
  section: "health_week",
};

const registrationTypeOptions: TypeOption[] = [
  { value: "single_select", label: "Μονή επιλογή" },
  { value: "multi_select", label: "Πολλαπλή επιλογή" },
  { value: "text", label: "Σύντομο κείμενο" },
  { value: "number", label: "Αριθμός" },
  { value: "textarea", label: "Μεγάλο κείμενο" },
  { value: "url", label: "Σύνδεσμος URL" },
];

const updateTypeOptions: TypeOption[] = [
  ...registrationTypeOptions,
  { value: "rating", label: "Αξιολόγηση (⭐ 1-5)" },
  { value: "photos", label: "Φωτογραφίες" },
  { value: "pdf", label: "PDF" },
];

const registrationEndpoints: QuestionEndpoints = {
  manage: "/questionnaire/manage",
  create: "/questionnaire/questions",
  update: (id) => `/questionnaire/questions/${id}`,
  remove: (id) => `/questionnaire/questions/${id}`,
  reorder: "/questionnaire/questions/reorder",
};

const updateEndpoints: QuestionEndpoints = {
  manage: "/updates/questions/manage",
  create: "/updates/questions",
  update: (id) => `/updates/questions/${id}`,
  remove: (id) => `/updates/questions/${id}`,
  reorder: "/updates/questions/reorder",
};

// A "standard" question is the one the app reads for a specific meaning
// (e.g. the client's weekly weight) instead of guessing from the question's
// type or wording — at most one question per set can hold a given key.
const registrationStandardKeyOptions: StandardKeyOption[] = [];

const updateStandardKeyOptions: StandardKeyOption[] = [
  { value: "weight_kg", label: "Κιλά (Βάρος)" },
  { value: "diet_score", label: "Βαθμολογία διατροφής" },
  { value: "diet_changes", label: "Αποκλίσεις διατροφής" },
  { value: "training_score", label: "Βαθμολογία προπόνησης" },
  { value: "training_notes", label: "Σημειώσεις προπόνησης" },
  { value: "sleep_quality", label: "Ποιότητα ύπνου" },
  { value: "recovery", label: "Αποκατάσταση" },
  { value: "health_changed", label: "Αλλαγή υγείας" },
  { value: "health_details", label: "Λεπτομέρειες υγείας" },
  { value: "next_week", label: "Ανάγκες επόμενης εβδομάδας" },
  { value: "coach_note", label: "Σημείωση προς τον coach" },
];

const updateSectionOptions: { value: Question["section"]; label: string }[] = [
  { value: "weight", label: "Βήμα 1 · Βάρος & δραστηριότητα" },
  { value: "nutrition_training", label: "Βήμα 2 · Διατροφή & προπόνηση" },
  { value: "sleep_recovery", label: "Βήμα 3 · Ύπνος & αποκατάσταση" },
  { value: "health_week", label: "Βήμα 4 · Υγεία & επόμενη εβδομάδα" },
  { value: "photos", label: "Βήμα 5 · Φωτογραφίες" },
];

function typeLabel(type: QuestionType, typeOptions: TypeOption[]): string {
  return typeOptions.find((option) => option.value === type)?.label || type;
}

function needsOptions(type: QuestionType): boolean {
  return type === "single_select" || type === "multi_select" || type === "url";
}

function needsPlaceholder(type: QuestionType): boolean {
  return type === "text" || type === "number" || type === "textarea";
}

function CoachQuestionnaireContent({ mode }: { mode: "registration" | "update" }) {
  const { user, logout } = useAuth();

  if (!["coach", "admin"].includes(user?.role || "")) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Δεν έχεις πρόσβαση σε αυτή τη σελίδα.
      </div>
    );
  }

  return (
    <CoachShell title={mode === "registration" ? "Ερωτηματολόγιο Εγγραφής" : "Ερωτηματολόγιο Update"} user={user} logout={logout}>
      {mode === "registration" ? (
          <QuestionSetEditor
            title="Ερωτηματολόγιο Εγγραφής"
            subtitle="Οι ερωτήσεις που απαντούν οι νέοι πελάτες κατά την εγγραφή τους."
            typeOptions={registrationTypeOptions}
            endpoints={registrationEndpoints}
            standardKeyOptions={registrationStandardKeyOptions}
          />
      ) : (
          <CoachUpdateFormBuilder />
          /* legacy builder retained below while registration editor is migrated */
          /*
          <Tabs defaultValue="questions" className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h1 className="text-[26px] font-extrabold tracking-[-.5px]">Εβδομαδιαίο update · ερωτηματολόγιο</h1><p className="mt-1 text-sm text-muted-foreground">Ό,τι αλλάζεις εδώ το βλέπει ο πελάτης στο επόμενο update του.</p></div>
              <Badge className="rounded-full bg-foreground px-3 py-1.5 text-[11px] font-extrabold text-accent">Πρόχειρες αλλαγές</Badge>
            </div>
            <TabsList className="h-auto rounded-[14px] bg-muted p-1.5">
              <TabsTrigger value="questions" className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background">Ερωτήσεις</TabsTrigger>
              <TabsTrigger value="score" className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background">Σκορ & μηνύματα</TabsTrigger>
              <TabsTrigger value="settings" className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background">Ρυθμίσεις</TabsTrigger>
            </TabsList>
            <TabsContent value="questions" className="mt-0">
          <UpdateSectionBuilder />
          <QuestionSetEditor
            title="Ερωτηματολόγιο Update"
            subtitle="Οι ερωτήσεις που απαντούν οι πελάτες στο εβδομαδιαίο update τους."
            typeOptions={updateTypeOptions}
            endpoints={updateEndpoints}
            standardKeyOptions={updateStandardKeyOptions}
            sectionOptions={updateSectionOptions}
          />
            </TabsContent>
            <TabsContent value="score" className="mt-0"><UpdateScoreSettings mode="score" /></TabsContent>
            <TabsContent value="settings" className="mt-0"><UpdateScoreSettings mode="settings" /></TabsContent>
          </Tabs>*/
      )}
    </CoachShell>
  );
}

function UpdateSectionBuilder() {
  const [sections, setSections] = useState<{ key: Question["section"]; label: string; sortOrder: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    api.get<{ key: Question["section"]; label: string; sortOrder: number }[]>("/updates/sections/manage").then(setSections).catch(() => setMessage("Δεν φορτώθηκαν τα tabs."))
  }, [])

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    setSections((current) => arrayMove(current, index, target))
  }

  const save = async () => {
    setSaving(true)
    setMessage("")
    try {
      const saved = await api.put<{ key: Question["section"]; label: string; sortOrder: number }[]>("/updates/sections", { sections: sections.map((section) => ({ key: section.key, label: section.label.trim() })) })
      setSections(saved)
      window.dispatchEvent(new CustomEvent("weekly-update-sections-updated", { detail: saved }))
      setMessage("Τα tabs αποθηκεύτηκαν και συγχρονίστηκαν με το update του πελάτη.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Δεν αποθηκεύτηκαν τα tabs.")
    } finally {
      setSaving(false)
    }
  }

  return <section className="mb-6 rounded-[20px] border border-border bg-card p-5 shadow-none"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-[16px] font-extrabold">Tabs εβδομαδιαίου update</h2><p className="mt-1 text-xs text-muted-foreground">Άλλαξε ονομασία ή σειρά. Οι αλλαγές εφαρμόζονται και στη φόρμα του πελάτη.</p></div><Button type="button" variant="lime" className="h-10 rounded-full px-4" onClick={save} disabled={saving || sections.some((section) => !section.label.trim())}><Save className="mr-2 h-4 w-4" />{saving ? "Αποθήκευση…" : "Αποθήκευση tabs"}</Button></div><div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">{sections.map((section, index) => <div key={section.key} className="flex items-center gap-1 rounded-[14px] border border-border bg-muted/35 p-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-xs font-extrabold text-accent">{index + 1}</span><Input value={section.label} onChange={(event) => setSections((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="h-9 min-w-0 border-0 bg-transparent px-2 text-xs font-extrabold shadow-none focus-visible:ring-0" /><span className="flex flex-col"><Button type="button" variant="ghost" size="icon" onClick={() => move(index, -1)} disabled={index === 0} className="h-4 w-5"><ArrowUp className="h-3 w-3" /></Button><Button type="button" variant="ghost" size="icon" onClick={() => move(index, 1)} disabled={index === sections.length - 1} className="h-4 w-5"><ArrowDown className="h-3 w-3" /></Button></span></div>)}</div>{message && <p className="mt-3 text-xs font-bold text-muted-foreground">{message}</p>}</section>
}

function UpdateScoreSettings({ mode }: { mode: "score" | "settings" }) {
  const [settings, setSettings] = useState<UpdateBuilderSettings | null>(null);
  const [tiers, setTiers] = useState<UpdateScoreTier[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get<{ settings: UpdateBuilderSettings; tiers: UpdateScoreTier[] }>("/updates/builder-settings")
      .then((data) => { setSettings(data.settings); setTiers(data.tiers); })
      .catch(() => setMessage("Δεν φορτώθηκαν οι ρυθμίσεις του update."));
  }, []);

  const rangesValid = useMemo(() => {
    const rows = [...tiers].sort((a, b) => a.minScore - b.minScore);
    return rows.length > 0 && rows[0]?.minScore === 0 && rows.at(-1)?.maxScore === 100
      && rows.every((tier, index) => tier.minScore <= tier.maxScore && (index === 0 || tier.minScore === rows[index - 1].maxScore + 1));
  }, [tiers]);
  const updateTier = (index: number, key: keyof UpdateScoreTier, value: string | number) => setTiers((current) => current.map((tier, currentIndex) => currentIndex === index ? { ...tier, [key]: value } : tier));
  const save = async () => {
    if (!settings || !rangesValid) return;
    setSaving(true); setMessage("");
    try {
      await api.put("/updates/builder-settings", { settings, tiers });
      setMessage("Οι ρυθμίσεις αποθηκεύτηκαν.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Δεν αποθηκεύτηκαν οι ρυθμίσεις."); }
    finally { setSaving(false); }
  };
  if (!settings) return <div className="rounded-[20px] border border-border bg-card p-6 text-sm text-muted-foreground">Φόρτωση ρυθμίσεων…</div>;

  if (mode === "score") return <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)]">
    <div className="rounded-[20px] border border-border bg-card p-5 sm:p-[22px]">
      <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-[12px] bg-foreground text-accent"><Trophy className="size-5" /></span><div><h2 className="text-[17px] font-extrabold">Σκορ εβδομάδας & μηνύματα</h2><p className="mt-1 text-xs text-muted-foreground">Τα ranges πρέπει να καλύπτουν συνεχόμενα το 0–100.</p></div></div>
      <div className="mt-5 space-y-3">{tiers.map((tier, index) => <div key={`${tier.id ?? "new"}-${index}`} className="grid gap-2 rounded-[14px] border border-border p-3 sm:grid-cols-[104px_minmax(130px,.7fr)_minmax(0,1.6fr)_auto] sm:items-center">
        <div className="flex items-center gap-1"><Input type="number" min={0} max={100} value={tier.minScore} onChange={(event) => updateTier(index, "minScore", Number(event.target.value))} className="h-10 w-[46px] px-1 text-center" /><span className="text-muted-foreground">–</span><Input type="number" min={0} max={100} value={tier.maxScore} onChange={(event) => updateTier(index, "maxScore", Number(event.target.value))} className="h-10 w-[46px] px-1 text-center" /></div>
        <Input value={tier.title} onChange={(event) => updateTier(index, "title", event.target.value)} className="h-10 text-sm font-bold" />
        <Input value={tier.message} onChange={(event) => updateTier(index, "message", event.target.value)} className="h-10 text-sm" />
        <Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" disabled={tiers.length === 1} onClick={() => setTiers((current) => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="size-4" /></Button>
      </div>)}</div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" variant="outline" className="rounded-full" onClick={() => setTiers((current) => [...current, { minScore: 0, maxScore: 0, title: "Νέο εύρος", message: "Μήνυμα αξιολόγησης" }])}><Plus className="mr-1 size-4" />Νέο εύρος</Button><span className={cn("text-xs font-bold", rangesValid ? "text-emerald-700" : "text-destructive")}>{rangesValid ? "✓ Τα εύρη καλύπτουν 0–100 χωρίς κενά" : "Συμπλήρωσε ranges 0–100 χωρίς κενά ή επικαλύψεις."}</span></div>
      <Label className="mt-5 flex flex-col items-start gap-2 text-sm font-bold">Σταθερό κείμενο κάτω από το σκορ<Textarea value={settings.scoreNote || ""} onChange={(event) => setSettings((current) => current ? { ...current, scoreNote: event.target.value } : current)} className="min-h-24 text-sm font-normal" /></Label>
    </div>
    <div className="rounded-[20px] border border-border bg-muted/45 p-5"><h3 className="text-[15px] font-extrabold">Τύπος υπολογισμού</h3><p className="mt-3 rounded-[14px] bg-card p-3 text-xs leading-5 text-muted-foreground">σκορ = Σ(απάντηση × βάρος) ÷ Σ(5 × βάρος) × 100. Μετράνε μόνο οι κλίμακες 1–5 που έχουν ενεργοποιημένο το σκορ.</p><p className="mt-4 text-xs leading-5 text-muted-foreground">Οι ερωτήσεις που μετρούν επισημαίνονται στον builder με badge «Σκορ».</p><Button type="button" variant="lime" className="mt-5 h-11 w-full rounded-full font-extrabold" disabled={saving || !rangesValid} onClick={save}><Save className="mr-2 size-4" />{saving ? "Αποθήκευση…" : "Αποθήκευση"}</Button>{message && <p className="mt-3 text-xs font-bold text-muted-foreground">{message}</p>}</div>
  </section>;

  const reminderItems = [{ value: "same_day_10", label: "Την ίδια ημέρα 10:00" }, { value: "day_before", label: "Μία ημέρα πριν" }, { value: "none", label: "Χωρίς υπενθύμιση" }];
  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><div className="rounded-[20px] border border-border bg-card p-5 sm:p-[22px]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[12px] bg-foreground text-accent"><Settings2 className="size-5" /></span><div><h2 className="text-[17px] font-extrabold">Ρυθμίσεις update</h2><p className="mt-1 text-xs text-muted-foreground">Οι ημέρες update ορίζονται στα στοιχεία του κάθε πελάτη.</p></div></div><div className="mt-5 divide-y divide-border"><Label className="flex items-center justify-between gap-4 py-4 text-sm font-extrabold">Προθεσμία <Input type="time" value={settings.deadlineTime} onChange={(event) => setSettings({ ...settings, deadlineTime: event.target.value })} className="h-10 w-28" /></Label><Label className="flex items-center justify-between gap-4 py-4 text-sm font-extrabold">Υπενθύμιση<Select items={reminderItems} value={settings.reminder} onValueChange={(value) => value && setSettings({ ...settings, reminder: value })}><SelectTrigger className="h-10 w-[180px]"><SelectValue /></SelectTrigger><SelectContent>{reminderItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Label><SettingSwitch label="Φωτογραφίες υποχρεωτικές" description="Ο πελάτης δεν υποβάλλει χωρίς φωτογραφίες." checked={settings.photosRequired} onChange={(value) => setSettings({ ...settings, photosRequired: value })} /><SettingSwitch label="Δείξε σκορ στον πελάτη" description="Αλλιώς το σκορ εμφανίζεται μόνο στον coach." checked={settings.showScoreToClient} onChange={(value) => setSettings({ ...settings, showScoreToClient: value })} /><SettingSwitch label="Αυτόματη αποθήκευση πρόχειρου" description="Ο πελάτης συνεχίζει από εκεί που σταμάτησε." checked={settings.autosave} onChange={(value) => setSettings({ ...settings, autosave: value })} /></div></div><div className="rounded-[20px] border border-border bg-card p-5"><h3 className="text-[15px] font-extrabold">Πόντοι</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Οι πόντοι έρχονται από Πόντοι & Rewards και δεν αλλάζουν από εδώ.</p><div className="mt-4 flex gap-2"><Badge className="bg-foreground text-accent">Έγκαιρο update</Badge><Badge className="bg-accent text-accent-foreground">Bonus 4 συνεχόμενων</Badge></div><Button type="button" variant="lime" className="mt-6 h-11 w-full rounded-full font-extrabold" disabled={saving} onClick={save}><Save className="mr-2 size-4" />{saving ? "Αποθήκευση…" : "Αποθήκευση ρυθμίσεων"}</Button>{message && <p className="mt-3 text-xs font-bold text-muted-foreground">{message}</p>}</div></section>;
}

function SettingSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-4 py-4"><span><b className="block text-sm">{label}</b><small className="mt-1 block text-xs text-muted-foreground">{description}</small></span><Switch checked={checked} onCheckedChange={(value) => onChange(value === true)} /></div>;
}

function QuestionSetEditor({
  title,
  subtitle,
  typeOptions,
  endpoints,
  standardKeyOptions,
  sectionOptions,
}: {
  title: string;
  subtitle: string;
  typeOptions: TypeOption[];
  endpoints: QuestionEndpoints;
  standardKeyOptions: StandardKeyOption[];
  sectionOptions?: { value: Question["section"]; label: string }[];
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<Question["section"]>(sectionOptions?.[0]?.value || "health_week");
  const [configuredSections, setConfiguredSections] = useState(sectionOptions || []);

  const selectedQuestion = useMemo(() => questions.find((item) => item.id === selectedId) || null, [questions, selectedId]);
  const visibleQuestions = useMemo(() => configuredSections.length ? questions.filter((item) => item.section === activeSection) : questions, [questions, configuredSections, activeSection]);
  const isLockedStandardQuestion = Boolean(form.standardKey);
  const standardKeyLabel = standardKeyOptions.find((option) => option.value === form.standardKey)?.label || (form.standardKey ? "Επιλεγμένο standard πεδίο" : "Κανένα");
  const activeCount = questions.filter((item) => item.isActive).length;
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sectionOptions) return;
    const applySections = (rows: { key: Question["section"]; label: string; sortOrder: number }[]) => {
        const next = rows.map((row) => ({ value: row.key, label: row.label }));
        setConfiguredSections(next);
        if (next[0]) setActiveSection(next[0].value);
    };
    api.get<{ key: Question["section"]; label: string; sortOrder: number }[]>("/updates/sections/manage").then(applySections).catch(() => undefined);
    const listener = (event: Event) => applySections((event as CustomEvent<{ key: Question["section"]; label: string; sortOrder: number }[]>).detail);
    window.addEventListener("weekly-update-sections-updated", listener);
    return () => window.removeEventListener("weekly-update-sections-updated", listener);
  }, [sectionOptions]);

  useEffect(() => {
    if (selectedQuestion) setForm(selectedQuestion);
  }, [selectedQuestion]);

  const loadQuestions = async () => {
    try {
      const rows = await api.get<Question[]>(endpoints.manage);
      setQuestions(rows);
      if (rows.length && selectedId === null) {
        setSelectedId(rows[0].id);
        setForm(rows[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ερωτήσεις.");
    }
  };

  const update = <K extends keyof Question>(key: K, value: Question[K]) => setForm((current) => ({ ...current, [key]: value }));

  const updateOption = (index: number, value: string) => update("options", form.options.map((option, i) => (i === index ? value : option)));
  const removeOption = (index: number) => update("options", form.options.filter((_, i) => i !== index));
  const addOption = () => update("options", [...form.options, `Επιλογή ${form.options.length + 1}`]);

  const buildPayload = (source: Question) => ({
    question: source.question,
    type: source.type,
    options: needsOptions(source.type) ? source.options.filter((option) => option.trim()) : null,
    isRequired: source.isRequired,
    placeholder: source.placeholder,
    helpText: source.helpText,
    allowPhotos: source.allowPhotos,
    maxPhotos: source.maxPhotos,
    allowPdf: source.allowPdf,
    sortOrder: source.sortOrder,
    isActive: source.isActive,
    standardKey: source.standardKey,
    section: source.section,
  });

  const saveQuestion = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = form.id
        ? await api.put<Question>(endpoints.update(form.id), buildPayload(form))
        : await api.post<Question>(endpoints.create, buildPayload(form));
      setMessage("Η ερώτηση αποθηκεύτηκε.");
      await loadQuestions();
      setSelectedId(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε η ερώτηση.");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await api.delete(endpoints.remove(form.id));
      setMessage("Η ερώτηση διαγράφηκε.");
      setSelectedId(null);
      setForm(emptyQuestion);
      await loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν διαγράφηκε η ερώτηση.");
    } finally {
      setSaving(false);
    }
  };

  const newQuestion = () => {
    setSelectedId(null);
    setForm({ ...emptyQuestion, section: activeSection, sortOrder: questions.length });
  };

  const toggleActive = async (targetQuestion: Question, nextActive: boolean) => {
    if (targetQuestion.standardKey) return;
    setQuestions((current) => current.map((item) => (item.id === targetQuestion.id ? { ...item, isActive: nextActive } : item)));
    if (selectedId === targetQuestion.id) update("isActive", nextActive);
    try {
      await api.put(endpoints.update(targetQuestion.id), buildPayload({ ...targetQuestion, isActive: nextActive }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν ενημερώθηκε η κατάσταση.");
      await loadQuestions();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = visibleQuestions.map((item) => String(item.id));
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedSection = arrayMove(visibleQuestions, oldIndex, newIndex);
    let sectionIndex = 0;
    const reordered = questions.map((item) => item.section === activeSection ? reorderedSection[sectionIndex++] : item);
    setQuestions(reordered);
    try {
      await api.put(endpoints.reorder, { ids: reordered.map((item) => item.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε η σειρά.");
      await loadQuestions();
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold">{title}</h2>
            <Badge variant="outline" className="h-auto rounded-full px-3 py-1 text-xs font-bold">
              {activeCount} ενεργές ερωτήσεις
            </Badge>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPreviewOpen(true)}
            className="h-11 px-5 font-bold text-slate-700 dark:text-slate-200"
          >
            Προεπισκόπηση
          </Button>
          <Button onClick={newQuestion} className="h-11 gap-1.5 px-5 font-bold">
            <Plus className="h-4 w-4" />
            Νέα Ερώτηση
          </Button>
        </div>
      </div>

      {configuredSections.length > 0 && (
        <Tabs value={activeSection} onValueChange={(value) => value && setActiveSection(value as Question["section"])} className="mb-5">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-[14px] bg-muted p-1.5">
            {configuredSections.map((section) => (
              <TabsTrigger key={section.value} value={section.value} className="h-10 shrink-0 rounded-[10px] px-3 text-xs font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background">
                {section.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-[20px] border border-border bg-card p-3 shadow-none sm:p-4">
        <div className="grid gap-4 xl:grid-cols-[236px_minmax(0,1fr)]">
          <aside className="rounded-[18px] border border-border bg-card p-3 xl:sticky xl:top-5 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
            <h3 className="font-bold">{configuredSections.length ? configuredSections.find((section) => section.value === activeSection)?.label : "Ερωτήσεις"}</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Σύρε για αλλαγή σειράς μέσα σε αυτό το βήμα</p>
            <div className="mt-5">
              <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleQuestions.map((item) => String(item.id))} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {visibleQuestions.map((item) => (
                      <SortableQuestionRow
                        key={item.id}
                        questionItem={item}
                        typeOptions={typeOptions}
                        selected={selectedId === item.id}
                        onSelect={() => { setSelectedId(item.id); setActiveSection(item.section); }}
                        onToggleActive={(next) => toggleActive(item, next)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {!visibleQuestions.length && <p className="mt-4 text-sm font-semibold text-slate-400">Δεν υπάρχουν ερωτήσεις σε αυτό το βήμα ακόμα.</p>}
            </div>
          </aside>

          <div className="min-w-0 overflow-hidden rounded-[18px] border-2 border-foreground bg-card shadow-[0_0_0_4px_rgba(176,249,12,.25)]">
            <div className="mb-0 flex items-center justify-between border-b border-border bg-muted/40 px-4 py-4 sm:px-5">
              <div>
                <p className="text-[10px] font-extrabold tracking-[.12em] text-muted-foreground">
                  ΒΗΜΑ {Math.max(1, configuredSections.findIndex((section) => section.value === form.section) + 1)}
                </p>
                <h3 className="mt-1 text-lg font-extrabold">
                  {configuredSections.find((section) => section.value === form.section)?.label || (form.id ? "Επεξεργασία Ερώτησης" : "Νέα Ερώτηση")}
                </h3>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="outline"
                      disabled={!form.id || saving || isLockedStandardQuestion}
                      className="h-10 px-4 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 disabled:opacity-40 dark:text-slate-200"
                    >
                      Διαγραφή
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Διαγραφή ερώτησης;</AlertDialogTitle>
                    <AlertDialogDescription>
                      Η ερώτηση &ldquo;{form.question}&rdquo; θα αφαιρεθεί από τη φόρμα. Οι ήδη υποβλημένες απαντήσεις διατηρούνται στο ιστορικό των πελατών.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Άκυρο</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteQuestion} className="bg-red-600 hover:bg-red-700">
                      Διαγραφή
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="grid gap-5 p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200 md:col-span-2">
                  Κείμενο Ερώτησης
                  <Textarea value={form.question} onChange={(event) => update("question", event.target.value)} disabled={isLockedStandardQuestion} className="min-h-20" />
                </Label>

                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Τύπος Ερώτησης
                  <Select items={typeOptions} value={form.type} disabled={isLockedStandardQuestion} onValueChange={(value) => value && update("type", value as QuestionType)}>
                    <SelectTrigger className="h-12 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Label>

                {configuredSections.length > 0 && (
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Βήμα εμφάνισης στο εβδομαδιαίο update
                    <Select
                      items={configuredSections}
                      value={form.section || "health_week"}
                      disabled={isLockedStandardQuestion}
                      onValueChange={(value) => value && update("section", value as Question["section"])}
                    >
                      <SelectTrigger className="h-12 w-full">
                          <span data-slot="select-value" className="flex flex-1 text-left">{standardKeyLabel}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {configuredSections.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs font-semibold text-slate-400">Η πρόσθετη ερώτηση θα εμφανίζεται μόνο στο επιλεγμένο βήμα.</span>
                  </Label>
                )}

                {standardKeyOptions.length > 0 && (
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Standard πεδίο
                    <Select
                      items={[{ value: "none", label: "Κανένα" }, ...standardKeyOptions]}
                      value={form.standardKey || "none"}
                      onValueChange={(value) => update("standardKey", value && value !== "none" ? value : null)}
                    >
                      <SelectTrigger className="h-12 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Κανένα</SelectItem>
                        {standardKeyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs font-semibold text-slate-400">
                      Η εφαρμογή χρησιμοποιεί αυτή την ερώτηση για να διαβάζει την τιμή, αντί να μαντεύει βάσει τύπου. Μόνο μία ερώτηση μπορεί να έχει το κάθε standard πεδίο.
                    </span>
                  </Label>
                )}

                <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Επιτρέπει ανέβασμα αρχείων;</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">📷 Φωτογραφίες</span>
                    <Switch checked={form.allowPhotos} disabled={isLockedStandardQuestion} onCheckedChange={(checked) => update("allowPhotos", checked === true)} />
                  </div>
                  {form.allowPhotos && (
                    <div className="flex items-center justify-between gap-3 pl-6">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Μέγιστος αριθμός</span>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={form.maxPhotos}
                        onChange={(event) => update("maxPhotos", Math.min(4, Math.max(1, Number(event.target.value) || 1)))} disabled={isLockedStandardQuestion}
                        className="h-9 w-20"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">📄 PDF</span>
                    <Switch checked={form.allowPdf} disabled={isLockedStandardQuestion} onCheckedChange={(checked) => update("allowPdf", checked === true)} />
                  </div>
                </div>

                {needsOptions(form.type) && (
                  <div>
                    <div className="mb-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {form.type === "url" ? "Επιλογές URL" : "Επιλογές"}
                    </div>
                    {form.type === "url" && (
                      <p className="mb-2 text-xs font-semibold text-slate-400">
                        Πρόσθεσε ετικέτες (π.χ. Instagram, TikTok) για να εμφανιστεί ένα ξεχωριστό πεδίο URL για καθεμία. Χωρίς
                        ετικέτες, εμφανίζεται ένα απλό πεδίο URL.
                      </p>
                    )}
                    <div className="space-y-2">
                      {form.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input value={option} onChange={(event) => updateOption(index, event.target.value)} disabled={isLockedStandardQuestion} className="h-10" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                            disabled={isLockedStandardQuestion || (form.type !== "url" && form.options.length <= 1)}
                            className="h-9 w-9 shrink-0 text-slate-400 hover:text-red-600 dark:text-slate-500"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addOption}
                      disabled={isLockedStandardQuestion}
                      className="mt-3 h-10 px-4 text-sm font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200"
                    >
                      {form.type === "url" ? "+ Προσθήκη Επιλογής" : "+ Προσθήκη επιλογής"}
                    </Button>
                  </div>
                )}

                {needsPlaceholder(form.type) && (
                  <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                    Placeholder κειμένου
                    <Input
                      value={form.placeholder}
                      onChange={(event) => update("placeholder", event.target.value)} disabled={isLockedStandardQuestion}
                      placeholder="π.χ. Περίγραψε αν υπάρχουν..."
                    />
                  </Label>
                )}

                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Σημείωση κάτω από την ερώτηση <span className="font-medium text-muted-foreground">(προαιρετικό)</span>
                  <Textarea value={form.helpText} onChange={(event) => update("helpText", event.target.value)} disabled={isLockedStandardQuestion} placeholder="π.χ. Η αύξηση δύναμης δεν είναι απαραίτητη για να επιλέξεις 5." className="min-h-20" />
                </Label>

                <Label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Υποχρεωτική ερώτηση
                  <Switch checked={form.isRequired} disabled={isLockedStandardQuestion} onCheckedChange={(checked) => update("isRequired", checked === true)} />
                </Label>
              </div>

            </div>

            <div className="flex justify-end border-t border-border px-4 py-4 sm:px-5">
              <Button onClick={saveQuestion} disabled={saving || !form.question.trim() || isLockedStandardQuestion} className="h-11 px-6 font-bold disabled:bg-slate-400">
                {saving ? "Αποθήκευση..." : "Αποθήκευση Ερώτησης"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 hidden grid gap-4 xl:grid-cols-[236px_minmax(0,1fr)_290px]">
        <div className="hidden xl:block" />
        <div className="hidden xl:block" />
        <aside className="rounded-[20px] border border-border bg-card p-4 xl:sticky xl:top-5 xl:self-start">
          <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">Όπως το βλέπει ο πελάτης</h3><Badge variant="outline" className="text-[10px] font-extrabold">LIVE</Badge></div>
          <div className="mt-3 overflow-hidden rounded-[22px] border-[6px] border-foreground bg-muted">
            <div className="bg-foreground px-3 py-2.5 text-[10px] font-bold text-background"><div className="flex justify-between"><span>‹ Αρχική</span><span>Βήμα <b className="text-accent">{Math.max(1, configuredSections.findIndex((section) => section.value === form.section) + 1)}</b> / {configuredSections.length || 5}</span></div><div className="mt-2 flex gap-1">{configuredSections.map((section, index) => <span key={section.value} className={cn("h-1 flex-1 rounded-full", index <= configuredSections.findIndex((item) => item.value === form.section) ? "bg-accent" : "bg-white/15")} />)}</div></div>
            <div className="space-y-3 p-3"><p className="text-xs font-extrabold">{configuredSections.find((section) => section.value === form.section)?.label || "Ερώτηση"}</p><div className="rounded-[12px] border-2 border-accent bg-card p-2.5"><p className="text-[11px] font-extrabold">{form.question || "Το κείμενο της ερώτησης"}{form.isRequired && <span className="text-destructive"> *</span>}</p>{form.helpText && <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{form.helpText}</p>}<div className="mt-2"><QuestionPreview question={form} /></div></div><Button type="button" className="h-8 w-full rounded-full bg-foreground text-[10px] font-extrabold text-background">Επόμενο →</Button></div>
          </div>
        </aside>
      </section>

      <QuestionnairePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} questions={questions} />
    </div>
  );
}

function QuestionnairePreviewDialog({
  open,
  onOpenChange,
  questions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: Question[];
}) {
  const activeQuestions = questions.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Προεπισκόπηση Ερωτηματολογίου</DialogTitle>
          <DialogDescription>Έτσι το βλέπουν οι πελάτες</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {activeQuestions.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <Separator className="mb-6" />}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    {index + 1}. {item.question}
                    {item.isRequired && <span className="ml-1 text-red-500">*</span>}
                  </div>
                  {!item.isRequired && (
                    <Badge variant="outline" className="h-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                      Προαιρετικό
                    </Badge>
                  )}
                </div>
                <QuestionnairePreviewInput question={item} />
              </div>
            ))}
            {!activeQuestions.length && <p className="text-sm font-semibold text-slate-400">Δεν υπάρχουν ενεργές ερωτήσεις.</p>}
          </div>
        </ScrollArea>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-400">Αυτή η προεπισκόπηση δείχνει μόνο τις ενεργές ερωτήσεις.</p>
          <DialogClose render={<Button variant="outline">Κλείσιμο</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionnairePreviewInput({ question }: { question: Question }) {
  if (question.type === "textarea") {
    return <Textarea disabled placeholder={question.placeholder} className="min-h-20" />;
  }
  if (question.type === "number") {
    return <Input disabled type="number" placeholder={question.placeholder} className="h-11" />;
  }
  if (question.type === "text") {
    return <Input disabled placeholder={question.placeholder} className="h-11" />;
  }
  if (question.type === "rating") {
    return <StarRatingPreview />;
  }
  if (question.type === "photos") {
    return <UploadZonePreview label="📷 Ανέβασε φωτογραφίες" hint={`(max ${question.maxPhotos})`} />;
  }
  if (question.type === "pdf") {
    return <UploadZonePreview label="📄 Ανέβασε PDF" />;
  }
  if (question.type === "url") {
    const labels = question.options.filter((option) => option.trim());
    if (labels.length) {
      return <UrlOptionsPreview labels={labels} />;
    }
    return <UrlPreviewInput placeholder={question.placeholder} />;
  }
  if (question.type === "single_select") {
    return (
      <RadioGroup disabled className="gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        {question.options.map((option, index) => (
          <label key={index} className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <RadioGroupItem value={option} />
            {option}
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (question.type === "multi_select") {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        {question.options.map((option, index) => (
          <label key={index} className="flex items-center gap-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <Checkbox disabled />
            {option}
          </label>
        ))}
      </div>
    );
  }
  return null;
}

function StarRatingPreview() {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="h-6 w-6 text-slate-300 dark:text-slate-600" />
      ))}
    </div>
  );
}

function UploadZonePreview({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 p-6 text-center text-sm font-semibold text-slate-400 dark:border-slate-700 dark:text-slate-500">
      <span>{label}</span>
      {hint && <span className="text-xs">{hint}</span>}
    </div>
  );
}

function UrlPreviewInput({ placeholder, className }: { placeholder: string; className?: string }) {
  return (
    <div className="relative">
      <Link2 className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <Input disabled type="url" placeholder={placeholder} className={cn("h-11 pl-9", className)} />
    </div>
  );
}

function UrlOptionsPreview({ labels, className }: { labels: string[]; className?: string }) {
  return (
    <div className="space-y-3">
      {labels.map((label, index) => (
        <div key={index}>
          <div className="mb-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">{label}</div>
          <UrlPreviewInput placeholder={`${label} URL`} className={className} />
        </div>
      ))}
    </div>
  );
}

function SortableQuestionRow({
  questionItem,
  typeOptions,
  selected,
  onSelect,
  onToggleActive,
}: {
  questionItem: Question;
  typeOptions: TypeOption[];
  selected: boolean;
  onSelect: () => void;
  onToggleActive: (next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(questionItem.id) });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5",
        selected ? "border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-500/10" : "border-slate-200 dark:border-slate-800",
        isDragging && "z-10 opacity-60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none text-slate-400 hover:text-slate-600 active:cursor-grabbing dark:text-slate-500"
        aria-label="Αλλαγή σειράς"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", questionItem.isActive ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100">
          {questionItem.question || "(χωρίς κείμενο)"}
        </span>
      </button>
      <Badge variant="outline" className="h-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
        {typeLabel(questionItem.type, typeOptions)}
      </Badge>
      <Switch checked={questionItem.isActive} onCheckedChange={(checked) => onToggleActive(checked === true)} className="shrink-0" />
    </div>
  );
}

function QuestionPreview({ question }: { question: Question }) {
  if (!question.question.trim()) {
    return <p className="text-sm font-semibold text-slate-400">Συμπλήρωσε το κείμενο της ερώτησης.</p>;
  }

  return (
    <div>
      <div className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-200">
        {question.question}
        {question.isRequired && <span className="ml-1 text-red-500">*</span>}
      </div>
      {question.type === "textarea" && (
        <Textarea disabled placeholder={question.placeholder} className="min-h-20 bg-white dark:bg-slate-900" />
      )}
      {question.type === "number" && <Input disabled type="number" placeholder={question.placeholder} className="h-11 bg-white dark:bg-slate-900" />}
      {question.type === "text" && <Input disabled placeholder={question.placeholder} className="h-11 bg-white dark:bg-slate-900" />}
      {question.type === "rating" && <StarRatingPreview />}
      {question.type === "photos" && <UploadZonePreview label="📷 Ανέβασε φωτογραφίες" hint={`(max ${question.maxPhotos})`} />}
      {question.type === "pdf" && <UploadZonePreview label="📄 Ανέβασε PDF" />}
      {question.type === "url" &&
        (question.options.filter((option) => option.trim()).length ? (
          <UrlOptionsPreview labels={question.options.filter((option) => option.trim())} className="bg-white dark:bg-slate-900" />
        ) : (
          <UrlPreviewInput placeholder={question.placeholder} className="bg-white dark:bg-slate-900" />
        ))}
      {(question.type === "single_select" || question.type === "multi_select") && (
        <div className="grid gap-2 sm:grid-cols-2">
          {question.options
            .filter((option) => option.trim())
            .map((option, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 border border-slate-300 dark:border-slate-600",
                    question.type === "single_select" ? "rounded-full" : "rounded",
                  )}
                />
                {option}
              </div>
            ))}
          {!question.options.filter((option) => option.trim()).length && (
            <p className="text-sm font-semibold text-slate-400">Πρόσθεσε τουλάχιστον μία επιλογή.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoachQuestionnairePage() {
  return (
    <ProtectedRoute>
      <CoachQuestionnaireContent mode="registration" />
    </ProtectedRoute>
  );
}

export function CoachUpdateQuestionnairePage() {
  return (
    <ProtectedRoute>
      <CoachQuestionnaireContent mode="update" />
    </ProtectedRoute>
  );
}
