"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ClipboardList, HeartPulse, ImagePlus, Moon, Send, Scale, UtensilsCrossed } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth/auth-context"
import { api } from "@/lib/api/client"

type Question = { id: number; question: string; type: string; isRequired: boolean; options?: string[]; placeholder?: string | null; allowPhotos?: boolean; standardKey?: string | null; section?: string | null }
type UpdateHistory = { id: number; submittedAt: string; weight?: number | null }
type Dashboard = { client: { subscriptionStatus?: string | null; daysRemaining?: number | null }; nextUpdateDate?: string | null; streak?: number }
type Workout = { completed_at: string }
type UpdateFile = { file: File; questionId: number; angle: "front" | "side" | "back" }

const photoAngles = [{ key: "front", label: "Μπροστά" }, { key: "side", label: "Πλάι" }, { key: "back", label: "Πίσω" }] as const
const stepDefinitions = [
  { key: "weight", title: "Βάρος", icon: Scale, hint: "30″" },
  { key: "nutrition_training", title: "Διατροφή & προπόνηση", icon: UtensilsCrossed, hint: "1′" },
  { key: "sleep_recovery", title: "Ύπνος & αποκατάσταση", icon: Moon, hint: "30″" },
  { key: "health_week", title: "Υγεία & εβδομάδα", icon: HeartPulse, hint: "30″" },
  { key: "photos", title: "Φωτογραφίες", icon: ImagePlus, hint: "1′" },
] as const

function sectionFor(question: Question) {
  if (question.section) return question.section
  const key = question.standardKey || ""
  if (["weight_kg", "activity_details"].includes(key)) return "weight"
  if (["nutrition_consistency", "nutrition_details", "nutrition_changes", "training_consistency", "training_details", "training_tags"].includes(key)) return "nutrition_training"
  if (["sleep_hours", "sleep_quality", "recovery_quality", "recovery_details"].includes(key)) return "sleep_recovery"
  if (["health_change", "health_details", "next_week_needs", "next_week_tags", "other_notes"].includes(key)) return "health_week"
  if (question.allowPhotos || question.type === "photos" || key === "progress_photos") return "photos"
  return "health_week"
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" }).format(new Date(value)) : "—" }

function RatingButtons({ value, onChange, labels }: { value: string; onChange: (value: string) => void; labels?: string[] }) {
  return <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => onChange(String(rating))} className={`min-h-[76px] rounded-[14px] border p-2 text-center transition-colors ${value === String(rating) ? "border-[#0b0b0b] bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"}`}><b className="block text-lg font-extrabold">{rating}</b><span className="mt-1 block text-[10px] font-semibold leading-3">{labels?.[rating - 1] || ""}</span></button>)}</div>
}

function ClientWeeklyUpdateContent() {
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [history, setHistory] = useState<UpdateHistory[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [files, setFiles] = useState<UpdateFile[]>([])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({})

  useEffect(() => {
    Promise.all([api.get<Dashboard>("/client/dashboard"), api.get<Question[]>("/updates/questions"), api.get<UpdateHistory[]>("/client/updates"), api.get<Workout[]>("/client/workout/history")])
      .then(([dashboardData, questionData, historyData, workoutData]) => { setDashboard(dashboardData); setQuestions(questionData); setHistory(historyData); setWorkouts(workoutData) })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το update."))
      .finally(() => setLoading(false))
  }, [])

  const grouped = useMemo(() => Object.fromEntries(stepDefinitions.map((definition) => [definition.key, questions.filter((question) => sectionFor(question) === definition.key)])), [questions]) as Record<string, Question[]>
  const currentDefinition = stepDefinitions[step]
  const currentQuestions = grouped[currentDefinition.key] || []
  const currentWeight = questions.find((question) => question.standardKey === "weight_kg")
  const previousWeight = history.find((item) => item.weight != null)?.weight
  const enteredWeight = currentWeight ? Number(String(answers[currentWeight.id] || "").replace(",", ".")) : NaN
  const weightDifference = Number.isFinite(enteredWeight) && previousWeight != null ? enteredWeight - Number(previousWeight) : null
  const nutritionQuestion = questions.find((question) => question.standardKey === "nutrition_consistency")
  const healthQuestion = questions.find((question) => question.standardKey === "health_change")
  const isNutritionPerfect = nutritionQuestion && answers[nutritionQuestion.id] === "5"
  const healthIsYes = healthQuestion && String(answers[healthQuestion.id]).startsWith("Ναι")
  const weekStart = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" }).format(new Date())
  const completedWorkouts = workouts.filter((item) => (Date.now() - new Date(item.completed_at).getTime()) < 8 * 86400000).length

  const setAnswer = (id: number, value: string | string[]) => setAnswers((current) => ({ ...current, [id]: value }))
  const shouldShow = (question: Question) => {
    if (question.standardKey === "nutrition_details" || question.standardKey === "nutrition_changes") return !isNutritionPerfect
    if (question.standardKey === "health_details") return healthIsYes
    return true
  }
  const isRequiredNow = (question: Question) => question.isRequired && shouldShow(question) && question.standardKey !== "progress_photos"

  const validateStep = () => {
    const nextErrors: Record<number, string> = {}
    currentQuestions.filter(shouldShow).forEach((question) => {
      const value = answers[question.id]
      if (isRequiredNow(question) && (!value || (Array.isArray(value) && value.length === 0))) nextErrors[question.id] = "Συμπλήρωσε αυτό το πεδίο για να συνεχίσεις."
    })
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }
  const goNext = () => { if (validateStep()) setStep((current) => Math.min(stepDefinitions.length - 1, current + 1)) }
  const chooseFiles = (questionId: number, angle: UpdateFile["angle"], file?: File) => setFiles((current) => [...current.filter((entry) => entry.questionId !== questionId || entry.angle !== angle), ...(file ? [{ file, questionId, angle }] : [])])

  const renderQuestion = (question: Question) => {
    if (!shouldShow(question)) return null
    const value = answers[question.id] ?? (question.type === "multi_select" ? [] : "")
    const hasError = fieldErrors[question.id]
    const common = <>{hasError && <p className="mt-2 text-xs font-bold text-destructive">{hasError}</p>}</>
    if (question.allowPhotos || question.type === "photos") return <div key={question.id} className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">Ίδιο φως, απόσταση και στάση με τις προηγούμενες · χωρίς φίλτρα.</p><div className="grid grid-cols-3 gap-2 sm:gap-3">{photoAngles.map((angle) => { const selected = files.find((file) => file.questionId === question.id && file.angle === angle.key); return <div key={angle.key} className="space-y-2 text-center"><label className={`relative flex h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] border border-dashed ${selected ? "border-accent bg-[color:var(--sp-lime-soft)]" : "border-border bg-muted/20"}`}><Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => chooseFiles(question.id, angle.key, event.target.files?.[0])} /><ImagePlus className="h-7 w-7 text-muted-foreground" />{selected && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3.5 w-3.5" /></span>}</label><p className="text-xs font-extrabold">{angle.label}</p><label className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full bg-foreground text-[10px] font-extrabold text-background sm:hidden"><Camera className="h-3 w-3" />Κάμερα<Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(event) => chooseFiles(question.id, angle.key, event.target.files?.[0])} /></label></div> })}</div>{common}</div>
    if (question.type === "rating") { const labels = question.standardKey === "nutrition_consistency" ? ["Καθόλου", "Λίγες μέρες", "Μισές μέρες", "Σχεδόν πλήρως", "Πλήρως"] : question.standardKey === "training_consistency" ? ["Δεν το εφάρμοσα", "Λίγο", "Περίπου μισό", "Σχεδόν όλο", "Ολόκληρο"] : undefined; return <div key={question.id} className="space-y-3"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label><RatingButtons value={String(value)} onChange={(next) => setAnswer(question.id, next)} labels={labels} />{question.standardKey === "training_consistency" && <p className="text-xs text-muted-foreground">Η αύξηση δύναμης δεν είναι απαραίτητη για να επιλέξεις 5.</p>}{common}</div> }
    if (question.type === "multi_select") { const selected = Array.isArray(value) ? value : []; const options = question.options || []; return <div key={question.id} className="space-y-3"><Label className="text-[15px] font-extrabold">{question.question}</Label><div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} type="button" onClick={() => setAnswer(question.id, selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} className={`rounded-full border px-3 py-2 text-xs font-extrabold ${selected.includes(option) ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}>{option}</button>)}</div>{common}</div> }
    if (question.type === "single_select" || question.type === "select") return <div key={question.id} className="space-y-3"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label><div className="flex flex-wrap gap-2">{(question.options || []).map((option) => <button key={option} type="button" onClick={() => setAnswer(question.id, option)} className={`min-w-24 rounded-full border px-4 py-2.5 text-sm font-extrabold ${value === option ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}>{option}</button>)}</div>{common}</div>
    const isLong = question.type === "textarea"; return <div key={question.id} className="space-y-2"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label>{isLong ? <Textarea value={String(value)} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={question.placeholder || "Γράψε εδώ…"} className="min-h-28 rounded-[14px]" /> : <Input type={question.type === "number" ? "text" : "text"} inputMode={question.type === "number" ? "decimal" : undefined} value={String(value)} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={question.placeholder || ""} className="h-12 rounded-[14px]" />}{common}</div>
  }

  const submit = async (event: FormEvent) => { event.preventDefault(); if (!validateStep()) return; setSubmitting(true); try { const body = new FormData(); body.append("answers", JSON.stringify(Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })))); files.forEach((item) => body.append("files", item.file)); body.append("fileQuestionIds", JSON.stringify(files.map((item) => item.questionId))); body.append("fileAngles", JSON.stringify(files.map((item) => item.angle))); await api.upload("/client/updates/submit", body); setSubmitted(true) } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Δεν υποβλήθηκε το update.") } finally { setSubmitting(false) } }

  if (loading) return <ClientShell user={user} logout={logout} paymentApproved={false}><p className="p-6 text-muted-foreground">Φόρτωση update…</p></ClientShell>
  const Icon = currentDefinition.icon
  return <ClientShell user={user} logout={logout} paymentApproved={dashboard?.client.subscriptionStatus === "active"} subscriptionStatus={dashboard?.client.subscriptionStatus} daysRemaining={dashboard?.client.daysRemaining}>
    <main className="mx-auto max-w-[var(--container-7xl)] space-y-5 pb-24 sm:p-6 lg:p-8"><header className="flex flex-wrap items-center justify-between gap-3"><Link href="/client/dashboard" className="inline-flex items-center gap-1 text-sm font-extrabold hover:underline"><ArrowLeft className="h-4 w-4" />Αρχική</Link><span className="text-xs text-muted-foreground">Βήμα <b className="text-accent">{step + 1}</b> / 5</span></header><div><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Εβδομαδιαίο update</h1><p className="mt-1 text-sm text-muted-foreground">Εβδομάδα {weekStart} · ≈ 3 λεπτά</p></div><div className="grid grid-cols-5 gap-1.5">{stepDefinitions.map((item, index) => <button key={item.key} type="button" onClick={() => index <= step && setStep(index)} className={`h-1.5 rounded-full ${index <= step ? "bg-accent" : "bg-muted"}`} aria-label={item.title} />)}</div><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><form onSubmit={submit} className="space-y-4"><Card className="rounded-[20px]"><CardContent className="p-5 sm:p-6"><span className="grid h-10 w-10 place-items-center rounded-[12px] bg-foreground text-accent"><Icon className="h-5 w-5" /></span><p className="mt-4 text-[11px] font-extrabold tracking-[1px] text-muted-foreground">ΒΗΜΑ {step + 1} ΑΠΟ 5</p><h2 className="mt-1 text-xl font-extrabold">{currentDefinition.title}</h2><div className="mt-6 space-y-6">{currentDefinition.key === "nutrition_training" && <div className="rounded-[14px] bg-[var(--sp-lime-soft)] p-4 text-sm"><b>Από την εφαρμογή:</b> {completedWorkouts} προπονήσεις ολοκληρώθηκαν αυτή την εβδομάδα.</div>}{currentDefinition.key === "weight" && weightDifference !== null && <p className="rounded-[14px] bg-muted p-3 text-sm font-bold">Διαφορά από το προηγούμενο update: <span className="text-accent-foreground">{weightDifference > 0 ? "+" : ""}{weightDifference.toFixed(1).replace(".", ",")} kg</span></p>}{currentQuestions.map(renderQuestion)}{!currentQuestions.length && <p className="text-sm text-muted-foreground">Δεν υπάρχουν πεδία σε αυτή την ενότητα.</p>}</div><div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">{step > 0 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>‹ {stepDefinitions[step - 1].title}</Button> : <span />}{step < 4 ? <Button type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={goNext}>Επόμενο: {stepDefinitions[step + 1].title}<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="submit" variant="lime" disabled={submitting}> <Send className="mr-2 h-4 w-4" />{submitting ? "Υποβολή…" : "Υποβολή update"}</Button>}</div></CardContent></Card></form><aside className="hidden space-y-4 lg:block"><Card className="overflow-hidden border-[#0b0b0b] bg-[#0b0b0b] text-white"><CardContent className="p-5"><p className="text-[11px] font-extrabold tracking-[1px] text-neutral-400">Η ΕΒΔΟΜΑΔΑ ΣΟΥ</p><div className="mt-4 space-y-3 text-sm"><p className="flex justify-between border-b border-white/10 pb-2"><span className="text-neutral-300">Βάρος</span><b>{Number.isFinite(enteredWeight) ? `${enteredWeight} kg` : "—"}</b></p><p className="flex justify-between border-b border-white/10 pb-2"><span className="text-neutral-300">Προπονήσεις</span><b>{completedWorkouts}</b></p><p className="flex justify-between"><span className="text-neutral-300">Συνέπεια updates</span><b>{dashboard?.streak || 0} εβδομάδες</b></p></div></CardContent></Card><Card><CardContent className="p-5"><h3 className="font-extrabold">Τι ζητάμε</h3><div className="mt-3 space-y-3">{stepDefinitions.map((item, index) => <button type="button" key={item.key} onClick={() => index <= step && setStep(index)} className={`flex w-full items-center gap-3 text-left text-sm font-bold ${index > step ? "text-muted-foreground" : ""}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${index < step ? "bg-accent text-accent-foreground" : index === step ? "bg-foreground text-accent" : "bg-muted"}`}>{index < step ? <Check className="h-3 w-3" /> : index + 1}</span>{item.title}<small className="ml-auto text-muted-foreground">{item.hint}</small></button>)}</div></CardContent></Card></aside></div>{error && <p className="text-sm font-bold text-destructive">{error}</p>}</main><Dialog open={submitted} onOpenChange={setSubmitted}><DialogContent className="max-w-[440px] rounded-[26px] p-8 text-center"><span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_10px_rgba(176,249,12,.24)]"><CheckCircle2 className="h-9 w-9" /></span><DialogTitle className="text-[26px] font-extrabold italic">Το update στάλθηκε!</DialogTitle><p className="text-sm leading-6 text-muted-foreground">Ο coach σου ενημερώθηκε και θα αξιολογήσει την πρόοδό σου.</p><Button variant="lime" className="h-12 w-full rounded-full" onClick={() => window.location.assign("/client/dashboard")}>Πίσω στην αρχική</Button></DialogContent></Dialog>
  </ClientShell>
}

export default function ClientWeeklyUpdatePage() { return <ProtectedRoute allow="client-dashboard"><ClientWeeklyUpdateContent /></ProtectedRoute> }
