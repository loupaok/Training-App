"use client";

import { useEffect, useMemo, useState } from "react";
import { GripVertical, Plus, X, Link2 } from "lucide-react";
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

type QuestionType = "single_select" | "multi_select" | "text" | "number" | "textarea" | "url";

interface Question {
  id: number;
  question: string;
  type: QuestionType;
  options: string[];
  isRequired: boolean;
  placeholder: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyQuestion: Question = {
  id: 0,
  question: "",
  type: "single_select",
  options: ["Επιλογή 1"],
  isRequired: true,
  placeholder: "",
  sortOrder: 0,
  isActive: true,
};

const typeOptions: { value: QuestionType; label: string }[] = [
  { value: "single_select", label: "Μονή επιλογή" },
  { value: "multi_select", label: "Πολλαπλή επιλογή" },
  { value: "text", label: "Σύντομο κείμενο" },
  { value: "number", label: "Αριθμός" },
  { value: "textarea", label: "Μεγάλο κείμενο" },
  { value: "url", label: "Σύνδεσμος URL" },
];

function typeLabel(type: QuestionType): string {
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
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<Question>(emptyQuestion);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedQuestion = useMemo(() => questions.find((item) => item.id === selectedId) || null, [questions, selectedId]);
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
      const rows = await api.get<Question[]>("/questionnaire/manage");
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
    sortOrder: source.sortOrder,
    isActive: source.isActive,
  });

  const saveQuestion = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = form.id
        ? await api.put<Question>(`/questionnaire/questions/${form.id}`, buildPayload(form))
        : await api.post<Question>("/questionnaire/questions", buildPayload(form));
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
      await api.delete(`/questionnaire/questions/${form.id}`);
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
    setQuestions((current) => current.map((item) => (item.id === targetQuestion.id ? { ...item, isActive: nextActive } : item)));
    if (selectedId === targetQuestion.id) update("isActive", nextActive);
    try {
      await api.put(`/questionnaire/questions/${targetQuestion.id}`, buildPayload({ ...targetQuestion, isActive: nextActive }));
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
      await api.put("/questionnaire/questions/reorder", { ids: reordered.map((item) => item.id) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν αποθηκεύτηκε η σειρά.");
      await loadQuestions();
    }
  };

  if (!["coach", "admin"].includes(user?.role || "")) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Δεν έχεις πρόσβαση σε αυτή τη σελίδα.
      </div>
    );
  }

  return (
    <CoachShell title="Ερωτηματολόγιο" user={user} logout={logout}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold">Ερωτηματολόγιο Εγγραφής</h2>
            <Badge variant="outline" className="h-auto rounded-full px-3 py-1 text-xs font-bold">
              {activeCount} ενεργές ερωτήσεις
            </Badge>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Οι ερωτήσεις που απαντούν οι νέοι πελάτες κατά την εγγραφή τους.
          </p>
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
                      disabled={!form.id || saving}
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
                  <Textarea value={form.question} onChange={(event) => update("question", event.target.value)} className="min-h-20" />
                </Label>

                <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Τύπος Ερώτησης
                  <Select items={typeOptions} value={form.type} onValueChange={(value) => value && update("type", value as QuestionType)}>
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
                          <Input value={option} onChange={(event) => updateOption(index, event.target.value)} className="h-10" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index)}
                            disabled={form.type !== "url" && form.options.length <= 1}
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
                      onChange={(event) => update("placeholder", event.target.value)}
                      placeholder="π.χ. Περίγραψε αν υπάρχουν..."
                    />
                  </Label>
                )}

                <Label className="flex items-center justify-between gap-3 text-sm font-bold text-slate-700 dark:text-slate-200">
                  Υποχρεωτική ερώτηση
                  <Switch checked={form.isRequired} onCheckedChange={(checked) => update("isRequired", checked === true)} />
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
              <Button onClick={saveQuestion} disabled={saving || !form.question.trim()} className="h-11 px-6 font-bold disabled:bg-slate-400">
                {saving ? "Αποθήκευση..." : "Αποθήκευση Ερώτησης"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <QuestionnairePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} questions={questions} />
    </CoachShell>
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
          <DialogDescription>Έτσι το βλέπουν οι νέοι πελάτες</DialogDescription>
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
  selected,
  onSelect,
  onToggleActive,
}: {
  questionItem: Question;
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
        {typeLabel(questionItem.type)}
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
