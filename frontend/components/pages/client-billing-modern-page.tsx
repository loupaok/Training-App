"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  CreditCard,
  Download,
  FileText,
  FileUp,
  Landmark,
  LockKeyhole,
  Paperclip,
  WalletCards,
  ReceiptText,
  Repeat2,
  X,
} from "lucide-react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";

type Subscription = {
  id?: number | string;
  plan_name: string;
  price: number | string;
  currency?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  days_remaining?: number | null;
};
type Payment = {
  id: number;
  amount: number | string;
  currency?: string | null;
  method: string;
  status: string;
  referenceNumber?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  proofUrl?: string | null;
  planName?: string | null;
  createdAt?: string | null;
  privacyPolicyAcceptedAt?: string | null;
  privacyPolicyVersion?: string | null;
};
type PaymentData = {
  subscription: Subscription | null;
  pendingSubscription?: Subscription | null;
  upcomingSubscriptions?: Subscription[];
  payments: Payment[];
};
type PricingPlan = {
  id?: number;
  slug: string;
  name: string;
  price: number | string;
  currency?: string;
  period?: string;
  description?: string;
  badge?: string;
  pointsReward?: number | string;
  isPopular?: boolean;
  features?: string[];
};
type PackageDuration = { id: number; months: number; title?: string | null; basePriceCents: number; label?: string | null; isActive: boolean; sortOrder?: number };
type CoachingPackageOffer = { id: number; months: number; priceCents: number; features: string[]; isActive: boolean };
type CoachingPackage = { id: number; key: string; name: string; monthlyAddonCents: number; label?: string | null; sortOrder?: number; parentPackageId?: number | null; features: { id: number; text: string }[]; offers?: CoachingPackageOffer[] };
type PackageCatalog = { packages: CoachingPackage[]; durations: PackageDuration[]; commonFeatures: { id: number; text: string }[]; pointsPerEuro: number };
type BankDetails = { beneficiary?: string; bankName?: string; iban?: string };
type BankAccount = {
  id: number;
  bankName: string;
  accountHolder: string;
  iban: string;
  isDefault: boolean;
  isVisible: boolean;
  sortOrder: number;
};
type PaymentSettings = {
  bankTransferEnabled: boolean;
  cashEnabled: boolean;
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  paymentReference?: string;
  paymentNote?: string;
  bankAccounts: BankAccount[];
};

const dateFormat = new Intl.DateTimeFormat("el-GR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortDateFormat = new Intl.DateTimeFormat("el-GR", {
  day: "numeric",
  month: "short",
});
const paymentMethods: Record<string, string> = {
  bank_transfer: "Τραπεζικό έμβασμα",
  bank: "Τραπεζικό έμβασμα",
  stripe: "Κάρτα",
  stripe_card: "Κάρτα",
  card: "Κάρτα",
  paypal: "PayPal",
  cash: "Μετρητά",
};
const paymentStatuses: Record<string, string> = {
  pending: "Εκκρεμεί έγκριση",
  completed: "Εγκρίθηκε",
  confirmed: "Εγκρίθηκε",
  failed: "Απορρίφθηκε",
  cancelled: "Ακυρώθηκε",
};
const formatDate = (value?: string | null) =>
  value ? dateFormat.format(new Date(value)) : "-";
const formatShortDate = (value?: string | null) =>
  value ? shortDateFormat.format(new Date(value)) : "-";
const formatDateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "-";
const money = (value: number | string | null | undefined, currency = "EUR") =>
  new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(value || 0));
const periodMonths = (period?: string) => {
  const number = Number(period?.match(/\d+/)?.[0] || 1);
  return /χρόν|έτος/i.test(period || "")
    ? Math.max(1, number * 12)
    : Math.max(1, number);
};

function paymentStatusClass(status: string) {
  if (status === "completed" || status === "confirmed")
    return "bg-[color:var(--sp-lime-soft)] text-foreground";
  if (status === "failed")
    return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

function paymentStatusLabel(payment: Payment) {
  if (payment.status === "failed" && /ακυρώθηκε/i.test(payment.notes || "")) return "Ακυρώθηκε";
  return paymentStatuses[payment.status] || payment.status;
}

function ClientBillingModernContent() {
  const { user, logout } = useAuth();
  const plansRef = useRef<HTMLElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PaymentData>({
    subscription: null,
    payments: [],
  });
  const [catalog, setCatalog] = useState<PackageCatalog | null>(null);
  const [selectedDurationMonths, setSelectedDurationMonths] = useState(1);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bankTransferEnabled: true,
    cashEnabled: false,
    stripeEnabled: false,
    paypalEnabled: false,
    bankAccounts: [],
  });
  const [selectedPlan, setSelectedPlan] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "bank_transfer" | "stripe_card" | "paypal" | "cash"
  >("bank_transfer");
  const [paymentIntent, setPaymentIntent] = useState<"renew" | "change" | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [payments, packageCatalog, bank, settings] = await Promise.all([
        api.get<PaymentData>("/client/payments"),
        api.get<PackageCatalog>("/pricing-plans/packages").catch(() => null),
        api.get<BankDetails>("/bank-details").catch(() => null),
        api
          .get<PaymentSettings>("/pricing-plans/payment-options")
          .catch(() => null),
      ]);
      setData({
        subscription: payments.subscription || null,
        pendingSubscription: payments.pendingSubscription || null,
        upcomingSubscriptions: payments.upcomingSubscriptions || [],
        payments: payments.payments || [],
      });
      setCatalog(packageCatalog);
      setBankDetails(bank);
      if (settings) {
        setPaymentSettings(settings);
      const firstAvailable = settings.stripeEnabled
        ? "stripe_card"
        : settings.paypalEnabled
          ? "paypal"
          : settings.bankTransferEnabled
            ? "bank_transfer"
            : settings.cashEnabled
              ? "cash"
              : null;
      if (firstAvailable) setPaymentMethod(firstAvailable);
      }
      const availableDurations = packageCatalog?.durations.filter((item) => item.isActive).sort((a, b) => (a.sortOrder || a.months) - (b.sortOrder || b.months)) || [];
      setSelectedDurationMonths((current) => availableDurations.some((item) => item.months === current) ? current : (availableDurations[0]?.months || 1));
      setSelectedPlan((current) => current || (packageCatalog?.packages[0] ? String(packageCatalog.packages[0].id) : ""));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Δεν ήταν δυνατή η φόρτωση των στοιχείων συνδρομής.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripePaymentId = params.get("stripe_payment_id");
    const stripeSessionId = params.get("stripe_session_id");
    const paypalPaymentId = params.get("paypal_payment_id");
    const paypalOrderId = params.get("token");
    const cancelledPaymentId = params.get("payment") === "cancelled" ? params.get("payment_id") : null;
    const confirm = async () => {
      try {
        if (stripePaymentId && stripeSessionId) {
          await api.post(`/clients/me/billing/${stripePaymentId}/stripe-confirm`, { sessionId: stripeSessionId });
          setMessage("Η πληρωμή επιβεβαιώθηκε και η συνδρομή σου ενεργοποιήθηκε.");
        } else if (paypalPaymentId && paypalOrderId) {
          await api.post(`/clients/me/billing/${paypalPaymentId}/paypal-capture`, { orderId: paypalOrderId });
          setMessage("Η πληρωμή επιβεβαιώθηκε και η συνδρομή σου ενεργοποιήθηκε.");
        } else if (cancelledPaymentId) {
          await api.post(`/clients/me/billing/${cancelledPaymentId}/cancel-online`, {});
          setMessage("Η online πληρωμή ακυρώθηκε. Δεν έγινε καμία αλλαγή στη συνδρομή σου.");
        } else return;
        window.history.replaceState({}, "", "/client-billing");
        await load();
      } catch (confirmationError) {
        setError(confirmationError instanceof Error ? confirmationError.message : "Δεν ήταν δυνατή η επιβεβαίωση της πληρωμής.");
      }
    };
    void confirm();
  }, []);

  const plans = useMemo<PricingPlan[]>(() => {
    const duration = catalog?.durations.find((item) => item.months === selectedDurationMonths) || catalog?.durations[0];
    if (!duration) return [];
    const resolveFeatures = (item: CoachingPackage, visited = new Set<number>()): string[] => {
      if (visited.has(item.id)) return [];
      visited.add(item.id);
      const parent = item.parentPackageId ? catalog?.packages.find((entry) => entry.id === item.parentPackageId) : undefined;
      const offer = item.offers?.find((entry) => entry.months === duration.months && entry.isActive !== false);
      const own = offer?.features?.length ? offer.features : item.features.map((feature) => feature.text);
      return [...new Set([...(parent ? resolveFeatures(parent, visited) : []), ...own])];
    };
    return [...(catalog?.packages || [])].sort((a, b) => (a.sortOrder || a.id) - (b.sortOrder || b.id)).flatMap((item) => {
      const offer = item.offers?.find((entry) => entry.months === duration.months && entry.isActive !== false);
      if (!offer) return [];
      const priceCents = offer.priceCents;
      const offerFeatures = resolveFeatures(item);
      return [{
        id: item.id,
        slug: String(item.id),
        name: item.name,
        price: priceCents / 100,
        currency: "EUR",
        period: `${duration.months} ${duration.months === 1 ? "μήνας" : "μήνες"}`,
        badge: item.label || "",
        description: offerFeatures.slice(0, 2).join(" · "),
        features: offerFeatures,
        pointsReward: Math.round((priceCents / 100) * (catalog?.pointsPerEuro || 0)),
        isPopular: Boolean(item.label),
      }];
    });
  }, [catalog, selectedDurationMonths]);
  useEffect(() => {
    if (plans.length && !plans.some((item) => item.slug === selectedPlan)) setSelectedPlan(plans[0].slug);
  }, [plans, selectedPlan]);
  const subscription = data.subscription;
  const pendingSubscription = data.pendingSubscription || null;
  const pendingPayment =
    data.payments.find((payment) => payment.status === "pending") || null;
  const active =
    subscription?.status === "active" ||
    subscription?.status === "expiring_soon";
  const plan = useMemo(
    () => plans.find((item) => item.slug === selectedPlan) || plans[0] || null,
    [plans, selectedPlan],
  );
  const activePlan = useMemo(
    () =>
      plans.find(
        (item) =>
          item.name.trim().toLocaleLowerCase("el-GR") ===
          subscription?.plan_name?.trim().toLocaleLowerCase("el-GR"),
      ),
    [plans, subscription?.plan_name],
  );
  const start = subscription?.start_date
    ? new Date(subscription.start_date)
    : null;
  const end = subscription?.end_date ? new Date(subscription.end_date) : null;
  const totalDays =
    start && end
      ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      : 1;
  const elapsedDays = start
    ? Math.max(0, Math.ceil((Date.now() - start.getTime()) / 86400000))
    : 0;
  const progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  const beginPayment = async (
    privacyPolicyAccepted: boolean,
    bankTransfer?: { proof?: File | null; note?: string },
  ) => {
    if (!plan) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payment = await api.post<{ paymentId: number }>("/clients/me/billing", {
        packageId: plan.id,
        durationMonths: selectedDurationMonths,
        paymentMethod,
        privacyPolicyAccepted,
        note: bankTransfer?.note?.trim() || undefined,
      });
      if (paymentMethod === "stripe_card") {
        const checkout = await api.post<{ checkoutUrl: string }>(`/clients/me/billing/${payment.paymentId}/stripe-checkout`, {});
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      if (paymentMethod === "paypal") {
        const checkout = await api.post<{ checkoutUrl: string }>(`/clients/me/billing/${payment.paymentId}/paypal-order`, {});
        window.location.assign(checkout.checkoutUrl);
        return;
      }
      if (paymentMethod === "bank_transfer" && bankTransfer?.proof) {
        const proofData = new FormData();
        proofData.append("proof", bankTransfer.proof);
        try {
          await api.upload("/clients/me/billing-proof", proofData);
        } catch (proofError) {
          setError(proofError instanceof Error ? `${proofError.message} Μπορείς να το προσθέσεις αργότερα.` : "Η πληρωμή καταχωρήθηκε, αλλά το αποδεικτικό μπορείς να το προσθέσεις αργότερα.");
        }
      }
      setMessage(
        "Η πληρωμή καταχωρήθηκε και αναμένει επιβεβαίωση από τον coach.",
      );
      setPaymentIntent(null);
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Δεν ήταν δυνατή η καταχώριση της πληρωμής.",
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadBankProof = async (file: File) => {
    setUploadingProof(true);
    setError("");
    try {
      const proofData = new FormData();
      proofData.append("proof", file);
      await api.upload("/clients/me/billing-proof", proofData);
      setMessage("Το αποδεικτικό στάλθηκε. Ακολουθεί έλεγχος από τον coach.");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Δεν ήταν δυνατή η αποστολή του αποδεικτικού.");
    } finally {
      setUploadingProof(false);
    }
  };

  const copyIban = async (iban = bankDetails?.iban) => {
    if (iban)
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
  };
  const openPlans = (planSlug?: string) => {
    if (planSlug) setSelectedPlan(planSlug);
    setPaymentIntent("change");
    window.setTimeout(
      () =>
        plansRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      0,
    );
  };
  const selectForRenewal = (planSlug?: string) => {
    if (planSlug) setSelectedPlan(planSlug);
    setPaymentIntent("renew");
    window.setTimeout(
      () => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      0,
    );
  };
  const selectPlanForPayment = (planSlug: string) => {
    setSelectedPlan(planSlug);
    setPaymentIntent("change");
    window.setTimeout(
      () => paymentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      350,
    );
  };
  const cancelPendingPayment = async (paymentId: number) => {
    setCancellingPayment(true);
    setError("");
    try {
      await api.post(`/clients/me/billing/${paymentId}/cancel`, {});
      setMessage("Το αίτημα πληρωμής ακυρώθηκε.");
      await load();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Δεν ήταν δυνατή η ακύρωση του αιτήματος.");
    } finally {
      setCancellingPayment(false);
    }
  };

  return (
    <ClientShell
      title="Συνδρομή & Πληρωμές"
      user={user}
      logout={logout}
      paymentApproved={user?.status === "active"}
      active="billing"
    >
      <main className="mx-auto max-w-[var(--container-7xl)] space-y-6 bg-background p-4 sm:p-6 lg:px-10 lg:py-8">
        <header>
          <h1 className="text-[26px] font-extrabold italic tracking-[-.6px] text-foreground sm:text-[30px]">
            Συνδρομή & Πληρωμές
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Το πλάνο σου, οι ανανεώσεις και όλες οι πληρωμές σου.
          </p>
        </header>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {message && (
          <Alert className="border-border bg-card">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="h-[300px] animate-pulse rounded-[20px] border-border bg-card lg:col-span-2" />
            <Card className="h-[300px] animate-pulse rounded-[20px] border-border bg-card" />
          </div>
        ) : (
          <>
            {pendingPayment ? (
              <>
                {active && (
                  <ActiveSubscription
                    subscription={subscription!}
                    progress={progress}
                    pointsReward={Number(activePlan?.pointsReward || 0)}
                    payments={data.payments}
                    paymentSettings={paymentSettings}
                    onRenew={() => selectForRenewal(activePlan?.slug)}
                    onChangePlan={openPlans}
                    showHowItWorks={false}
                  />
                )}
                <section className="grid items-start gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <PendingSubscription
                      payment={pendingPayment}
                      subscription={pendingSubscription || subscription}
                      bankDetails={bankDetails}
                      onCopyIban={() => void copyIban()}
                      onCancel={() => void cancelPendingPayment(pendingPayment.id)}
                      cancelling={cancellingPayment}
                      pointsReward={Number(activePlan?.pointsReward || 0)}
                      onUploadProof={(file) => void uploadBankProof(file)}
                      uploadingProof={uploadingProof}
                    />
                  </div>
                  <div className="lg:sticky lg:top-6"><RenewalHowItWorks paymentSettings={paymentSettings} /></div>
                </section>
              </>
            ) : active ? (
              <ActiveSubscription
                subscription={subscription!}
                progress={progress}
                pointsReward={Number(activePlan?.pointsReward || 0)}
                payments={data.payments}
                paymentSettings={paymentSettings}
                onRenew={() => selectForRenewal(activePlan?.slug)}
                onChangePlan={openPlans}
                renewalSlot={<RenewalForm sectionRef={paymentRef} intent={paymentIntent} plans={plans} paymentSettings={paymentSettings} bankDetails={bankDetails} selectedPlan={selectedPlan} onPlanChange={setSelectedPlan} paymentMethod={paymentMethod} onMethodChange={setPaymentMethod} saving={saving} onSubmit={(accepted, bankTransfer) => void beginPayment(accepted, bankTransfer)} onCopyIban={(iban) => void copyIban(iban)} hidePlanPicker />}
              />
            ) : (
              <ExpiredSubscription
                subscription={subscription}
                onRenew={openPlans}
              />
            )}
            {!!data.upcomingSubscriptions?.length && (
              <UpcomingSubscriptions
                subscriptions={data.upcomingSubscriptions}
              />
            )}
            {!pendingPayment && (
              <>
                <AvailablePlans
                  plansRef={plansRef}
                  plans={plans}
                  subscription={subscription}
                  selectedPlan={selectedPlan}
                  durations={(catalog?.durations || []).filter((duration) => duration.isActive).sort((a, b) => (a.sortOrder || a.months) - (b.sortOrder || b.months))}
                  selectedDurationMonths={selectedDurationMonths}
                  onDurationChange={setSelectedDurationMonths}
                  commonFeatures={(catalog?.commonFeatures || []).map((feature) => feature.text)}
                  onSelect={(slug) => { setSelectedPlan(slug); setPaymentIntent("change"); }}
                  onContinue={() => selectPlanForPayment(selectedPlan)}
                  intent={paymentIntent}
                />
              </>
            )}
            {(!active && !pendingPayment) && (
              <RenewalForm
                sectionRef={paymentRef}
                intent={paymentIntent}
                plans={plans}
                paymentSettings={paymentSettings}
                bankDetails={bankDetails}
                selectedPlan={selectedPlan}
                onPlanChange={setSelectedPlan}
                paymentMethod={paymentMethod}
                onMethodChange={setPaymentMethod}
                saving={saving}
                onSubmit={(accepted, bankTransfer) => void beginPayment(accepted, bankTransfer)}
                onCopyIban={(iban) => void copyIban(iban)}
              />
            )}
            <PaymentHistory payments={data.payments} />
          </>
        )}
      </main>
    </ClientShell>
  );
}

function RenewalHowItWorks({ paymentSettings: _paymentSettings }: { paymentSettings: PaymentSettings }) {
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardContent className="flex flex-col gap-4 p-[22px]">
        <h2 className="text-[16px] font-extrabold">Πώς γίνεται η ανανέωση</h2>
        <div className="space-y-4">
          <div className="flex gap-3"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-extrabold text-accent">1</span><div className="flex flex-col gap-0.5 pt-1"><p className="text-sm font-extrabold">Διαλέγεις πλάνο</p><p className="text-xs leading-[1.45] text-muted-foreground">ανανέωση ή αλλαγή από τα διαθέσιμα πλάνα</p></div></div>
          <div className="flex gap-3"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-extrabold text-accent">2</span><div className="flex flex-col gap-0.5 pt-1"><p className="text-sm font-extrabold">Πληρώνεις</p><p className="text-xs leading-[1.45] text-muted-foreground">με κάρτα, PayPal, έμβασμα ή μετρητά</p></div></div>
          <div className="flex gap-3"><span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-extrabold text-accent">3</span><div className="flex flex-col gap-0.5 pt-1"><p className="text-sm font-extrabold">Ενεργοποιείται</p><p className="text-xs leading-[1.45] text-muted-foreground"><b className="text-foreground">Κάρτα / PayPal:</b> αμέσως<br /><b className="text-foreground">Έμβασμα / μετρητά:</b> μόλις εγκρίνει ο coach</p></div></div>
        </div>
        <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">Θα λάβεις ειδοποίηση για κάθε πληρωμή.</p>
      </CardContent>
    </Card>
  );
}

function ActiveSubscription({
  subscription,
  progress,
  pointsReward,
  payments,
  onRenew,
  onChangePlan,
  renewalSlot,
  paymentSettings,
  showHowItWorks = true,
}: {
  subscription: Subscription;
  progress: number;
  pointsReward: number;
  payments: Payment[];
  onRenew: () => void;
  onChangePlan: () => void;
  renewalSlot?: React.ReactNode;
  paymentSettings: PaymentSettings;
  showHowItWorks?: boolean;
}) {
  const days = Number(subscription.days_remaining ?? 0);
  const expiring = subscription.status === "expiring_soon";
  const lastPayment = payments.find(
    (payment) =>
      payment.status === "completed" || payment.status === "confirmed",
  );
  const months =
    subscription.end_date && subscription.start_date
      ? Math.max(
          1,
          Math.round(
            (new Date(subscription.end_date).getTime() -
              new Date(subscription.start_date).getTime()) /
              2629800000,
          ),
        )
      : null;
  return (
    <section className="grid items-start gap-4 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
      <Card className="relative overflow-hidden rounded-[20px] border-border bg-card shadow-none">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1.5 bg-accent"
        />
        <CardContent className="grid gap-6 p-[22px] pl-7 xl:grid-cols-[minmax(0,1fr)_250px]">
          <div className="min-w-0 space-y-[14px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="h-6 rounded-full bg-foreground px-2.5 text-[11px] font-extrabold text-background hover:bg-foreground">
                <span className="mr-1.5 h-[7px] w-[7px] rounded-full bg-accent" />
                {expiring ? "Λήγει σύντομα" : "Ενεργή συνδρομή"}
              </Badge>
              <span className="text-[13px] text-muted-foreground">
                από {formatDate(subscription.start_date)}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[34px] font-extrabold italic leading-none tracking-[-1px] text-foreground">
                {subscription.plan_name}
              </h2>
              <span className="text-[15px] text-muted-foreground">
                {money(subscription.price, subscription.currency || "EUR")} /{" "}
                {months ? `${months} μήνες` : "πλάνο"}
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-bold">
                  <span className="text-[22px] font-extrabold">{days}</span>{" "}
                  ημέρες απομένουν
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatShortDate(subscription.start_date)} →{" "}
                  {formatDate(subscription.end_date)}
                </p>
              </div>
              <Progress
                value={progress}
                className="h-2.5 bg-muted [&_[data-slot=progress-indicator]]:bg-accent"
              />
            </div>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button
                className="h-[46px] rounded-full bg-accent px-[22px] font-extrabold text-accent-foreground hover:bg-accent/85"
                onClick={onRenew}
              >
                <Repeat2 className="mr-2 h-4 w-4" />
                Ανανέωση
              </Button>
              <Button
                className="h-[46px] rounded-full border-[1.5px] border-foreground bg-transparent px-5 font-bold text-foreground hover:bg-muted"
                variant="outline"
                onClick={onChangePlan}
              >
                Αλλαγή πλάνου
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 content-start">
            {[
              ["Επόμενη ανανέωση", formatShortDate(subscription.end_date)],
              [
                "Ποσό",
                money(subscription.price, subscription.currency || "EUR"),
              ],
              ["Τελευταία πληρωμή", formatShortDate(lastPayment?.paidAt)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-[14px] bg-muted p-[14px] text-foreground"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-[17px] font-extrabold">{value}</p>
              </div>
            ))}
            {pointsReward > 0 && (
              <div className="rounded-[14px] bg-accent p-[14px] text-accent-foreground">
                <p className="text-xs font-bold">Με την ανανέωση</p>
                <p className="mt-0.5 text-[17px] font-extrabold">
                  +{pointsReward} πόντοι
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {renewalSlot}
      </div>
      {showHowItWorks && <RenewalHowItWorks paymentSettings={paymentSettings} />}
    </section>
  );
}

function UpcomingSubscriptions({
  subscriptions,
}: {
  subscriptions: Subscription[];
}) {
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-[18px] font-extrabold">
          Επόμενα πλάνα
        </CardTitle>
        <CardDescription>
          Έχουν πληρωθεί και θα ενεργοποιηθούν στις ημερομηνίες που
          εμφανίζονται.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {subscriptions.map((subscription, index) => (
          <div
            key={subscription.id ?? `${subscription.plan_name}-${subscription.start_date}-${index}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-muted p-4"
          >
            <div>
              <p className="font-extrabold">{subscription.plan_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ξεκινά {formatDate(subscription.start_date)} ·{" "}
                {money(subscription.price, subscription.currency || "EUR")}
              </p>
            </div>
            <Badge className="rounded-full bg-[color:var(--sp-lime-soft)] text-foreground">
              Πληρωμένο
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AvailablePlans({
  plans, subscription, selectedPlan, intent, onSelect, onContinue, plansRef, durations, selectedDurationMonths, onDurationChange, commonFeatures,
}: {
  plans: PricingPlan[];
  subscription: Subscription | null;
  selectedPlan: string;
  intent: "renew" | "change" | null;
  onSelect: (slug: string) => void;
  onContinue: () => void;
  plansRef: React.RefObject<HTMLElement | null>;
  durations: PackageDuration[];
  selectedDurationMonths: number;
  onDurationChange: (months: number) => void;
  commonFeatures: string[];
}) {
  const currentName = subscription?.plan_name?.trim().toLocaleLowerCase("el-GR") || "";
  const current = plans.find((plan) => plan.name.trim().toLocaleLowerCase("el-GR") === currentName);
  const selected = plans.find((plan) => plan.slug === selectedPlan) || current || plans[0];
  const selectedPrice = Number(selected?.price || 0);
  const selectedPoints = Number(selected?.pointsReward || 0);
  const selectedMonths = periodMonths(selected?.period);
  const oneMonth = durations.find((duration) => duration.months === 1);
  const currentDuration = durations.find((duration) => duration.months === selectedDurationMonths);
  const saving = oneMonth && currentDuration ? Math.max(0, oneMonth.basePriceCents * selectedDurationMonths - currentDuration.basePriceCents) / 100 : 0;
  if (!plans.length) return null;

  return <section ref={plansRef} id="available-plans" aria-labelledby="available-plans-heading" className="scroll-mt-6">
    <Card className="rounded-[20px] border-border bg-card shadow-none"><CardContent className="space-y-[18px] p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 id="available-plans-heading" className="text-[20px] font-extrabold">Ανανέωση ή αλλαγή πακέτου</h2><p className="mt-1 text-[13px] text-muted-foreground">Η αλλαγή ισχύει από την επόμενη περίοδο.</p>{intent === "change" && <p className="mt-2 text-[12px] font-bold text-muted-foreground">Επίλεξε πακέτο και συνέχισε στην πληρωμή.</p>}</div>
        <div className="w-full lg:max-w-[520px]"><div className="grid grid-cols-2 gap-1 rounded-[16px] border border-border bg-card p-[5px] sm:grid-cols-4">{durations.map((duration) => { const discount = duration.months > 1 && oneMonth ? Math.round((1 - duration.basePriceCents / Math.max(1, oneMonth.basePriceCents * duration.months)) * 100) : 0; const active = selectedDurationMonths === duration.months; return <Button key={duration.id} type="button" variant="ghost" onClick={() => onDurationChange(duration.months)} className={`h-[46px] rounded-[12px] px-2 text-[13px] font-extrabold ${active ? "bg-foreground text-background hover:bg-foreground hover:text-background" : "text-[#3a3a3a] hover:bg-muted dark:text-foreground"}`}>{duration.title || `${duration.months} ${duration.months === 1 ? "μήνας" : "μήνες"}`}{discount > 0 && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${active ? "bg-accent text-accent-foreground" : "bg-[color:var(--sp-lime-soft)] text-[#3f6b00] dark:text-accent"}`}>−{discount}%</span>}</Button>; })}</div></div>
      </div>
      <div className="grid items-stretch gap-[14px] pt-2 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan, index) => { const isCurrent = plan.name.trim().toLocaleLowerCase("el-GR") === currentName; const isSelected = selected?.slug === plan.slug; const months = periodMonths(plan.period); const addon = Number(plan.price || 0) - Number(plans[0]?.price || 0); return <button key={plan.slug} type="button" role="radio" aria-checked={isSelected} onClick={() => onSelect(plan.slug)} className={`relative flex min-h-[360px] flex-col gap-3 rounded-[20px] border bg-card p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sp-lime-glow)] ${isSelected ? "border-2 border-foreground ring-4 ring-accent/50" : "border-border hover:border-foreground/45"}`}>
        {plan.badge && <span className={`absolute -top-[11px] left-[18px] rounded-full px-2.5 py-1 text-[10px] font-extrabold ${plan.badge === "Πλήρης πρόσβαση" ? "bg-foreground text-accent" : "bg-accent text-accent-foreground"}`}>{plan.badge}</span>}
        <div className="flex items-center gap-2.5"><span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${isSelected ? "border-foreground" : "border-[#cfcfcb]"}`}>{isSelected && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}</span><span className="text-[18px] font-extrabold">{plan.name}</span><span className="ml-auto flex gap-[3px]">{[0, 1, 2, 3].map((level) => <i key={level} className={`h-[5px] w-[14px] rounded-full ${level <= index ? "bg-accent" : "bg-muted"}`} />)}</span>{isCurrent && <Badge className="bg-foreground text-[10px] text-accent">Τρέχον</Badge>}</div>
        <div><p className="text-[36px] font-extrabold italic leading-none tracking-[-1px]">{money(plan.price, plan.currency || "EUR")}</p><p className="mt-1 text-[12px] text-muted-foreground">για {months} {months === 1 ? "μήνα" : "μήνες"} · {money(Number(plan.price || 0) / Math.max(1, months), plan.currency || "EUR")} / μήνα · {saving ? <b className="text-[#3f6b00] dark:text-accent">−{money(saving, plan.currency || "EUR")}</b> : ""}</p><p className="mt-1 text-[12px] text-muted-foreground">{index === 0 ? "η βάση της συνεργασίας" : `+${money(addon / Math.max(1, months), plan.currency || "EUR")} / μήνα από το Βασικό`}</p></div>
        <div className="space-y-2 border-t border-border pt-3"><p className="text-[12px] font-extrabold text-[#3a3a3a] dark:text-foreground">{index === 0 ? "Περιλαμβάνει:" : `Όλα του ${plans[index - 1]?.name || "προηγούμενου"}, και:`}</p>{(plan.features || []).slice(0, 5).map((feature) => <span key={feature} className="flex items-start gap-2 text-[13px] leading-[1.4]"><span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-2.5 w-2.5 stroke-[3]" /></span>{feature}</span>)}</div>
        {index === 0 && <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); document.getElementById("common-package-features")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); document.getElementById("common-package-features")?.scrollIntoView({ behavior: "smooth", block: "start" }); } }} className="mt-auto cursor-pointer pl-[26px] text-[12px] font-extrabold underline underline-offset-2">Δες και τις {commonFeatures.length} παροχές</span>}
      </button>; })}</div>
      <div className="space-y-2 rounded-[14px] bg-muted p-4 text-[13px] leading-[1.5] text-[#3a3a3a] dark:text-foreground"><p>Οι βιντεοκλήσεις χρησιμοποιούνται για ανασκόπηση προόδου, διευκρινίσεις, επίλυση δυσκολιών και οργάνωση των επόμενων βημάτων.</p><p>Στο <b>DIRECT</b>, μπορείς να στέλνεις τις απορίες σου στο WhatsApp και λαμβάνεις απάντηση εντός μίας εργάσιμης ημέρας, στο συμφωνημένο ωράριο υποστήριξης.</p></div>
      <div id="common-package-features" className="scroll-mt-6 rounded-[18px] border border-border bg-muted/50 p-5"><h3 className="text-[16px] font-extrabold">Όλες οι διάρκειες περιλαμβάνουν τις ίδιες παροχές</h3><p className="mt-1 text-[12px] text-muted-foreground">Εξατομικευμένη καθοδήγηση στην προπόνηση, στη διατροφή και στα συμπληρώματα, με τακτική αξιολόγηση της προόδου σου.</p><div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">{commonFeatures.map((feature) => <span key={feature} className="flex items-start gap-2 text-[13px] leading-[1.45]"><span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-2.5 w-2.5 stroke-[3]" /></span>{feature}</span>)}</div><p className="mt-3 flex items-center rounded-xl bg-muted px-3 py-2 text-[12px] text-muted-foreground">Η ημέρα update συμφωνείται από Δευτέρα έως Σάββατο. Η Κυριακή εξαιρείται.</p></div>
      {selected && <div className="flex flex-col gap-3 rounded-[16px] bg-foreground p-4 text-background sm:flex-row sm:items-center"><div><p className="text-[12px] text-[#9a9a9a]">Η επιλογή σου</p><p className="text-[15px] font-extrabold"><span className="text-accent">{selected.name}</span> · {selectedMonths} {selectedMonths === 1 ? "μήνας" : "μήνες"}</p></div><div className="sm:ml-auto sm:text-right"><p className="text-[26px] font-extrabold leading-none text-accent">{money(selectedPrice, selected.currency || "EUR")}</p><p className="mt-1 text-[12px] text-[#9a9a9a]">≈ {money(selectedPrice / Math.max(1, selectedMonths), selected.currency || "EUR")} / μήνα · +{new Intl.NumberFormat("el-GR").format(selectedPoints)} πόντοι</p></div><Button type="button" onClick={onContinue} className="h-12 rounded-full bg-accent px-5 font-extrabold text-accent-foreground hover:bg-accent/85">Συνέχεια στην πληρωμή →</Button></div>}
    </CardContent></Card>
  </section>;
}

function LegacyAvailablePlans({
  plans,
  subscription,
  selectedPlan,
  intent,
  onSelect,
  plansRef,
}: {
  plans: PricingPlan[];
  subscription: Subscription | null;
  selectedPlan: string;
  intent: "renew" | "change" | null;
  onSelect: (slug: string) => void;
  plansRef: React.RefObject<HTMLElement | null>;
}) {
  const currentName =
    subscription?.plan_name?.trim().toLocaleLowerCase("el-GR") || "";
  const eligible = plans.filter(
    (plan) => plan.name.trim().toLocaleLowerCase("el-GR") !== currentName,
  );
  const bestValue = eligible.reduce<PricingPlan | null>(
    (best, plan) =>
      !best ||
      Number(plan.price || 0) / periodMonths(plan.period) <
        Number(best.price || 0) / periodMonths(best.period)
        ? plan
        : best,
    null,
  );
  if (!plans.length) return null;
  return (
    <section
      ref={plansRef}
      id="available-plans"
      aria-labelledby="available-plans-heading"
      className="scroll-mt-6 space-y-4"
    >
      <div>
        <h2 id="available-plans-heading" className="text-[20px] font-extrabold">
          Διαθέσιμα πλάνα
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Η αλλαγή ενεργοποιείται μετά την έγκριση του coach.
        </p>
        {intent === "change" && selectedPlan && (
          <p aria-live="polite" className="mt-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--sp-lime-soft)] px-3 py-1.5 text-[12px] font-extrabold text-foreground"><Check className="h-3.5 w-3.5" />Επίλεξε πλάνο και συνέχισε στην πληρωμή.</p>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent =
            plan.name.trim().toLocaleLowerCase("el-GR") === currentName;
          const isSelected = selectedPlan === plan.slug;
          const planMonths = periodMonths(plan.period);
          const isBestValue = !isCurrent && bestValue?.slug === plan.slug;
          return (
            <Card
              key={plan.slug}
              className={`flex min-h-[280px] rounded-[20px] bg-card shadow-none transition-all duration-200 ${isCurrent ? "border-2 border-foreground ring-4 ring-accent/45" : isSelected ? "border-2 border-foreground ring-4 ring-accent/30" : "border-border hover:-translate-y-0.5 hover:border-foreground/40"}`}
            >
              <CardContent className="flex w-full flex-col gap-[14px] p-[22px]">
                <div className="flex min-h-6 items-center justify-between gap-2">
                  <h3 className="text-[18px] font-extrabold">{plan.name}</h3>
                  {isCurrent ? (
                    <Badge className="h-6 rounded-full bg-foreground px-2.5 text-[11px] font-extrabold text-accent hover:bg-foreground">
                      <Check className="mr-1 h-3 w-3" />
                      Τρέχον πλάνο
                    </Badge>
                  ) : isSelected ? (
                    <Badge className="h-6 rounded-full bg-accent px-2.5 text-[11px] font-extrabold text-accent-foreground hover:bg-accent"><Check className="mr-1 h-3 w-3" />Επιλεγμένο</Badge>
                  ) : isBestValue ? (
                    <Badge className="h-6 rounded-full bg-accent px-2.5 text-[11px] font-extrabold text-accent-foreground hover:bg-accent">
                      Καλύτερη τιμή
                    </Badge>
                  ) : null}
                </div>
                <p className="min-h-[58px] text-[13px] leading-5 text-muted-foreground">
                  {plan.description || " "}
                </p>
                {!!plan.features?.length && (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-extrabold text-foreground">Τι περιλαμβάνει</summary>
                    <ul className="mt-2 space-y-1.5">
                      {plan.features.map((feature) => <li key={feature} className="flex gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />{feature}</li>)}
                    </ul>
                  </details>
                )}
                <div>
                  <p className="text-[30px] font-extrabold italic leading-none tracking-[-.8px]">
                    {money(plan.price, plan.currency || "EUR")}
                    <span className="text-sm font-semibold not-italic tracking-normal text-muted-foreground">
                      {" "}
                      / {plan.period || "μήνα"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[#8A8A8A]">
                    {planMonths > 1
                      ? `≈ ${money(Number(plan.price || 0) / planMonths, plan.currency || "EUR")} / μήνα`
                      : "πληρωμή κάθε μήνα"}
                  </p>
                </div>
                <Button
                  className={`mt-auto h-11 w-full rounded-full font-extrabold ${isCurrent ? "border-[1.5px] border-foreground bg-transparent text-foreground hover:bg-muted" : "bg-foreground text-background hover:bg-foreground/90"}`}
                  variant={isCurrent ? "outline" : "default"}
                  onClick={() => onSelect(plan.slug)}
                >
                  {isCurrent ? "Ανανέωση πλάνου" : isSelected ? "Συνέχεια στην πληρωμή" : "Επιλογή πλάνου"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function PendingSubscription({
  payment,
  subscription,
  bankDetails,
  onCopyIban,
  onCancel,
  cancelling,
  pointsReward,
  onUploadProof,
  uploadingProof,
}: {
  payment: Payment;
  subscription: Subscription | null;
  bankDetails: BankDetails | null;
  onCopyIban: () => void;
  onCancel: () => void;
  cancelling: boolean;
  pointsReward: number;
  onUploadProof: (file: File) => void;
  uploadingProof: boolean;
}) {
  const bank = payment.method === "bank_transfer" || payment.method === "bank";
  if (payment.method === "cash") {
    return <PendingPaymentCard payment={payment} subscription={subscription} onCancel={onCancel} cancelling={cancelling} pointsReward={pointsReward} />;
  }
  if (bank) {
    return <PendingBankTransfer payment={payment} subscription={subscription} bankDetails={bankDetails} onCopyIban={onCopyIban} onUploadProof={onUploadProof} uploadingProof={uploadingProof} onCancel={onCancel} cancelling={cancelling} pointsReward={pointsReward} />;
  }
  return (
    <div className="space-y-5">
      <Card className="rounded-[20px] border-border bg-card shadow-none">
        <CardContent className="flex gap-4 p-[22px]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-foreground">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <Badge className="rounded-full bg-muted text-muted-foreground">
              Εκκρεμεί έγκριση
            </Badge>
            <h2 className="mt-3 text-xl font-extrabold">
              Η πληρωμή σου καταχωρήθηκε
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Ο coach θα επιβεβαιώσει την πληρωμή σου. Τότε θα ξεκινήσει η
              συνδρομή και θα ξεκλειδώσουν τα προγράμματά σου.
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="rounded-[20px] border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">Σύνοψη αιτήματος</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Summary label="Πλάνο" value={subscription?.plan_name || "-"} />
            <Summary
              label="Ποσό"
              value={money(payment.amount, payment.currency || "EUR")}
            />
            <Summary
              label="Τρόπος"
              value={paymentMethods[payment.method] || payment.method}
            />
            {payment.referenceNumber && (
              <Summary label="Αιτιολογία" value={payment.referenceNumber} />
            )}
          </CardContent>
        </Card>
        {bank && bankDetails?.iban ? (
          <Card className="rounded-[20px] border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle className="text-lg">Στοιχεία εμβάσματος</CardTitle>
              <CardDescription>
                Χρησιμοποίησε την αιτιολογία του αιτήματος.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">
                {bankDetails.beneficiary || "-"}
              </p>
              <p className="text-sm text-muted-foreground">
                {bankDetails.bankName || ""}
              </p>
              <div className="rounded-[12px] bg-muted p-3 font-mono text-xs">
                {bankDetails.iban}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-full"
                onClick={onCopyIban}
              >
                <Copy className="mr-2 h-4 w-4" />
                Αντιγραφή IBAN
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-[20px] border-border bg-card shadow-none">
            <CardContent className="flex h-full flex-col justify-center p-6">
              <CreditCard className="h-6 w-6 text-foreground" />
              <p className="mt-3 text-sm font-extrabold">Πληρωμή με κάρτα</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Η πληρωμή ενεργοποιείται μόλις επιβεβαιωθεί από τον coach.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PendingBankTransfer({
  payment,
  subscription,
  bankDetails,
  onCopyIban,
  onUploadProof,
  uploadingProof,
  onCancel,
  cancelling,
  pointsReward,
}: {
  payment: Payment;
  subscription: Subscription | null;
  bankDetails: BankDetails | null;
  onCopyIban: () => void;
  onUploadProof: (file: File) => void;
  uploadingProof: boolean;
  onCancel: () => void;
  cancelling: boolean;
  pointsReward: number;
}) {
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const proofUploaded = Boolean(payment.proofUrl);
  const dateLabel = formatDateTime(payment.createdAt || payment.paidAt);
  const duration = subscription?.start_date && subscription?.end_date
    ? Math.max(1, Math.round((new Date(subscription.end_date).getTime() - new Date(subscription.start_date).getTime()) / 2629800000))
    : null;
  const selectProof = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadError("Επίλεξε JPG, PNG ή PDF έως 10 MB.");
      return;
    }
    setUploadError("");
    onUploadProof(file);
  };

  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-6 pb-3 pt-5">
        <div>
          <CardTitle className="text-[16px] font-extrabold">Πληρωμή ανανέωσης</CardTitle>
          <CardDescription className="mt-1 text-[12px]">Έχεις μια πληρωμή σε εκκρεμότητα</CardDescription>
        </div>
        <p className="shrink-0 text-[13px] text-muted-foreground">{subscription?.plan_name || "Πλάνο"} · <b className="text-[16px] text-foreground">{money(payment.amount, payment.currency || "EUR")}</b></p>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-5 pt-2">
        <div className="flex items-center gap-[14px] rounded-[16px] bg-[color:var(--sp-lime-soft)] p-[18px]">
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-foreground text-accent"><Clock3 className="h-[22px] w-[22px]" /></span>
          <div className="min-w-0"><p className="text-[16px] font-extrabold">{proofUploaded ? "Έλεγχος από coach" : "Η κατάθεσή σου περιμένει έγκριση"}</p><p className="mt-0.5 text-[13px] text-foreground/80">Τραπεζικό έμβασμα · {money(payment.amount, payment.currency || "EUR")} · δηλώθηκε {dateLabel}</p></div>
        </div>

        <div className="grid gap-4 px-0.5 py-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-2.5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-[13px] w-[13px] stroke-[3.2]" /></span><span className="hidden h-[3px] flex-1 rounded-full bg-accent sm:block" /></div>
            <p className="text-[13px] font-extrabold">Δήλωσες την κατάθεση</p><p className="text-[11px] text-muted-foreground">{dateLabel}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-accent"><Clock3 className="h-[14px] w-[14px]" /></span><span className="hidden h-[3px] flex-1 rounded-full bg-muted sm:block" /></div>
            <p className="text-[13px] font-extrabold">Έλεγχος από τον coach</p><p className="text-[11px] text-muted-foreground">{proofUploaded ? "Έλεγχος αποδεικτικού" : "συνήθως εντός 24 ωρών"}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="h-7 w-7 shrink-0 rounded-full border-[1.5px] border-[#d6d6d2] dark:border-border" /></div>
            <p className="text-[13px] font-extrabold text-muted-foreground">Ενεργοποίηση</p><p className="text-[11px] text-muted-foreground">{`${duration ? `+${duration} μήνες` : ""}${pointsReward > 0 ? ` · +${pointsReward} πόντοι` : ""}` || "μετά την έγκριση"}</p>
          </div>
        </div>

        {!proofUploaded && <div className="flex flex-col gap-[14px] rounded-[14px] border-[1.5px] border-dashed border-[#d6d6d2] px-4 py-[14px] sm:flex-row sm:items-center dark:border-border"><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-muted"><FileUp className="h-[17px] w-[17px]" /></span><div className="min-w-0 flex-1"><p className="text-[14px] font-extrabold">Δεν έχεις στείλει αποδεικτικό</p><p className="text-[12px] text-muted-foreground">Προαιρετικό · βοηθά τον coach να εγκρίνει πιο γρήγορα.</p></div><input ref={proofInputRef} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(event) => selectProof(event.target.files?.[0])} /><Button type="button" disabled={uploadingProof} onClick={() => proofInputRef.current?.click()} className="h-[42px] shrink-0 rounded-full bg-foreground px-4 text-[13px] font-extrabold text-background hover:bg-foreground/90"><FileUp className="mr-2 h-[15px] w-[15px]" />{uploadingProof ? "Αποστολή..." : "Πρόσθεσε αποδεικτικό"}</Button></div>}
        {proofUploaded && <div className="flex items-center gap-[14px] rounded-[14px] border border-border bg-muted/60 px-4 py-[14px]"><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[color:var(--sp-lime-soft)]"><Check className="h-[17px] w-[17px]" /></span><div><p className="text-[14px] font-extrabold">Το αποδεικτικό στάλθηκε</p><p className="text-[12px] text-muted-foreground">Ο coach ελέγχει την κατάθεσή σου.</p></div></div>}
        {uploadError && <p className="text-[12px] font-semibold text-destructive">{uploadError}</p>}

        <div className="flex flex-col gap-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => setDetailsOpen((open) => !open)} className="inline-flex w-fit items-center gap-1.5 font-extrabold text-foreground">Δες τα στοιχεία κατάθεσης <ChevronDown className={`h-[15px] w-[15px] transition-transform ${detailsOpen ? "rotate-180" : ""}`} /></button>
          <AlertDialog><AlertDialogTrigger render={<button type="button" className="w-fit text-muted-foreground underline underline-offset-4 hover:text-foreground" />}>Ακύρωση αιτήματος</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ακύρωση αιτήματος;</AlertDialogTitle><AlertDialogDescription>Το αίτημα εμβάσματος θα ακυρωθεί και ο coach θα ενημερωθεί.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Πίσω</AlertDialogCancel><AlertDialogAction className="bg-foreground text-background hover:bg-foreground/90" onClick={onCancel} disabled={cancelling}>{cancelling ? "Ακύρωση..." : "Ναι, ακύρωση"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
        {detailsOpen && <div className="grid gap-3 rounded-[14px] bg-muted p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="space-y-1.5"><p className="text-[11px] font-bold uppercase tracking-[.8px] text-muted-foreground">Στοιχεία εμβάσματος</p><p className="text-[13px] font-extrabold">{bankDetails?.beneficiary || "-"}</p><p className="text-[12px] text-muted-foreground">{bankDetails?.bankName || ""}</p>{bankDetails?.iban && <p className="rounded-[10px] bg-card px-3 py-2 font-mono text-[12px] font-bold">{bankDetails.iban}</p>}{payment.referenceNumber && <p className="text-[12px] text-muted-foreground">Αιτιολογία: <b className="text-foreground">{payment.referenceNumber}</b></p>}</div>{bankDetails?.iban && <Button size="sm" variant="outline" className="h-10 rounded-full px-4" onClick={onCopyIban}><Copy className="mr-2 h-3.5 w-3.5" />Αντιγραφή IBAN</Button>}</div>}
      </CardContent>
    </Card>
  );
}

function PendingPaymentCard({
  payment,
  subscription,
  onCancel,
  cancelling,
  pointsReward,
}: {
  payment: Payment;
  subscription: Subscription | null;
  onCancel: () => void;
  cancelling: boolean;
  pointsReward: number;
}) {
  const duration = subscription?.start_date && subscription?.end_date
    ? Math.max(1, Math.round((new Date(subscription.end_date).getTime() - new Date(subscription.start_date).getTime()) / 2629800000))
    : null;
  const dateLabel = formatDateTime(payment.createdAt || payment.paidAt);
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 px-6 pb-3 pt-5">
        <div>
          <CardTitle className="text-[16px] font-extrabold">Πληρωμή ανανέωσης</CardTitle>
          <CardDescription className="mt-1 text-[12px]">Έχεις μια πληρωμή σε εκκρεμότητα</CardDescription>
        </div>
        <p className="shrink-0 text-[13px] text-muted-foreground">{subscription?.plan_name || "Πλάνο"} · <b className="text-[16px] text-foreground">{money(payment.amount, payment.currency || "EUR")}</b></p>
      </CardHeader>
      <CardContent className="space-y-4 px-6 pb-5 pt-2">
        <div className="flex items-center gap-[14px] rounded-[16px] bg-[color:var(--sp-lime-soft)] p-[18px]">
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-foreground text-accent"><Clock3 className="h-[22px] w-[22px]" /></span>
          <div className="min-w-0"><p className="text-[16px] font-extrabold">Η πληρωμή με μετρητά περιμένει έγκριση</p><p className="mt-0.5 text-[13px] text-foreground/80">Μετρητά στον coach · {money(payment.amount, payment.currency || "EUR")} · δηλώθηκε {dateLabel}</p></div>
        </div>

        <div className="grid gap-4 px-0.5 py-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-2.5">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-[13px] w-[13px] stroke-[3.2]" /></span><span className="hidden h-[3px] flex-1 rounded-full bg-accent sm:block" /></div>
            <p className="text-[13px] font-extrabold">Δήλωσες μετρητά</p><p className="text-[11px] text-muted-foreground">{dateLabel}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-foreground text-accent"><Clock3 className="h-[14px] w-[14px]" /></span><span className="hidden h-[3px] flex-1 rounded-full bg-muted sm:block" /></div>
            <p className="text-[13px] font-extrabold">Παραλαβή από τον coach</p><p className="text-[11px] text-muted-foreground">από κοντά</p>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-2"><span className="h-7 w-7 shrink-0 rounded-full border-[1.5px] border-[#d6d6d2] dark:border-border" /></div>
            <p className="text-[13px] font-extrabold text-muted-foreground">Ενεργοποίηση</p><p className="text-[11px] text-muted-foreground">{`${duration ? `+${duration} μήνες` : ""}${pointsReward > 0 ? ` · +${pointsReward} πόντοι` : ""}` || "μετά την έγκριση"}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
          <p>Ο coach θα πατήσει «Παρελήφθη» μόλις πάρει τα χρήματα.</p>
          <AlertDialog>
            <AlertDialogTrigger render={<button type="button" className="w-fit text-muted-foreground underline underline-offset-4 hover:text-foreground" />}>Ακύρωση αιτήματος</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Ακύρωση αιτήματος;</AlertDialogTitle><AlertDialogDescription>Το αίτημα μετρητών θα ακυρωθεί και ο coach θα ενημερωθεί.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Πίσω</AlertDialogCancel><AlertDialogAction className="bg-foreground text-background hover:bg-foreground/90" onClick={onCancel} disabled={cancelling}>{cancelling ? "Ακύρωση..." : "Ναι, ακύρωση"}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function PendingStep({ icon, tone, title, detail }: { icon: React.ReactNode; tone: "lime" | "dark" | "muted"; title: string; detail: string }) {
  const toneClass = tone === "lime" ? "bg-accent text-accent-foreground" : tone === "dark" ? "bg-foreground text-accent" : "bg-muted text-muted-foreground";
  return <div className="relative flex items-center gap-3 md:flex-col md:items-start md:pr-4 md:after:absolute md:after:right-0 md:after:top-5 md:after:h-px md:after:w-4 md:after:bg-border last:after:hidden"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${toneClass}`}>{icon}</span><div><p className="text-[13px] font-extrabold">{title}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p></div></div>;
}

function ExpiredSubscription({
  subscription,
  onRenew,
}: {
  subscription: Subscription | null;
  onRenew: () => void;
}) {
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardContent className="flex flex-col gap-5 p-[22px] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge className="rounded-full bg-muted text-muted-foreground">
            {subscription?.status === "expired"
              ? "Η συνδρομή έληξε"
              : "Δεν υπάρχει ενεργή συνδρομή"}
          </Badge>
          <h2 className="mt-3 text-xl font-extrabold">
            Συνέχισε από εκεί που έμεινες
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Επίλεξε πλάνο και τρόπο πληρωμής. Η νέα συνδρομή ξεκινά μόλις την
            εγκρίνει ο coach.
          </p>
        </div>
        <Button
          className="h-[46px] rounded-full bg-accent px-6 font-extrabold text-accent-foreground hover:bg-accent/85"
          onClick={onRenew}
        >
          Επιλογή πλάνου
        </Button>
      </CardContent>
    </Card>
  );
}

function RenewalForm({
  sectionRef,
  intent,
  plans,
  paymentSettings,
  bankDetails,
  selectedPlan,
  onPlanChange,
  paymentMethod,
  onMethodChange,
  saving,
  onSubmit,
  onCopyIban,
  hidePlanPicker = false,
}: {
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  intent: "renew" | "change" | null;
  plans: PricingPlan[];
  paymentSettings: PaymentSettings;
  bankDetails: BankDetails | null;
  selectedPlan: string;
  onPlanChange: (value: string) => void;
  paymentMethod: "bank_transfer" | "stripe_card" | "paypal" | "cash";
  onMethodChange: (value: "bank_transfer" | "stripe_card" | "paypal" | "cash") => void;
  saving: boolean;
  onSubmit: (
    privacyPolicyAccepted: boolean,
    bankTransfer?: { proof?: File | null; note?: string },
  ) => void;
  onCopyIban: (iban?: string) => void;
  hidePlanPicker?: boolean;
}) {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const selected = plans.find((plan) => plan.slug === selectedPlan) || plans[0];
  const bankAccounts: BankDetails[] = paymentSettings.bankAccounts
    .filter((account) => account.isVisible)
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.sortOrder - right.sortOrder)
    .map((account) => ({ beneficiary: account.accountHolder, bankName: account.bankName, iban: account.iban }));
  if (!bankAccounts.length && bankDetails?.iban) bankAccounts.push({ beneficiary: bankDetails.beneficiary || "", bankName: bankDetails.bankName || "", iban: bankDetails.iban });
  const bankAccount = bankAccounts[0] || null;
  const methods = [
    {
      value: "bank_transfer" as const,
      enabled: paymentSettings.bankTransferEnabled,
      title: "Τραπεζικό έμβασμα",
      description: "έγκριση από coach",
      icon: Landmark,
    },
    {
      value: "cash" as const,
      enabled: paymentSettings.cashEnabled,
      title: "Μετρητά",
      description: "στον coach",
      icon: CreditCard,
    },
    {
      value: "stripe_card" as const,
      enabled: paymentSettings.stripeEnabled,
      title: "Κάρτα",
      description: "Ασφαλής πληρωμή μέσω Stripe",
      icon: CreditCard,
    },
    {
      value: "paypal" as const,
      enabled: paymentSettings.paypalEnabled,
      title: "PayPal",
      description: "Ασφαλής πληρωμή μέσω PayPal",
      icon: CreditCard,
    },
  ].filter((method) => method.enabled);
  return (
    <div ref={sectionRef} className="scroll-mt-6">
    <Card className="rounded-[20px] border-border bg-card shadow-none transition-[box-shadow,border-color] duration-300 data-[intent=true]:border-foreground data-[intent=true]:ring-4 data-[intent=true]:ring-accent/25" data-intent={intent ? "true" : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3 sm:p-6 sm:pb-3">
        <div>
          <CardTitle className="text-[16px] font-extrabold">Πληρωμή ανανέωσης</CardTitle>
          <CardDescription className="mt-1 text-[12px]">Διάλεξε πώς θέλεις να πληρώσεις</CardDescription>
        </div>
        {selected && <p className="shrink-0 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{selected.name}</span> · <b className="text-[16px] text-foreground">{money(selected.price, selected.currency)}</b></p>}
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-2 sm:p-6 sm:pt-2">
        {selected && intent && <div aria-live="polite" className="flex items-center gap-2 rounded-[12px] bg-[color:var(--sp-lime-soft)] px-3 py-2.5 text-[13px] font-bold text-foreground"><span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-foreground"><Check className="h-3.5 w-3.5" /></span>{intent === "change" ? `Επιλέχθηκε το ${selected.name}. Διάλεξε τρόπο πληρωμής.` : `Ανανέωση του ${selected.name}. Διάλεξε τρόπο πληρωμής.`}</div>}
        {!hidePlanPicker && <div className="grid gap-3 md:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.slug}
              type="button"
              onClick={() => onPlanChange(plan.slug)}
              className={`rounded-[14px] border p-4 text-left transition-colors ${selectedPlan === plan.slug ? "border-foreground bg-[color:var(--sp-lime-soft)]" : "border-border"}`}
            >
              <p className="font-extrabold">{plan.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {money(plan.price, plan.currency)} · {plan.period || "Μηνιαίο"}
              </p>
            </button>
          ))}
        </div>}
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {methods.map((method) => {
            const Icon = method.icon;
            const immediate = method.value === "stripe_card" || method.value === "paypal";
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => onMethodChange(method.value)}
                className={`relative flex min-h-[96px] flex-col gap-2 rounded-[14px] border p-3 text-left transition-shadow ${paymentMethod === method.value ? "border-2 border-foreground bg-card shadow-[0_0_0_3px_rgba(176,249,12,.5)]" : "border-border bg-card hover:bg-muted"}`}
              >
                <span className="flex items-center gap-2"><Icon className="h-[18px] w-[18px]" />{immediate && <Badge className="h-5 rounded-full bg-accent px-1.5 text-[10px] font-extrabold text-accent-foreground">Άμεσα</Badge>}<span className={`ml-auto grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${paymentMethod === method.value ? "border-foreground" : "border-[#cfcfcb]"}`}>{paymentMethod === method.value && <span className="h-2 w-2 rounded-full bg-foreground" />}</span></span>
                <span className="block"><span className="block text-[14px] font-extrabold">{method.title}</span><span className="block text-[11px] text-muted-foreground">{method.description}</span></span>
              </button>
            );
          })}
        </div>
        <PaymentMethodDetails
          method={paymentMethod}
          selected={selected}
          bankAccount={bankAccount}
          bankAccounts={bankAccounts}
          paymentReference={paymentSettings.paymentReference}
          paymentNote={paymentSettings.paymentNote}
          onCopyIban={onCopyIban}
          saving={saving}
          disabled={!selectedPlan || !methods.length || !privacyAccepted}
          onSubmit={() => {
            if (paymentMethod === "bank_transfer") {
              setBankDialogOpen(true);
              return;
            }
            onSubmit(privacyAccepted);
          }}
        />
        <label className="flex cursor-pointer items-start gap-3 rounded-[12px] border border-border p-3 text-[13px] leading-5">
          <Checkbox checked={privacyAccepted} onCheckedChange={(checked) => setPrivacyAccepted(checked === true)} className="mt-0.5 data-checked:border-accent data-checked:bg-accent data-checked:text-accent-foreground" />
          <span>Έχω διαβάσει και αποδέχομαι την <a href="/privacy" target="_blank" className="font-extrabold underline underline-offset-2">Πολιτική Απορρήτου</a> <span className="text-destructive">*</span></span>
        </label>
      </CardContent>
    </Card>
    <BankTransferDialog
      open={bankDialogOpen}
      onOpenChange={setBankDialogOpen}
      plan={selected}
      paymentReference={paymentSettings.paymentReference}
      saving={saving}
      onConfirm={(bankTransfer) => onSubmit(privacyAccepted, bankTransfer)}
    />
    </div>
  );
}

function BankTransferDialog({
  open,
  onOpenChange,
  plan,
  paymentReference,
  saving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: PricingPlan;
  paymentReference?: string;
  saving: boolean;
  onConfirm: (bankTransfer: { proof?: File | null; note?: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [fileError, setFileError] = useState("");
  const close = (nextOpen: boolean) => {
    if (!nextOpen && !saving) {
      setProof(null);
      setNote("");
      setFileError("");
    }
    onOpenChange(nextOpen);
  };
  const chooseProof = (file?: File) => {
    if (!file) return;
    const validType = ["image/jpeg", "image/png", "application/pdf"].includes(file.type);
    if (!validType || file.size > 10 * 1024 * 1024) {
      setProof(null);
      setFileError("Επίλεξε JPG, PNG ή PDF έως 10 MB.");
      return;
    }
    setFileError("");
    setProof(file);
  };

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent className="max-w-[520px] gap-4 rounded-[24px] border-border bg-card p-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)] sm:p-[26px]">
        <AlertDialogHeader className="relative space-y-1 pr-10 text-left">
          <AlertDialogTitle className="text-[20px] font-extrabold">Επιβεβαίωση κατάθεσης</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-5 text-muted-foreground">Ο coach θα ελέγξει την κατάθεση και θα ενεργοποιήσει τη συνδρομή σου.</AlertDialogDescription>
          <Button type="button" variant="ghost" size="icon" aria-label="Κλείσιμο" disabled={saving} onClick={() => close(false)} className="absolute right-0 top-0 h-[34px] w-[34px] rounded-full bg-muted hover:bg-muted/80"><X className="h-4 w-4" /></Button>
        </AlertDialogHeader>

        <div className="rounded-[14px] bg-muted px-3.5 py-2">
          <DialogSummaryRow label="Πλάνο" value={plan ? `${plan.name}${plan.period ? ` · ${plan.period}` : ""}` : "—"} />
          <DialogSummaryRow label="Ποσό" value={plan ? money(plan.price, plan.currency) : "—"} />
          <DialogSummaryRow label="Αιτιολογία" value={paymentReference || "Ονοματεπώνυμο + πλάνο"} />
        </div>

        <div className="space-y-2">
          <p className="text-[13px] font-extrabold">Αποδεικτικό <span className="text-destructive">*</span></p>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(event) => chooseProof(event.target.files?.[0])} />
          <button type="button" disabled={saving} onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-[#cfcfcb] bg-muted/45 px-4 py-[22px] text-center transition-colors hover:bg-muted disabled:cursor-not-allowed dark:border-border">
            <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[color:var(--sp-lime-soft)] text-foreground"><FileUp className="h-5 w-5" /></span>
            <span className="text-[14px] font-extrabold">Σύρε εδώ το αποδεικτικό ή <u>επίλεξε αρχείο</u></span>
            <span className="text-[12px] text-muted-foreground">JPG, PNG, PDF · έως 10 MB</span>
          </button>
          {fileError && <p className="text-[12px] font-semibold text-destructive">{fileError}</p>}
          {proof && <div className="flex items-center gap-3 rounded-[12px] bg-muted px-3 py-2.5"><span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border bg-card"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-extrabold">{proof.name}</span><span className="block text-[11px] text-muted-foreground">{Math.max(1, Math.round(proof.size / 1024))} KB</span></span><Button type="button" variant="ghost" size="icon" aria-label="Αφαίρεση αρχείου" disabled={saving} onClick={() => { setProof(null); if (inputRef.current) inputRef.current.value = ""; }} className="h-8 w-8 rounded-full text-muted-foreground"><X className="h-4 w-4" /></Button></div>}
          {!proof && <p className="pt-1 text-[12px] font-semibold text-muted-foreground">Ανέβασε το αποδεικτικό για να συνεχίσεις.</p>}
        </div>

        <label className="space-y-2">
          <span className="block text-[13px] font-extrabold">Σημείωση για τον coach <span className="font-medium text-muted-foreground">(προαιρετικό)</span></span>
          <textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="π.χ. «Η κατάθεση έγινε από τον λογαριασμό της συζύγου μου»" className="h-16 w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-[var(--sp-lime-glow)]" />
        </label>

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={saving} onClick={() => close(false)} className="h-[46px] rounded-full border-border px-5 font-bold">Ακύρωση</AlertDialogCancel>
          <Button type="button" disabled={saving || !proof} onClick={() => onConfirm({ proof, note })} className="h-[46px] rounded-full bg-foreground px-[22px] font-extrabold text-background hover:bg-foreground/90"><Check className="mr-2 h-4 w-4" />{saving ? "Καταχώριση..." : "Επιβεβαίωση"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DialogSummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border/70 py-1.5 text-[13px] last:border-b-0"><span className="text-muted-foreground">{label}</span><b className="text-right">{value}</b></div>;
}

function PaymentMethodDetails({
  method,
  selected,
  bankAccount,
  bankAccounts,
  paymentReference,
  paymentNote,
  onCopyIban,
  saving,
  disabled,
  onSubmit,
}: {
  method: "bank_transfer" | "stripe_card" | "paypal" | "cash";
  selected?: PricingPlan;
  bankAccount: BankDetails | null;
  bankAccounts: BankDetails[];
  paymentReference?: string;
  paymentNote?: string;
  onCopyIban: (iban?: string) => void;
  saving: boolean;
  disabled: boolean;
  onSubmit: () => void;
}) {
  const amount = selected ? money(selected.price, selected.currency) : "";
  const isOnline = method === "stripe_card" || method === "paypal";
  const actionLabel = saving
    ? "Μετάβαση στην πληρωμή..."
    : method === "stripe_card"
      ? `Πλήρωσε ${amount}`
      : method === "paypal"
        ? "Συνέχεια στο PayPal"
        : "Καταχώρηση αιτήματος";

  if (method === "bank_transfer") {
    const referenceHint = paymentReference || "το ονοματεπώνυμό σου + το πλάνο";
    return (
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-extrabold">Στοιχεία κατάθεσης</p>
          {bankAccounts.length > 1 && <span className="inline-flex h-[26px] items-center rounded-full bg-muted px-2.5 text-[12px] font-extrabold">{bankAccounts.length} λογαριασμοί</span>}
        </div>
        <div className="space-y-[10px]">{bankAccounts.map((account, index) => <div key={`${account.iban}-${index}`} className="rounded-[14px] border border-border bg-muted p-3"><div className="mb-2 flex items-center justify-between gap-3"><p className="text-[12px] font-extrabold">{account.bankName || "Τραπεζικός λογαριασμός"}</p>{index === 0 && <span className="rounded-full bg-card px-2 py-1 text-[10px] font-extrabold text-muted-foreground">Προτεινόμενος</span>}</div><div className="grid gap-[10px] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"><div className="flex min-w-0 items-center gap-[10px] rounded-[12px] bg-card px-[14px] py-3"><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">Δικαιούχος</p><p className="truncate text-[14px] font-extrabold">{account.beneficiary || "—"}</p></div>{account.beneficiary && <Button type="button" variant="outline" size="icon" aria-label="Αντιγραφή δικαιούχου" onClick={() => onCopyIban(account.beneficiary)} className="h-[34px] w-[34px] shrink-0 rounded-[10px] border-border bg-card"><Copy className="h-[15px] w-[15px]" /></Button>}</div><div className="flex min-w-0 items-center gap-[10px] rounded-[12px] bg-card px-[14px] py-3"><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">IBAN</p><p className="truncate text-[14px] font-extrabold tracking-[.3px] tabular-nums">{account.iban || "—"}</p></div>{account.iban && <Button type="button" variant="outline" size="icon" aria-label="Αντιγραφή IBAN" onClick={() => onCopyIban(account.iban)} className="h-[34px] w-[34px] shrink-0 rounded-[10px] border-border bg-card"><Copy className="h-[15px] w-[15px]" /></Button>}</div></div></div>)}</div>
        <p className="text-[13px] text-muted-foreground">Στην αιτιολογία γράψε <b className="text-foreground">{referenceHint}</b>.</p>
        <div className="flex flex-col gap-[14px] rounded-[14px] border-[1.5px] border-dashed border-[#d6d6d2] px-4 py-[14px] sm:flex-row sm:items-center dark:border-border">
          <div className="min-w-0 flex-1"><p className="text-[14px] font-extrabold">Έκανες την κατάθεση;</p><p className="mt-0.5 flex items-start gap-1.5 text-[12px] leading-5 text-muted-foreground"><Paperclip className="mt-0.5 h-[14px] w-[14px] shrink-0" />Επισύναψε προαιρετικά το αποδεικτικό (φωτογραφία ή PDF) για γρηγορότερη έγκριση.</p></div>
          <Button className="h-11 w-full shrink-0 rounded-full bg-foreground px-[18px] text-[13px] font-extrabold text-background hover:bg-foreground/90 sm:w-auto" disabled={disabled || saving} onClick={onSubmit}><Check className="mr-2 h-4 w-4" />{saving ? "Καταχώριση..." : "Έκανα την κατάθεση"}</Button>
        </div>
      </div>
    );
  }

  if (method === "cash") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-[.8px] text-muted-foreground">Ποσό</p><p className="mt-1 text-[22px] font-extrabold italic">{amount}</p></div>
          <div className="rounded-[14px] bg-muted p-4"><p className="text-[11px] font-bold uppercase tracking-[.8px] text-muted-foreground">Σε ποιον</p><p className="mt-1 text-[16px] font-extrabold">Στον coach σου</p></div>
        </div>
        <div className="flex flex-col gap-4 rounded-[14px] border-[1.5px] border-dashed border-[#D6D6D2] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-border">
          <div><p className="font-extrabold">Θα πληρώσεις μετρητά στον coach;</p><p className="mt-1 text-[13px] leading-5 text-muted-foreground">Θα του τα δώσεις από κοντά. Η συνδρομή ενεργοποιείται μόλις τα παραλάβει.</p></div>
          <Button className="h-[46px] w-full shrink-0 rounded-full bg-foreground px-5 font-extrabold text-background hover:bg-foreground/90 sm:w-auto" disabled={disabled || saving} onClick={onSubmit}><Check className="mr-2 h-4 w-4" />{saving ? "Καταχώριση..." : "Θα πληρώσω μετρητά"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[16px] bg-muted p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-2">
        {method === "stripe_card" ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {["VISA", "Mastercard", "Apple Pay", "Google Pay"].map((item) => (
                <span key={item} className="rounded-[7px] border border-border bg-card px-2 py-1 text-[11px] font-extrabold tracking-[.2px]">{item}</span>
              ))}
            </div>
            <p className="flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground"><LockKeyhole className="h-3.5 w-3.5 shrink-0" />Ασφαλής πληρωμή μέσω Stripe. Η συνδρομή ενεργοποιείται αμέσως.</p>
          </>
        ) : method === "paypal" ? (
          <p className="flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground"><WalletCards className="h-4 w-4 shrink-0" />Θα μεταφερθείς στο PayPal για να ολοκληρώσεις την πληρωμή.</p>
        ) : method === "bank_transfer" && bankAccount?.iban ? (
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-foreground">Στοιχεία κατάθεσης{bankAccount.bankName ? ` · ${bankAccount.bankName}` : ""}</p>
            <div className="flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-card px-3 py-2">
              <span className="min-w-0 flex-1 font-mono text-[12px] font-bold tabular-nums">{bankAccount.iban}</span>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-full px-3 text-[11px]" onClick={() => onCopyIban(bankAccount.iban)}><Copy className="mr-1 h-3.5 w-3.5" />Αντιγραφή</Button>
            </div>
            <p className="text-[12px] leading-5 text-muted-foreground">Στην αιτιολογία γράψε <b className="text-foreground">{paymentReference || "ονοματεπώνυμο + πλάνο"}</b>{paymentNote ? ` · ${paymentNote}` : ""}.</p>
          </div>
        ) : (
          <p className="text-[12px] leading-5 text-muted-foreground">Θα λάβεις οδηγίες από τον coach μόλις καταχωρηθεί το αίτημα.</p>
        )}
      </div>
      <Button className={`h-[50px] shrink-0 rounded-full px-6 font-extrabold ${isOnline ? "bg-accent text-accent-foreground hover:bg-accent/85" : "bg-foreground text-background hover:bg-foreground/90"}`} disabled={disabled || saving} onClick={onSubmit}>
        {method === "stripe_card" ? <CreditCard className="mr-2 h-4 w-4" /> : method === "paypal" ? <WalletCards className="mr-2 h-4 w-4" /> : null}
        {actionLabel}
      </Button>
    </div>
  );
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  const [showAll, setShowAll] = useState(false);
  const visiblePayments = showAll ? payments : payments.slice(0, 5);
  const currentYear = new Date().getFullYear();
  const currentYearTotal = payments
    .filter(
      (payment) =>
        ["completed", "confirmed"].includes(payment.status) &&
        payment.paidAt &&
        new Date(payment.paidAt).getFullYear() === currentYear,
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return (
    <Card className="rounded-[20px] border-border bg-card shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <ReceiptText className="h-5 w-5" />
          Ιστορικό πληρωμών
        </CardTitle>
        <p className="text-[13px] text-muted-foreground">
          Σύνολο {currentYear}:{" "}
          <span className="font-extrabold text-foreground">
            {money(currentYearTotal)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:px-6">
        {payments.length ? (
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-10 px-6 text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">
                      ΗΜΕΡΟΜΗΝΙΑ
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">
                      ΠΛΑΝΟ
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">
                      ΤΡΟΠΟΣ
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">
                      ΠΟΣΟ
                    </TableHead>
                    <TableHead className="text-[10px] font-extrabold tracking-[1px] text-[#8A8A8A]">
                      ΚΑΤΑΣΤΑΣΗ
                    </TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiblePayments.map((payment) => (
                    <TableRow
                      key={payment.id}
                      className="border-border hover:bg-muted/50"
                    >
                      <TableCell className="px-6 py-3.5 font-bold">
                        {formatDate(payment.paidAt || payment.createdAt)}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <div>
                          <p>{payment.planName || "-"}</p>
                          {payment.privacyPolicyAcceptedAt && <p className="mt-1 text-[11px] text-muted-foreground">Πολιτική Απορρήτου · {formatDateTime(payment.privacyPolicyAcceptedAt)}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 text-muted-foreground">
                        {paymentMethods[payment.method] || payment.method}
                      </TableCell>
                      <TableCell className="py-3.5 font-extrabold">
                        {money(payment.amount, payment.currency || "EUR")}
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge
                          className={`h-6 rounded-full px-2.5 text-[11px] font-extrabold ${paymentStatusClass(payment.status)}`}
                        >
                          {["completed", "confirmed"].includes(
                            payment.status,
                          ) && <Check className="mr-1 h-3 w-3" />}
                          {paymentStatusLabel(payment)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 pr-6">
                        {payment.proofUrl ? (
                          <Button
                            asChild
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-[10px] border-border"
                          >
                            <a
                              href={payment.proofUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Αποδεικτικό πληρωμής"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-2 px-4 sm:hidden">
              {visiblePayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-[14px] border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-extrabold">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </p>
                    <p className="font-extrabold">
                      {money(payment.amount, payment.currency || "EUR")}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div><p className="text-sm text-muted-foreground">{paymentMethods[payment.method] || payment.method}</p>{payment.privacyPolicyAcceptedAt && <p className="mt-1 text-[10px] text-muted-foreground">Πολιτική Απορρήτου · {formatDateTime(payment.privacyPolicyAcceptedAt)}</p>}</div>
                    <Badge
                      className={`h-6 rounded-full px-2.5 text-[11px] font-extrabold ${paymentStatusClass(payment.status)}`}
                    >
                      {["completed", "confirmed"].includes(payment.status) && (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      {paymentStatusLabel(payment)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            {payments.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAll((current) => !current)}
                className="flex w-full items-center justify-center gap-1 py-3 text-[13px] font-extrabold text-foreground"
              >
                {showAll ? "Λιγότερα" : "Περισσότερα"}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Δεν υπάρχουν πληρωμές ακόμα.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default function ClientBillingModernPage() {
  return (
    <ProtectedRoute allow="client-billing">
      <ClientBillingModernContent />
    </ProtectedRoute>
  );
}
