"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Apple,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Dumbbell,
  ImagePlus,
  Info,
  Moon,
  RefreshCw,
  Send,
  Zap,
  X,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { isVisible, validateStep } from "@/lib/update-form/logic";
import type {
  Answers,
  FormDefinition,
  Question,
} from "@/lib/update-form/types";

type FormResponse = {
  form: FormDefinition;
  draft: { answers: Answers; autoSnapshot: { stepIndex?: number } } | null;
  submitted: {
    score: number | null;
    onTime: boolean;
    answers: Answers;
    showScoreToClient: boolean;
    scoreNote: string;
    tier: { title: string; message: string } | null;
  } | null;
  timelyPoints?: number;
  previousAnswers?: Answers;
  timelyStreak?: number;
};
type SubmitResponse = {
  score: number | null;
  tier: { title: string; message: string } | null;
  showScoreToClient: boolean;
  scoreNote: string;
  pointsAwarded: boolean;
  pointsEarned?: number;
  weeklyStreak?: number;
  nextStreakBonusIn?: number | null;
  nextStreakBonusPoints?: number;
  streakBonusAwarded?: boolean;
};

export function UpdateQuestionField({
  question,
  value,
  error,
  onChange,
  onFile,
  photoFiles,
  onRemoveFile,
}: {
  question: Question;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onFile: (slot: string, file?: File) => void;
  photoFiles?: Record<string, File>;
  onRemoveFile?: (slot: string) => void;
}) {
  const head = (
    <div className="space-y-1.5">
      <Label className="text-[15px] font-extrabold leading-6">
        {question.label}
        {question.required && <span className="text-destructive"> *</span>}
      </Label>
      {question.help && (
        <p className="text-[12px] leading-5 text-muted-foreground">
          {question.help}
        </p>
      )}
    </div>
  );
  const issue = error && (
    <p className="text-xs font-bold text-destructive">{error}</p>
  );
  if (question.type === "auto")
    return (
      <div className="rounded-[14px] bg-muted p-4">
        <b className="text-sm">{question.label}</b>
        <p className="mt-1 text-xs text-muted-foreground">
          Υπολογίζεται αυτόματα από τα στοιχεία της εφαρμογής.
        </p>
      </div>
    );
  if (question.type === "scale")
    return (
      <section data-question-id={question.id} className="space-y-3">
        {head}
        <p className="text-[12px] font-semibold text-muted-foreground">
          Επίλεξε από 1 έως 5
        </p>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`min-h-[80px] rounded-[14px] border p-2 text-center transition-colors ${Number(value) === n ? "border-foreground bg-accent text-accent-foreground" : "border-border bg-card hover:border-foreground"}`}
            >
              <b className="block text-xl font-extrabold italic">
                {question.display === "stars" ? "★" : n}
              </b>
              <small className="mt-1 block text-[10px] font-bold leading-3">
                {question.scaleLabels?.[n - 1] || n}
              </small>
            </button>
          ))}
        </div>
        {issue}
      </section>
    );
  if (question.type === "yes_no")
    return (
      <section data-question-id={question.id} className="space-y-3">
        {head}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={value === true ? "lime" : "outline"}
            className="h-10 rounded-full px-5"
            onClick={() => onChange(true)}
          >
            Ναι
          </Button>
          <Button
            type="button"
            variant={value === false ? "lime" : "outline"}
            className="h-10 rounded-full px-5"
            onClick={() => onChange(false)}
          >
            Όχι
          </Button>
        </div>
        {issue}
      </section>
    );
  if (question.type === "chips") {
    const selected = (value as { chips?: string[] })?.chips || [];
    return (
      <section data-question-id={question.id} className="space-y-3">
        {head}
        <div className="flex flex-wrap gap-2">
          {(question.options || []).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange({
                  chips: question.multi
                    ? selected.includes(option)
                      ? selected.filter((x) => x !== option)
                      : [...selected, option]
                    : [option],
                  text: (value as { text?: string })?.text || "",
                })
              }
              className={`rounded-full border px-3 py-2 text-xs font-extrabold ${selected.includes(option) ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}
            >
              {option}
            </button>
          ))}
        </div>
        {question.withText && (
          <Textarea
            className="min-h-24 rounded-[14px]"
            placeholder="Πρόσθεσε λεπτομέρειες…"
            value={(value as { text?: string })?.text || ""}
            onChange={(e) =>
              onChange({ chips: selected, text: e.target.value })
            }
          />
        )}
        {issue}
      </section>
    );
  }
  if (question.type === "photos")
    return (
      <PhotosQuestion
        question={question}
        value={value}
        error={error}
        onFile={onFile}
        photoFiles={photoFiles}
        onRemoveFile={onRemoveFile}
      />
    );
  return (
    <section data-question-id={question.id} className="space-y-2">
      {head}
      {question.type === "number" ? (
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            className="h-[50px] rounded-[14px] pr-14 text-base font-bold"
            value={String(value ?? "")}
            placeholder={question.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {question.unit && (
            <span className="absolute right-4 top-3.5 text-sm font-bold text-muted-foreground">
              {question.unit}
            </span>
          )}
        </div>
      ) : (
        <Textarea
          className="min-h-28 rounded-[14px]"
          value={String(value ?? "")}
          placeholder={question.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {issue}
    </section>
  );
}

function PhotosQuestion({
  question,
  value,
  error,
  onFile,
  photoFiles = {},
  onRemoveFile,
}: {
  question: Question;
  value: unknown;
  error?: string;
  onFile: (slot: string, file?: File) => void;
  photoFiles?: Record<string, File>;
  onRemoveFile?: (slot: string) => void;
}) {
  const photos = value as Record<string, boolean> | undefined;
  const [selectedFiles, setSelectedFiles] =
    useState<Record<string, File>>(photoFiles);
  useEffect(() => setSelectedFiles(photoFiles), [photoFiles]);
  const choose = (slot: string, file?: File) => {
    if (!file) return;
    setSelectedFiles((items) => ({ ...items, [slot]: file }));
    onFile(slot, file);
  };
  const remove = (slot: string) => {
    setSelectedFiles((items) => {
      const next = { ...items };
      delete next[slot];
      return next;
    });
    onRemoveFile?.(slot);
    window.dispatchEvent(
      new CustomEvent("weekly-update-remove-photo", {
        detail: { questionId: question.id, slot },
      }),
    );
  };
  return (
    <section data-question-id={question.id} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[15px] font-extrabold leading-6">
          {question.label}
          {question.required && <span className="text-destructive"> *</span>}
        </Label>
        {question.help && (
          <p className="text-[12px] leading-5 text-muted-foreground">
            {question.help}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(question.photoSlots || ["Μπροστά", "Πλάι", "Πίσω"]).map((slot) => {
          const done = Boolean(photos?.[slot]);
          const file = selectedFiles[slot] || photoFiles[slot];
          return (
            <div
              key={slot}
              className={`relative h-[220px] overflow-hidden rounded-[14px] border-2 border-dashed p-3 text-center sm:h-[240px] ${done ? "border-accent bg-[var(--sp-lime-soft)]" : "border-border bg-muted/30"}`}
            >
              {done && !file && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              {file && (
                <>
                  <LocalPhotoPreview file={file} slot={slot} />
                  <span className="absolute inset-0 bg-black/25" />
                  <button
                    type="button"
                    aria-label={`Αφαίρεση φωτογραφίας ${slot}`}
                    onClick={() => remove(slot)}
                    className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-foreground text-background shadow-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
              {file ? <span className="absolute bottom-2 left-2 z-10 rounded-full bg-foreground/85 px-2 py-1 text-[10px] font-extrabold text-background">{slot}</span> : <><ImagePlus className="relative mx-auto h-6 w-6 text-muted-foreground" /><b className="mt-1 block text-xs font-extrabold">{slot}</b><small className="block text-[11px] font-semibold text-muted-foreground">{done ? "Προστέθηκε" : "Διάλεξε τρόπο"}</small><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-1">
                <label className="flex h-10 cursor-pointer items-center justify-center rounded-full bg-foreground px-2 text-[11px] font-extrabold text-background sm:hidden">
                  Βγάλε φωτογραφία
                  <Input
                    className="hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    capture="environment"
                    onChange={(e) => choose(slot, e.target.files?.[0])}
                  />
                </label>
                <label className="flex h-10 cursor-pointer items-center justify-center rounded-full border border-foreground bg-card px-2 text-[11px] font-extrabold">
                  Ανέβασε
                  <Input
                    className="hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={(e) => choose(slot, e.target.files?.[0])}
                  />
                </label>
              </div></>}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs font-bold text-destructive">{error}</p>}
    </section>
  );
}

function LocalPhotoPreview({ file, slot }: { file: File; slot: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url ? (
    <img
      src={url}
      alt={`Προεπισκόπηση ${slot}`}
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : null;
}

function Stepper({
  form,
  step,
  go,
}: {
  form: FormDefinition;
  step: number;
  go: (n: number) => void;
}) {
  const active = form.steps[step];
  const nextLabel =
    step === form.steps.length - 1
      ? "μετά: Υποβολή"
      : `μετά: ${form.steps[step + 1]?.title || ""}`;
  return (
    <>
      <div className="overflow-hidden rounded-[20px] sm:hidden">
        <div className="flex flex-col gap-3 bg-foreground px-[18px] pb-[18px] pt-4 text-background">
          <div className="flex justify-end">
            <span className="text-xs text-[#9a9a9a]">
              Βήμα <b className="text-accent">{step + 1}</b> /{" "}
              {form.steps.length}
            </span>
          </div>
          <div className="flex gap-1">
            {form.steps.map((item, index) => (
              <i
                key={item.id}
                className={`h-[5px] flex-1 rounded-[3px] ${index <= step ? "bg-accent" : "bg-[#303030]"}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <b className="text-[13px]">{active?.title}</b>
            <span className="max-w-[52%] truncate text-right text-xs text-[#9a9a9a]">
              {nextLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="hidden overflow-hidden rounded-[20px] border border-border bg-card sm:block">
        <div className="grid grid-cols-5 gap-2 px-5 py-3">
          {form.steps.map((item, i) => (
            <div
              key={item.id}
              className="flex min-w-0 flex-col items-start gap-1 rounded-[14px] bg-muted/40 p-3"
            >
              <button
                type="button"
                disabled={i > step}
                onClick={() => go(i)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold ${i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-foreground text-accent" : "bg-muted text-muted-foreground"}`}
              >
                {i < step ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </button>
              <span className="min-w-0">
                <small className="block text-[10px] text-muted-foreground">
                  Βήμα {i + 1}
                </small>
                <b className="block break-words text-xs leading-4">
                  {item.title}
                </b>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function WeekCard({
  form,
  answers,
  timelyPoints,
  previousAnswers = {},
  timelyStreak = 0,
}: {
  form: FormDefinition;
  answers: Answers;
  timelyPoints?: number;
  previousAnswers?: Answers;
  timelyStreak?: number;
}) {
  const awardedPoints =
    timelyPoints ??
    Number(
      (
        form.settings as FormDefinition["settings"] & {
          weeklyUpdatePoints?: number;
        }
      ).weeklyUpdatePoints || 0,
    );
  const allQuestions = form.steps.flatMap((formStep, stepIndex) => formStep.questions.map((question) => ({ question, stepIndex })));
  const weightEntry = allQuestions.find(({ question }) => question.id === "weight_kg")
    || allQuestions.find(({ question }) => question.type === "number" && question.showDelta);
  const trainingEntry = allQuestions.find(({ question }) => question.id === "training_planned_completed")
    || allQuestions.find(({ question }) => /προπονήσ/i.test(question.shortLabel || question.label) && question.type !== "scale");
  const weight = weightEntry ? Number(answers[weightEntry.question.id]) : Number.NaN;
  const previousWeight = weightEntry ? Number(previousAnswers[weightEntry.question.id]) : Number.NaN;
  const weightDelta = Number.isFinite(weight) && Number.isFinite(previousWeight) ? weight - previousWeight : null;
  const trainingValue = trainingEntry ? answers[trainingEntry.question.id] : undefined;
  const weightValue = Number.isFinite(weight)
    ? <>{weight.toLocaleString("el-GR", { maximumFractionDigits: 1 })} {weightEntry?.question.unit || "kg"}{weightDelta !== null && <span className="ml-1 text-xs text-accent">{weightDelta > 0 ? "+" : ""}{weightDelta.toLocaleString("el-GR", { maximumFractionDigits: 1 })}</span>}</>
    : "—";
  const trainingDisplay = trainingValue === undefined || trainingValue === null || trainingValue === ""
    ? "—"
    : Array.isArray(trainingValue) ? trainingValue.join(", ") : String(trainingValue);
  return (
    <Card className="overflow-hidden rounded-[20px] border-[#0b0b0b] bg-[#0b0b0b] text-white shadow-none">
      <CardContent className="relative p-5">
        <span className="absolute -top-4 right-[22px] h-[52px] w-2 -skew-x-[18deg] bg-accent" />
        <p className="text-[11px] font-extrabold tracking-[1px] text-[#9a9a9a]">
          Η ΕΒΔΟΜΑΔΑ ΣΟΥ
        </p>
        <div className="relative mt-4 space-y-0 text-sm">
          <p className="flex items-baseline justify-between gap-4 border-t border-[#222] py-2">
            <span className="min-w-0 text-[#bdbdbd]">Βάρος{weightEntry ? ` (βήμα ${weightEntry.stepIndex + 1})` : ""}</span>
            <b className="shrink-0 text-right">{weightValue}</b>
          </p>
          <p className="flex items-baseline justify-between gap-4 border-t border-[#222] py-2">
            <span className="min-w-0 text-[#bdbdbd]">Προπονήσεις</span>
            <b className="max-w-[58%] shrink-0 text-right">{trainingDisplay}</b>
          </p>
          <p className="flex items-baseline justify-between gap-4 border-t border-[#222] py-2">
            <span className="min-w-0 text-[#bdbdbd]">Συνέπεια updates</span>
            <b className="shrink-0 text-right">{timelyStreak ? `${timelyStreak} ${timelyStreak === 1 ? "εβδομάδα" : "εβδομάδες"} στη σειρά` : "Ξεκίνα τώρα"}</b>
          </p>
          {awardedPoints > 0 && <p className="flex items-baseline justify-between gap-4 border-t border-[#222] py-2">
            <span className="text-[#bdbdbd]">Αν το στείλεις στην ώρα</span>
            <b className="text-accent">
              +{awardedPoints.toLocaleString("el-GR")} πόντοι
            </b>
          </p>}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreScreen({
  form,
  answers,
  result,
}: {
  form: FormDefinition;
  answers: Answers;
  result: SubmitResponse;
}) {
  const score = result.score ?? 0;
  const tier =
    result.tier ||
    form.scoreTiers.find((x) => score >= x.min && score <= x.max);
  const scored = form.steps
    .flatMap((x) => x.questions)
    .filter((q) => q.type === "scale" && q.scored && isVisible(q, answers));
  const scoreIcon = (question: Question) => question.id.includes("diet") ? Apple : question.id.includes("training") ? Dumbbell : question.id.includes("sleep") ? Moon : Zap;
  const sentAt = new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date());
  const scoreTiers = form.scoreTiers.slice().sort((a, b) => a.min - b.min);
  const activeTierIndex = scoreTiers.findIndex((item) => score >= item.min && score <= item.max);
  const scoreCircumference = 2 * Math.PI * 78;
  const scoreDash = (Math.max(0, Math.min(100, score)) / 100) * scoreCircumference;
  return (
    <main className="mx-auto max-w-[720px] p-4 pb-24 sm:p-8">
      <Card className="overflow-hidden rounded-[28px] border-border shadow-[0_30px_80px_rgba(0,0,0,.06)]">
        <CardContent className="p-0">
          <header className="flex items-center gap-3.5 border-b border-border/70 px-5 py-5 sm:px-7">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-5 w-5" strokeWidth={3} /></span>
            <span><h1 className="text-[20px] font-extrabold">Το update στάλθηκε στον coach</h1><p className="mt-0.5 text-[13px] text-muted-foreground">{sentAt} · {result.pointsAwarded ? "στην ώρα του" : "καταχωρήθηκε"}</p></span>
          </header>
          <div className="space-y-5 p-5 sm:p-7">
            {result.showScoreToClient ? <>
              <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
                <div className="relative mx-auto h-[170px] w-[170px] shrink-0 sm:mx-0"><svg width="170" height="170" viewBox="0 0 170 170" className="-rotate-90"><circle cx="85" cy="85" r="78" fill="none" stroke="#ececea" strokeWidth="14" /><circle cx="85" cy="85" r="78" fill="none" stroke="#b0f90c" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${scoreDash} ${scoreCircumference}`} /></svg><span className="absolute inset-0 flex flex-col items-center justify-center text-center"><b className="block text-[50px] font-extrabold italic leading-none tracking-[-1.5px]">{score}</b><small className="mt-1 block text-[13px] font-bold text-muted-foreground">/ 100</small></span></div>
                <div className="min-w-0 flex-1"><p className="text-[12px] font-extrabold tracking-[1px] text-muted-foreground">ΤΟ ΣΚΟΡ ΤΗΣ ΕΒΔΟΜΑΔΑΣ ΣΟΥ</p><h2 className="mt-2 text-[26px] font-extrabold leading-tight tracking-[-.6px]">{score}/100 · {tier?.title}</h2><p className="mt-2 text-[15px] leading-6 text-foreground/80">{tier?.message}</p><div className="mt-4 flex gap-1">{scoreTiers.map((item, index) => <span key={`${item.min}-${item.max}`} className="min-w-0 flex-1"><i className={`block h-[5px] rounded-[3px] ${index === activeTierIndex ? "bg-foreground" : "bg-muted"}`} /><small className={`mt-1 block text-[10px] font-bold ${index === activeTierIndex ? "text-foreground" : "text-muted-foreground"}`}>{item.min}–{item.max}</small></span>)}</div></div>
              </section>
              <section className="space-y-3 rounded-[18px] border border-border bg-muted/35 p-4 sm:p-[18px]"><p className="text-[12px] font-extrabold tracking-[.8px] text-muted-foreground">ΑΠΟ ΤΙΣ ΑΠΑΝΤΗΣΕΙΣ ΣΟΥ (1–5)</p>{scored.map((question) => { const value = Number(answers[question.id] || 0); const Icon = scoreIcon(question); return <div key={question.id} className="flex items-center gap-2.5 sm:gap-3"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-muted"><Icon className="h-[14px] w-[14px]" /></span><b className="w-[92px] shrink-0 truncate text-[13px] sm:w-[120px]">{question.shortLabel || question.label}</b><span className="flex flex-1 gap-1">{[1,2,3,4,5].map((number) => <i key={number} className={`h-2 flex-1 rounded-full ${number <= value ? "bg-accent" : "bg-muted"}`} />)}</span><b className="w-8 shrink-0 text-right text-[13px]">{value}/5</b></div> })}</section>
              <p className="flex gap-2 text-[13px] leading-5 text-foreground/75"><Info className="mt-0.5 h-[15px] w-[15px] shrink-0 text-muted-foreground" />{result.scoreNote || form.scoreNote}</p>
            </> : <section className="py-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-accent" /><h2 className="mt-4 text-2xl font-extrabold">Το update στάλθηκε</h2><p className="mt-2 text-sm text-muted-foreground">Ο coach σου θα αξιολογήσει την πρόοδό σου.</p></section>}
            {result.pointsAwarded && Number(result.pointsEarned) > 0 && <div className="flex items-center gap-3 rounded-[16px] bg-foreground px-4 py-3.5 text-background"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-accent text-accent-foreground"><RefreshCw className="h-[17px] w-[17px]" /></span><span className="min-w-0 flex-1"><b className="block text-[15px]">Κέρδισες +{Number(result.pointsEarned).toLocaleString("el-GR")} πόντους</b><small className="mt-0.5 block text-[12px] text-[#9a9a9a]">Έγκαιρο weekly update{result.weeklyStreak ? ` · ${result.weeklyStreak}η εβδομάδα στη σειρά` : ""}{result.streakBonusAwarded ? " · bonus συνέπειας" : result.nextStreakBonusIn === 1 ? ` · στο επόμενο +${Number(result.nextStreakBonusPoints || 0).toLocaleString("el-GR")}` : result.nextStreakBonusIn ? ` · σε ${result.nextStreakBonusIn} ακόμη updates +${Number(result.nextStreakBonusPoints || 0).toLocaleString("el-GR")}` : ""}</small></span><b className="shrink-0 text-[22px] italic text-accent">+{Number(result.pointsEarned).toLocaleString("el-GR")}</b></div>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button asChild variant="outline" className="h-12 rounded-full border-[1.5px] border-foreground px-5"><Link href="/client-progress">Δες την πρόοδό σου</Link></Button><Button asChild variant="lime" className="h-12 rounded-full px-6"><Link href="/client/dashboard">Πίσω στην αρχική <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Wizard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<FormResponse | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<
    Array<{ id: string; slot: string; file: File }>
  >([]);
  const [saved, setSaved] = useState<Date | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [sending, setSending] = useState(false);
  const lastSavedDraft = useRef("");
  useEffect(() => {
    api
      .get<FormResponse>("/updates/form")
      .then((response) => {
        setData(response);
        setAnswers(response.draft?.answers || response.submitted?.answers || {});
        setStep(
          Math.max(0, Number(response.draft?.autoSnapshot?.stepIndex || 0)),
        );
        if (response.submitted) {
          setResult({
            score: response.submitted.score,
            tier: response.submitted.tier,
            showScoreToClient: response.submitted.showScoreToClient,
            scoreNote: response.submitted.scoreNote,
            // The points have already been credited in the original submit;
            // do not announce or award them again when reopening the page.
            pointsAwarded: false,
          });
        }
      })
      .catch(() => setData(null));
  }, []);
  useEffect(() => {
    if (!data || data.submitted) return;
    const payload = JSON.stringify({ answers, stepIndex: step });
    if (!lastSavedDraft.current) {
      lastSavedDraft.current = payload;
      return;
    }
    if (payload === lastSavedDraft.current) return;
    const t = window.setTimeout(
      () =>
        api
          .put("/updates/draft", { answers, autoSnapshot: { stepIndex: step } })
          .then(() => {
            lastSavedDraft.current = payload;
            setSaved(new Date());
          })
          .catch(() => undefined),
      800,
    );
    return () => clearTimeout(t);
  }, [answers, step, data]);
  useEffect(() => {
    const removePhoto = (event: Event) => {
      const detail = (event as CustomEvent<{ questionId?: string; slot?: string }>).detail;
      if (!detail?.questionId || !detail.slot) return;
      const questionId = detail.questionId;
      const slot = detail.slot;
      setFiles((items) => items.filter((item) => !(item.id === questionId && item.slot === slot)));
      setAnswers((current) => {
        const photos = { ...((current[questionId] as Record<string, boolean>) || {}) };
        delete photos[slot];
        return { ...current, [questionId]: photos };
      });
    };
    window.addEventListener("weekly-update-remove-photo", removePhoto);
    return () => window.removeEventListener("weekly-update-remove-photo", removePhoto);
  }, []);
  if (!data)
    return (
      <ClientShell user={user} logout={logout} paymentApproved={false}>
        <main className="mx-auto max-w-[var(--container-7xl)] p-8 text-sm text-muted-foreground">
          Φόρτωση update…
        </main>
      </ClientShell>
    );
  if (result)
    return (
      <ClientShell user={user} logout={logout} paymentApproved>
        <ScoreScreen form={data.form} answers={answers} result={result} />
      </ClientShell>
    );
  const reviewing = step >= data.form.steps.length;
  const active = data.form.steps[Math.min(step, data.form.steps.length - 1)];
  const answer = (id: string, v: unknown) => {
    setErrors((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
    setAnswers((a) => ({ ...a, [id]: v }));
  };
  const next = () => {
    const found = validateStep(
      active,
      answers,
      data.form.settings.photosRequired,
    );
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      document
        .querySelector(`[data-question-id="${first}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStep((n) => n + 1);
  };
  const submit = async () => {
    const all = Object.assign(
      {},
      ...data.form.steps.map((s) =>
        validateStep(s, answers, data.form.settings.photosRequired),
      ),
    );
    if (Object.keys(all).length) {
      setErrors(all);
      setStep(
        data.form.steps.findIndex(
          (s) =>
            Object.keys(
              validateStep(s, answers, data.form.settings.photosRequired),
            ).length,
        ),
      );
      return;
    }
    setSending(true);
    const body = new FormData();
    body.append("answers", JSON.stringify(answers));
    files.forEach((x) => body.append("files", x.file));
    body.append("fileSlots", JSON.stringify(files.map((file) => file.slot)));
    try {
      setResult(await api.upload<SubmitResponse>("/updates/submit-form", body));
    } finally {
      setSending(false);
    }
  };
  const doneSteps = data.form.steps.filter(
    (s) =>
      !Object.keys(validateStep(s, answers, data.form.settings.photosRequired))
        .length,
  ).length;
  return (
    <ClientShell user={user} logout={logout} paymentApproved>
      <main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 pb-28 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/client/dashboard"
              className="inline-flex items-center gap-1 text-[13px] font-extrabold text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Αρχική
            </Link>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-[-.5px]">
              Εβδομαδιαίο update
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Οι τελευταίες επτά ημέρες · στείλ’ το έως{" "}
              <b className="text-foreground">
                {data.form.settings.deadlineTime || "Δευτέρα 23:59"}
              </b>{" "}
              · ≈ 3 λεπτά
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Cloud className="h-3.5 w-3.5" />
              {saved
                ? `Πρόχειρο αποθηκεύτηκε ${saved.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}`
                : "Το πρόχειρο αποθηκεύεται αυτόματα"}
            </span>
            <span className="rounded-full bg-accent px-3 py-2 text-xs font-extrabold text-accent-foreground">
              +100 πόντοι αν σταλεί στην ώρα
            </span>
          </div>
        </header>
        <Stepper
          form={data.form}
          step={step}
          go={(n) => n <= step && setStep(n)}
        />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <Card className="rounded-[20px] border-border shadow-none">
            <CardContent className="p-4 sm:p-6 lg:p-7">
              {reviewing ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">
                      ΤΕΛΙΚΟ ΒΗΜΑ
                    </p>
                    <h2 className="mt-1 text-[24px] font-extrabold">
                      Ανασκόπηση
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Έλεγξε τις απαντήσεις σου πριν την υποβολή.
                    </p>
                  </div>
                  {data.form.steps.map((s, i) => (
                    <div
                      key={s.id}
                      className="rounded-[16px] border border-border p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <b className="text-[15px]">{s.title}</b>
                        <button
                          type="button"
                          onClick={() => setStep(i)}
                          className="text-xs font-extrabold underline underline-offset-4"
                        >
                          Αλλαγή
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {s.questions
                          .filter((q) => isVisible(q, answers))
                          .map(
                            (q) =>
                              `${q.shortLabel}: ${typeof answers[q.id] === "object" ? "Συμπληρώθηκε" : answers[q.id] || "—"}`,
                          )
                          .join(" · ") || "Δεν υπάρχουν ερωτήσεις"}
                      </p>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="lime"
                    className="h-[54px] w-full rounded-full"
                    disabled={sending}
                    onClick={submit}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? "Υποβολή…" : "Υποβολή update · +100 πόντοι"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-7">
                  <div>
                    <p className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">
                      ΒΗΜΑ {step + 1} ΑΠΟ {data.form.steps.length}
                    </p>
                    <h2 className="mt-1 text-[25px] font-extrabold tracking-[-.3px]">
                      {active.title}
                    </h2>
                    {step === 0 && (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Συμπλήρωσε τη φόρμα για τις τελευταίες επτά ημέρες. Οι
                        απαντήσεις βοηθούν τον coach να καταλάβει τι λειτούργησε
                        και τι χρειάζεται αλλαγή.
                      </p>
                    )}
                  </div>
                  <div className="space-y-8">
                    {active.questions
                      .filter((q) => isVisible(q, answers))
                      .map((q) => (
                        <UpdateQuestionField
                          key={q.id}
                          question={q}
                          value={answers[q.id]}
                          error={errors[q.id]}
                          onChange={(v) => answer(q.id, v)}
                          onFile={(slot, file) => {
                            if (!file) return;
                            setFiles((items) => [
                              ...items.filter(
                                (x) => !(x.id === q.id && x.slot === slot),
                              ),
                              { id: q.id, slot, file },
                            ]);
                            answer(q.id, {
                              ...((answers[q.id] as object) || {}),
                              [slot]: true,
                            });
                          }}
                          photoFiles={Object.fromEntries(
                            files
                              .filter((file) => file.id === q.id)
                              .map((file) => [file.slot, file.file]),
                          )}
                        />
                      ))}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-5">
                    {step > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full px-5"
                        onClick={() => setStep(step - 1)}
                      >
                        Πίσω
                      </Button>
                    ) : (
                      <span />
                    )}
                    {step === data.form.steps.length - 1 ? (
                      <Button
                        type="button"
                        className="h-11 rounded-full bg-foreground px-5 text-background"
                        onClick={next}
                      >
                        Ανασκόπηση <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="h-11 rounded-full bg-foreground px-5 text-background"
                        onClick={next}
                      >
                        Επόμενο <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <aside className="space-y-4">
            <WeekCard form={data.form} answers={answers} timelyPoints={data.timelyPoints} previousAnswers={data.previousAnswers} timelyStreak={data.timelyStreak} />
            <Card className="hidden rounded-[20px] xl:block">
              <CardContent className="p-5">
                <h3 className="text-[15px] font-extrabold">
                  Πρόοδος συμπλήρωσης
                </h3>
                <div className="mt-4 space-y-3">
                  {data.form.steps.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => i <= step && setStep(i)}
                      className={`flex w-full items-center gap-3 text-left text-sm font-bold ${i <= step ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-foreground text-accent" : "bg-muted"}`}
                      >
                        {i < step ? (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      {s.title}
                    </button>
                  ))}
                </div>
                <p className="mt-5 border-t border-border pt-3 text-xs text-muted-foreground">
                  {doneSteps} / {data.form.steps.length} ενότητες έτοιμες
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </main>
    </ClientShell>
  );
}

export default function ClientWeeklyUpdateWizardPage() {
  return (
    <ProtectedRoute allow="client-dashboard">
      <Wizard />
    </ProtectedRoute>
  );
}
