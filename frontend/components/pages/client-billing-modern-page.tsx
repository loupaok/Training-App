"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, CheckCircle2, ChevronDown, Clock3, Copy, CreditCard, Download, Landmark, ReceiptText, Repeat2 } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ClientShell } from "@/components/shell/client-shell"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/auth-context"

type Subscription = { plan_name: string; price: number | string; currency?: string | null; status: string; start_date?: string | null; end_date?: string | null; days_remaining?: number | null }
type Payment = { id: number; amount: number | string; currency?: string | null; method: string; status: string; referenceNumber?: string | null; paidAt?: string | null; notes?: string | null; proofUrl?: string | null }
type PaymentData = { subscription: Subscription | null; pendingSubscription?: Subscription | null; upcomingSubscriptions?: Subscription[]; payments: Payment[] }
type PricingPlan = { slug: string; name: string; price: number | string; currency?: string; period?: string; description?: string; badge?: string; points_reward?: number | string }
type BankDetails = { beneficiary?: string; bankName?: string; iban?: string }

const dateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric" })
const shortDateFormat = new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short" })
const paymentMethods: Record<string, string> = { bank_transfer: "Τραπεζικό έμβασμα", bank: "Τραπεζικό έμβασμα", stripe: "Κάρτα", stripe_card: "Κάρτα", card: "Κάρτα", cash: "Μετρητά" }
const paymentStatuses: Record<string, string> = { pending: "Εκκρεμεί έγκριση", completed: "Εγκρίθηκε", confirmed: "Εγκρίθηκε", failed: "Απορρίφθηκε" }
const formatDate = (value?: string | null) => value ? dateFormat.format(new Date(value)) : "-"
const formatShortDate = (value?: string | null) => value ? shortDateFormat.format(new Date(value)) : "-"
const money = (value: number | string | null | undefined, currency = "EUR") => new Intl.NumberFormat("el-GR", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0))
const periodMonths = (period?: string) => { const number = Number(period?.match(/\d+/)?.[0] || 1); return /χρόν|έτος/i.test(period || "") ? Math.max(1, number * 12) : Math.max(1, number) }

function paymentStatusClass(status: string) {
  if (status === "completed" || status === "confirmed") return "bg-[color:var(--sp-lime-soft)] text-foreground"
  if (status === "failed") return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
  return "bg-muted text-muted-foreground"
}

function ClientBillingModernContent() {
  const { user, logout } = useAuth()
  const plansRef = useRef<HTMLElement>(null)
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
  const plan = useMemo(() => plans.find((item) => item.slug === selectedPlan) || plans[0] || null, [plans, selectedPlan])
  const activePlan = useMemo(() => plans.find((item) => item.name.trim().toLocaleLowerCase("el-GR") === subscription?.plan_name?.trim().toLocaleLowerCase("el-GR")), [plans, subscription?.plan_name])
  const start = subscription?.start_date ? new Date(subscription.start_date) : null
  const end = subscription?.end_date ? new Date(subscription.end_date) : null
  const totalDays = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)) : 1
  const elapsedDays = start ? Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000)) : 0
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))

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
  const openPlans = () => { setRenewing(true); window.setTimeout(() => plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0) }

  return <ClientShell title="Συνδρομή & Πληρωμές" user={user} logout={logout} paymentApproved={user?.status === "active"} active="billing">
    <main className="mx-auto max-w-[var(--container-7xl)] space-y-6 bg-background p-4 sm:p-6 lg:px-10 lg:py-8">
      <header><h1 className="text-[26px] font-extrabold italic tracking-[-.6px] text-foreground sm:text-[30px]">Συνδρομή & Πληρωμές</h1><p className="mt-1 text-sm text-muted-foreground">Το πλάνο σου, οι ανανεώσεις και όλες οι πληρωμές σου.</p></header>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert className="border-border bg-card"><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      {loading ? <div className="grid gap-4 lg:grid-cols-3"><Card className="h-[300px] animate-pulse rounded-[20px] border-border bg-card lg:col-span-2" /><Card className="h-[300px] animate-pulse rounded-[20px] border-border bg-card" /></div> : <>
        {pendingPayment ? <>{active && <ActiveSubscription subscription={subscription!} progress={progress} pointsReward={Number(activePlan?.points_reward || 0)} payments={data.payments} onRenew={openPlans} onChangePlan={openPlans} />}<PendingSubscription payment={pendingPayment} subscription={pendingSubscription || subscription} bankDetails={bankDetails} onCopyIban={() => void copyIban()} /></> : active ? <ActiveSubscription subscription={subscription!} progress={progress} pointsReward={Number(activePlan?.points_reward || 0)} payments={data.payments} onRenew={openPlans} onChangePlan={openPlans} /> : <ExpiredSubscription subscription={subscription} onRenew={openPlans} />}
        {!!data.upcomingSubscriptions?.length && <UpcomingSubscriptions subscriptions={data.upcomingSubscriptions} />}
        {!pendingPayment && active && <AvailablePlans plansRef={plansRef} plans={plans} subscription={subscription} onSelect={(slug) => { setSelectedPlan(slug); setRenewing(true) }} />}
        {(renewing || (!active && !pendingPayment)) && <RenewalForm plans={plans} selectedPlan={selectedPlan} onPlanChange={setSelectedPlan} paymentMethod={paymentMethod} onMethodChange={setPaymentMethod} saving={saving} onSubmit={() => void beginPayment()} />}
        <PaymentHistory payments={data.payments} />
      </>}
    </main>
  </ClientShell>
}

function RenewalHowItWorks() {
  const steps = [["Διαλέγεις πλάνο", "ανανέωση ή αλλαγή από τα διαθέσιμα πλάνα"], ["Πληρώνεις", "με τραπεζικό έμβασμα ή μετρητά στον coach"], ["Εγκρίνει ο coach", "η συνδρομή ενεργοποιείται μόλις εγκριθεί η πληρωμή"]]
  return <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex h-full flex-col gap-4 p-[22px]"><h2 className="text-[16px] font-extrabold">Πώς γίνεται η ανανέωση</h2><div className="space-y-4">{steps.map(([title, detail], index) => <div key={title} className="flex gap-3"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-extrabold text-accent">{index + 1}</span><div className="pt-1"><p className="text-sm font-extrabold">{title}</p><p className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">{detail}</p></div></div>)}</div><Separator className="mt-auto bg-border" /><p className="text-xs text-muted-foreground">Θα λάβεις ειδοποίηση μόλις εγκριθεί.</p></CardContent></Card>
}

function ActiveSubscription({ subscription, progress, pointsReward, payments, onRenew, onChangePlan }: { subscription: Subscription; progress: number; pointsReward: number; payments: Payment[]; onRenew: () => void; onChangePlan: () => void }) {
  const days = Number(subscription.days_remaining ?? 0); const expiring = subscription.status === "expiring_soon"; const lastPayment = payments.find((payment) => payment.status === "completed" || payment.status === "confirmed")
  const months = subscription.end_date && subscription.start_date ? Math.max(1, Math.round((new Date(subscription.end_date).getTime() - new Date(subscription.start_date).getTime()) / 2629800000)) : null
  return <section className="grid gap-4 lg:grid-cols-3"><Card className="relative overflow-hidden rounded-[20px] border-border bg-card shadow-none lg:col-span-2"><span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-accent" /><CardContent className="grid gap-6 p-[22px] pl-7 xl:grid-cols-[minmax(0,1fr)_250px]"><div className="min-w-0 space-y-[14px]"><div className="flex flex-wrap items-center gap-2"><Badge className="h-6 rounded-full bg-foreground px-2.5 text-[11px] font-extrabold text-background hover:bg-foreground"><span className="mr-1.5 h-[7px] w-[7px] rounded-full bg-accent" />{expiring ? "Λήγει σύντομα" : "Ενεργή συνδρομή"}</Badge><span className="text-[13px] text-muted-foreground">από {formatDate(subscription.start_date)}</span></div><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="text-[34px] font-extrabold italic leading-none tracking-[-1px] text-foreground">{subscription.plan_name}</h2><span className="text-[15px] text-muted-foreground">{money(subscription.price, subscription.currency || "EUR")} / {months ? `${months} μήνες` : "πλάνο"}</span></div><div className="space-y-2"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><p className="text-sm font-bold"><span className="text-[22px] font-extrabold">{days}</span> ημέρες απομένουν</p><p className="text-xs text-muted-foreground">{formatShortDate(subscription.start_date)} → {formatDate(subscription.end_date)}</p></div><Progress value={progress} className="h-2.5 bg-muted [&_[data-slot=progress-indicator]]:bg-accent" /></div><div className="flex flex-wrap gap-2.5 pt-1"><Button className="h-[46px] rounded-full bg-accent px-[22px] font-extrabold text-accent-foreground hover:bg-accent/85" onClick={onRenew}><Repeat2 className="mr-2 h-4 w-4" />Ανανέωση</Button><Button className="h-[46px] rounded-full border-[1.5px] border-foreground bg-transparent px-5 font-bold text-foreground hover:bg-muted" variant="outline" onClick={onChangePlan}>Αλλαγή πλάνου</Button></div></div><div className="grid grid-cols-2 gap-2.5 content-start">{[["Επόμενη ανανέωση", formatShortDate(subscription.end_date)], ["Ποσό", money(subscription.price, subscription.currency || "EUR")], ["Τελευταία πληρωμή", formatShortDate(lastPayment?.paidAt)]].map(([label, value]) => <div key={label} className="rounded-[14px] bg-muted p-[14px] text-foreground"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-[17px] font-extrabold">{value}</p></div>)}{pointsReward > 0 && <div className="rounded-[14px] bg-accent p-[14px] text-accent-foreground"><p className="text-xs font-bold">Με την ανανέωση</p><p className="mt-0.5 text-[17px] font-extrabold">+{pointsReward} πόντοι</p></div>}</div></CardContent></Card><RenewalHowItWorks /></section>
}

function UpcomingSubscriptions({ subscriptions }: { subscriptions: Subscription[] }) { return <Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader className="pb-3"><CardTitle className="text-[18px] font-extrabold">Επόμενα πλάνα</CardTitle><CardDescription>Έχουν πληρωθεί και θα ενεργοποιηθούν στις ημερομηνίες που εμφανίζονται.</CardDescription></CardHeader><CardContent className="space-y-3">{subscriptions.map((subscription) => <div key={`${subscription.plan_name}-${subscription.start_date}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-muted p-4"><div><p className="font-extrabold">{subscription.plan_name}</p><p className="mt-1 text-sm text-muted-foreground">Ξεκινά {formatDate(subscription.start_date)} · {money(subscription.price, subscription.currency || "EUR")}</p></div><Badge className="rounded-full bg-[color:var(--sp-lime-soft)] text-foreground">Πληρωμένο</Badge></div>)}</CardContent></Card> }

function AvailablePlans({ plans, subscription, onSelect, plansRef }: { plans: PricingPlan[]; subscription: Subscription | null; onSelect: (slug: string) => void; plansRef: React.RefObject<HTMLElement | null> }) {
  const currentName = subscription?.plan_name?.trim().toLocaleLowerCase("el-GR") || ""; const eligible = plans.filter((plan) => plan.name.trim().toLocaleLowerCase("el-GR") !== currentName); const bestValue = eligible.reduce<PricingPlan | null>((best, plan) => !best || Number(plan.price || 0) / periodMonths(plan.period) < Number(best.price || 0) / periodMonths(best.period) ? plan : best, null)
  if (!plans.length) return null
  return <section ref={plansRef} id="available-plans" aria-labelledby="available-plans-heading" className="scroll-mt-6 space-y-4"><div><h2 id="available-plans-heading" className="text-[20px] font-extrabold">Διαθέσιμα πλάνα</h2><p className="mt-1 text-[13px] text-muted-foreground">Η αλλαγή ενεργοποιείται μετά την έγκριση του coach.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => { const isCurrent = plan.name.trim().toLocaleLowerCase("el-GR") === currentName; const planMonths = periodMonths(plan.period); const isBestValue = !isCurrent && bestValue?.slug === plan.slug; return <Card key={plan.slug} className={`flex min-h-[280px] rounded-[20px] bg-card shadow-none ${isCurrent ? "border-2 border-foreground ring-4 ring-accent/45" : "border-border"}`}><CardContent className="flex w-full flex-col gap-[14px] p-[22px]"><div className="flex min-h-6 items-center justify-between gap-2"><h3 className="text-[18px] font-extrabold">{plan.name}</h3>{isCurrent ? <Badge className="h-6 rounded-full bg-foreground px-2.5 text-[11px] font-extrabold text-accent hover:bg-foreground"><Check className="mr-1 h-3 w-3" />Τρέχον πλάνο</Badge> : isBestValue ? <Badge className="h-6 rounded-full bg-accent px-2.5 text-[11px] font-extrabold text-accent-foreground hover:bg-accent">Καλύτερη τιμή</Badge> : null}</div><p className="min-h-[58px] text-[13px] leading-5 text-muted-foreground">{plan.description || " "}</p><div><p className="text-[30px] font-extrabold italic leading-none tracking-[-.8px]">{money(plan.price, plan.currency || "EUR")}<span className="text-sm font-semibold not-italic tracking-normal text-muted-foreground"> / {plan.period || "μήνα"}</span></p><p className="mt-1 text-xs text-[#8A8A8A]">{planMonths > 1 ? `≈ ${money(Number(plan.price || 0) / planMonths, plan.currency || "EUR")} / μήνα` : "πληρωμή κάθε μήνα"}</p></div><Button className={`mt-auto h-11 w-full rounded-full font-extrabold ${isCurrent ? "border-[1.5px] border-foreground bg-transparent text-foreground hover:bg-muted" : "bg-foreground text-background hover:bg-foreground/90"}`} variant={isCurrent ? "outline" : "default"} onClick={() => onSelect(plan.slug)}>{isCurrent ? "Ανανέωση πλάνου" : "Επιλογή πλάνου"}</Button></CardContent></Card> })}</div></section>
}

function PendingSubscription({ payment, subscription, bankDetails, onCopyIban }: { payment: Payment; subscription: Subscription | null; bankDetails: BankDetails | null; onCopyIban: () => void }) { const bank = payment.method === "bank_transfer" || payment.method === "bank"; return <div className="space-y-5"><Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex gap-4 p-[22px]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-foreground"><Clock3 className="h-5 w-5" /></span><div><Badge className="rounded-full bg-muted text-muted-foreground">Εκκρεμεί έγκριση</Badge><h2 className="mt-3 text-xl font-extrabold">Η πληρωμή σου καταχωρήθηκε</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Ο coach θα επιβεβαιώσει την πληρωμή σου. Τότε θα ξεκινήσει η συνδρομή και θα ξεκλειδώσουν τα προγράμματά σου.</p></div></CardContent></Card><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"><Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader><CardTitle className="text-lg">Σύνοψη αιτήματος</CardTitle></CardHeader><CardContent className="space-y-4"><Summary label="Πλάνο" value={subscription?.plan_name || "-"} /><Summary label="Ποσό" value={money(payment.amount, payment.currency || "EUR")} /><Summary label="Τρόπος" value={paymentMethods[payment.method] || payment.method} />{payment.referenceNumber && <Summary label="Αιτιολογία" value={payment.referenceNumber} />}</CardContent></Card>{bank && bankDetails?.iban ? <Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader><CardTitle className="text-lg">Στοιχεία εμβάσματος</CardTitle><CardDescription>Χρησιμοποίησε την αιτιολογία του αιτήματος.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm font-medium">{bankDetails.beneficiary || "-"}</p><p className="text-sm text-muted-foreground">{bankDetails.bankName || ""}</p><div className="rounded-[12px] bg-muted p-3 font-mono text-xs">{bankDetails.iban}</div><Button size="sm" variant="outline" className="w-full rounded-full" onClick={onCopyIban}><Copy className="mr-2 h-4 w-4" />Αντιγραφή IBAN</Button></CardContent></Card> : <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex h-full flex-col justify-center p-6"><CreditCard className="h-6 w-6 text-foreground" /><p className="mt-3 text-sm font-extrabold">Πληρωμή με κάρτα</p><p className="mt-1 text-sm text-muted-foreground">Η πληρωμή ενεργοποιείται μόλις επιβεβαιωθεί από τον coach.</p></CardContent></Card>}</div></div> }

function ExpiredSubscription({ subscription, onRenew }: { subscription: Subscription | null; onRenew: () => void }) { return <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="flex flex-col gap-5 p-[22px] sm:flex-row sm:items-center sm:justify-between"><div><Badge className="rounded-full bg-muted text-muted-foreground">{subscription?.status === "expired" ? "Η συνδρομή έληξε" : "Δεν υπάρχει ενεργή συνδρομή"}</Badge><h2 className="mt-3 text-xl font-extrabold">Συνέχισε από εκεί που έμεινες</h2><p className="mt-2 text-sm text-muted-foreground">Επίλεξε πλάνο και τρόπο πληρωμής. Η νέα συνδρομή ξεκινά μόλις την εγκρίνει ο coach.</p></div><Button className="h-[46px] rounded-full bg-accent px-6 font-extrabold text-accent-foreground hover:bg-accent/85" onClick={onRenew}>Επιλογή πλάνου</Button></CardContent></Card> }

function RenewalForm({ plans, selectedPlan, onPlanChange, paymentMethod, onMethodChange, saving, onSubmit }: { plans: PricingPlan[]; selectedPlan: string; onPlanChange: (value: string) => void; paymentMethod: "bank_transfer" | "stripe_card"; onMethodChange: (value: "bank_transfer" | "stripe_card") => void; saving: boolean; onSubmit: () => void }) { return <Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader><CardTitle>Ανανέωση συνδρομής</CardTitle><CardDescription>Η συνδρομή σου θα ξεκινήσει μετά την επιβεβαίωση του coach.</CardDescription></CardHeader><CardContent className="space-y-6"><div className="grid gap-3 md:grid-cols-3">{plans.map((plan) => <button key={plan.slug} type="button" onClick={() => onPlanChange(plan.slug)} className={`rounded-[14px] border p-4 text-left transition-colors ${selectedPlan === plan.slug ? "border-foreground bg-[color:var(--sp-lime-soft)]" : "border-border"}`}><p className="font-extrabold">{plan.name}</p><p className="mt-1 text-sm text-muted-foreground">{money(plan.price, plan.currency)} · {plan.period || "Μηνιαίο"}</p></button>)}</div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => onMethodChange("bank_transfer")} className={`flex items-center gap-3 rounded-[14px] border p-4 text-left ${paymentMethod === "bank_transfer" ? "border-foreground bg-[color:var(--sp-lime-soft)]" : "border-border"}`}><Landmark className="h-5 w-5" /><span><span className="block font-extrabold">Τραπεζικό έμβασμα</span><span className="text-xs text-muted-foreground">Θα εμφανιστούν στοιχεία κατάθεσης</span></span></button><button type="button" onClick={() => onMethodChange("stripe_card")} className={`flex items-center gap-3 rounded-[14px] border p-4 text-left ${paymentMethod === "stripe_card" ? "border-foreground bg-[color:var(--sp-lime-soft)]" : "border-border"}`}><CreditCard className="h-5 w-5" /><span><span className="block font-extrabold">Κάρτα</span><span className="text-xs text-muted-foreground">Αναμονή έγκρισης coach μετά την πληρωμή</span></span></button></div><Button className="h-[46px] rounded-full bg-accent px-6 font-extrabold text-accent-foreground hover:bg-accent/85" disabled={!selectedPlan || saving} onClick={onSubmit}>{saving ? "Καταχώριση..." : "Συνέχεια στην πληρωμή"}</Button></CardContent></Card> }

function PaymentHistory({ payments }: { payments: Payment[] }) { const [showAll, setShowAll] = useState(false); const visiblePayments = showAll ? payments : payments.slice(0, 5); const currentYear = new Date().getFullYear(); const currentYearTotal = payments.filter((payment) => ["completed", "confirmed"].includes(payment.status) && payment.paidAt && new Date(payment.paidAt).getFullYear() === currentYear).reduce((sum, payment) => sum + Number(payment.amount || 0), 0); return <Card className="rounded-[20px] border-border bg-card shadow-none"><CardHeader className="flex flex-row items-center justify-between gap-4 pb-3"><CardTitle className="flex items-center gap-2 text-[18px] font-extrabold"><ReceiptText className="h-5 w-5" />Ιστορικό πληρωμών</CardTitle><p className="text-[13px] text-muted-foreground">Σύνολο {currentYear}: <span className="font-extrabold text-foreground">{money(currentYearTotal)}</span></p></CardHeader><CardContent className="px-0 pb-2 sm:px-6">{payments.length ? <><div className="hidden sm:block"><Table><TableHeader><TableRow className="border-border hover:bg-transparent"><TableHead className="h-10 px-6 text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">ΗΜΕΡΟΜΗΝΙΑ</TableHead><TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">ΠΛΑΝΟ</TableHead><TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">ΤΡΟΠΟΣ</TableHead><TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">ΠΟΣΟ</TableHead><TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">ΚΑΤΑΣΤΑΣΗ</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{visiblePayments.map((payment) => <TableRow key={payment.id} className="border-border hover:bg-muted/50"><TableCell className="px-6 py-3.5 font-bold">{formatDate(payment.paidAt)}</TableCell><TableCell className="py-3.5">{payment.notes || "-"}</TableCell><TableCell className="py-3.5 text-muted-foreground">{paymentMethods[payment.method] || payment.method}</TableCell><TableCell className="py-3.5 font-extrabold">{money(payment.amount, payment.currency || "EUR")}</TableCell><TableCell className="py-3.5"><Badge className={`h-6 rounded-full px-2.5 text-[11px] font-extrabold ${paymentStatusClass(payment.status)}`}>{["completed", "confirmed"].includes(payment.status) && <Check className="mr-1 h-3 w-3" />}{paymentStatuses[payment.status] || payment.status}</Badge></TableCell><TableCell className="py-3.5 pr-6">{payment.proofUrl ? <Button asChild size="icon" variant="outline" className="h-9 w-9 rounded-[10px] border-border"><a href={payment.proofUrl} target="_blank" rel="noreferrer" aria-label="Αποδεικτικό πληρωμής"><Download className="h-4 w-4" /></a></Button> : null}</TableCell></TableRow>)}</TableBody></Table></div><div className="space-y-2 px-4 sm:hidden">{visiblePayments.map((payment) => <div key={payment.id} className="rounded-[14px] border border-border p-4"><div className="flex items-start justify-between gap-3"><p className="font-extrabold">{formatDate(payment.paidAt)}</p><p className="font-extrabold">{money(payment.amount, payment.currency || "EUR")}</p></div><div className="mt-3 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{paymentMethods[payment.method] || payment.method}</p><Badge className={`h-6 rounded-full px-2.5 text-[11px] font-extrabold ${paymentStatusClass(payment.status)}`}>{["completed", "confirmed"].includes(payment.status) && <Check className="mr-1 h-3 w-3" />}{paymentStatuses[payment.status] || payment.status}</Badge></div></div>)}</div>{payments.length > 5 && <button type="button" onClick={() => setShowAll((current) => !current)} className="flex w-full items-center justify-center gap-1 py-3 text-[13px] font-extrabold text-foreground">{showAll ? "Λιγότερα" : "Περισσότερα"}<ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} /></button>}</> : <p className="py-8 text-center text-sm text-muted-foreground">Δεν υπάρχουν πληρωμές ακόμα.</p>}</CardContent></Card> }

function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div> }

export default function ClientBillingModernPage() { return <ProtectedRoute allow="client-billing"><ClientBillingModernContent /></ProtectedRoute> }
