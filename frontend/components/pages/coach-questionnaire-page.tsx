"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, X, Link2, Star } from "lucide-react";
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
  allowPhotos: boolean;
  maxPhotos: number;
  allowPdf: boolean;
  sortOrder: number;
  isActive: boolean;
  standardKey: string | null;
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

const emptyQuestion: Question = {
  id: 0,
  question: "",
  type: "single_select",
  options: ["Επιλογή 1"],
  isRequired: true,
  placeholder: "",
  allowPhotos: false,
  maxPhotos: 4,
  allowPdf: false,
  sortOrder: 0,
  isActive: true,
  standardKey: null,
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

function CoachQuestionnaireContent() {
  const { user, logout } = useAuth();

  if (!["coach", "admin"].includes(user?.role || "")) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Δεν έχεις πρόσβαση σε αυτή τη σελίδα.
      </div>
    );
  }

  return (
    <CoachShell title="Ερωτηματολόγιο" user={user} logout={logout}>
      <Tabs defaultValue="registration">
        <TabsList className="mb-6">
          <TabsTrigger value="registration">Ερωτηματολόγιο Εγγραφής</TabsTrigger>
          <TabsTrigger value="update">Ερωτηματολόγιο Update</TabsTrigger>
        </TabsList>
        <TabsContent value="registration">
          <QuestionSetEditor
            title="Ερωτηματολόγιο Εγγραφής"
            subtitle="Οι ερωτήσεις που απαντούν οι νέοι πελάτες κατά την εγγραφή τους."
            typeOptions={registrationTypeOptions}
            endpoints={registrationEndpoints}
            standardKeyOptions={registrationStandardKeyOptions}
          />
        </TabsContent>
        <TabsContent value="update">
          <QuestionSetEditor
            title="Ερωτηματολόγιο Update"
            subtitle="Οι ερωτήσεις που απαντούν οι πελάτες στο εβδομαδιαίο update τους."
            typeOptions={updateTypeOptions}
            endpoints={updateEndpoints}
            standardKeyOptions={updateStandardKeyOptions}
          />
        </TabsContent>
      </Tabs>
    </CoachShell>
  );
}

function QuestionSetEditor({
  title,
  subtitle,
  typeOptions,
  endpoints,
  standardKeyOptions,
}: {
  title: string;
  subtitle: string;
  typeOptions: TypeOption[];
  endpoints: QuestionEndpoints;
  standardKeyOptions: StandardKeyOption[];
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedQuestion = useMemo(() => questions.find((item) => item.id === selectedId) || null, [questions, selectedId]);
  const isLockedStandardQuestion = form.standardKey === "update_day";
  const activeCount = questions.filter((item) => item.isActive).length;
  const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    allowPhotos: source.allowPhotos,
    maxPhotos: source.maxPhotos,
    allowPdf: source.allowPdf,
    sortOrder: source.sortOrder,
    isActive: source.isActive,
    standardKey: source.standardKey,
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
    setForm({ ...emptyQuestion, sortOrder: questions.length });
  };

  const toggleActive = async (targetQuestion: Question, nextActive: boolean) => {
    if (targetQuestion.standardKey === "update_day") return;
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
    const ids = questions.map((item) => String(item.id));
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(questions, oldIndex, newIndex);
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

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
          <aside className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-bold">Ερωτήσεις</h3>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Σύρε για αλλαγή σειράς</p>
            <div className="mt-5">
              <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={questions.map((item) => String(item.id))} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {questions.map((item) => (
                      <SortableQuestionRow
                        key={item.id}
                        questionItem={item}
                        typeOptions={typeOptions}
                        selected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onToggleActive={(next) => toggleActive(item, next)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              {!questions.length && <p className="mt-4 text-sm font-semibold text-slate-400">Δεν υπάρχουν ερωτήσεις ακόμα.</p>}
            </div>
          </aside>

          <div className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">{form.id ? "Επεξεργασία Ερώτησης" : "Νέα Ερώτηση"}</h3>
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
                      Η ερώτηση &ldquo;{form.question}&rdquo; θα διαγραφεί οριστικά, μαζί με τυχόν απαντήσεις πελατών. Η ενέργεια δεν αναιρείται.
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

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
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

                <Label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Υποχρεωτική ερώτηση
                  <Switch checked={form.isRequired} disabled={isLockedStandardQuestion} onCheckedChange={(checked) => update("isRequired", checked === true)} />
                </Label>
              </div>

              <div>
                <h4 className="mb-4 font-bold">Προεπισκόπηση</h4>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                  <QuestionPreview question={form} />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={saveQuestion} disabled={saving || !form.question.trim() || isLockedStandardQuestion} className="h-11 px-6 font-bold disabled:bg-slate-400">
                {saving ? "Αποθήκευση..." : "Αποθήκευση Ερώτησης"}
              </Button>
            </div>
          </div>
        </div>
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
      <CoachQuestionnaireContent />
    </ProtectedRoute>
  );
}
