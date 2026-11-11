"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, ClipboardList, Cloud, HeartPulse, ImagePlus, Moon, RefreshCw, Send, Scale, UtensilsCrossed } from "lucide-react"
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
import { computeScore, isVisible, validateStep } from "@/lib/update-form/logic"
import type { Answers, FormDefinition, Question as FormQuestion } from "@/lib/update-form/types"

type Question = { id: number; question: string; type: string; isRequired: boolean; options?: string[]; placeholder?: string | null; helpText?: string | null; allowPhotos?: boolean; standardKey?: string | null; section?: string | null }
type UpdateHistory = { id: number; submittedAt: string; weight?: number | null }
type Dashboard = { client: { subscriptionStatus?: string | null; daysRemaining?: number | null }; nextUpdateDate?: string | null; streak?: number; todayIsUpdateDay?: boolean; lateUpdateSubmission?: boolean }
type PointSettings = { isActive?: boolean; is_active?: number | boolean; weeklyUpdatePoints?: number; weekly_update_points?: number }
type UpdateSection = { key: string; label: string; sortOrder: number }
type Workout = { completed_at: string }
type UpdateFile = { file: File; questionId: number; angle: "front" | "side" | "back" }

const photoAngles = [{ key: "front", label: "Μπροστά" }, { key: "side", label: "Πλάι" }, { key: "back", label: "Πίσω" }] as const
const defaultStepDefinitions = [
  { key: "nutrition_training", title: "Διατροφή & προπόνηση", icon: UtensilsCrossed, hint: "1′" },
  { key: "weight", title: "Βάρος & δραστηριότητα", icon: Scale, hint: "30″" },
  { key: "sleep_recovery", title: "Ύπνος & αποκατάσταση", icon: Moon, hint: "30″" },
  { key: "health_week", title: "Υγεία & εβδομάδα", icon: HeartPulse, hint: "30″" },
  { key: "photos", title: "Φωτογραφίες", icon: ImagePlus, hint: "1′" },
] as const

function sectionFor(question: Question) {
  if (question.section) return question.section
  const key = question.standardKey || ""
  if (["weight_kg", "weight_measured_on", "average_weekly_weight", "steps_per_day", "cardio_planned", "cardio_completed"].includes(key)) return "weight"
  if (["nutrition_consistency", "nutrition_details", "nutrition_changes", "training_consistency", "training_details", "training_tags"].includes(key)) return "nutrition_training"
  if (["sleep_hours", "sleep_quality", "sleep_details", "recovery_quality", "recovery_details"].includes(key)) return "sleep_recovery"
  if (["health_change", "health_details", "next_week_needs", "next_week_tags", "other_notes"].includes(key)) return "health_week"
  if (question.allowPhotos || question.type === "photos" || key === "progress_photos") return "photos"
  return "health_week"
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" }).format(new Date(value)) : "—" }

function RatingButtons({ value, onChange, labels }: { value: string; onChange: (value: string) => void; labels?: string[] }) {
  const exactLabels: Record<string, string> = {
    "Καθόλου": "Δεν το ακολούθησα ουσιαστικά",
    "Λίγες μέρες": "Το ακολούθησα σε λίγες ημέρες",
    "Μισές μέρες": "Το ακολούθησα περίπου τις μισές ημέρες",
    "Σχεδόν πλήρως": "Το ακολούθησα σχεδόν πλήρως, με μικρές αποκλίσεις",
    "Πλήρως": "Ακολούθησα πλήρως το συμφωνημένο πλάνο",
    "Λίγο": "Ολοκλήρωσα μικρό μέρος",
    "Περίπου μισό": "Ολοκλήρωσα περίπου το μισό",
    "Σχεδόν όλο": "Το ολοκλήρωσα σχεδόν όλο",
    "Ολόκληρο": "Ολοκλήρωσα το συμφωνημένο πρόγραμμα",
  }
  const displayedLabels = labels?.map((label) => exactLabels[label] || label) || ["Πολύ κακή", "Κακή", "Μέτρια", "Καλή", "Πολύ καλή"]
  return <><p className="text-xs text-muted-foreground">Επίλεξε από 1 έως 5:</p><div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => onChange(String(rating))} className={`min-h-[92px] rounded-[14px] border p-2 text-center transition-colors ${value === String(rating) ? "border-[#0b0b0b] bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"}`}><b className="block text-lg font-extrabold italic">{rating}</b><span className="mt-1 block text-[10px] font-semibold leading-3">{displayedLabels[rating - 1]}</span></button>)}</div></>
}

function ClientWeeklyUpdateContent() {
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [history, setHistory] = useState<UpdateHistory[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [pointSettings, setPointSettings] = useState<PointSettings | null>(null)
  const [sections, setSections] = useState<UpdateSection[]>([])
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [files, setFiles] = useState<UpdateFile[]>([])
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({})
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    Promise.all([api.get<Dashboard>("/client/dashboard"), api.get<Question[]>("/updates/questions"), api.get<UpdateHistory[]>("/client/updates"), api.get<Workout[]>("/client/workout/history"), api.get<PointSettings>("/points/settings"), api.get<UpdateSection[]>("/updates/sections")])
      .then(([dashboardData, questionData, historyData, workoutData, pointsData, sectionData]) => { setDashboard(dashboardData); setQuestions(questionData); setHistory(historyData); setWorkouts(workoutData); setPointSettings(pointsData); setSections(sectionData); const stored = window.localStorage.getItem("weekly-update-draft"); if (stored) { try { setAnswers(JSON.parse(stored)) } catch { window.localStorage.removeItem("weekly-update-draft") } } })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκε το update."))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!Object.keys(answers).length) return
    window.localStorage.setItem("weekly-update-draft", JSON.stringify(answers))
    setDraftSavedAt(new Date())
  }, [answers])

  const stepDefinitions = useMemo(() => {
    const configured = new Map(sections.map((section) => [section.key, section]))
    return [...defaultStepDefinitions].sort((first, second) => (configured.get(first.key)?.sortOrder ?? 99) - (configured.get(second.key)?.sortOrder ?? 99)).map((definition) => ({ ...definition, title: configured.get(definition.key)?.label || definition.title }))
  }, [sections])
  const grouped = useMemo(() => Object.fromEntries(stepDefinitions.map((definition) => [definition.key, questions.filter((question) => sectionFor(question) === definition.key)])), [questions, stepDefinitions]) as Record<string, Question[]>
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
  const isRequiredNow = (question: Question) => {
    if (!shouldShow(question) || question.standardKey === "progress_photos") return false
    if (question.standardKey === "nutrition_changes") return !isNutritionPerfect
    if (question.standardKey === "health_details") return Boolean(healthIsYes)
    return question.isRequired
  }

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
    const help = question.helpText ? <p className="text-xs leading-5 text-muted-foreground">{question.helpText}</p> : null
    if (question.allowPhotos || question.type === "photos") return <div key={question.id} className="space-y-4"><p className="text-sm leading-6 text-muted-foreground">Ίδιο φως, απόσταση και στάση με τις προηγούμενες · χωρίς φίλτρα.</p><div className="grid grid-cols-3 gap-2 sm:gap-3">{photoAngles.map((angle) => { const selected = files.find((file) => file.questionId === question.id && file.angle === angle.key); return <div key={angle.key} className="space-y-2 text-center"><label className={`relative flex h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-[14px] border border-dashed ${selected ? "border-accent bg-[color:var(--sp-lime-soft)]" : "border-border bg-muted/20"}`}><Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={(event) => chooseFiles(question.id, angle.key, event.target.files?.[0])} /><ImagePlus className="h-7 w-7 text-muted-foreground" />{selected && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3.5 w-3.5" /></span>}</label><p className="text-xs font-extrabold">{angle.label}</p><label className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full bg-foreground text-[10px] font-extrabold text-background sm:hidden"><Camera className="h-3 w-3" />Κάμερα<Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(event) => chooseFiles(question.id, angle.key, event.target.files?.[0])} /></label></div> })}</div>{common}</div>
    if (question.type === "rating") { const labels = question.standardKey === "nutrition_consistency" ? ["Καθόλου", "Λίγες μέρες", "Μισές μέρες", "Σχεδόν πλήρως", "Πλήρως"] : question.standardKey === "training_consistency" ? ["Δεν το εφάρμοσα", "Λίγο", "Περίπου μισό", "Σχεδόν όλο", "Ολόκληρο"] : undefined; return <div key={question.id} className="space-y-3"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label>{question.helpText && <p className="text-xs leading-5 text-muted-foreground">{question.helpText}</p>}<RatingButtons value={String(value)} onChange={(next) => setAnswer(question.id, next)} labels={labels} />{common}</div> }
    if (question.type === "multi_select") { const selected = Array.isArray(value) ? value : []; const options = question.options || []; const isNutritionChanges = question.standardKey === "nutrition_changes"; return <div key={question.id} className={`space-y-3 ${isNutritionChanges ? "rounded-[16px] border border-border bg-muted/30 p-4" : ""}`}><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label>{question.helpText && <p className="text-xs leading-5 text-muted-foreground">{question.helpText}</p>}{isNutritionChanges && <p className="text-xs text-muted-foreground">Εμφανίζεται επειδή επέλεξες κάτω από 5 · οι συμφωνημένες αλλαγές δεν μετράνε.</p>}<div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} type="button" onClick={() => setAnswer(question.id, selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} className={`rounded-full border px-3 py-2 text-xs font-extrabold ${selected.includes(option) ? "border-[#0b0b0b] bg-foreground text-background" : "border-border bg-card hover:bg-muted"}`}>{option}</button>)}</div>{common}</div> }
    if (question.type === "single_select" || question.type === "select") return <div key={question.id} className="space-y-3"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label><div className="flex flex-wrap gap-2">{(question.options || []).map((option) => <button key={option} type="button" onClick={() => setAnswer(question.id, option)} className={`min-w-24 rounded-full border px-4 py-2.5 text-sm font-extrabold ${value === option ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card"}`}>{option}</button>)}</div>{common}</div>
    const isLong = question.type === "textarea"; return <div key={question.id} className="space-y-2"><Label className="text-[15px] font-extrabold">{question.question} {isRequiredNow(question) && <span className="text-destructive">*</span>}</Label>{isLong ? <Textarea value={String(value)} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={question.placeholder || "Γράψε εδώ…"} className="min-h-28 rounded-[14px]" /> : <Input type={question.type === "number" ? "text" : "text"} inputMode={question.type === "number" ? "decimal" : undefined} value={String(value)} onChange={(event) => setAnswer(question.id, event.target.value)} placeholder={question.placeholder || ""} className="h-12 rounded-[14px]" />}{common}</div>
  }

  const submit = async (event: FormEvent) => { event.preventDefault(); if (!validateStep()) return; setSubmitting(true); try { const body = new FormData(); body.append("answers", JSON.stringify(Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer })))); files.forEach((item) => body.append("files", item.file)); body.append("fileQuestionIds", JSON.stringify(files.map((item) => item.questionId))); body.append("fileAngles", JSON.stringify(files.map((item) => item.angle))); await api.upload("/client/updates/submit", body); window.localStorage.removeItem("weekly-update-draft"); setSubmitted(true) } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Δεν υποβλήθηκε το update.") } finally { setSubmitting(false) } }

  if (loading) return <ClientShell user={user} logout={logout} paymentApproved={false}><p className="p-6 text-muted-foreground">Φόρτωση update…</p></ClientShell>
  const Icon = currentDefinition.icon
  const dueDate = dashboard?.nextUpdateDate ? new Date(dashboard.nextUpdateDate) : null
  const dueWeekday = dueDate ? new Intl.DateTimeFormat("el-GR", { weekday: "long" }).format(dueDate) : null
  const deadlineLabel = dueWeekday ? `${dueWeekday.charAt(0).toUpperCase()}${dueWeekday.slice(1)} 23:59` : "την ημέρα του update σου"
  const configuredWeeklyPoints = Number(pointSettings?.weeklyUpdatePoints ?? pointSettings?.weekly_update_points ?? 0)
  const pointsEnabled = Boolean(pointSettings?.isActive ?? pointSettings?.is_active) && configuredWeeklyPoints > 0
  const timelyPointsAvailable = pointsEnabled && Boolean(dashboard?.todayIsUpdateDay) && !dashboard?.lateUpdateSubmission
  const draftLabel = draftSavedAt ? new Intl.DateTimeFormat("el-GR", { hour: "2-digit", minute: "2-digit" }).format(draftSavedAt) : null
  return <ClientShell user={user} logout={logout} paymentApproved={dashboard?.client.subscriptionStatus === "active"} subscriptionStatus={dashboard?.client.subscriptionStatus} daysRemaining={dashboard?.client.daysRemaining}>
    <main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 pb-24 sm:p-6 lg:p-8"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-1"><Link href="/client/dashboard" className="inline-flex w-fit items-center gap-1 text-[13px] font-extrabold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Αρχική</Link><h1 className="text-[28px] font-extrabold tracking-[-.5px]">Εβδομαδιαίο update</h1><p className="text-sm text-muted-foreground">Εβδομάδα {weekStart} · στείλ’ το έως <b className="text-foreground">{deadlineLabel}</b> · ≈ 3 λεπτά</p></div><div className="flex flex-wrap items-center gap-2 sm:justify-end">{draftLabel && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Cloud className="h-3.5 w-3.5" />Πρόχειρο αποθηκεύτηκε {draftLabel}</span>}{timelyPointsAvailable && <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-extrabold text-accent-foreground"><RefreshCw className="h-3.5 w-3.5" />+{configuredWeeklyPoints.toLocaleString("el-GR")} πόντοι αν σταλεί στην ώρα</span>}</div></header><Card className="overflow-hidden rounded-[20px]"><CardContent className="overflow-x-auto p-3 sm:px-5 sm:py-4"><div className="flex min-w-max items-center sm:min-w-0">{stepDefinitions.map((item, index) => { const StepIcon = item.icon; const complete = index < step; const current = index === step; return <div key={item.key} className="flex min-w-[126px] flex-1 items-center gap-2 sm:min-w-0"><button type="button" onClick={() => index <= step && setStep(index)} disabled={index > step} className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full transition-colors ${complete ? "bg-accent text-accent-foreground" : current ? "bg-foreground text-accent" : "border border-[#d6d6d2] bg-card text-muted-foreground"}`} aria-label={`Βήμα ${index + 1}: ${item.title}`}>{complete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}</button><button type="button" onClick={() => index <= step && setStep(index)} disabled={index > step} className={`min-w-0 text-left ${index > step ? "text-muted-foreground" : "text-foreground"}`}><span className="block text-[10px] font-bold text-muted-foreground">Βήμα {index + 1}</span><span className="block truncate text-[12px] font-extrabold">{item.title}</span></button>{index < stepDefinitions.length - 1 && <span className={`mx-2 h-0.5 min-w-3 flex-1 ${index < step ? "bg-accent" : "bg-muted"}`} />}</div> })}</div></CardContent></Card><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><form onSubmit={submit} className="space-y-4"><Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex flex-col gap-[22px] p-5 sm:p-[26px]"><div className="flex items-center gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] bg-foreground text-accent"><Icon className="h-[19px] w-[19px]" /></span><div className="min-w-0"><p className="text-[12px] font-extrabold tracking-[.6px] text-[#8a8a8a]">ΒΗΜΑ {step + 1} ΑΠΟ 5</p><h2 className="mt-0.5 text-[22px] font-extrabold tracking-[-.3px]">{currentDefinition.title}</h2></div></div>{step === 0 && <div className="mt-5 rounded-[14px] border border-border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground"><p>Συμπλήρωσε τη φόρμα για τις τελευταίες επτά ημέρες και ανέβασε τις φωτογραφίες σου εδώ, ώστε να αξιολογήσουμε την πρόοδό σου.</p><p className="mt-2">Απάντησε ειλικρινά. Οι απαντήσεις μάς βοηθούν να καταλάβουμε τι λειτούργησε, τι σε δυσκόλεψε και τι χρειάζεται αλλαγή.</p></div>}<div className="mt-6 space-y-6">{currentDefinition.key === "nutrition_training" && <div className="rounded-[14px] bg-[var(--sp-lime-soft)] p-4 text-sm"><b>Από την εφαρμογή:</b> {completedWorkouts} προπονήσεις ολοκληρώθηκαν αυτή την εβδομάδα.</div>}{currentDefinition.key === "weight" && weightDifference !== null && <p className="rounded-[14px] bg-muted p-3 text-sm font-bold">Διαφορά από το προηγούμενο update: <span className="text-accent-foreground">{weightDifference > 0 ? "+" : ""}{weightDifference.toFixed(1).replace(".", ",")} kg</span></p>}{currentQuestions.map(renderQuestion)}{!currentQuestions.length && <p className="text-sm text-muted-foreground">Δεν υπάρχουν πεδία σε αυτή την ενότητα.</p>}</div><div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-5">{step > 0 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>‹ {stepDefinitions[step - 1].title}</Button> : <span />}{step < 4 ? <Button type="button" className="bg-foreground text-background hover:bg-foreground/90" onClick={goNext}>Επόμενο: {stepDefinitions[step + 1].title}<ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button type="submit" variant="lime" disabled={submitting}> <Send className="mr-2 h-4 w-4" />{submitting ? "Υποβολή…" : "Υποβολή update"}</Button>}</div></CardContent></Card></form><aside className="hidden space-y-4 lg:block"><Card className="relative overflow-hidden rounded-[20px] border-[#0b0b0b] bg-[#0b0b0b] text-white"><CardContent className="relative p-5"><span aria-hidden="true" className="absolute -top-3 right-[22px] h-[52px] w-2 -skew-x-[18deg] bg-accent" /><p className="text-[11px] font-extrabold tracking-[1px] text-[#9a9a9a]">Η ΕΒΔΟΜΑΔΑ ΣΟΥ</p><div className="mt-4 space-y-0 text-sm"><p className="relative flex items-baseline justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Βάρος (βήμα 2)</span><b>{Number.isFinite(enteredWeight) ? <>{enteredWeight.toFixed(1).replace(".", ",")} kg {weightDifference !== null && <span className="ml-1 text-xs text-accent">{weightDifference > 0 ? "+" : ""}{weightDifference.toFixed(1).replace(".", ",")}</span>}</> : "—"}</b></p><p className="relative flex items-baseline justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Προπονήσεις</span><b>{completedWorkouts} ολοκληρώθηκαν</b></p><p className="relative flex items-baseline justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Συνέπεια updates</span><b>{dashboard?.streak || 0} {(dashboard?.streak || 0) === 1 ? "εβδομάδα" : "εβδομάδες"} στη σειρά</b></p>{timelyPointsAvailable && <p className="relative flex items-baseline justify-between border-t border-[#222] py-2"><span className="text-[#bdbdbd]">Αν το στείλεις τώρα</span><b className="text-accent">+{configuredWeeklyPoints.toLocaleString("el-GR")} πόντοι</b></p>}</div></CardContent></Card></aside></div>{error && <p className="text-sm font-bold text-destructive">{error}</p>}</main><Dialog open={submitted} onOpenChange={setSubmitted}><DialogContent className="max-w-[440px] rounded-[26px] p-8 text-center"><span className="mx-auto grid h-[72px] w-[72px] place-items-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_10px_rgba(176,249,12,.24)]"><CheckCircle2 className="h-9 w-9" /></span><DialogTitle className="text-[26px] font-extrabold italic">Το update στάλθηκε!</DialogTitle><p className="text-sm leading-6 text-muted-foreground">Ο coach σου ενημερώθηκε και θα αξιολογήσει την πρόοδό σου.</p><Button variant="lime" className="h-12 w-full rounded-full" onClick={() => window.location.assign("/client/dashboard")}>Πίσω στην αρχική</Button></DialogContent></Dialog>
  </ClientShell>
}

type FormResponse = { formId: number; form: FormDefinition; draft: { updateId: number; answers: Answers; autoSnapshot: Record<string, unknown> } | null; submitted: { score: number | null; tierTitle: string | null; onTime: boolean } | null }
type SubmitResponse = { score: number | null; tier: { title: string; message: string } | null; showScoreToClient: boolean; scoreNote: string; pointsAwarded: boolean }

function DynamicQuestion({ question, value, onChange, error, onFile }: { question: FormQuestion; value: unknown; onChange: (value: unknown) => void; error?: string; onFile: (slot: string, file?: File) => void }) {
  const required = question.required ? <span className="text-destructive"> *</span> : null
  const fieldError = error && <p className="mt-2 text-xs font-bold text-destructive">{error}</p>
  const heading = <><Label className="text-[15px] font-extrabold">{question.label}{required}</Label>{question.help && <p className="text-xs leading-5 text-muted-foreground">{question.help}</p>}</>
  if (question.type === "scale") {
    const labels = question.scaleLabels ?? ["1", "2", "3", "4", "5"]
    return <div data-question-id={question.id} className="space-y-3">{heading}<div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`min-h-[76px] rounded-[14px] border p-1 text-center ${Number(value) === item ? "border-[#0b0b0b] bg-accent text-accent-foreground" : "border-border bg-card hover:bg-muted"}`}><b className="block text-lg font-extrabold italic">{question.display === "stars" ? "★" : item}</b><span className="mt-1 block text-[9px] font-bold leading-3">{labels[item - 1]}</span></button>)}</div>{fieldError}</div>
  }
  if (question.type === "yes_no") return <div data-question-id={question.id} className="space-y-3">{heading}<div className="flex gap-2"><Button type="button" variant={value === true ? "lime" : "outline"} onClick={() => onChange(true)}>Ναι</Button><Button type="button" variant={value === false ? "lime" : "outline"} onClick={() => onChange(false)}>Όχι</Button></div>{fieldError}</div>
  if (question.type === "chips") {
    const current = (value && typeof value === "object" ? value : {}) as { chips?: string[]; text?: string }
    const selected = current.chips ?? []
    const select = (option: string) => onChange({ ...current, chips: question.multi ? (selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option]) : [option] })
    return <div data-question-id={question.id} className="space-y-3">{heading}<div className="flex flex-wrap gap-2">{(question.options ?? []).map((option) => <button key={option} type="button" onClick={() => select(option)} className={`rounded-full border px-3 py-2 text-xs font-extrabold ${selected.includes(option) ? "border-[#0b0b0b] bg-foreground text-background" : "border-border bg-card"}`}>{option}</button>)}</div>{question.withText && <Textarea value={current.text ?? ""} onChange={(event) => onChange({ ...current, text: event.target.value })} placeholder="Πρόσθεσε λεπτομέρειες…" className="min-h-20 rounded-[14px]" />}{fieldError}</div>
  }
  if (question.type === "photos") return <div data-question-id={question.id} className="space-y-3">{heading}<p className="text-xs leading-5 text-muted-foreground">Σύγκρινε με την προηγούμενη εβδομάδα: ίδιο φως, απόσταση και στάση, χωρίς φίλτρα.</p><div className="grid grid-cols-3 gap-3">{(question.photoSlots ?? ["Μπροστά", "Πλάι", "Πίσω"]).map((slot) => <label key={slot} className="grid min-h-28 cursor-pointer place-items-center gap-2 rounded-[14px] border-2 border-dashed border-border bg-muted/30 p-3 text-center text-xs font-extrabold"><ImagePlus className="h-5 w-5" />{slot}<Input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" onChange={(event) => onFile(slot, event.target.files?.[0])} /></label>)}</div>{fieldError}</div>
  if (question.type === "auto") return <div data-question-id={question.id} className="rounded-[14px] bg-[var(--sp-lime-soft)] p-4 text-sm"><b>{question.label}</b><p className="mt-1 text-muted-foreground">Υπολογίζεται αυτόματα από την εφαρμογή.</p></div>
  const textValue = String(value ?? "")
  const isLong = question.type === "text"
  return <div data-question-id={question.id} className="space-y-2">{heading}{isLong ? <Textarea value={textValue} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder} className="min-h-28 rounded-[14px]" /> : <div className="relative"><Input type="number" inputMode="decimal" value={textValue} onChange={(event) => onChange(event.target.value)} placeholder={question.placeholder} className="h-12 rounded-[14px] pr-14" />{question.unit && <span className="absolute right-4 top-3 text-sm font-bold text-muted-foreground">{question.unit}</span>}</div>}{fieldError}</div>
}

function DynamicWeeklyUpdateContent() {
  const { user, logout } = useAuth()
  const [data, setData] = useState<FormResponse | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [files, setFiles] = useState<Array<{ questionId: string; slot: string; file: File }>>([])
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [result, setResult] = useState<SubmitResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const autosaveReady = useRef(false)

  useEffect(() => { api.get<FormResponse>("/updates/form").then((response) => { setData(response); setAnswers(response.draft?.answers ?? {}); setStep(Number(response.draft?.autoSnapshot?.stepIndex ?? 0)); }).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!data || data.submitted || !autosaveReady.current) { autosaveReady.current = true; return }
    const timer = window.setTimeout(() => api.put("/updates/draft", { answers, autoSnapshot: { stepIndex: step } }).then(() => setSavedAt(new Date())).catch(() => undefined), 800)
    return () => window.clearTimeout(timer)
  }, [answers, step, data])
  if (loading || !data) return <ClientShell user={user} logout={logout} paymentApproved={false}><main className="p-8 text-muted-foreground">Φόρτωση update…</main></ClientShell>
  const steps = data.form.steps
  const isReview = step === steps.length
  const current = steps[Math.min(step, steps.length - 1)]
  const visible = (question: FormQuestion) => isVisible(question, answers)
  const next = () => {
    const nextErrors = validateStep(current, answers, data.form.settings.photosRequired)
    setErrors(nextErrors)
    const first = Object.keys(nextErrors)[0]
    if (first) { document.querySelector(`[data-question-id="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return }
    setStep((value) => value + 1)
  }
  const uploadFile = (questionId: string, slot: string, file?: File) => { if (!file) return; setFiles((items) => [...items.filter((item) => !(item.questionId === questionId && item.slot === slot)), { questionId, slot, file }]); setAnswers((currentAnswers) => ({ ...currentAnswers, [questionId]: { ...(currentAnswers[questionId] as object || {}), [slot]: true } })) }
  const submit = async () => { const allErrors = Object.assign({}, ...steps.map((item) => validateStep(item, answers, data.form.settings.photosRequired))); if (Object.keys(allErrors).length) { setErrors(allErrors); setStep(steps.findIndex((item) => Object.keys(validateStep(item, answers, data.form.settings.photosRequired)).length)); return } setSending(true); try { const body = new FormData(); body.append("answers", JSON.stringify(answers)); files.forEach((item) => body.append("files", item.file)); const response = await api.upload<SubmitResponse>("/updates/submit-form", body); setResult(response) } finally { setSending(false) } }
  const localScore = computeScore(data.form, answers)
  const awardedPoints = result?.pointsAwarded ? 100 : 0
  if (result || data.submitted) {
    const score = result?.score ?? data.submitted?.score ?? null; const tier = result?.tier ?? (score === null ? null : data.form.scoreTiers.find((item) => score >= item.min && score <= item.max) ?? null)
    return <ClientShell user={user} logout={logout} paymentApproved><main className="mx-auto max-w-[720px] p-4 sm:p-8">{(result?.showScoreToClient ?? true) && score !== null ? <Card className="overflow-hidden rounded-[24px]"><CardContent className="p-6 text-center sm:p-10"><div className="mx-auto grid h-40 w-40 place-items-center rounded-full border-[12px] border-accent bg-card"><b className="text-4xl font-extrabold italic">{score}<small className="text-base">/100</small></b></div><h1 className="mt-6 text-3xl font-extrabold">{tier?.title}</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{tier?.message}</p><div className="mt-7 space-y-3 text-left">{data.form.steps.flatMap((item) => item.questions).filter((item) => item.type === "scale" && item.scored && visible(item)).map((item) => <div key={item.id}><div className="flex justify-between text-sm font-bold"><span>{item.shortLabel}</span><span>{String(answers[item.id] ?? "–")}/5</span></div><div className="mt-1 h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-accent" style={{ width: `${Number(answers[item.id] ?? 0) * 20}%` }} /></div></div>)}</div><p className="mt-7 text-xs leading-5 text-muted-foreground">{result?.scoreNote ?? data.form.scoreNote}</p>{awardedPoints > 0 && <p className="mt-4 font-extrabold text-accent-foreground">+{awardedPoints} πόντοι προστέθηκαν</p>}<Button asChild variant="lime" className="mt-7 h-12 rounded-full"><Link href="/client/dashboard">Πίσω στην αρχική</Link></Button></CardContent></Card> : <Card className="rounded-[24px]"><CardContent className="p-10 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-accent" /><h1 className="mt-5 text-3xl font-extrabold">Το update στάλθηκε</h1><p className="mt-3 text-muted-foreground">Ο coach σου ενημερώθηκε και θα αξιολογήσει την πρόοδό σου.</p><Button asChild variant="lime" className="mt-7"><Link href="/client/dashboard">Πίσω στην αρχική</Link></Button></CardContent></Card>}</main></ClientShell>
  }
  return <ClientShell user={user} logout={logout} paymentApproved><main className="mx-auto max-w-[var(--container-7xl)] space-y-5 p-4 pb-24 sm:p-6 lg:p-8"><header className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/client/dashboard" className="text-xs font-extrabold text-muted-foreground">‹ Αρχική</Link><h1 className="mt-1 text-[28px] font-extrabold">Εβδομαδιαίο update</h1><p className="text-sm text-muted-foreground">Συμπλήρωσέ το σε λίγα λεπτά.{savedAt && " · Πρόχειρο αποθηκεύτηκε"}</p></div><span className="rounded-full bg-accent px-3 py-2 text-xs font-extrabold text-accent-foreground">+100 πόντοι αν σταλεί στην ώρα</span></header><div className="flex gap-1">{steps.map((item, index) => <span key={item.id} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-accent" : "bg-muted"}`} />)}</div><Card className="rounded-[20px]"><CardContent className="p-5 sm:p-7">{isReview ? <div className="space-y-5"><h2 className="text-2xl font-extrabold">Ανασκόπηση</h2>{steps.map((item, index) => <div key={item.id} className="rounded-[14px] border border-border p-4"><div className="flex justify-between"><b>{item.title}</b><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => setStep(index)}>Αλλαγή</Button></div><p className="mt-2 text-sm text-muted-foreground">{item.questions.filter(visible).map((question) => `${question.shortLabel}: ${typeof answers[question.id] === "object" ? "Συμπληρώθηκε" : answers[question.id] || "—"}`).join(" · ")}</p></div>)}<Button type="button" variant="lime" className="h-12 w-full rounded-full" disabled={sending} onClick={submit}>{sending ? "Υποβολή…" : `Υποβολή update · +${awardedPoints || 100} πόντοι`}</Button></div> : <div className="space-y-6"><div><p className="text-xs font-extrabold tracking-[1px] text-muted-foreground">ΒΗΜΑ {step + 1} ΑΠΟ {steps.length}</p><h2 className="mt-1 text-2xl font-extrabold">{current.title}</h2></div>{current.questions.filter(visible).map((question) => <DynamicQuestion key={question.id} question={question} value={answers[question.id]} error={errors[question.id]} onChange={(value) => setAnswers((currentAnswers) => ({ ...currentAnswers, [question.id]: value }))} onFile={(slot, file) => uploadFile(question.id, slot, file)} />)}<div className="flex justify-between border-t border-border pt-5">{step > 0 ? <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Πίσω</Button> : <span />}<Button type="button" className="bg-foreground text-background" onClick={next}>Επόμενο <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div>}</CardContent></Card></main></ClientShell>
}

export default function ClientWeeklyUpdatePage() { return <ProtectedRoute allow="client-dashboard"><DynamicWeeklyUpdateContent /></ProtectedRoute> }
