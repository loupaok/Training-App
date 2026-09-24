"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock, Copy, Mail, Phone } from "lucide-react";
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
    <div className="grid grid-cols-[120px_1fr_auto] items-center gap-4 border-b border-slate-200 px-5 py-4 text-sm last:border-b-0 dark:border-slate-800">
      <span className="font-bold text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-bold text-slate-950 dark:text-slate-50">{value}</span>
      <span>{action}</span>
    </div>
  );
}

function NextStep({ step, title, text }: { step: number; title: string; text: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-red-600 text-sm font-bold text-white">{step}</div>
      <h3 className="font-bold text-slate-900 dark:text-slate-50">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">{text}</p>
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
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-amber-100 bg-amber-50 p-7 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-amber-200 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-900 dark:text-amber-200">Η πληρωμή σου είναι σε εκκρεμότητα</h1>
              <p className="mt-2 text-sm font-semibold leading-6 text-amber-800 dark:text-amber-300">
                Η αίτησή σου καταχωρήθηκε. Μόλις ο coach επιβεβαιώσει την πληρωμή σου, θα ξεκλειδώσουν αυτόματα το πρόγραμμα, η διατροφή και το progress.
              </p>
            </div>
          </div>
        </section>

        {(subscription || payment) && (
          <Card className="p-7">
            <h2 className="text-xl font-bold">Σύνοψη Αίτησης</h2>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
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
          <Card className="p-7">
            <h2 className="text-xl font-bold">Στοιχεία Τραπεζικού Λογαριασμού</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
              Αν δεν έχεις κάνει ακόμα την κατάθεση, χρησιμοποίησε τα στοιχεία παρακάτω.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
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

        <Card className="p-7">
          <h2 className="text-xl font-bold">Τι συμβαίνει μετά;</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <NextStep step={1} title="Κάνεις την κατάθεση" text="Με την αιτιολογία που βλέπεις παραπάνω, ώστε να ταυτοποιηθεί σωστά." />
            <NextStep step={2} title="Ο coach επιβεβαιώνει" text="Μόλις επαληθευτεί η πληρωμή, ενεργοποιεί τη συνδρομή σου." />
            <NextStep step={3} title="Ξεκλειδώνει η εφαρμογή" text="Πρόγραμμα, διατροφή και progress ανοίγουν αυτόματα." />
          </div>
        </Card>

        {bankDetails && (bankDetails.supportEmail || bankDetails.supportPhone) && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
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
