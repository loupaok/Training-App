"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bell, CheckCircle2, ExternalLink, Loader2, Megaphone, Send, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

type Audience = "all_active" | "active_clients" | "coaches" | "selected_clients";
type Recipient = { id: number; full_name?: string | null; email: string };
type ManualNotification = { id: number; title: string; body: string; audience: Audience; recipient_count: number; link_url?: string | null; created_at: string; created_by_name?: string | null };
type HistoryResponse = { items: ManualNotification[]; page: number; totalPages: number; total: number };

const audienceOptions: { value: Audience; label: string; description: string }[] = [
  { value: "active_clients", label: "Ενεργοί πελάτες", description: "Πελάτες με ενεργή συνδρομή" },
  { value: "selected_clients", label: "Επιλεγμένοι πελάτες", description: "Διάλεξε συγκεκριμένους πελάτες" },
  { value: "coaches", label: "Ομάδα Coach", description: "Coach, admin και moderator" },
];

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("el-GR", { dateStyle: "medium", timeStyle: "short" });
}

function audienceLabel(audience: Audience) {
  return audienceOptions.find((option) => option.value === audience)?.label || "Παραλήπτες";
}

function ManualNotificationsContent() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<ManualNotification[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [audience, setAudience] = useState<Audience>("active_clients");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ManualNotification | null>(null);

  const selectedAudience = audienceOptions.find((option) => option.value === audience)!;
  const sentTotal = useMemo(() => items.reduce((total, item) => total + Number(item.recipient_count || 0), 0), [items]);

  const load = async (nextPage = 1, append = false) => {
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const history = await api.get<HistoryResponse>(`/manual-notifications?page=${nextPage}&limit=20`);
      setItems((current) => append ? [...current, ...history.items] : history.items);
      setPage(history.page);
      setTotalPages(history.totalPages);
      if (!append) setRecipients(await api.get<Recipient[]>("/manual-notifications/recipients"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν ήταν δυνατή η φόρτωση των ανακοινώσεων.");
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (audience === "selected_clients" && selectedIds.length === 0) {
      setError("Επίλεξε τουλάχιστον έναν πελάτη.");
      return;
    }
    setSaving(true);
    try {
      const result = await api.post<{ recipientCount: number }>("/manual-notifications", { title, body, audience, recipientIds: selectedIds, linkUrl });
      setSuccess(`Η ανακοίνωση στάλθηκε σε ${result.recipientCount} παραλήπτες.`);
      setTitle(""); setBody(""); setLinkUrl(""); setSelectedIds([]);
      await load(1);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν στάλθηκε η ανακοίνωση.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/manual-notifications/${deleteTarget.id}`);
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Δεν διαγράφηκε η ανακοίνωση.");
    }
  };

  if (user?.role !== "admin") return <div className="grid min-h-screen place-items-center bg-muted/30"><p className="text-sm text-muted-foreground">Δεν έχεις δικαίωμα πρόσβασης.</p></div>;

  return <CoachShell title="Ανακοινώσεις" user={user} logout={logout}>
    <main className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><Megaphone className="h-5 w-5" /></div><h1 className="text-2xl font-bold">Ανακοινώσεις</h1><p className="mt-1 text-sm text-muted-foreground">Στείλε ενημέρωση στη σωστή ομάδα και κράτησε ιστορικό των αποστολών.</p></div>
        <div className="flex gap-3"><Metric icon={Bell} label="Αποστολές" value={items.length} /><Metric icon={Users} label="Παραδόσεις" value={sentTotal} /></div>
      </header>
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
      {success && <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card><CardHeader><CardTitle>Νέα ανακοίνωση</CardTitle><CardDescription>Θα εμφανιστεί στο Notification Center και θα σταλεί push όπου είναι ενεργό.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Παραλήπτες"><Select value={audience} onValueChange={(value) => setAudience((value || "active_clients") as Audience)}><SelectTrigger><SelectValue>{selectedAudience.label}</SelectValue></SelectTrigger><SelectContent>{audienceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">{selectedAudience.description}</p></Field>
            <Field label="Σύνδεσμος ενέργειας" hint="Προαιρετικό. Αν μείνει κενό, είναι απλή ανακοίνωση."><Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="/client-billing ή https://..." /></Field>
          </div>
          {audience === "selected_clients" && <div className="rounded-lg border"><div className="flex items-center justify-between border-b px-3 py-2.5"><p className="text-sm font-medium">Επιλεγμένοι πελάτες</p><span className="text-xs text-muted-foreground">{selectedIds.length} επιλέχθηκαν</span></div><div className="max-h-52 overflow-y-auto p-2">{recipients.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60"><Checkbox checked={selectedIds.includes(recipient.id)} onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...new Set([...current, recipient.id])] : current.filter((id) => id !== recipient.id))} /><span className="min-w-0"><span className="block truncate text-sm font-medium">{recipient.full_name || recipient.email}</span><span className="block truncate text-xs text-muted-foreground">{recipient.email}</span></span></label>)}</div></div>}
          <Field label="Τίτλος"><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} placeholder="π.χ. Νέο πρόγραμμα αυτή την εβδομάδα" required /></Field>
          <Field label="Μήνυμα"><Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} maxLength={4000} placeholder="Γράψε με σαφήνεια την ενημέρωση που θέλεις να λάβουν." required /><p className="text-right text-xs text-muted-foreground">{body.length}/4000</p></Field>
          <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Αποστολή ανακοίνωσης</Button></div>
        </form></CardContent></Card>
        <Card className="h-fit"><CardHeader><CardTitle className="text-lg">Προεπισκόπηση</CardTitle><CardDescription>Έτσι θα φαίνεται η ειδοποίηση.</CardDescription></CardHeader><CardContent><div className="rounded-lg border bg-muted/20 p-4"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span><div className="min-w-0"><p className="font-semibold">{title || "Τίτλος ανακοίνωσης"}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body || "Το μήνυμα της ανακοίνωσης θα εμφανίζεται εδώ."}</p><p className="mt-3 text-xs text-muted-foreground">Από: {user?.fullName || "Διαχειριστής"} · τώρα</p>{linkUrl && <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary"><ExternalLink className="h-3.5 w-3.5" />Περιέχει σύνδεσμο</span>}</div></div></div></CardContent></Card>
      </div>

      <Card><CardHeader><CardTitle>Ιστορικό ανακοινώσεων</CardTitle><CardDescription>Η διαγραφή αποσύρει την ανακοίνωση και από τα Notification Centers των παραληπτών.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Φόρτωση...</div> : items.length ? <><div className="divide-y">{items.map((item) => <div key={item.id} className="flex gap-4 px-5 py-4 sm:px-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted"><Megaphone className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{audienceLabel(item.audience)}</span></div><p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(item.created_at)} · από {item.created_by_name || "Διαχειριστή"} · {item.recipient_count} παραλήπτες</p></div><Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(item)} aria-label="Διαγραφή ανακοίνωσης"><Trash2 className="h-4 w-4" /></Button></div>)}</div>{page < totalPages && <div className="flex justify-center border-t p-4"><Button variant="outline" onClick={() => void load(page + 1, true)} disabled={loadingMore}>{loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Δείτε περισσότερα</Button></div>}</> : <div className="p-12 text-center text-sm text-muted-foreground">Δεν έχουν σταλεί ανακοινώσεις ακόμα.</div>}</CardContent></Card>
    </main>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Διαγραφή ανακοίνωσης;</AlertDialogTitle><AlertDialogDescription>Θα αφαιρεθεί και από τα Notification Centers των παραληπτών. Η ενέργεια δεν αναιρείται.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Ακύρωση</AlertDialogCancel><AlertDialogAction onClick={() => void remove()}>Διαγραφή</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </CoachShell>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>; }
function Metric({ icon: Icon, label, value }: { icon: typeof Bell; label: string; value: number }) { return <div className="flex min-w-24 items-center gap-2 rounded-lg border bg-card px-3 py-2"><Icon className="h-4 w-4 text-muted-foreground" /><span><span className="block text-lg font-bold leading-none">{value}</span><span className="text-[11px] text-muted-foreground">{label}</span></span></div>; }

export default function ManualNotificationsPage() { return <ProtectedRoute><ManualNotificationsContent /></ProtectedRoute>; }
