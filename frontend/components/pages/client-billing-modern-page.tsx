"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, CheckCircle2, Clock3, Copy, CreditCard, Landmark, ReceiptText, ShieldCheck, Sparkles } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"

type Subscription = { plan_name: string; price: number | string; currency?: string | null; status: string; start_date?: string | null; end_date?: string | null; days_remaining?: number | null }
type Payment = { id: number; amount: number | string; currency?: string | null; method: string; status: string; referenceNumber?: string | null; paidAt?: string | null; notes?: string | null }
type PaymentData = { subscription: Subscription | null; pendingSubscription?: Subscription | null; upcomingSubscriptions?: Subscription[]; payments: Payment[] }
type PricingPlan = { slug: string; name: string; price: number | string; currency?: string; period?: string; description?: string; badge?: string }
type BankDetails = { beneficiary?: string; bankName?: string; iban?: string }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const paymentMethods: Record<string, string> = { bank_transfer: "Τραπεζικό Έμβασμα", bank: "Τραπεζικό Έμβασμα", stripe: "Κάρτα", stripe_card: "Κάρτα", card: "Κάρτα", cash: "Μετρητά" }
const paymentStatuses: Record<string, string> = { pending: "Εκκρεμεί έγκριση", completed: "Εγκρίθηκε", confirmed: "Εγκρίθηκε", failed: "Απορρίφθηκε" }
const formatDate = (value?: string | null) => value ? dateFormat.format(new Date(value)) : "-"
const money = (value: number | string | null | undefined, currency = "EUR") => new Intl.NumberFormat("el-GR", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0))

function statusStyle(status?: string | null) {
  if (status === "active") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
  if (status === "expiring_soon") return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
  if (status === "expired") return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function ClientBillingModernContent() {
  const { user, logout } = useAuth()
  const [data, setData] = useState<PaymentData>({ subscription: null, payments: [] })
  const [plans, setPlans] = useState<PricingPlan[]>([])
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null)
  const [selectedPlan, setSelectedPlan] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "stripe_card">("bank_transfer")
  const [renewing, setRenewing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const load = async () => {
    setLoading(true)
    try {
      const [payments, planRows, bank] = await Promise.all([
        api.get<PaymentData>("/client/payments"),
        api.get<PricingPlan[]>("/pricing-plans?active=true").catch(() => []),
        api.get<BankDetails>("/bank-details").catch(() => null),
      ])
      setData({ subscription: payments.subscription || null, pendingSubscription: payments.pendingSubscription || null, upcomingSubscriptions: payments.upcomingSubscriptions || [], payments: payments.payments || [] })
      setPlans(Array.isArray(planRows) ? planRows : [])
      setBankDetails(bank)
      setSelectedPlan((current) => current || planRows[0]?.slug || "")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Δεν ήταν δυνατή η φόρτωση των στοιχείων συνδρομής.")
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const subscription = data.subscription
  const pendingSubscription = data.pendingSubscription || null
  const pendingPayment = data.payments.find((payment) => payment.status === "pending") || null
  const active = subscription?.status === "active" || subscription?.status === "expiring_soon"
  const expired = subscription?.status === "expired" || subscription?.status === "cancelled"
  const plan = useMemo(() => plans.find((item) => item.slug === selectedPlan) || plans[0] || null, [plans, selectedPlan])
  const start = subscription?.start_date ? new Date(subscription.start_date) : null
  const end = subscription?.end_date ? new Date(subscription.end_date) : null
  const totalDays = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 1
  const elapsedDays = start ? Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000)) : 0
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
  const daysRemaining = Number(subscription?.days_remaining ?? 0)
  const barTone = daysRemaining > totalDays * 0.5 ? "[&_[data-slot=progress-indicator]]:bg-emerald-500" : daysRemaining >= totalDays * 0.2 ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-red-500"

  const beginPayment = async () => {
    if (!plan) return
    setSaving(true); setError(""); setMessage("")
    try {
      await api.post("/clients/me/billing", { subscriptionPackage: plan.slug, paymentMethod })
      setMessage("Η πληρωμή καταχωρήθηκε και αναμένει επιβεβαίωση από τον coach.")
      setRenewing(false)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Δεν ήταν δυνατή η καταχώριση της πληρωμής.")
    } finally { setSaving(false) }
  }

  const copyIban = async () => { if (bankDetails?.iban) await navigator.clipboard.writeText(bankDetails.iban) }

  return <ClientShell title="Συνδρομή & Πληρωμές" user={user} logout={logout} paymentApproved={user?.status === "active"} active="billing">
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div><h1 className="text-2xl font-bold">Συνδρομή & Πληρωμές</h1><p className="mt-1 text-sm text-muted-foreground">Διαχειρίσου το πλάνο σου και δες το ιστορικό των πληρωμών σου.</p></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      {loading ? <div className="grid gap-6 lg:grid-cols-2"><Card className="h-72 animate-pulse" /><Card className="h-72 animate-pulse" /></div> : <>
        {pendingPayment ? <>{active && <ActiveSubscription subscription={subscription!} progress={progress} barTone={barTone} onRenew={() => setRenewing(true)} />}<PendingSubscription payment={pendingPayment} subscription={pendingSubscription || subscription} bankDetails={bankDetails} onCopyIban={() => void copyIban()} /></> : active ? <ActiveSubscription subscription={subscription!} progress={progress} barTone={barTone} onRenew={() => setRenewing(true)} /> : <ExpiredSubscription subscription={subscription} onRenew={() => setRenewing(true)} />}
        {!!data.upcomingSubscriptions?.length && <UpcomingSubscriptions subscriptions={data.upcomingSubscriptions} />}
        {!pendingPayment && active && <AvailablePlans plans={plans} subscription={subscription} onSelect={(slug) => { setSelectedPlan(slug); setRenewing(true) }} />}
        {(renewing || (!active && !pendingPayment)) && <RenewalForm plans={plans} selectedPlan={selectedPlan} onPlanChange={setSelectedPlan} paymentMethod={paymentMethod} onMethodChange={setPaymentMethod} saving={saving} onSubmit={() => void beginPayment()} />}
        <PaymentHistory payments={data.payments} />
      </>}
    </main>
  </ClientShell>
}

function ActiveSubscription({ subscription, progress, barTone, onRenew }: { subscription: Subscription; progress: number; barTone: string; onRenew: () => void }) {
  const days = Number(subscription.days_remaining ?? 0)
  const expiring = subscription.status === "expiring_soon"
  return <Card className="overflow-hidden"><CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center"><div><div className="flex flex-wrap items-center gap-3"><Badge className={statusStyle(subscription.status)}>{expiring ? "Λήγει σύντομα" : "Ενεργή συνδρομή"}</Badge><span className="text-sm text-muted-foreground">{subscription.plan_name}</span></div><p className="mt-5 text-4xl font-bold tabular-nums">{days}<span className="ml-2 text-base font-medium text-muted-foreground">ημέρες απομένουν</span></p><Progress value={progress} className={`mt-5 h-2 ${barTone}`} /><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{formatDate(subscription.start_date)}</span><span>{formatDate(subscription.end_date)}</span></div></div><div className="rounded-xl bg-muted/60 p-5"><p className="text-sm text-muted-foreground">Πλάνο</p><p className="mt-2 text-xl font-semibold">{subscription.plan_name}</p><p className="mt-1 text-sm text-muted-foreground">{money(subscription.price)}</p>{expiring && <Button size="sm" className="mt-5 w-full" onClick={onRenew}>Ανανέωση</Button>}</div></CardContent></Card>
}

function UpcomingSubscriptions({ subscriptions }: { subscriptions: Subscription[] }) {
  return <Card><CardHeader><CardTitle className="text-lg">Επόμενα πλάνα</CardTitle><CardDescription>Έχουν πληρωθεί και θα ενεργοποιηθούν στις ημερομηνίες που φαίνονται παρακάτω.</CardDescription></CardHeader><CardContent className="space-y-3">{subscriptions.map((subscription) => <div key={`${subscription.plan_name}-${subscription.start_date}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4"><div><p className="font-semibold">{subscription.plan_name}</p><p className="mt-1 text-sm text-muted-foreground">Ξεκινά {formatDate(subscription.start_date)} · {money(subscription.price, subscription.currency || "EUR")}</p></div><Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">Πληρωμένο</Badge></div>)}</CardContent></Card>
}

function AvailablePlans({ plans, subscription, onSelect }: { plans: PricingPlan[]; subscription: Subscription | null; onSelect: (slug: string) => void }) {
  const currentName = subscription?.plan_name?.trim().toLocaleLowerCase("el-GR") || ""
  const currentPrice = Number(subscription?.price || 0)
  if (!plans.length) return null

  return <section aria-labelledby="available-plans-heading" className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div><h2 id="available-plans-heading" className="text-xl font-bold">Διαθέσιμα πλάνα</h2><p className="mt-1 text-sm text-muted-foreground">Επίλεξε ανανέωση ή αλλαγή πλάνου. Η επιλογή ενεργοποιείται μετά την έγκριση του coach.</p></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.name.trim().toLocaleLowerCase("el-GR") === currentName
        const price = Number(plan.price || 0)
        const upgrade = !isCurrent && price > currentPrice
        const label = isCurrent ? "Τρέχον πλάνο" : upgrade ? "Αναβάθμιση" : "Αλλαγή πλάνου"
        return <Card key={plan.slug} className={isCurrent ? "ring-2 ring-primary" : ""}>
          <CardContent className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted-foreground">{plan.description || plan.period || "Συνδρομητικό πλάνο"}</p></div><Badge variant={isCurrent ? "default" : "secondary"}>{isCurrent ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : upgrade ? <Sparkles className="mr-1 h-3.5 w-3.5" /> : null}{label}</Badge></div>
            <div><span className="text-2xl font-bold">{money(plan.price, plan.currency)}</span>{plan.period && <span className="ml-1 text-sm text-muted-foreground">/ {plan.period}</span>}</div>
            <Button className="mt-auto w-full" variant={isCurrent ? "outline" : "default"} onClick={() => onSelect(plan.slug)}>{isCurrent ? "Ανανέωση πλάνου" : upgrade ? "Επιλογή αναβάθμισης" : "Επιλογή πλάνου"}</Button>
          </CardContent>
        </Card>
      })}
    </div>
  </section>
}

function PendingSubscription({ payment, subscription, bankDetails, onCopyIban }: { payment: Payment; subscription: Subscription | null; bankDetails: BankDetails | null; onCopyIban: () => void }) {
  const bank = payment.method === "bank_transfer" || payment.method === "bank"
  return <div className="space-y-6"><Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="flex gap-4 p-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Clock3 className="h-5 w-5" /></span><div><Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Εκκρεμεί έγκριση</Badge><h2 className="mt-3 text-xl font-bold">Η πληρωμή σου καταχωρήθηκε</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Ο coach θα επιβεβαιώσει την πληρωμή σου. Τότε θα ξεκινήσει η συνδρομή και θα ξεκλειδώσουν τα προγράμματά σου.</p></div></CardContent></Card><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><Card><CardHeader><CardTitle className="text-lg">Σύνοψη αιτήματος</CardTitle></CardHeader><CardContent className="space-y-4"><Summary label="Πλάνο" value={subscription?.plan_name || "-"} /><Summary label="Ποσό" value={money(payment.amount, payment.currency || "EUR")} /><Summary label="Τρόπος" value={paymentMethods[payment.method] || payment.method} />{payment.referenceNumber && <Summary label="Αιτιολογία" value={payment.referenceNumber} />}</CardContent></Card>{bank && bankDetails?.iban ? <Card><CardHeader><CardTitle className="text-lg">Στοιχεία εμβάσματος</CardTitle><CardDescription>Χρησιμοποίησε την αιτιολογία του αιτήματος.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm font-medium">{bankDetails.beneficiary || "-"}</p><p className="text-sm text-muted-foreground">{bankDetails.bankName || ""}</p><div className="rounded-md bg-muted p-3 font-mono text-xs">{bankDetails.iban}</div><Button size="sm" variant="outline" className="w-full" onClick={onCopyIban}><Copy className="mr-2 h-4 w-4" />Αντιγραφή IBAN</Button></CardContent></Card> : <Card><CardContent className="flex h-full flex-col justify-center p-6"><CreditCard className="h-6 w-6 text-primary" /><p className="mt-3 text-sm font-medium">Πληρωμή με κάρτα</p><p className="mt-1 text-sm text-muted-foreground">Η πληρωμή θα ενεργοποιηθεί μόλις επιβεβαιωθεί από τον coach.</p></CardContent></Card>}</div></div>
}

function ExpiredSubscription({ subscription, onRenew }: { subscription: Subscription | null; onRenew: () => void }) { return <Card><CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between"><div><Badge className={statusStyle(subscription?.status)}>{subscription?.status === "expired" ? "Η συνδρομή έληξε" : "Δεν υπάρχει ενεργή συνδρομή"}</Badge><h2 className="mt-3 text-xl font-bold">Συνέχισε από εκεί που έμεινες</h2><p className="mt-2 text-sm text-muted-foreground">Επίλεξε πλάνο και τρόπο πληρωμής. Η νέα συνδρομή ξεκινά μόλις την εγκρίνει ο coach.</p></div><Button onClick={onRenew}>Επιλογή πλάνου</Button></CardContent></Card> }

function RenewalForm({ plans, selectedPlan, onPlanChange, paymentMethod, onMethodChange, saving, onSubmit }: { plans: PricingPlan[]; selectedPlan: string; onPlanChange: (value: string) => void; paymentMethod: "bank_transfer" | "stripe_card"; onMethodChange: (value: "bank_transfer" | "stripe_card") => void; saving: boolean; onSubmit: () => void }) { return <Card><CardHeader><CardTitle>Ανανέωση συνδρομής</CardTitle><CardDescription>Η συνδρομή σου θα ξεκινήσει μετά την επιβεβαίωση του coach.</CardDescription></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-3">{plans.map((plan) => <button key={plan.slug} type="button" onClick={() => onPlanChange(plan.slug)} className={`rounded-xl border p-4 text-left transition-all ${selectedPlan === plan.slug ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40"}`}><p className="font-semibold">{plan.name}</p><p className="mt-1 text-sm text-muted-foreground">{money(plan.price, plan.currency)} · {plan.period || "Μηνιαίο"}</p></button>)}</div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => onMethodChange("bank_transfer")} className={`flex items-center gap-3 rounded-lg border p-4 text-left ${paymentMethod === "bank_transfer" ? "border-primary bg-primary/5" : "border-border"}`}><Landmark className="h-5 w-5" /><span><span className="block font-medium">Τραπεζικό Έμβασμα</span><span className="text-xs text-muted-foreground">Θα εμφανιστούν στοιχεία κατάθεσης</span></span></button><button type="button" onClick={() => onMethodChange("stripe_card")} className={`flex items-center gap-3 rounded-lg border p-4 text-left ${paymentMethod === "stripe_card" ? "border-primary bg-primary/5" : "border-border"}`}><CreditCard className="h-5 w-5" /><span><span className="block font-medium">Κάρτα</span><span className="text-xs text-muted-foreground">Αναμονή έγκρισης coach μετά την πληρωμή</span></span></button></div><Button className="w-full sm:w-auto" disabled={!selectedPlan || saving} onClick={onSubmit}>{saving ? "Καταχώριση..." : "Συνέχεια στην πληρωμή"}</Button></CardContent></Card> }

function PaymentHistory({ payments }: { payments: Payment[] }) { return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ReceiptText className="h-5 w-5" />Ιστορικό πληρωμών</CardTitle></CardHeader><CardContent>{payments.length ? <div className="divide-y">{payments.map((payment) => <div key={payment.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0"><span className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><ShieldCheck className="h-5 w-5" /></span><div className="min-w-[10rem] flex-1"><p className="font-medium">{money(payment.amount, payment.currency || "EUR")}</p><p className="text-xs text-muted-foreground">{formatDate(payment.paidAt)} · {paymentMethods[payment.method] || payment.method}</p></div><Badge className={payment.status === "completed" || payment.status === "confirmed" ? statusStyle("active") : payment.status === "failed" ? statusStyle("expired") : statusStyle("pending")}>{paymentStatuses[payment.status] || payment.status}</Badge></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Δεν υπάρχουν πληρωμές ακόμα.</p>}</CardContent></Card> }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b pb-3 text-sm last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div> }

export default function ClientBillingModernPage() { return <ProtectedRoute allow="client-active"><ClientBillingModernContent /></ProtectedRoute> }
