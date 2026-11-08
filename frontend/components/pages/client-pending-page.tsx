"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, Copy, CreditCard, Dumbbell, FileText, FileUp, Lock, Mail, MapPin, MessageCircle, Star, WalletCards, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ClientShell } from "@/components/shell/client-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface Subscription { plan_name: string | null; price: number | string | null; duration_months?: number | null; is_popular?: boolean | number; }
interface Payment { amount: number | string | null; currency: string | null; method: string | null; status: string | null; referenceNumber: string | null; proofUrl?: string | null; planName?: string | null; }
interface BankDetails { bankName: string; beneficiary: string; iban: string; }
interface Branding { supportEmail?: string | null; }

const labels: Record<string, string> = { bank_transfer: "Τραπεζικό έμβασμα", bank: "Τραπεζικό έμβασμα", stripe: "Κάρτα (Stripe)", stripe_card: "Κάρτα (Stripe)", paypal: "PayPal", cash: "Μετρητά" };
const amountText = (amount: number | string | null, currency: string | null) => `${Number(amount || 0).toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "EUR" || !currency ? "€" : currency}`;

function PendingStep({ title, detail, state }: { title: string; detail: string; state: "complete" | "current" | "future" }) {
  return <div className="min-w-[132px] flex-1"><div className="flex items-center gap-2"><span className={`grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full ${state === "complete" ? "bg-accent text-accent-foreground" : state === "current" ? "bg-card text-foreground ring-4 ring-accent/30" : "border-[1.5px] border-[#3a3a3a]"}`}>{state === "complete" ? <Check className="h-3.5 w-3.5" /> : state === "current" ? <Clock className="h-[13px] w-[13px]" /> : null}</span><span className={`hidden h-[3px] flex-1 rounded-full sm:block ${state === "complete" ? "bg-accent" : "bg-[#2a2a2a]"}`} /></div><p className={`mt-2 text-[13px] font-extrabold ${state === "future" ? "text-[#8a8a8a]" : "text-white"}`}>{title}</p><p className="mt-0.5 text-[11px] text-[#8a8a8a]">{detail}</p></div>;
}

function InfoValue({ label, value, copyValue, onCopy }: { label: string; value: string; copyValue?: string; onCopy: (value: string) => void }) {
  return <div className="flex min-w-0 items-center gap-2.5 rounded-[14px] bg-muted px-[14px] py-3"><div className="min-w-0 flex-1"><p className="text-[11px] text-muted-foreground">{label}</p><p className="truncate text-[14px] font-extrabold tabular-nums">{value || "—"}</p></div>{copyValue && <button type="button" aria-label={`Αντιγραφή ${label}`} onClick={() => onCopy(copyValue)} className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] border border-border bg-card transition-colors hover:bg-muted"><Copy className="h-[15px] w-[15px]" /></button>}</div>;
}

function LockedFeature({ icon: Icon, title, description }: { icon: typeof Dumbbell; title: string; description: string }) {
  return <div className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0"><span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-muted text-muted-foreground"><Icon className="h-[17px] w-[17px]" /></span><span className="min-w-0 flex-1"><b className="block text-[14px]">{title}</b><small className="block text-[12px] text-muted-foreground">{description}</small></span><Lock className="h-[15px] w-[15px] text-muted-foreground" /></div>;
}

function DepositProofDialog({ open, onOpenChange, planName, amount, reference, onComplete }: { open: boolean; onOpenChange: (value: boolean) => void; planName: string; amount: string; reference: string; onComplete: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const close = (value: boolean) => { if (!value && !saving) { setProof(null); setNote(""); setError(""); } onOpenChange(value); };
  const selectProof = (file?: File) => { if (!file) return; if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || file.size > 10 * 1024 * 1024) { setProof(null); setError("Επίλεξε JPG, PNG ή PDF έως 10 MB."); return; } setProof(file); setError(""); };
  const submit = async () => { if (!proof) { setError("Ανέβασε το αποδεικτικό για να συνεχίσεις."); return; } setSaving(true); setError(""); try { const data = new FormData(); data.append("proof", proof); if (note.trim()) data.append("note", note.trim()); await api.upload("/clients/me/billing-proof", data); await onComplete(); close(false); } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "Δεν ήταν δυνατή η αποστολή του αποδεικτικού."); } finally { setSaving(false); } };
  return <AlertDialog open={open} onOpenChange={close}><AlertDialogContent className="max-w-[520px] gap-4 rounded-[24px] border-border bg-card p-5 shadow-[0_30px_80px_rgba(0,0,0,.25)] sm:p-[26px]"><AlertDialogHeader className="relative space-y-1 pr-10 text-left"><AlertDialogTitle className="text-[20px] font-extrabold">Επιβεβαίωση κατάθεσης</AlertDialogTitle><AlertDialogDescription className="text-[13px] leading-5 text-muted-foreground">Ο coach θα ελέγξει την κατάθεση και θα ενεργοποιήσει τη συνδρομή σου.</AlertDialogDescription><Button type="button" variant="ghost" size="icon" aria-label="Κλείσιμο" disabled={saving} onClick={() => close(false)} className="absolute right-0 top-0 h-[34px] w-[34px] rounded-full bg-muted hover:bg-muted/80"><X className="h-4 w-4" /></Button></AlertDialogHeader><div className="rounded-[14px] bg-muted px-3.5 py-2"><SummaryRow label="Πλάνο" value={planName} /><SummaryRow label="Ποσό" value={amount} /><SummaryRow label="Αιτιολογία" value={reference} /></div><div className="space-y-2"><p className="text-[13px] font-extrabold">Αποδεικτικό <span className="text-destructive">*</span></p><input ref={inputRef} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" className="sr-only" onChange={(event) => selectProof(event.target.files?.[0])} /><button type="button" disabled={saving} onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-[#cfcfcb] bg-muted/45 px-4 py-[22px] text-center transition-colors hover:bg-muted disabled:cursor-not-allowed dark:border-border"><span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[var(--sp-lime-soft)] text-foreground"><FileUp className="h-5 w-5" /></span><span className="text-[14px] font-extrabold">Σύρε εδώ το αποδεικτικό ή <u>επέλεξε αρχείο</u></span><span className="text-[12px] text-muted-foreground">JPG, PNG, PDF · έως 10 MB</span></button>{proof && <div className="flex items-center gap-3 rounded-[12px] bg-muted px-3 py-2.5"><span className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border bg-card"><FileText className="h-4 w-4" /></span><span className="min-w-0 flex-1"><b className="block truncate text-[13px]">{proof.name}</b><small className="block text-[11px] text-muted-foreground">{Math.max(1, Math.round(proof.size / 1024))} KB</small></span><Button type="button" variant="ghost" size="icon" aria-label="Αφαίρεση αρχείου" disabled={saving} onClick={() => { setProof(null); if (inputRef.current) inputRef.current.value = ""; }} className="h-8 w-8 rounded-full"><X className="h-4 w-4" /></Button></div>}{error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}{!proof && !error && <p className="pt-1 text-[12px] font-semibold text-muted-foreground">Ανέβασε το αποδεικτικό για να συνεχίσεις.</p>}</div><label className="block space-y-2"><span className="block text-[13px] font-extrabold">Σημείωση για τον coach <span className="font-medium text-muted-foreground">(προαιρετικό)</span></span><textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="π.χ. «Η κατάθεση έγινε από τον λογαριασμό της συζύγου μου»" className="h-16 w-full resize-none rounded-[14px] border border-border bg-card px-3.5 py-3 text-[13px] outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-4 focus:ring-[var(--sp-lime-glow)]" /></label><AlertDialogFooter className="gap-2 sm:gap-2"><AlertDialogCancel disabled={saving} onClick={() => close(false)} className="h-[46px] rounded-full border-border px-5 font-bold">Ακύρωση</AlertDialogCancel><Button type="button" disabled={saving || !proof} onClick={submit} className="h-[46px] rounded-full bg-foreground px-[22px] font-extrabold text-background hover:bg-foreground/90"><Check className="mr-2 h-4 w-4" />{saving ? "Καταχώριση..." : "Επιβεβαίωση"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-b border-border/70 py-1.5 text-[13px] last:border-b-0"><span className="text-muted-foreground">{label}</span><b className="text-right">{value}</b></div>; }

function ClientPendingContent() {
  const { user, logout } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [pointsPerEuro, setPointsPerEuro] = useState(0);
  const [copied, setCopied] = useState(false);
  const [proofDialogOpen, setProofDialogOpen] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState("");

  const loadPaymentState = async () => {
    const data = await api.get<{ subscription: Subscription | null; pendingSubscription: Subscription | null; payments: Payment[] }>("/client/payments");
    setSubscription(data.pendingSubscription || data.subscription);
    setPayment(data.payments?.find((item) => item.status === "pending") || data.payments?.[0] || null);
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const stripePaymentId = params.get("stripe_payment_id");
    const stripeSessionId = params.get("stripe_session_id");
    const paypalPaymentId = params.get("paypal_payment_id");
    const paypalOrderId = params.get("token");

    const finishCheckout = async () => {
      try {
        if (stripePaymentId && stripeSessionId) {
          await api.post(`/clients/me/billing/${stripePaymentId}/stripe-confirm`, { sessionId: stripeSessionId });
          if (mounted) setCheckoutNotice("Η πληρωμή με κάρτα επιβεβαιώθηκε. Ο coach θα ελέγξει το ερωτηματολόγιό σου και θα ετοιμάσει τα πλάνα σου.");
        } else if (paypalPaymentId && paypalOrderId) {
          await api.post(`/clients/me/billing/${paypalPaymentId}/paypal-capture`, { orderId: paypalOrderId });
          if (mounted) setCheckoutNotice("Η πληρωμή με PayPal επιβεβαιώθηκε. Ο coach θα ελέγξει το ερωτηματολόγιό σου και θα ετοιμάσει τα πλάνα σου.");
        } else if (params.get("payment") === "cancelled" && mounted) {
          setCheckoutNotice("Η online πληρωμή ακυρώθηκε. Μπορείς να επικοινωνήσεις με τον coach για το αίτημά σου.");
        }
      } catch (error) {
        if (mounted) setCheckoutNotice(error instanceof Error ? error.message : "Δεν ήταν δυνατή η επιβεβαίωση της πληρωμής.");
      } finally {
        if (stripePaymentId || paypalPaymentId || params.get("payment") === "cancelled") window.history.replaceState({}, "", "/client/pending");
        await loadPaymentState().catch(() => {});
      }
    };

    finishCheckout();
    api.get<BankDetails>("/bank-details").then(setBankDetails).catch(() => {});
    api.get<Branding>("/branding").then((data) => setSupportEmail(data.supportEmail?.trim() || null)).catch(() => {});
    api.get<{ pointsPerEuro?: number }>("/pricing-plans/packages").then((data) => setPointsPerEuro(Number(data.pointsPerEuro || 0))).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const isBank = payment?.method === "bank_transfer" || payment?.method === "bank";
  const isCash = payment?.method === "cash";
  const proofUploaded = Boolean(payment?.proofUrl);
  const firstName = user?.fullName?.split(" ")[0] || "";
  const amount = amountText(payment?.amount ?? subscription?.price ?? null, payment?.currency ?? "EUR");
  const method = labels[payment?.method || ""] || "πληρωμή";
  const reference = payment?.referenceNumber || "Θα εμφανιστεί μόλις καταχωρηθεί η πληρωμή";
  const durationMonths = Number(subscription?.duration_months || 0);
  const pointsReward = Math.round(Number(payment?.amount ?? subscription?.price ?? 0) * pointsPerEuro);
  const monthlyAmount = durationMonths > 0 ? Number(payment?.amount ?? subscription?.price ?? 0) / durationMonths : 0;
  const description = isCash ? "Δίνεις το ποσό στον coach από κοντά. Μόλις το παραλάβει, επιβεβαιώνει την πληρωμή και ξεκινά η προετοιμασία των πλάνων σου." : isBank ? "Κάνε την κατάθεση με τα στοιχεία παρακάτω. Μόλις ο coach την ελέγξει, ξεκινά η προετοιμασία του προγράμματος και της διατροφής σου." : "Η online πληρωμή σου επεξεργάζεται με ασφάλεια. Έπειτα ο coach αξιολογεί το ερωτηματολόγιό σου.";
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch {} };

  return <ClientShell title="Εκκρεμής Πληρωμή" user={user} logout={logout} paymentApproved={false} active="dashboard"><div className="mx-auto grid max-w-[1320px] gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-[22px] lg:p-8">
    <main className="min-w-0 space-y-5">
      <section className="relative overflow-hidden rounded-[24px] bg-[#0b0b0b] p-6 text-white sm:p-[30px]"><span aria-hidden className="absolute right-10 -top-10 h-[220px] w-[14px] -skew-x-[18deg] bg-accent" /><div className="relative max-w-[640px]"><span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#262626] px-2.5 text-[11px] font-extrabold text-accent"><Clock className="h-3 w-3" />{proofUploaded ? "Σε έλεγχο coach" : "Σε αναμονή πληρωμής"}</span><h1 className="mt-3 text-[30px] font-extrabold tracking-[-.5px] text-white">Λίγο ακόμα{firstName ? `, ${firstName}` : ""}!</h1><p className="mt-2 text-[15px] leading-6 text-[#bdbdbd]">{proofUploaded ? "Το αποδεικτικό σου καταχωρήθηκε. Ο coach ελέγχει την κατάθεση και θα συνεχίσει με την ενεργοποίηση της συνδρομής σου." : description}</p></div><div className="relative mt-6 flex gap-2 overflow-x-auto pb-1 sm:gap-3 sm:overflow-visible"><PendingStep title="Εγγραφή" detail="Ολοκληρώθηκε" state="complete" /><PendingStep title={isCash ? "Μετρητά" : isBank ? "Κατάθεση" : "Πληρωμή"} detail={proofUploaded ? "δηλώθηκε" : `${amount} · εκκρεμεί`} state={proofUploaded ? "complete" : "current"} /><PendingStep title="Έλεγχος από τον coach" detail={proofUploaded ? "συνήθως σε 24 ώρες" : "μετά το αποδεικτικό"} state={proofUploaded ? "current" : "future"} /><PendingStep title="Ξεκινάς!" detail="πρόγραμμα & διατροφή" state="future" /></div></section>

      {checkoutNotice && <div className="rounded-[16px] border border-accent bg-[var(--sp-lime-soft)] px-4 py-3 text-[13px] font-semibold text-foreground">{checkoutNotice}</div>}

      {isBank && bankDetails && <Card className="rounded-[22px] border-border bg-card shadow-none"><CardContent className="p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-[17px] font-extrabold">Στοιχεία κατάθεσης</h2><p className="mt-0.5 text-[13px] text-muted-foreground">{subscription?.plan_name || payment?.planName || "Πλάνο"} · {method}</p></div><b className="text-[26px] font-extrabold italic">{amount}</b></div><div className="mt-5 grid gap-[10px] sm:grid-cols-2"><InfoValue label="Δικαιούχος" value={bankDetails.beneficiary} copyValue={bankDetails.beneficiary} onCopy={copy} /><InfoValue label="Τράπεζα" value={bankDetails.bankName} onCopy={() => {}} /><InfoValue label="IBAN" value={bankDetails.iban} copyValue={bankDetails.iban} onCopy={copy} /><InfoValue label="Αιτιολογία" value={reference} copyValue={payment?.referenceNumber || undefined} onCopy={copy} /></div><div className="mt-4 border-t border-border pt-4">{proofUploaded ? <div className="flex items-center gap-3 rounded-[14px] bg-[var(--sp-lime-soft)] px-4 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0b0b0b] text-accent"><Check className="h-4 w-4" /></span><span><b className="block text-[13px]">Το αποδεικτικό καταχωρήθηκε</b><small className="mt-0.5 block text-[12px] text-muted-foreground">Επόμενο βήμα: έλεγχος από τον coach.</small></span></div> : <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Button onClick={() => setProofDialogOpen(true)} className="h-[46px] rounded-full bg-foreground px-5 text-sm font-extrabold text-background hover:bg-foreground/90"><Check className="mr-2 h-4 w-4" />Έκανα την κατάθεση</Button><p className="text-[12px] leading-5 text-muted-foreground">Πάτησέ το αφού κάνεις την κατάθεση και ανέβασε το αποδεικτικό.</p></div>}</div>{copied && <p className="mt-3 text-xs font-bold text-foreground">Αντιγράφηκε.</p>}</CardContent></Card>}

      {isCash && <Card className="rounded-[22px] border-border bg-card shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-[13px] bg-muted"><WalletCards className="h-5 w-5" /></span><span className="min-w-0 flex-1"><b className="block text-[15px]">Θα πληρώσεις με μετρητά στον coach;</b><small className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">Δεν χρειάζεται να στείλεις κάτι. Η συνδρομή ενεργοποιείται μόλις ο coach επιβεβαιώσει ότι τα παρέλαβε.</small></span></CardContent></Card>}
    </main>

    <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start"><Card className="rounded-[22px] border-2 border-foreground bg-card shadow-none"><CardContent className="flex flex-col gap-[10px] p-5"><div className="flex items-center justify-between gap-3"><span className="text-[11px] font-extrabold tracking-[1px] text-muted-foreground">ΤΟ ΠΑΚΕΤΟ ΣΟΥ</span>{Boolean(subscription?.is_popular) && <span className="inline-flex h-[22px] items-center rounded-full bg-accent px-[9px] text-[11px] font-extrabold text-accent-foreground">Δημοφιλές</span>}</div><div className="flex items-baseline justify-between gap-3"><b className="text-[22px] font-extrabold">{subscription?.plan_name || payment?.planName || "Το πλάνο σου"}{durationMonths > 0 && <span> · {durationMonths} {durationMonths === 1 ? "μήνας" : "μήνες"}</span>}</b><b className="shrink-0 text-[24px] font-extrabold italic">{amount}</b></div>{durationMonths > 0 && <p className="text-[12px] text-muted-foreground">≈ {monthlyAmount.toLocaleString("el-GR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € / μήνα</p>}<div className="border-t border-border pt-[10px]"><p className="text-[13px] font-bold">{pointsReward > 0 ? <><span>+{pointsReward.toLocaleString("el-GR")} πόντοι</span> <span className="font-medium text-muted-foreground">μετά την έγκριση</span></> : "Η συνδρομή ενεργοποιείται μετά την έγκριση."}</p><p className="mt-1 text-[12px] text-muted-foreground">Αλλαγή πακέτου διαθέσιμη μετά την ολοκλήρωση του αιτήματος.</p></div></CardContent></Card>
      <Card className="rounded-[22px] border-border bg-card shadow-none"><CardContent className="p-5"><h2 className="pb-3 text-[15px] font-extrabold">Ξεκλειδώνουν μετά την έγκριση</h2><LockedFeature icon={Dumbbell} title="Πρόγραμμα" description="Το προσωπικό σου πρόγραμμα" /><LockedFeature icon={MapPin} title="Διατροφή" description="Πλάνο & λίστα για ψώνια" /><LockedFeature icon={CreditCard} title="Progress" description="Μετρήσεις & φωτογραφίες" /><LockedFeature icon={MessageCircle} title="Μηνύματα" description="Απευθείας με τον coach" />{pointsReward > 0 && <LockedFeature icon={Star} title="Πόντοι & Rewards" description={`+${pointsReward.toLocaleString("el-GR")} πόντοι μετά την έγκριση`} />}</CardContent></Card>
      {supportEmail && <Card className="rounded-[22px] border-border bg-card shadow-none"><CardContent className="space-y-3 p-5"><h2 className="text-[15px] font-extrabold">Χρειάζεσαι βοήθεια;</h2><a className="flex items-center gap-2.5 text-[13px] font-bold hover:underline" href={`mailto:${supportEmail}`}><Mail className="h-4 w-4" />{supportEmail}</a></CardContent></Card>}
    </aside>
    <DepositProofDialog open={proofDialogOpen} onOpenChange={setProofDialogOpen} planName={subscription?.plan_name || payment?.planName || "Πλάνο"} amount={amount} reference={reference} onComplete={async () => { const data = await api.get<{ payments: Payment[] }>("/client/payments"); setPayment(data.payments?.find((item) => item.status === "pending") || data.payments?.[0] || null); }} />
  </div></ClientShell>;
}

export default function ClientPendingPage() { return <ProtectedRoute allow="client-pending"><ClientPendingContent /></ProtectedRoute>; }
