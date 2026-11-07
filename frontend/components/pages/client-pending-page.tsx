"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Clock, Copy, CreditCard, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClientShell } from "@/components/shell/client-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface Subscription {
  plan_name: string | null;
  price: number | string | null;
}

interface Payment {
  amount: number | string | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  referenceNumber: string | null;
  paidAt: string | null;
}

interface BankDetails {
  bankName: string;
  beneficiary: string;
  iban: string;
  supportEmail: string;
  supportPhone: string;
}

const paymentMethodLabel: Record<string, string> = {
  bank_transfer: "Τραπεζικό Έμβασμα",
  bank: "Τραπεζικό Έμβασμα",
  stripe_card: "Κάρτα (Stripe)",
  stripe: "Κάρτα (Stripe)",
};

function formatAmount(amount: number | string | null, currency: string | null): string {
  const value = Number(amount || 0);
  return `${value.toFixed(2)} ${currency === "EUR" || !currency ? "€" : currency}`;
}

function BankRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-4 border-b border-border px-5 py-4 text-sm last:border-b-0">
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
      <span>{action}</span>
    </div>
  );
}

function NextStep({ step, title, text }: { step: number; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-muted p-5">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{step}</div>
      <h3 className="font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function ClientPendingContent() {
  const { user, logout } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<{ subscription: Subscription | null; payments: Payment[] }>("/client/payments")
      .then((data) => {
        setSubscription(data.subscription);
        setPayment(data.payments?.[0] || null);
      })
      .catch(() => {});
    api.get<BankDetails>("/bank-details").then(setBankDetails).catch(() => {});
  }, []);

  const isBankTransfer = payment?.method === "bank_transfer" || payment?.method === "bank";
  const referenceNumber = payment?.referenceNumber || "-";
  const firstName = user?.fullName?.split(" ")[0] || "";

  const copyIban = async () => {
    if (!bankDetails?.iban) return;
    try {
      await navigator.clipboard.writeText(bankDetails.iban);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked in some browsers; the IBAN remains visible.
    }
  };

  return (
    <ClientShell title="Εκκρεμής Πληρωμή" user={user} logout={logout} paymentApproved={false} active="dashboard">
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 lg:p-8">
        <section className="relative overflow-hidden rounded-[24px] border border-[#0b0b0b] bg-[#0b0b0b] p-6 text-white shadow-none sm:p-[30px]">
          <span aria-hidden="true" className="absolute -right-3 -top-10 h-[220px] w-[14px] -skew-x-[18deg] bg-accent" />
          <div className="flex items-start gap-5">
            <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#262626] text-accent">
              <Clock className="h-6 w-6" />
            </div>
            <div className="relative max-w-3xl">
              <span className="inline-flex rounded-full bg-[#262626] px-2.5 py-1 text-[11px] font-extrabold text-accent">Σε αναμονή πληρωμής</span>
              <h1 className="mt-3 text-[28px] font-extrabold tracking-[-.5px]">Λίγο ακόμα{firstName ? `, ${firstName}` : ""}!</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-300">
                Κάνε την κατάθεση και πάτα «Έκανα την κατάθεση». Μόλις ο coach την εγκρίνει, ξεκλειδώνουν αυτόματα το πρόγραμμα, η διατροφή και το progress.
              </p>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Εγγραφή", "Ολοκληρώθηκε", true], ["Κατάθεση", payment ? `${formatAmount(payment.amount, payment.currency)} · εκκρεμεί` : "εκκρεμεί", false], ["Έγκριση coach", "συνήθως σε 24 ώρες", false], ["Ξεκινάς!", "πρόγραμμα & διατροφή", false]].map(([title, text, complete], index) => <div key={String(title)} className="min-w-0"><span className={`grid h-[26px] w-[26px] place-items-center rounded-full ${complete ? "bg-accent text-accent-foreground" : index === 1 ? "bg-white text-[#0b0b0b] ring-4 ring-accent/30" : "border border-[#3a3a3a]"}`}>{complete ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><p className={`mt-2 text-[13px] font-extrabold ${complete || index === 1 ? "text-white" : "text-neutral-400"}`}>{title}</p><p className="mt-0.5 text-[11px] text-neutral-400">{text}</p></div>)}</div>
        </section>

        <section className="flex flex-col gap-4 rounded-[22px] bg-accent p-5 text-accent-foreground sm:flex-row sm:items-center"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-[#0b0b0b] text-accent"><CreditCard className="h-5 w-5" /></span><div className="flex-1"><h2 className="text-[15px] font-extrabold">Θες να ξεκινήσεις τώρα;</h2><p className="mt-0.5 text-[13px]">Πλήρωσε με κάρτα ή PayPal και η συνδρομή ενεργοποιείται αμέσως.</p></div><div className="flex gap-2"><Button onClick={() => window.location.assign("/client-billing")} className="rounded-full bg-[#0b0b0b] text-white hover:bg-[#1f1f1f]">Κάρτα</Button><Button onClick={() => window.location.assign("/client-billing")} className="rounded-full bg-[#0b0b0b] text-white hover:bg-[#1f1f1f]">PayPal</Button></div></section>

        {(subscription || payment) && (
          <Card className="rounded-[22px] border-border p-6 shadow-none">
            <h2 className="text-[18px] font-extrabold">Στοιχεία κατάθεσης</h2>
            <div className="mt-4 overflow-hidden rounded-[14px] border border-border">
              {subscription?.plan_name && <BankRow label="Πλάνο" value={subscription.plan_name} />}
              {payment && <BankRow label="Ποσό" value={formatAmount(payment.amount, payment.currency)} />}
              {payment?.method && (
                <BankRow label="Τρόπος" value={paymentMethodLabel[payment.method] || payment.method} />
              )}
              <BankRow label="Κατάσταση" value="Εκκρεμεί έγκριση" />
            </div>
          </Card>
        )}

        {isBankTransfer && bankDetails && (
          <Card className="rounded-[22px] border-border p-6 shadow-none">
            <h2 className="text-[18px] font-extrabold">Στοιχεία Τραπεζικού Λογαριασμού</h2>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Αν δεν έχεις κάνει ακόμα την κατάθεση, χρησιμοποίησε τα στοιχεία παρακάτω.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border">
              <BankRow label="Δικαιούχος" value={bankDetails.beneficiary} />
              <BankRow label="Τράπεζα" value={bankDetails.bankName} />
              <BankRow
                label="IBAN"
                value={bankDetails.iban}
                action={
                  <Button variant="outline" size="sm" onClick={copyIban} className="h-7 text-xs">
                    <Copy className="h-3 w-3" />
                    {copied ? "Έγινε!" : "Copy"}
                  </Button>
                }
              />
              <BankRow label="Αιτιολογία" value={referenceNumber} />
            </div>
          </Card>
        )}

        <Card className="rounded-[22px] border-border p-6 shadow-none">
          <h2 className="text-[18px] font-extrabold">Ξεκλειδώνουν μετά την έγκριση</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <NextStep step={1} title="Κάνεις την κατάθεση" text="Με την αιτιολογία που βλέπεις παραπάνω, ώστε να ταυτοποιηθεί σωστά." />
            <NextStep step={2} title="Ο coach επιβεβαιώνει" text="Μόλις επαληθευτεί η πληρωμή, ενεργοποιεί τη συνδρομή σου." />
            <NextStep step={3} title="Ξεκλειδώνει η εφαρμογή" text="Πρόγραμμα, διατροφή και progress ανοίγουν αυτόματα." />
          </div>
        </Card>

        {bankDetails && (bankDetails.supportEmail || bankDetails.supportPhone) && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-muted px-5 py-4 text-sm font-bold text-foreground">
            <span>Χρειάζεσαι βοήθεια;</span>
            {bankDetails.supportEmail && (
              <a href={`mailto:${bankDetails.supportEmail}`} className="flex items-center gap-1.5 underline">
                <Mail className="h-3.5 w-3.5" />
                {bankDetails.supportEmail}
              </a>
            )}
            {bankDetails.supportPhone && (
              <a href={`tel:${bankDetails.supportPhone}`} className="flex items-center gap-1.5 underline">
                <Phone className="h-3.5 w-3.5" />
                {bankDetails.supportPhone}
              </a>
            )}
          </div>
        )}
      </div>
    </ClientShell>
  );
}

export default function ClientPendingPage() {
  return (
    <ProtectedRoute allow="client-pending">
      <ClientPendingContent />
    </ProtectedRoute>
  );
}
