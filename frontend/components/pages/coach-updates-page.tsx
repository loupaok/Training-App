"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CheckCircle2, ClipboardList, FileText, ImageIcon, Search, Star, Weight } from "lucide-react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { getInitials, resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface UpdateAnswer { update_id: number; question_id: number; answer: string; question: string; type: string; standard_key: string | null; }
interface UpdateFile { update_id: number; question_id: number | null; file_url: string; file_type: "photo" | "pdf"; original_name: string; }
interface WeeklyUpdate { id: number; client_id: number; submitted_at: string; week_start: string; is_read: 0 | 1; client_name: string; client_email: string; client_photo: string | null; answers: UpdateAnswer[]; files: UpdateFile[]; }
interface PendingClient { id: number; fullName: string; email: string; dayOfWeek: number; }
interface StatsResponse { totalUnread: number; pendingClients: PendingClient[]; }

function weekStart() { const date = new Date(); const day = date.getDay(); date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); return date.toISOString().slice(0, 10); }
function formatDate(value: string) { return new Intl.DateTimeFormat("el-GR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function parseAnswer(answer: UpdateAnswer) { if (answer.type !== "multi_select") return answer.answer || "-"; try { const parsed = JSON.parse(answer.answer || "[]"); return Array.isArray(parsed) ? parsed.join(", ") : String(parsed); } catch { return answer.answer || "-"; } }
function quickStats(answers: UpdateAnswer[]) { return { weight: answers.find((answer) => answer.standard_key === "weight_kg")?.answer, ratings: answers.filter((answer) => answer.type === "rating").slice(0, 3), note: answers.find((answer) => answer.type === "textarea")?.answer }; }

function RatingValue({ value }: { value: string }) { const rating = Math.max(0, Math.min(5, Number(value) || 0)); return <span className="inline-flex gap-0.5" aria-label={`${rating} στα 5`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className={cn("h-3.5 w-3.5", index < rating ? "fill-primary text-primary" : "text-muted-foreground/30")} />)}</span>; }

function CoachUpdatesContent() {
  const { user, logout } = useAuth();
  const [updates, setUpdates] = useState<WeeklyUpdate[]>([]);
  const [stats, setStats] = useState<StatsResponse>({ totalUnread: 0, pendingClients: [] });
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [thisWeekOnly, setThisWeekOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selectedUpdate, setSelectedUpdate] = useState<WeeklyUpdate | null>(null);

  const markAsRead = async (id: number) => {
    const wasUnread = updates.find((update) => update.id === id)?.is_read === 0 || selectedUpdate?.id === id && selectedUpdate.is_read === 0;
    setUpdates((current) => current.map((update) => update.id === id ? { ...update, is_read: 1 } : update));
    setSelectedUpdate((current) => current?.id === id ? { ...current, is_read: 1 } : current);
    if (wasUnread) setStats((current) => ({ ...current, totalUnread: Math.max(0, current.totalUnread - 1) }));
    try {
      await api.put(`/updates/${id}/read`, { isRead: true });
      window.dispatchEvent(new Event("coach-updates-read"));
    } catch { /* Optimistic UI is enough here. */ }
  };

  const loadPage = async (targetPage: number, append = false) => {
    append ? setLoadingMore(true) : setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ page: String(targetPage), limit: "20" });
      if (filter === "unread") query.set("unreadOnly", "true");
      const response = await api.get<{ updates: WeeklyUpdate[]; page: number; totalPages: number; total: number }>(`/updates?${query}`);
      setUpdates((current) => append ? [...current, ...response.updates] : response.updates);
      setPage(response.page); setTotalPages(response.totalPages); setTotal(response.total);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Δεν φορτώθηκαν τα updates."); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  useEffect(() => { api.get<StatsResponse>("/updates/stats").then(setStats).catch(() => {}); }, []);
  useEffect(() => { void loadPage(1); }, [filter]);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    if (!id) return;
    api.get<WeeklyUpdate>(`/updates/${id}`).then((item) => {
      setUpdates((current) => current.some((update) => update.id === item.id) ? current : [item, ...current]);
      setSelectedUpdate(item);
      if (!item.is_read) void markAsRead(item.id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleUpdates = useMemo(() => updates.filter((item) => {
    const matchesSearch = !search.trim() || `${item.client_name} ${item.client_email}`.toLocaleLowerCase("el-GR").includes(search.trim().toLocaleLowerCase("el-GR"));
    return matchesSearch && (!thisWeekOnly || item.week_start === weekStart());
  }), [updates, search, thisWeekOnly]);
  const thisWeekCount = updates.filter((item) => item.week_start === weekStart()).length;

  return <CoachShell title="Updates" user={user} logout={logout}>
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-bold">Εβδομαδιαία Updates</h1><p className="mt-1 text-sm text-muted-foreground">Δες τι χρειάζεται προσοχή και άνοιξε κάθε αναφορά για λεπτομέρειες.</p></div>{stats.totalUnread > 0 && <Badge className="h-auto rounded-full px-3 py-1">{stats.totalUnread} αδιάβαστα</Badge>}</header>
      <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Αδιάβαστα" value={String(stats.totalUnread)} icon={ClipboardList} /><StatCard label="Αυτή την εβδομάδα" value={String(thisWeekCount)} icon={CheckCircle2} /><StatCard label="Αναμένονται" value={String(stats.pendingClients.length)} icon={AlertTriangle} /></div>
      {stats.pendingClients.length > 0 && <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20"><CardContent className="flex flex-wrap items-center gap-3 p-4"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" /><p className="mr-auto text-sm font-medium">{stats.pendingClients.length} πελάτες δεν έχουν στείλει update αυτή την εβδομάδα.</p><div className="flex flex-wrap gap-2">{stats.pendingClients.slice(0, 4).map((client) => <Button key={client.id} nativeButton={false} render={<Link href={`/clients/${client.id}`} />} size="sm" variant="outline" className="bg-background">{client.fullName || client.email}</Button>)}</div></CardContent></Card>}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4"><Tabs value={filter} onValueChange={(value) => setFilter(value as "all" | "unread")}><TabsList><TabsTrigger value="all">Όλα</TabsTrigger><TabsTrigger value="unread">Αδιάβαστα</TabsTrigger></TabsList></Tabs><div className="relative min-w-52 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Αναζήτηση πελάτη" className="h-9 pl-9" /></div><label className="flex items-center gap-2 text-sm font-medium"><Switch checked={thisWeekOnly} onCheckedChange={(checked) => setThisWeekOnly(checked === true)} />Αυτή την εβδομάδα</label></div>
      {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {loading ? <UpdatesLoading /> : visibleUpdates.length ? <div className="divide-y rounded-lg border bg-card">{visibleUpdates.map((item) => <UpdateRow key={item.id} item={item} onOpen={() => window.location.assign(`/coach/updates/${item.id}`)} />)}</div> : <EmptyUpdates />}
      {!loading && page < totalPages && <div className="flex justify-center"><Button variant="outline" onClick={() => void loadPage(page + 1, true)} disabled={loadingMore}>{loadingMore ? "Φόρτωση..." : "Δείτε περισσότερα"}</Button></div>}
      {!loading && total > 0 && <p className="text-center text-xs text-muted-foreground">{total} updates συνολικά</p>}
    </div>
    <Sheet open={Boolean(selectedUpdate)} onOpenChange={(open) => !open && setSelectedUpdate(null)}><SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">{selectedUpdate && <UpdateDetails item={selectedUpdate} onMarkRead={() => void markAsRead(selectedUpdate.id)} />}</SheetContent></Sheet>
  </CoachShell>;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof ClipboardList }) { return <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><Icon className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-2xl font-bold tabular-nums">{value}</p></div></CardContent></Card>; }
function UpdateRow({ item, onOpen }: { item: WeeklyUpdate; onOpen: () => void }) { const { weight, ratings, note } = quickStats(item.answers); const photos = item.files.filter((file) => file.file_type === "photo"); return <button type="button" onClick={onOpen} className={cn("flex w-full flex-wrap items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-muted/50 sm:flex-nowrap sm:px-5", !item.is_read && "bg-primary/[0.035]")}><UserAvatar initials={getInitials(item.client_name || item.client_email)} photoUrl={item.client_photo ? resolveMediaUrl(item.client_photo) : undefined} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-semibold">{item.client_name || item.client_email}</p>{!item.is_read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Αδιάβαστο" />}</div><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(item.submitted_at)}</p>{note && <p className="mt-1 truncate text-sm text-muted-foreground">{note}</p>}</div><div className="flex items-center gap-3 text-sm"><div className="hidden items-center gap-1 sm:flex">{weight && <><Weight className="h-4 w-4 text-muted-foreground" />{weight} kg</>}</div>{ratings[0] && <RatingValue value={ratings[0].answer} />}{photos.length > 0 && <span className="flex items-center gap-1 text-muted-foreground"><ImageIcon className="h-4 w-4" />{photos.length}</span>}</div></button>; }
function UpdateDetails({ item, onMarkRead }: { item: WeeklyUpdate; onMarkRead: () => void }) { const photos = item.files.filter((file) => file.file_type === "photo"); const documents = item.files.filter((file) => file.file_type === "pdf"); return <><SheetHeader className="border-b pr-14"><div className="flex items-center gap-3"><UserAvatar initials={getInitials(item.client_name || item.client_email)} photoUrl={item.client_photo ? resolveMediaUrl(item.client_photo) : undefined} /><div><SheetTitle>{item.client_name || item.client_email}</SheetTitle><SheetDescription>{formatDate(item.submitted_at)}</SheetDescription></div></div></SheetHeader><div className="space-y-6 p-4">{!item.is_read && <Button variant="outline" size="sm" onClick={onMarkRead}><Check className="mr-2 h-4 w-4" />Σημείωση ως διαβασμένο</Button>}<div className="space-y-4">{item.answers.map((answer) => <div key={answer.question_id} className="border-b pb-4 last:border-0"><p className="text-sm font-medium text-muted-foreground">{answer.question}</p>{answer.type === "rating" ? <div className="mt-2"><RatingValue value={answer.answer} /></div> : <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{parseAnswer(answer)}</p>}</div>)}</div>{photos.length > 0 && <section><h3 className="mb-3 text-sm font-semibold">Φωτογραφίες</h3><div className="grid grid-cols-3 gap-2">{photos.map((file) => <a key={file.file_url} href={resolveMediaUrl(file.file_url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border"><img src={resolveMediaUrl(file.file_url)} alt={file.original_name || "Φωτογραφία update"} className="aspect-square w-full object-cover" /></a>)}</div></section>}{documents.length > 0 && <section className="space-y-2"><h3 className="text-sm font-semibold">Αρχεία</h3>{documents.map((file) => <a key={file.file_url} href={resolveMediaUrl(file.file_url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:bg-muted"><FileText className="h-4 w-4" />{file.original_name || "PDF"}</a>)}</section>}<Button nativeButton={false} render={<Link href={`/clients/${item.client_id}`} />} variant="outline" className="w-full">Άνοιγμα καρτέλας πελάτη</Button></div></>; }
function UpdatesLoading() { return <div className="space-y-2 rounded-lg border p-4">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>; }
function EmptyUpdates() { return <div className="grid min-h-64 place-items-center rounded-lg border border-dashed text-center"><div><ClipboardList className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">Δεν υπάρχουν updates για προβολή</p><p className="mt-1 text-sm text-muted-foreground">Τα νέα check-ins των πελατών θα εμφανιστούν εδώ.</p></div></div>; }
export default function CoachUpdatesPage() { return <ProtectedRoute><CoachUpdatesContent /></ProtectedRoute>; }
