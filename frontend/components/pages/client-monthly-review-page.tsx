"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Cloud, Dumbbell, Send, Sparkles, Target, Trophy } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { isVisible, validateStep } from "@/lib/update-form/logic";
import type { Answers, FormDefinition } from "@/lib/update-form/types";
import { UpdateQuestionField } from "@/components/pages/client-weekly-update-wizard";

type Summary = {
  weights: { first: number | null; last: number | null; delta: number | null };
  updates: { completed: number; expected: number; averageScore: number | null };
  workouts: { completed: number; planned: number | null };
};

type ReviewResponse = {
  review: { id: number; status: "open" | "draft" | "submitted" | "reviewed"; periodStart: string; periodEnd: string; dueAt: string; submittedAt?: string | null; answers: Answers; autoSnapshot: { stepIndex?: number } };
  form: FormDefinition;
  summary: Summary;
  subscription: { endDate: string; daysRemaining: number } | null;
};

const greekDate = (value?: string | null) => value ? new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" }).format(new Date(value)) : "—";
const elapsed = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toLocaleString("el-GR", { maximumFractionDigits: 1 })} kg`;

function MobileHeader({ current, form }: { current: number; form: FormDefinition }) {
  const step = form.steps[current];
  return <div className="rounded-[20px] bg-[#0b0b0b] px-[18px] py-4 text-white sm:hidden">
    <div className="flex items-center justify-between text-[13px] font-extrabold"><span>Μηνιαία ανασκόπηση</span><span className="text-[#9a9a9a]">Βήμα <b className="text-accent">{current + 1}</b> / {form.steps.length}</span></div>
    <div className="mt-3 flex gap-1">{form.steps.map((item, index) => <span key={item.id} className={`h-1.5 flex-1 rounded-full ${index <= current ? "bg-accent" : "bg-[#303030]"}`} />)}</div>
    <div className="mt-3 flex items-center justify-between"><b className="text-[13px]">{step?.title}</b><span className="text-[12px] text-[#9a9a9a]">{current === form.steps.length - 1 ? "μετά: Υποβολή" : `μετά: ${form.steps[current + 1]?.title}`}</span></div>
  </div>;
}

function DesktopStepper({ current, form, onStep }: { current: number; form: FormDefinition; onStep: (index: number) => void }) {
  return <div className="hidden overflow-hidden rounded-[20px] border border-border bg-card sm:block"><div className="grid" style={{ gridTemplateColumns: `repeat(${form.steps.length}, minmax(0, 1fr))` }}>{form.steps.map((step, index) => <button key={step.id} type="button" onClick={() => onStep(index)} className={`min-w-0 p-4 text-left transition-colors ${index === current ? "bg-muted/70" : "hover:bg-muted/40"}`}><span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold ${index < current ? "bg-accent text-accent-foreground" : index === current ? "bg-foreground text-accent" : "bg-muted text-muted-foreground"}`}>{index < current ? <Check className="h-4 w-4" strokeWidth={3} /> : index + 1}</span><small className="mt-2 block text-[10px] text-muted-foreground">Βήμα {index + 1}</small><b className="block break-words text-xs leading-4">{step.title}</b></button>)}</div></div>;
}

function CycleSnapshot({ summary }: { summary: Summary }) {
  const rows = [
    ["Βάρος αρχής", summary.weights.first === null ? "—" : `${summary.weights.first.toLocaleString("el-GR")} kg`],
    ["Τελευταίο βάρος", summary.weights.last === null ? "—" : `${summary.weights.last.toLocaleString("el-GR")} kg`],
    ["Μεταβολή", elapsed(summary.weights.delta)],
    ["Εβδομαδιαία updates", `${summary.updates.completed} / ${summary.updates.expected}`],
    ["Μέσο σκορ update", summary.updates.averageScore === null ? "—" : `${summary.updates.averageScore}/100`],
    ["Ολοκληρωμένες προπονήσεις", summary.workouts.planned === null ? String(summary.workouts.completed) : `${summary.workouts.completed} / ${summary.workouts.planned}`],
  ];
  return <div className="space-y-5"><div><h2 className="text-xl font-extrabold tracking-[-.3px]">Η πρόοδός σου</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Μια συνοπτική εικόνα του κύκλου σου πριν προχωρήσεις στην ανασκόπηση.</p></div><div className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-[16px] border border-border bg-muted/30 px-4 py-3"><p className="text-[11px] font-bold text-muted-foreground">{label}</p><p className="mt-1 text-lg font-extrabold">{value}</p></div>)}</div><div className="rounded-[16px] bg-[var(--sp-lime-soft)] p-4 text-sm leading-6"><b>Οι φωτογραφίες και οι μετρήσεις σου</b><p className="mt-1 text-muted-foreground">Ο coach τις αξιολογεί μαζί με τα εβδομαδιαία updates για να προσαρμόσει σωστά τον επόμενο κύκλο.</p></div><p className="text-sm text-muted-foreground">Οι πόντοι του κύκλου σου φαίνονται στα <Link className="font-extrabold text-foreground underline underline-offset-4" href="/client-points">Πόντοι & Rewards</Link>.</p></div>;
}

function SideSummary({ summary, form, current }: { summary: Summary; form: FormDefinition; current: number }) {
  return <aside className="hidden space-y-4 lg:sticky lg:top-5 lg:block lg:self-start">
    <Card className="overflow-hidden rounded-[20px] border-[#0b0b0b] bg-[#0b0b0b] text-white shadow-none"><CardContent className="relative p-5"><span className="absolute -top-4 right-[22px] h-[52px] w-2 -skew-x-[18deg] bg-accent" /><p className="text-[11px] font-extrabold tracking-[1px] text-[#9a9a9a]">Ο ΚΥΚΛΟΣ ΣΟΥ</p><div className="mt-4 space-y-0 text-sm"><p className="flex justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Βάρος</span><b>{summary.weights.last ?? "—"}{summary.weights.last !== null && " kg"}</b></p><p className="flex justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Μεταβολή</span><b className="text-accent">{elapsed(summary.weights.delta)}</b></p><p className="flex justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Updates</span><b>{summary.updates.completed}/{summary.updates.expected}</b></p><p className="flex justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Προπονήσεις</span><b>{summary.workouts.completed}</b></p></div></CardContent></Card>
    <Card className="rounded-[20px] shadow-none"><CardContent className="p-5"><h3 className="font-extrabold">Τι ζητάμε</h3><div className="mt-3 space-y-2.5">{form.steps.map((step, index) => <div key={step.id} className={`flex items-center gap-2 text-sm ${index === current ? "font-extrabold" : "text-muted-foreground"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${index === current ? "bg-foreground text-accent" : "bg-muted"}`}>{index + 1}</span>{step.title}<small className="ml-auto text-xs">{index === 0 ? "1′" : "1′"}</small></div>)}</div></CardContent></Card>
    <Card className="rounded-[20px] bg-muted/40 shadow-none"><CardContent className="p-5"><h3 className="font-extrabold">Τι γίνεται μετά</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">Ο coach θα δει την ανασκόπησή σου και θα επικοινωνήσει μαζί σου αν χρειάζεται αλλαγή στον επόμενο κύκλο.</p></CardContent></Card>
  </aside>;
}

function Completed({ subscription }: { subscription: ReviewResponse["subscription"] }) {
  return <div className="mx-auto max-w-[620px] py-8 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-foreground"><CheckCircle2 className="h-8 w-8" /></span><h1 className="mt-5 text-3xl font-extrabold tracking-[-.5px]">Η ανασκόπηση στάλθηκε</h1><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">Ευχαριστούμε για τις απαντήσεις σου. Ο coach θα τις αξιολογήσει μαζί με την πρόοδό σου.</p>{subscription && subscription.daysRemaining <= 14 && <Card className="mx-auto mt-6 max-w-md rounded-[20px] text-left shadow-none"><CardContent className="p-5"><div className="flex gap-3"><Trophy className="mt-0.5 h-5 w-5 text-accent" /><div><b>Η συνδρομή σου λήγει σύντομα</b><p className="mt-1 text-sm text-muted-foreground">Απομένουν {subscription.daysRemaining} ημέρες. Δες τις επιλογές ανανέωσης για να συνεχίσεις χωρίς διακοπή.</p><Link href="/client-billing" className="mt-3 inline-flex text-sm font-extrabold underline underline-offset-4">Πληρωμές και συνδρομή</Link></div></div></CardContent></Card>}<Link href="/client-dashboard" className="mt-7 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-extrabold text-background">Επιστροφή στην αρχική</Link></div>;
}

function MonthlyReviewWizard() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const hydrated = useRef(false);
  const lastSavedDraft = useRef("");

  useEffect(() => { api.get<ReviewResponse>("/updates/monthly-review").then((response) => { const restoredStep = Math.min(Number(response.review.autoSnapshot?.stepIndex || 0), Math.max(0, response.form.steps.length - 1)); setData(response); setAnswers(response.review.answers || {}); setStepIndex(restoredStep); lastSavedDraft.current = JSON.stringify({ answers: response.review.answers || {}, autoSnapshot: { stepIndex: restoredStep } }); setSubmitted(response.review.status === "submitted" || response.review.status === "reviewed"); }).catch((error: Error) => setMessage(error.message)).finally(() => { hydrated.current = true; setLoading(false); }); }, []);
  useEffect(() => { if (!data || !hydrated.current || submitted) return; const payload = { answers, autoSnapshot: { stepIndex } }; const serialized = JSON.stringify(payload); if (serialized === lastSavedDraft.current) return; const timer = window.setTimeout(async () => { setSaving(true); try { await api.put(`/updates/monthly-review/${data.review.id}/draft`, payload); lastSavedDraft.current = serialized; } catch (error) { setMessage(error instanceof Error ? error.message : "Δεν αποθηκεύτηκε το πρόχειρο."); } finally { setSaving(false); } }, 800); return () => window.clearTimeout(timer); }, [answers, stepIndex, data, submitted]);
  const currentStep = data?.form.steps[stepIndex];
  const visibleQuestions = useMemo(() => currentStep?.questions.filter((question) => isVisible(question, answers)) || [], [currentStep, answers]);
  const changeStep = (next: number) => { setErrors({}); setStepIndex(Math.max(0, Math.min(next, (data?.form.steps.length || 1) - 1))); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const next = () => { if (!currentStep || !data) return; const nextErrors = validateStep(currentStep, answers, false); if (Object.keys(nextErrors).length) { setErrors(nextErrors); const first = Object.keys(nextErrors)[0]; window.setTimeout(() => document.querySelector(`[data-question-id="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); return; } changeStep(stepIndex + 1); };
  const submit = async () => { if (!data) return; const allErrors = Object.assign({}, ...data.form.steps.map((step) => validateStep(step, answers, false))); if (Object.keys(allErrors).length) { setErrors(allErrors); const firstStep = data.form.steps.findIndex((step) => Object.keys(validateStep(step, answers, false)).length); setStepIndex(Math.max(0, firstStep)); return; } try { await api.post(`/updates/monthly-review/${data.review.id}/submit`, { answers }); setSubmitted(true); } catch (error) { setMessage(error instanceof Error ? error.message : "Δεν υποβλήθηκε η ανασκόπηση."); } };
  if (loading) return <ClientShell user={user} logout={logout}><main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 sm:p-6 lg:p-8"><div className="h-24 animate-pulse rounded-[20px] bg-muted" /><div className="h-96 animate-pulse rounded-[20px] bg-muted" /></main></ClientShell>;
  if (!data) return <ClientShell user={user} logout={logout}><main className="mx-auto max-w-[var(--container-7xl)] p-4 sm:p-6 lg:p-8"><Card className="mx-auto max-w-lg rounded-[20px] shadow-none"><CardContent className="p-7 text-center"><Sparkles className="mx-auto h-8 w-8 text-accent" /><h1 className="mt-4 text-xl font-extrabold">Δεν υπάρχει διαθέσιμη ανασκόπηση</h1><p className="mt-2 text-sm text-muted-foreground">{message || "Θα ειδοποιηθείς όταν ανοίξει η επόμενη μηνιαία ανασκόπηση."}</p></CardContent></Card></main></ClientShell>;
  if (submitted) return <ClientShell user={user} logout={logout}><main className="mx-auto max-w-[var(--container-7xl)] p-4 sm:p-6 lg:p-8"><Completed subscription={data.subscription} /></main></ClientShell>;
  return <ClientShell user={user} logout={logout}><main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 pb-28 sm:p-6 sm:pb-8 lg:p-8"><header className="hidden items-end justify-between gap-4 sm:flex"><div><h1 className="text-3xl font-extrabold tracking-[-.5px]">Μηνιαία ανασκόπηση</h1><p className="mt-2 text-sm text-muted-foreground">{greekDate(data.review.periodStart)} – {greekDate(data.review.periodEnd)} · στείλ’ το έως <b className="text-foreground">{greekDate(data.review.dueAt)}, 23:59</b> · ≈ 4 λεπτά</p></div><span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"><Cloud className="h-4 w-4" />{saving ? "Αποθήκευση…" : "Το πρόχειρο αποθηκεύεται"}</span></header><MobileHeader current={stepIndex} form={data.form} /><DesktopStepper current={stepIndex} form={data.form} onStep={changeStep} /><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]"><Card className="rounded-[20px] shadow-none"><CardContent className="p-5 sm:p-7">{stepIndex === 0 ? <CycleSnapshot summary={data.summary} /> : <div className="space-y-7"><div><p className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">ΒΗΜΑ {stepIndex + 1} ΑΠΟ {data.form.steps.length}</p><h2 className="mt-1 text-xl font-extrabold">{currentStep?.title}</h2></div>{visibleQuestions.map((question) => <UpdateQuestionField key={question.id} question={question} value={answers[question.id]} error={errors[question.id]} onChange={(value) => setAnswers((old) => ({ ...old, [question.id]: value }))} onFile={() => {}} />)}</div>}<div className="mt-8 flex items-center justify-between border-t border-border pt-5"><Button variant="ghost" className="h-11 rounded-full px-4 font-extrabold" disabled={stepIndex === 0} onClick={() => changeStep(stepIndex - 1)}><ArrowLeft className="mr-1 h-4 w-4" />Πίσω</Button>{stepIndex === data.form.steps.length - 1 ? <Button className="h-11 rounded-full px-5 font-extrabold" onClick={submit}>Υποβολή ανασκόπησης<Send className="ml-2 h-4 w-4" /></Button> : <Button className="h-11 rounded-full px-5 font-extrabold" onClick={next}>Επόμενο<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>{message && <p className="mt-3 text-sm font-bold text-destructive">{message}</p>}</CardContent></Card><SideSummary summary={data.summary} form={data.form} current={stepIndex} /></div></main></ClientShell>;
}

export default function ClientMonthlyReviewPage() { return <ProtectedRoute allow="client-dashboard"><MonthlyReviewWizard /></ProtectedRoute>; }
