"use client";

import { type DragEvent, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  Plus,
  Save,
  Settings2,
  Trash2,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UpdateQuestionField } from "@/components/pages/client-weekly-update-wizard";
import { api } from "@/lib/api/client";
import { computeScore, isVisible } from "@/lib/update-form/logic";
import type {
  Answers,
  FormDefinition,
  Question,
  QuestionType,
  Step,
} from "@/lib/update-form/types";

type Draft = { id: number; version: number; definition: FormDefinition };
const labels: Record<QuestionType, string> = {
  scale: "Κλίμακα 1–5",
  text: "Κείμενο",
  number: "Αριθμός",
  yes_no: "Ναι / Όχι",
  chips: "Επιλογές",
  auto: "Αυτόματο",
  photos: "Φωτογραφίες",
};
const copy = <T,>(data: T): T => JSON.parse(JSON.stringify(data));
const uid = (name = "question") =>
  (name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-") || "question") +
  "-" +
  Math.random().toString(36).slice(2, 8);
const newQuestion = (type: QuestionType = "text"): Question => ({
  id: uid(),
  code: uid(),
  shortLabel: "Νέα ερώτηση",
  label: "Νέα ερώτηση",
  type,
  required: false,
  showToCoach: true,
  ...(type === "scale"
    ? {
        scored: false,
        weight: 1,
        display: "numbers",
        scaleLabels: ["1", "2", "3", "4", "5"] as [
          string,
          string,
          string,
          string,
          string,
        ],
      }
    : {}),
  ...(type === "chips" ? { options: ["Επιλογή 1"], multi: true } : {}),
  ...(type === "photos" ? { photoSlots: ["Μπροστά", "Πλάι", "Πίσω"] } : {}),
});
const replace = <T,>(list: T[], index: number, value: T) =>
  list.map((item, i) => (i === index ? value : item));
const reorder = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export function CoachUpdateFormBuilder() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState("questions");
  const [selected, setSelected] = useState("");
  const [expanded, setExpanded] = useState("");
  const [status, setStatus] = useState("Φόρτωση πρόχειρου…");
  const [dialog, setDialog] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const lastSavedDefinition = useRef("");
  useEffect(() => {
    api
      .get<Draft>("/updates/builder/draft")
      .then((data) => {
        lastSavedDefinition.current = JSON.stringify(data.definition);
        setDraft(data);
        setSelected(data.definition.steps[0]?.id || "");
        setStatus("Όλες οι αλλαγές αποθηκεύονται αυτόματα.");
      })
      .catch((e) =>
        setStatus(
          e instanceof Error ? e.message : "Δεν φορτώθηκε το πρόχειρο.",
        ),
      );
  }, []);
  useEffect(() => {
    if (!draft) return;
    const serialized = JSON.stringify(draft.definition);
    if (serialized === lastSavedDefinition.current) return;
    setStatus("Αποθήκευση…");
    const timer = window.setTimeout(() => {
      if (serialized === lastSavedDefinition.current) return;
      api
        .put<Draft>("/updates/builder/draft", { definition: draft.definition })
        .then(() => {
          lastSavedDefinition.current = serialized;
          setStatus("Αποθηκεύτηκε ως πρόχειρο.");
        })
        .catch((e) =>
          setStatus(e instanceof Error ? e.message : "Η αποθήκευση απέτυχε."),
        );
    }, 700);
    return () => clearTimeout(timer);
  }, [draft?.definition]);
  if (!draft)
    return (
      <Card className="rounded-[20px]">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {status}
        </CardContent>
      </Card>
    );
  const form = draft.definition;
  const index = form.steps.findIndex((step) => step.id === selected);
  const step = form.steps[index] || form.steps[0];
  const change = (fn: (value: FormDefinition) => FormDefinition) =>
    setDraft((current) =>
      current
        ? { ...current, definition: fn(copy(current.definition)) }
        : current,
    );
  const changeStep = (value: Step) =>
    change((data) => ({ ...data, steps: replace(data.steps, index, value) }));
  const save = async () => {
    try {
      setStatus("Αποθήκευση…");
      await api.put<Draft>("/updates/builder/draft", { definition: form });
      lastSavedDefinition.current = JSON.stringify(form);
      const published = await api.post<Draft>("/updates/builder/publish");
      setDraft(published);
      setStatus("Οι αλλαγές αποθηκεύτηκαν και εφαρμόστηκαν στους πελάτες.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Η αποθήκευση απέτυχε.");
    }
  };
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-extrabold tracking-[-.5px]">
              Ερωτηματολόγιο Update
            </h1>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold">
              {form.steps.flatMap((s) => s.questions).length} ενεργές ερωτήσεις
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Οι αλλαγές εμφανίζονται στο επόμενο update του πελάτη.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-full px-5 font-bold"
            onClick={() => setDialog(true)}
          >
            <Eye className="mr-2 h-4 w-4" />
            Προεπισκόπηση
          </Button>
          <Button
            variant="lime"
            className="h-11 rounded-full px-5 font-extrabold"
            onClick={save}
          >
            <Save className="mr-2 h-4 w-4" />
            Αποθήκευση
          </Button>
        </div>
      </div>
      <TabsList className="h-auto rounded-[14px] bg-muted p-1.5">
        <TabsTrigger
          value="questions"
          className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background"
        >
          Ερωτήσεις
        </TabsTrigger>
        <TabsTrigger
          value="score"
          className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background"
        >
          Σκορ & μηνύματα
        </TabsTrigger>
        <TabsTrigger
          value="settings"
          className="h-10 rounded-[10px] px-4 font-extrabold data-[state=active]:bg-foreground data-[state=active]:text-background"
        >
          Ρυθμίσεις
        </TabsTrigger>
      </TabsList>
      <p className="text-xs font-bold text-muted-foreground">{status}</p>
      <TabsContent value="questions" className="mt-0">
        <div className="grid gap-4 xl:grid-cols-[236px_minmax(0,1fr)_290px]">
          <Steps
            form={form}
            selected={step.id}
            setSelected={setSelected}
            change={change}
          />
          <Questions
            step={step}
            all={form.steps.flatMap((s) => s.questions)}
            expanded={expanded}
            setExpanded={setExpanded}
            change={changeStep}
          />
          <Preview
            form={form}
            step={step}
            answers={answers}
            setAnswers={setAnswers}
          />
        </div>
      </TabsContent>
      <TabsContent value="score" className="mt-0">
        <Score form={form} change={change} />
      </TabsContent>
      <TabsContent value="settings" className="mt-0">
        <SettingsWithPoints form={form} change={change} />
      </TabsContent>
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Προεπισκόπηση πελάτη</DialogTitle>
          </DialogHeader>
          <TestWizard form={form} answers={answers} setAnswers={setAnswers} />
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

function Steps({
  form,
  selected,
  setSelected,
  change,
}: {
  form: FormDefinition;
  selected: string;
  setSelected: (id: string) => void;
  change: (fn: (data: FormDefinition) => FormDefinition) => void;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
      <Card className="rounded-[20px]">
        <CardContent className="p-3">
          <div className="mb-3 flex items-center justify-between px-1">
            <b className="text-sm">Βήματα</b>
            <span className="text-xs text-muted-foreground">
              {form.steps.length}
            </span>
          </div>
          <div className="space-y-1">
            {form.steps.map((step, index) => (
              <div
                key={step.id}
                className={
                  "rounded-[12px] border p-2 " +
                  (selected === step.id
                    ? "border-foreground bg-muted"
                    : "border-transparent")
                }
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 text-left"
                  onClick={() => setSelected(step.id)}
                >
                  <span
                    className={
                      "grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold " +
                      (selected === step.id
                        ? "bg-foreground text-accent"
                        : "bg-muted")
                    }
                  >
                    {index + 1}
                  </span>
                  <b className="min-w-0 flex-1 truncate text-sm">
                    {step.title || "Νέο βήμα"}
                  </b>
                </button>
                {selected === step.id && (
                  <div className="mt-2 flex gap-1">
                    <Input
                      className="h-8 min-w-0 text-xs font-bold"
                      value={step.title}
                      onChange={(e) =>
                        change((d) => ({
                          ...d,
                          steps: replace(d.steps, index, {
                            ...step,
                            title: e.target.value,
                          }),
                        }))
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={!index}
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          steps: reorder(d.steps, index, index - 1),
                        }))
                      }
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={index === form.steps.length - 1}
                      onClick={() =>
                        change((d) => ({
                          ...d,
                          steps: reorder(d.steps, index, index + 1),
                        }))
                      }
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      disabled={form.steps.length === 1}
                      onClick={() => {
                        change((d) => ({
                          ...d,
                          steps: d.steps.filter((x) => x.id !== step.id),
                        }));
                        setSelected(
                          form.steps.find((x) => x.id !== step.id)?.id || "",
                        );
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-3 h-10 w-full rounded-full text-xs font-extrabold"
            onClick={() => {
              const id = uid("step");
              change((d) => ({
                ...d,
                steps: [
                  ...d.steps,
                  { id, title: "Νέο βήμα", icon: "•", questions: [] },
                ],
              }));
              setSelected(id);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Νέο βήμα
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}

function Questions({
  step,
  all,
  expanded,
  setExpanded,
  change,
}: {
  step: Step;
  all: Question[];
  expanded: string;
  setExpanded: (id: string) => void;
  change: (step: Step) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const update = (index: number, value: Question) =>
    change({ ...step, questions: replace(step.questions, index, value) });
  const move = (sourceId: string, targetId: string) => {
    const from = step.questions.findIndex((question) => question.id === sourceId);
    const to = step.questions.findIndex((question) => question.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    change({ ...step, questions: reorder(step.questions, from, to) });
  };
  const add = (type: QuestionType, parent?: Question) => {
    const q = newQuestion(type);
    if (parent) q.showIf = { questionId: parent.id, op: "is", value: true };
    change({ ...step, questions: [...step.questions, q] });
    setExpanded(q.id);
  };
  return (
    <Card className="rounded-[20px]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold">{step.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Οι εξαρτώμενες ερωτήσεις έχουν εσοχή.
            </p>
          </div>
          <Select
            items={Object.entries(labels).map(([value, label]) => ({ value, label }))}
            value={null}
            onValueChange={(v) => v && add(v as QuestionType)}
          >
            <SelectTrigger className="h-10 w-[175px] rounded-full text-xs font-extrabold">
              <Plus className="mr-1 h-4 w-4" />
              <SelectValue placeholder="Νέα ερώτηση" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(labels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-5 space-y-3">
          {step.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              question={question}
              all={all}
              dragging={draggedId === question.id}
              dropTarget={dropId === question.id && draggedId !== question.id}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", question.id);
                setDraggedId(question.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (draggedId && draggedId !== question.id) setDropId(question.id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/plain") || draggedId;
                if (sourceId) move(sourceId, question.id);
                setDraggedId(null);
                setDropId(null);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDropId(null);
              }}
              open={expanded === question.id}
              toggle={() =>
                setExpanded(expanded === question.id ? "" : question.id)
              }
              update={(value) => update(index, value)}
              remove={() =>
                change({
                  ...step,
                  questions: step.questions.filter((q) => q.id !== question.id),
                })
              }
              dependent={() => add("text", question)}
            />
          ))}
          {!step.questions.length && (
            <div className="rounded-[14px] border-2 border-dashed border-border p-7 text-center text-sm text-muted-foreground">
              Δεν υπάρχουν ερωτήσεις σε αυτό το βήμα.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuestionCard({
  question,
  all,
  dragging,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  open,
  toggle,
  update,
  remove,
  dependent,
}: {
  question: Question;
  all: Question[];
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  open: boolean;
  toggle: () => void;
  update: (q: Question) => void;
  remove: () => void;
  dependent: () => void;
}) {
  const patch = (data: Partial<Question>) => update({ ...question, ...data });
  const sources = all.filter((q) => q.id !== question.id);
  const selectedSource = sources.find(
    (source) => source.id === question.showIf?.questionId,
  );
  const selectedSourceLabel =
    selectedSource?.label || selectedSource?.shortLabel || "Επίλεξε ερώτηση";
  const conditionOperators = selectedSource?.type === "scale" || selectedSource?.type === "number"
    ? [{ value: "<", label: "μικρότερο από" }, { value: "<=", label: "μικρότερο ή ίσο" }, { value: "=", label: "ίσο με" }, { value: ">=", label: "μεγαλύτερο ή ίσο" }, { value: ">", label: "μεγαλύτερο από" }]
    : selectedSource?.type === "chips"
      ? [{ value: "includes", label: "περιλαμβάνει" }]
      : [{ value: "is", label: "είναι" }];
  const conditionValues = selectedSource?.type === "scale"
    ? [1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} · ${selectedSource.scaleLabels?.[value - 1] || value}` }))
    : selectedSource?.type === "yes_no"
      ? [{ value: "true", label: "Ναι" }, { value: "false", label: "Όχι" }]
      : selectedSource?.type === "chips"
        ? (selectedSource.options || []).map((value) => ({ value, label: value }))
        : [];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={
        "rounded-[16px] border border-border bg-card transition-opacity " +
        (dragging ? "opacity-45 " : "") +
        (dropTarget ? "ring-2 ring-accent ring-offset-2 ring-offset-background " : "") +
        (question.showIf ? "ml-5 border-l-4 border-l-accent" : "")
      }
    >
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="text-muted-foreground">⋮⋮</span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-sm">
            {question.label || "Χωρίς τίτλο"}
          </b>
          <small className="mt-1 block text-xs text-muted-foreground">
            {labels[question.type]}
            {question.required ? " · Υποχρεωτικό" : ""}
            {question.scored ? " · Σκορ" : ""}
          </small>
        </span>
        <ChevronDown className={"h-4 w-4 " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="space-y-5 border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Label className="space-y-2 text-sm font-bold">
              Ερώτηση
              <Input
                value={question.label}
                onChange={(e) =>
                  patch({
                    label: e.target.value,
                    shortLabel: e.target.value.slice(0, 34),
                  })
                }
              />
            </Label>
            <Label className="space-y-2 text-sm font-bold">
              Τύπος
              <Select
                items={Object.entries(labels).map(([value, label]) => ({ value, label }))}
                value={question.type}
                onValueChange={(v) => patch(v === "scale" ? { type: "scale", display: question.display || "buttons", scaleLabels: question.scaleLabels || ["1", "2", "3", "4", "5"] } : { type: v as QuestionType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(labels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>
          <Label className="space-y-2 text-sm font-bold">
            Βοηθητικό κείμενο
            <Textarea
              className="min-h-20"
              value={question.help || ""}
              onChange={(e) => patch({ help: e.target.value })}
            />
          </Label>
          {question.type === "scale" && (
            <div className="grid gap-2 sm:grid-cols-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Input
                  key={i}
                  value={question.scaleLabels?.[i] || ""}
                  placeholder={String(i + 1)}
                  onChange={(e) => {
                    const list = [
                      ...(question.scaleLabels || ["", "", "", "", ""]),
                    ] as [string, string, string, string, string];
                    list[i] = e.target.value;
                    patch({ scaleLabels: list });
                  }}
                />
              ))}
            </div>
          )}
          {question.type === "chips" && (
            <Label className="space-y-2 text-sm font-bold">
              Επιλογές
              <Textarea
                className="min-h-20"
                value={(question.options || []).join("\n")}
                onChange={(e) =>
                  patch({ options: e.target.value.split("\n").filter(Boolean) })
                }
              />
            </Label>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                "Υποχρεωτική",
                question.required,
                (v: boolean) => patch({ required: v }),
              ],
              [
                "Μετράει στο σκορ",
                !!question.scored,
                (v: boolean) => patch({ scored: v }),
              ],
              [
                "Βλέπει ο coach",
                question.showToCoach,
                (v: boolean) => patch({ showToCoach: v }),
              ],
            ].map(([label, value, fn]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between rounded-[12px] bg-muted p-3 text-xs font-bold"
              >
                <span>{String(label)}</span>
                <Switch
                  checked={Boolean(value)}
                  onCheckedChange={fn as (v: boolean) => void}
                />
              </div>
            ))}
          </div>
          {question.scored && (
            <Label className="flex items-center gap-3 text-sm font-bold">
              Βάρος score
              <Input
                type="number"
                min={1}
                className="h-10 w-20"
                value={question.weight || 1}
                onChange={(e) => patch({ weight: Number(e.target.value) || 1 })}
              />
            </Label>
          )}
          <div className="rounded-[14px] border border-dashed border-border p-3">
            <div className="flex items-center justify-between">
              <b className="text-sm">Συνθήκη εμφάνισης</b>
              <Switch
                checked={!!question.showIf}
                onCheckedChange={(v) =>
                  patch({
                    showIf: v
                      ? {
                          questionId: sources[0]?.id || "",
                          op: "is",
                          value: true,
                        }
                      : undefined,
                  })
                }
              />
            </div>
            {question.showIf && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Select
                  items={sources.map((source) => ({
                    value: source.id,
                    label: source.label || source.shortLabel || source.id,
                  }))}
                  value={question.showIf.questionId}
                  onValueChange={(value) =>
                    patch({
                      showIf: { ...question.showIf!, questionId: value },
                    })
                  }
                >
                  <SelectTrigger className="h-auto min-h-10 w-full whitespace-normal">
                    <span data-slot="select-value" className="flex flex-1 whitespace-normal text-left leading-5">
                      {selectedSourceLabel}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="min-w-[min(420px,calc(100vw-2rem))]">
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id} className="h-auto whitespace-normal py-2.5 leading-5">
                        {source.label || source.shortLabel || source.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select items={conditionOperators} value={question.showIf.op} onValueChange={(op) => patch({ showIf: { ...question.showIf!, op } as NonNullable<Question["showIf"]> })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{conditionOperators.map((operator) => <SelectItem key={operator.value} value={operator.value}>{operator.label}</SelectItem>)}</SelectContent></Select>
                {conditionValues.length ? <Select items={conditionValues} value={String(question.showIf.value)} onValueChange={(value) => patch({ showIf: { ...question.showIf!, value: selectedSource?.type === "yes_no" ? value === "true" : selectedSource?.type === "chips" ? value : Number(value) } as Question["showIf"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{conditionValues.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : <Input value={String(question.showIf.value)} onChange={(e) => patch({ showIf: { ...question.showIf!, value: e.target.value } as Question["showIf"] })} />}
              </div>
            )}
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              className="h-9 rounded-full text-xs"
              onClick={dependent}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Εξαρτώμενη
            </Button>
            <Button
              variant="ghost"
              className="h-9 rounded-full text-xs text-destructive"
              onClick={remove}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Διαγραφή
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({
  form,
  step,
  answers,
  setAnswers,
}: {
  form: FormDefinition;
  step: Step;
  answers: Answers;
  setAnswers: (a: Answers) => void;
}) {
  return (
    <aside className="xl:sticky xl:top-5 xl:self-start">
      <Card className="rounded-[20px]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <b className="text-sm">Όπως το βλέπει ο πελάτης</b>
            <span className="rounded-full border border-border px-2 py-1 text-[10px] font-extrabold">
              LIVE
            </span>
          </div>
          <div className="mt-3 overflow-hidden rounded-[18px] border-[5px] border-foreground">
            <div className="bg-foreground px-3 py-2 text-[10px] font-bold text-background">
              Εβδομαδιαίο update{" "}
              <span className="float-right text-accent">
                Βήμα {form.steps.findIndex((x) => x.id === step.id) + 1}/
                {form.steps.length}
              </span>
            </div>
            <div className="space-y-3 bg-card p-3">
              <b className="text-sm">{step.title}</b>
              {step.questions
                .filter((q) => isVisible(q, answers))
                .slice(0, 2)
                .map((q) => (
                  <UpdateQuestionField
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    onChange={(value) =>
                      setAnswers({ ...answers, [q.id]: value })
                    }
                    onFile={() => undefined}
                  />
                ))}
              <Button className="h-8 w-full rounded-full bg-foreground text-[10px] text-background">
                Επόμενο →
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function Score({
  form,
  change,
}: {
  form: FormDefinition;
  change: (fn: (data: FormDefinition) => FormDefinition) => void;
}) {
  const scoreQuestions = form.steps
    .flatMap((s) => s.questions)
    .filter((q) => q.type === "scale");
  const sample = computeScore(
    form,
    Object.fromEntries(scoreQuestions.map((q) => [q.id, 4])),
  );
  const valid =
    [...form.scoreTiers]
      .sort((a, b) => a.min - b.min)
      .every(
        (x, i, list) =>
          (i ? x.min === list[i - 1].max + 1 : x.min === 0) && x.min <= x.max,
      ) && form.scoreTiers.at(-1)?.max === 100;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-[20px]">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-foreground text-accent">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-extrabold">Σκορ & μηνύματα</h2>
              <p className="text-xs text-muted-foreground">
                Τα ranges καλύπτουν 0–100 χωρίς κενά.
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {form.scoreTiers.map((tier, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-[14px] border border-border p-3 sm:grid-cols-[110px_1fr_1.5fr_auto]"
              >
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="h-9 w-12 px-1 text-center"
                    value={tier.min}
                    onChange={(e) =>
                      change((d) => ({
                        ...d,
                        scoreTiers: replace(d.scoreTiers, index, {
                          ...tier,
                          min: Number(e.target.value),
                        }),
                      }))
                    }
                  />
                  <span>–</span>
                  <Input
                    type="number"
                    className="h-9 w-12 px-1 text-center"
                    value={tier.max}
                    onChange={(e) =>
                      change((d) => ({
                        ...d,
                        scoreTiers: replace(d.scoreTiers, index, {
                          ...tier,
                          max: Number(e.target.value),
                        }),
                      }))
                    }
                  />
                </div>
                <Input
                  className="h-9"
                  value={tier.title}
                  onChange={(e) =>
                    change((d) => ({
                      ...d,
                      scoreTiers: replace(d.scoreTiers, index, {
                        ...tier,
                        title: e.target.value,
                      }),
                    }))
                  }
                />
                <Input
                  className="h-9"
                  value={tier.message}
                  onChange={(e) =>
                    change((d) => ({
                      ...d,
                      scoreTiers: replace(d.scoreTiers, index, {
                        ...tier,
                        message: e.target.value,
                      }),
                    }))
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 text-destructive"
                  onClick={() =>
                    change((d) => ({
                      ...d,
                      scoreTiers: d.scoreTiers.filter((_, i) => i !== index),
                    }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-3 rounded-full"
            onClick={() =>
              change((d) => ({
                ...d,
                scoreTiers: [
                  ...d.scoreTiers,
                  { min: 0, max: 0, title: "Νέο εύρος", message: "Μήνυμα" },
                ],
              }))
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Νέο εύρος
          </Button>
          <p
            className={
              "mt-3 text-xs font-bold " +
              (valid ? "text-emerald-700" : "text-destructive")
            }
          >
            {valid
              ? "✓ Καλύπτουν 0–100 χωρίς κενά."
              : "Διόρθωσε τα ranges 0–100."}
          </p>
          <Label className="mt-5 block text-sm font-bold">
            Σημείωση κάτω από το σκορ
            <Textarea
              className="mt-2 min-h-24 font-normal"
              value={form.scoreNote}
              onChange={(e) =>
                change((d) => ({ ...d, scoreNote: e.target.value }))
              }
            />
          </Label>
        </CardContent>
      </Card>
      <Card className="rounded-[20px] bg-muted/50">
        <CardContent className="p-5">
          <h3 className="font-extrabold">Ερωτήσεις score</h3>
          <div className="mt-4 space-y-3">
            {scoreQuestions.map((question) => (
              <div
                key={question.id}
                className="flex items-center gap-2 rounded-[12px] bg-card p-3"
              >
                <Switch
                  checked={!!question.scored}
                  onCheckedChange={(value) =>
                    change((d) => ({
                      ...d,
                      steps: d.steps.map((s) => ({
                        ...s,
                        questions: s.questions.map((q) =>
                          q.id === question.id ? { ...q, scored: value } : q,
                        ),
                      })),
                    }))
                  }
                />
                <span className="min-w-0 flex-1 truncate text-xs font-bold">
                  {question.label}
                </span>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-12 px-1 text-center text-xs"
                  value={question.weight || 1}
                  onChange={(e) =>
                    change((d) => ({
                      ...d,
                      steps: d.steps.map((s) => ({
                        ...s,
                        questions: s.questions.map((q) =>
                          q.id === question.id
                            ? { ...q, weight: Number(e.target.value) || 1 }
                            : q,
                        ),
                      })),
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[14px] bg-foreground p-4 text-background">
            <p className="text-[11px] font-extrabold tracking-wide text-[#9a9a9a]">
              ΠΑΡΑΔΕΙΓΜΑ
            </p>
            <b className="mt-2 block text-lg">{sample.score ?? "—"}/100</b>
            <small className="text-[#bdbdbd]">
              {sample.tier?.title || "Συμπλήρωσε τα ranges"}
            </small>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Settings({
  form,
  change,
}: {
  form: FormDefinition;
  change: (fn: (data: FormDefinition) => FormDefinition) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="rounded-[20px]">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-foreground text-accent">
              <Settings2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-extrabold">Ρυθμίσεις update</h2>
              <p className="text-xs text-muted-foreground">
                Η Κυριακή παραμένει απενεργοποιημένη.
              </p>
            </div>
          </div>
          <Label className="mt-5 flex items-center justify-between text-sm font-bold">
            Ώρα προθεσμίας
            <Input
              type="time"
              className="h-10 w-28"
              value={form.settings.deadlineTime}
              onChange={(e) =>
                change((d) => ({
                  ...d,
                  settings: { ...d.settings, deadlineTime: e.target.value },
                }))
              }
            />
          </Label>
          <div className="mt-5">
            <b className="text-sm">Επιτρεπόμενες ημέρες</b>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Δευτέρα",
                "Τρίτη",
                "Τετάρτη",
                "Πέμπτη",
                "Παρασκευή",
                "Σάββατο",
              ].map((day, i) => {
                const value = i + 1,
                  active = form.settings.allowedDays.includes(value);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      change((d) => ({
                        ...d,
                        settings: {
                          ...d.settings,
                          allowedDays: active
                            ? d.settings.allowedDays.filter((x) => x !== value)
                            : [...d.settings.allowedDays, value],
                        },
                      }))
                    }
                    className={
                      "rounded-full border px-3 py-2 text-xs font-extrabold " +
                      (active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card")
                    }
                  >
                    {day}
                  </button>
                );
              })}
              <span className="cursor-not-allowed rounded-full border border-border bg-muted px-3 py-2 text-xs font-extrabold text-muted-foreground">
                Κυριακή
              </span>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Οι φωτογραφίες είναι υποχρεωτικές", "photosRequired"],
              ["Δείξε το σκορ στον πελάτη", "showScoreToClient"],
            ].map(([label, key]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-[14px] bg-muted p-4"
              >
                <span className="text-sm font-bold">{label}</span>
                <Switch
                  checked={Boolean(
                    form.settings[key as keyof FormDefinition["settings"]],
                  )}
                  onCheckedChange={(value) =>
                    change((d) => ({
                      ...d,
                      settings: { ...d.settings, [key]: value },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-[20px] bg-muted/50">
        <CardContent className="p-5">
          <h3 className="font-extrabold">Πόντοι</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Οι πόντοι για το έγκαιρο update έρχονται από τη σελίδα Πόντοι &
            Rewards και δεν αλλάζουν εδώ.
          </p>
          <div className="mt-4 rounded-[14px] bg-card p-3 text-sm font-extrabold">
            Έγκαιρο update{" "}
            <span className="float-right text-muted-foreground">
              Μόνο ανάγνωση
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsWithPoints({
  form,
  change,
}: {
  form: FormDefinition;
  change: (fn: (data: FormDefinition) => FormDefinition) => void;
}) {
  const [points, setPoints] = useState<number | null>(null);
  useEffect(() => {
    api
      .get<{ weekly_update_points?: number }>("/points/settings")
      .then((data) => setPoints(Number(data.weekly_update_points || 0)))
      .catch(() => setPoints(null));
  }, []);
  return (
    <div className="space-y-4">
      <Settings form={form} change={change} />
      <Card className="rounded-[20px]">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <span>
            <b className="block text-sm">Πόντοι έγκαιρου update</b>
            <small className="text-xs text-muted-foreground">
              Μόνο ανάγνωση · αλλάζει από Πόντοι & Rewards
            </small>
          </span>
          <b className="text-lg">{points === null ? "—" : "+" + points}</b>
        </CardContent>
      </Card>
    </div>
  );
}

function TestWizard({
  form,
  answers,
  setAnswers,
}: {
  form: FormDefinition;
  answers: Answers;
  setAnswers: (a: Answers) => void;
}) {
  const [index, setIndex] = useState(0);
  const step = form.steps[index];
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex gap-1">
        {form.steps.map((_, i) => (
          <i
            key={i}
            className={
              "h-1.5 flex-1 rounded-full " +
              (i <= index ? "bg-accent" : "bg-muted")
            }
          />
        ))}
      </div>
      <p className="text-xs font-bold text-muted-foreground">
        ΒΗΜΑ {index + 1} / {form.steps.length}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold">{step.title}</h2>
      <div className="mt-6 space-y-6">
        {step.questions
          .filter((q) => isVisible(q, answers))
          .map((q) => (
            <UpdateQuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(value) => setAnswers({ ...answers, [q.id]: value })}
              onFile={() => undefined}
            />
          ))}
      </div>
      <div className="mt-7 flex justify-between">
        <Button
          variant="outline"
          disabled={!index}
          onClick={() => setIndex((i) => i - 1)}
        >
          Πίσω
        </Button>
        <Button
          variant="lime"
          onClick={() =>
            setIndex((i) => Math.min(i + 1, form.steps.length - 1))
          }
        >
          {index === form.steps.length - 1 ? "Ολοκλήρωση" : "Επόμενο"}
        </Button>
      </div>
    </div>
  );
}
