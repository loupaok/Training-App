"use client"

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  FileText,
  Salad,
  Send,
  Upload,
} from "lucide-react"
import { AreaChart } from "@tremor/react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { StarRating } from "@/components/shared/star-rating"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"
import { resolveMediaUrl } from "@/lib/media"

type Question = {
  id: number
  question: string
  type: string
  isRequired: boolean
  options?: string[]
  placeholder?: string | null
}

type Update = {
  id: number
  submittedAt: string
  weekStart: string
  answers?: Array<{ question: string; type: string; answer: string | null }>
  weight?: number | null
  photos: string[]
}

type DashboardData = {
  client: {
    firstName: string
    currentWeight: number | null
    subscriptionStatus: string | null
    daysRemaining: number | null
    planName: string | null
  }
  todayIsUpdateDay: boolean
  alreadySubmittedThisWeek: boolean
  nextUpdateDate: string | null
  streak: number
  updatesCount: number
  lastUpdate: { submittedAt: string; averageRating: number | null } | null
}

type TrainingPlan = {
  id: number
  title: string
  days: Array<{ name: string; exercises: Array<{ name: string; sets?: number; reps?: string; imageUrl?: string | null }> }>
} | null

type NutritionPlanPreview = { id: number; title: string; meals: unknown[] } | null

type Payment = { id: number; amount: number; method: string; status: string; paidAt: string; notes?: string | null }
type PaymentData = { subscription: { planName?: string | null; price?: number | null; endDate?: string | null; daysRemaining?: number | null; status?: string | null } | null; payments: Payment[] }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const paymentMethod: Record<string, string> = { card: "Κάρτα", bank: "Τραπεζικό Έμβασμα", stripe: "Stripe", cash: "Μετρητά" }

function formatDate(date: string | null | undefined) {
  return date ? dateFormat.format(new Date(date)) : "-"
}

function PlanCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <Card><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-lg">{icon}{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>
}

function ClientDashboardContent() {
  const { user, logout } = useAuth()
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan>(null)
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlanPreview>(null)
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [files, setFiles] = useState<Array<{ file: File; questionId: number }>>([])
  const [activeTab, setActiveTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [dashboardResponse, updatesResponse, questionsResponse, trainingResponse, nutritionResponse, paymentsResponse] = await Promise.all([
        api.get<DashboardData>("/client/dashboard"),
        api.get<Update[]>("/client/updates"),
        api.get<Question[]>("/updates/questions"),
        api.get<TrainingPlan>("/client/training-plan"),
        api.get<NutritionPlanPreview>("/client/nutrition-plan"),
        api.get<PaymentData>("/client/payments"),
      ])
      setDashboard(dashboardResponse)
      setUpdates(updatesResponse)
      setQuestions(questionsResponse)
      setTrainingPlan(trainingResponse)
      setNutritionPlan(nutritionResponse)
      setPaymentData(paymentsResponse)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Δεν ήταν δυνατή η φόρτωση του dashboard.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadDashboard() }, [])
  const chartData = useMemo(() => updates
    .map((update) => {
      return update.weight ? { date: formatDate(update.submittedAt), weight: Number(update.weight) } : null
    })
    .filter((entry): entry is { date: string; weight: number } => entry !== null)
    .reverse(), [updates])

  const renderQuestion = (question: Question) => {
    const value = answers[question.id] ?? (question.type === "multi_select" ? [] : "")
    const setValue = (next: string | string[]) => setAnswers((current) => ({ ...current, [question.id]: next }))
    const required = question.isRequired ? <span className="text-destructive"> *</span> : null

    if (question.type === "rating") {
      return <div key={question.id} className="space-y-2"><Label>{question.question}{required}</Label><StarRating value={Number(value) || 0} onChange={(rating) => setValue(String(rating))} /></div>
    }
    if (question.type === "textarea") {
      return <div key={question.id} className="space-y-2"><Label>{question.question}{required}</Label><Textarea value={String(value)} placeholder={question.placeholder ?? ""} onChange={(event) => setValue(event.target.value)} /></div>
    }
    if (question.type === "photos" || question.type === "pdf") {
      return <div key={question.id} className="space-y-2"><Label>{question.question}{required}</Label><Input type="file" multiple={question.type === "photos"} accept={question.type === "photos" ? "image/jpeg,image/png,image/webp" : "application/pdf"} onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? []).map((file) => ({ file, questionId: question.id }))].slice(0, 5))} /><p className="text-xs text-muted-foreground">Έως 5 αρχεία, 5MB το καθένα.</p></div>
    }
    if (question.type === "select" || question.type === "single_select") {
      return <fieldset key={question.id} className="space-y-2"><legend className="text-sm font-medium">{question.question}{required}</legend><div className="grid gap-2 sm:grid-cols-2">{(question.options ?? []).map((option) => <button type="button" key={option} onClick={() => setValue(option)} className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${value === option ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>{option}</button>)}</div></fieldset>
    }
    if (question.type === "multi_select") {
      const selected = Array.isArray(value) ? value : []
      return <fieldset key={question.id} className="space-y-2"><legend className="text-sm font-medium">{question.question}{required}</legend><div className="grid gap-2 sm:grid-cols-2">{(question.options ?? []).map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"><input type="checkbox" checked={selected.includes(option)} onChange={() => setValue(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])} />{option}</label>)}</div></fieldset>
    }
    return <div key={question.id} className="space-y-2"><Label>{question.question}{required}</Label><Input type={question.type === "number" ? "number" : question.type === "url" ? "url" : "text"} autoComplete={question.type === "url" ? "off" : undefined} value={String(value)} placeholder={question.placeholder ?? ""} onChange={(event) => setValue(event.target.value)} /></div>
  }

  const submitUpdate = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    const unansweredRequired = questions.some((question) => question.isRequired && (!answers[question.id] || (Array.isArray(answers[question.id]) && answers[question.id].length === 0)))
    if (unansweredRequired) { setError("Συμπλήρωσε όλα τα υποχρεωτικά πεδία."); return }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("answers", JSON.stringify(Object.entries(answers).map(([questionId, answer]) => ({ questionId: Number(questionId), answer }))))
      files.forEach(({ file }) => formData.append("files", file))
      formData.append("fileQuestionIds", JSON.stringify(files.map(({ questionId }) => questionId)))
      await api.upload("/client/updates/submit", formData)
      setSubmitted(true)
      setAnswers({})
      setFiles([])
      await loadDashboard()
      window.setTimeout(() => setActiveTab("overview"), 1800)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Δεν ήταν δυνατή η υποβολή του update.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <ClientShell user={user} logout={logout} paymentApproved={false}><div className="p-6 text-muted-foreground">Φόρτωση dashboard...</div></ClientShell>
  if (error && !dashboard) return <ClientShell user={user} logout={logout} paymentApproved={false}><div className="p-6"><Alert variant="destructive"><AlertTitle>Σφάλμα φόρτωσης</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div></ClientShell>

  const subscriptionActive = dashboard?.client.subscriptionStatus === "active"
  const upcomingDate = formatDate(dashboard?.nextUpdateDate)

  return (
    <ClientShell user={user} logout={logout} paymentApproved={subscriptionActive} active="dashboard">
      <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl font-bold">Γεια σου, {dashboard?.client.firstName || ""}!</h1>
          <p className="text-sm text-muted-foreground">Η προσωπική σου προπόνηση, διατροφή και πρόοδος σε ένα μέρος.</p>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollArea className="w-full whitespace-nowrap"><TabsList className="h-auto"><TabsTrigger value="overview">Αρχική</TabsTrigger><TabsTrigger value="training">Προπόνηση</TabsTrigger><TabsTrigger value="progress">Πρόοδος</TabsTrigger><TabsTrigger value="payments">Πληρωμές</TabsTrigger><TabsTrigger value="update">Update</TabsTrigger></TabsList></ScrollArea>

          <TabsContent value="overview" className="space-y-6">
            {dashboard?.todayIsUpdateDay && !dashboard.alreadySubmittedThisWeek && <Alert><CalendarDays className="h-4 w-4" /><AlertTitle>Σήμερα είναι ημέρα update</AlertTitle><AlertDescription className="flex flex-wrap items-center gap-3">Συμπλήρωσε το εβδομαδιαίο σου update για να ενημερωθεί ο coach σου.<Button size="sm" onClick={() => setActiveTab("update")}>Συμπλήρωση update</Button></AlertDescription></Alert>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <PlanCard title="Τρέχον βάρος" icon={<Dumbbell className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.client.currentWeight ?? "-"}{dashboard?.client.currentWeight ? " kg" : ""}</p></PlanCard>
              <PlanCard title="Ημέρες συνδρομής" icon={<CalendarDays className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.client.daysRemaining ?? "-"}</p><p className="text-xs text-muted-foreground">{dashboard?.client.planName ?? "Χωρίς ενεργό πλάνο"}</p></PlanCard>
              <PlanCard title="Σερί updates" icon={<CheckCircle2 className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{dashboard?.streak ?? 0}</p><p className="text-xs text-muted-foreground">συνεχόμενες εβδομάδες</p></PlanCard>
              <PlanCard title="Τελευταίο update" icon={<Send className="h-5 w-5 text-primary" />}><p className="text-sm font-medium">{formatDate(dashboard?.lastUpdate?.submittedAt)}</p>{dashboard?.lastUpdate?.averageRating && <StarRating value={dashboard.lastUpdate.averageRating} readOnly />}</PlanCard>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <PlanCard title="Πρόγραμμα Προπόνησης" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{trainingPlan ? <><p className="font-medium">{trainingPlan.title}</p><p className="mt-1 text-sm text-muted-foreground">{trainingPlan.days.length} ημέρες προπόνησης</p><Button className="mt-4" variant="outline" size="sm" onClick={() => setActiveTab("training")}>Δες το πρόγραμμα</Button></> : <p className="text-sm text-muted-foreground">Δεν έχει ανατεθεί πρόγραμμα προπόνησης ακόμα.</p>}</PlanCard>
              <PlanCard title="Πλάνο Διατροφής" icon={<Salad className="h-5 w-5 text-primary" />}>{nutritionPlan ? <><p className="font-medium">{nutritionPlan.title}</p><p className="mt-1 text-sm text-muted-foreground">{nutritionPlan.meals.length} γεύματα</p><Button asChild nativeButton={false} className="mt-4" variant="outline" size="sm"><Link href="/client-nutrition">Δες τη διατροφή</Link></Button></> : <p className="text-sm text-muted-foreground">Δεν έχει ανατεθεί διατροφικό πλάνο ακόμα.</p>}</PlanCard>
            </div>
          </TabsContent>

          <TabsContent value="training"><PlanCard title="Πρόγραμμα Προπόνησης" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{trainingPlan ? <div className="space-y-6"><p className="text-muted-foreground">{trainingPlan.title}</p>{trainingPlan.days.map((day) => <section key={day.name} className="border-t pt-4"><h2 className="font-semibold">{day.name}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{day.exercises.map((exercise, index) => <div key={`${exercise.name}-${index}`} className="flex items-center gap-3 rounded-md border p-3">{exercise.imageUrl && <img className="h-12 w-12 rounded object-cover" src={resolveMediaUrl(exercise.imageUrl)} alt="" />}<div><p className="font-medium">{exercise.name}</p><p className="text-xs text-muted-foreground">{exercise.sets ? `${exercise.sets} σετ` : ""}{exercise.reps ? ` · ${exercise.reps}` : ""}</p></div></div>)}</div></section>)}</div> : <p className="text-muted-foreground">Δεν υπάρχει διαθέσιμο πρόγραμμα προπόνησης.</p>}</PlanCard></TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <PlanCard title="Πρόοδος βάρους" icon={<Dumbbell className="h-5 w-5 text-primary" />}>{chartData.length > 1 ? <AreaChart className="h-64" data={chartData} index="date" categories={["weight"]} colors={["blue"]} valueFormatter={(value) => `${value} kg`} /> : <p className="text-sm text-muted-foreground">Χρειάζονται τουλάχιστον δύο ενημερώσεις με βάρος για το γράφημα.</p>}</PlanCard>
            <PlanCard title="Φωτογραφίες προόδου" icon={<Upload className="h-5 w-5 text-primary" />}>{updates.flatMap((update) => update.photos).length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{updates.flatMap((update) => update.photos).slice(0, 8).map((photo, index) => <a key={`${photo}-${index}`} href={resolveMediaUrl(photo)} target="_blank" rel="noreferrer"><img className="aspect-square w-full rounded-md object-cover" src={resolveMediaUrl(photo)} alt="Φωτογραφία προόδου" /></a>)}</div> : <p className="text-sm text-muted-foreground">Δεν υπάρχουν φωτογραφίες προόδου ακόμα.</p>}</PlanCard>
            <PlanCard title="Ιστορικό updates" icon={<FileText className="h-5 w-5 text-primary" />}>{updates.length ? <div className="space-y-3">{updates.map((update) => <div key={update.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0"><div><p className="font-medium">{formatDate(update.submittedAt)}</p><p className="text-xs text-muted-foreground">{update.answers?.length || 0} απαντήσεις · {update.photos?.length || 0} φωτογραφίες</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">Δεν έχεις υποβάλει update ακόμα.</p>}</PlanCard>
          </TabsContent>

          <TabsContent value="payments"><div className="grid gap-6 lg:grid-cols-3"><PlanCard title="Συνδρομή" icon={<CalendarDays className="h-5 w-5 text-primary" />}><Badge>{paymentData?.subscription?.status === "active" ? "Ενεργή" : "-"}</Badge><p className="mt-3 font-medium">{paymentData?.subscription?.planName ?? "Δεν υπάρχει ενεργή συνδρομή"}</p><p className="text-sm text-muted-foreground">{paymentData?.subscription?.daysRemaining != null ? `${paymentData.subscription.daysRemaining} ημέρες απομένουν` : ""}</p></PlanCard><PlanCard title="Πληρωμές" icon={<FileText className="h-5 w-5 text-primary" />}><p className="text-3xl font-bold">{paymentData?.payments.length ?? 0}</p><p className="text-sm text-muted-foreground">καταγεγραμμένες πληρωμές</p></PlanCard><PlanCard title="Επόμενη λήξη" icon={<CalendarDays className="h-5 w-5 text-primary" />}><p className="text-lg font-semibold">{formatDate(paymentData?.subscription?.endDate)}</p></PlanCard></div><PlanCard title="Ιστορικό πληρωμών" icon={<FileText className="h-5 w-5 text-primary" />}>{paymentData?.payments.length ? <div className="space-y-3">{paymentData.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between border-b pb-3 last:border-0"><div><p className="font-medium">€{Number(payment.amount).toFixed(2)}</p><p className="text-xs text-muted-foreground">{formatDate(payment.paidAt)} · {paymentMethod[payment.method] ?? payment.method}</p></div><Badge variant={payment.status === "confirmed" ? "default" : "secondary"}>{payment.status === "confirmed" ? "Εγκρίθηκε" : "Εκκρεμεί"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">Δεν υπάρχουν πληρωμές ακόμα.</p>}</PlanCard></TabsContent>

          <TabsContent value="update">
            {submitted ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CheckCircle2 className="h-14 w-14 text-green-600" /><h2 className="mt-4 text-xl font-semibold">Το update υποβλήθηκε!</h2><p className="mt-2 text-sm text-muted-foreground">Ο coach σου ενημερώθηκε.</p></CardContent></Card> : dashboard?.alreadySubmittedThisWeek ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CheckCircle2 className="h-14 w-14 text-green-600" /><h2 className="mt-4 text-xl font-semibold">Έχεις ήδη υποβάλει το update σου</h2><p className="mt-2 text-sm text-muted-foreground">Το επόμενο update είναι στις {upcomingDate}.</p></CardContent></Card> : !dashboard?.todayIsUpdateDay ? <Card><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><CalendarDays className="h-14 w-14 text-primary" /><h2 className="mt-4 text-xl font-semibold">Το επόμενο update είναι στις {upcomingDate}</h2><p className="mt-2 text-sm text-muted-foreground">Επιστρέψε εκείνη την ημέρα για να συμπληρώσεις το εβδομαδιαίο σου update.</p><p className="mt-5 text-xs text-muted-foreground">Έχεις υποβάλει {dashboard?.updatesCount ?? 0} updates συνολικά.</p></CardContent></Card> : <Card><CardHeader><CardTitle>Εβδομαδιαίο Update</CardTitle><CardDescription>Συμπλήρωσε την εβδομαδιαία σου αναφορά. Τα στοιχεία θα σταλούν απευθείας στον coach σου.</CardDescription></CardHeader><CardContent><form className="space-y-6" onSubmit={submitUpdate}>{questions.map(renderQuestion)}<div className="border-t pt-5"><Button type="submit" size="lg" disabled={submitting}><Send className="mr-2 h-4 w-4" />{submitting ? "Υποβολή..." : "Υποβολή Update"}</Button></div></form></CardContent></Card>}
          </TabsContent>
        </Tabs>
      </main>
    </ClientShell>
  )
}

export default function ClientDashboardPage() {
  return <ProtectedRoute allow="client-active"><ClientDashboardContent /></ProtectedRoute>
}
