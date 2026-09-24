"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, AlertTriangle, Check, ChevronDown } from "lucide-react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { resolveMediaUrl, getInitials } from "@/lib/media";
import { cn } from "@/lib/utils";

interface UpdateAnswer {
  update_id: number;
  question_id: number;
  answer: string;
  question: string;
  type: string;
  standard_key: string | null;
}

interface UpdateFile {
  update_id: number;
  question_id: number | null;
  file_url: string;
  file_type: "photo" | "pdf";
  original_name: string;
}

interface WeeklyUpdate {
  id: number;
  client_id: number;
  submitted_at: string;
  week_start: string;
  is_read: 0 | 1;
  client_name: string;
  client_email: string;
  client_photo: string | null;
  answers: UpdateAnswer[];
  files: UpdateFile[];
}

interface PendingClient {
  id: number;
  fullName: string;
  email: string;
  dayOfWeek: number;
}

interface StatsResponse {
  totalUnread: number;
  pendingClients: PendingClient[];
}

const dayLabels = ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Σάββατο"];

function getCurrentWeekStart(): string {
  const current = new Date();
  const day = current.getDay();
  const diff = current.getDate() - day + (day === 0 ? -6 : 1);
  current.setDate(diff);
  const year = current.getFullYear();
  const month = String(current.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(current.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("el-GR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

function extractQuickStats(answers: UpdateAnswer[]) {
  const weight = answers.find((a) => a.standard_key === "weight_kg")?.answer;
  // Match on the word stem, not the exact word — Greek question text inflects
  // (e.g. "προπόνηση" vs "προπονήσεις") depending on how the coach phrases it.
  const trainingRating = answers.find((a) => a.type === "rating" && a.question.includes("προπον"))?.answer;
  const nutritionRating = answers.find((a) => a.type === "rating" && a.question.includes("διατροφ"))?.answer;
  const generalRating = answers.find(
    (a) => a.type === "rating" && !a.question.includes("προπον") && !a.question.includes("διατροφ"),
  )?.answer;
  const notes = answers.find((a) => a.type === "textarea")?.answer || "";
  const notesPreview = notes.length > 100 ? `${notes.slice(0, 100)}…` : notes;
  return { weight, trainingRating, nutritionRating, generalRating, notesPreview };
}

function CoachUpdatesContent() {
  const { user, logout } = useAuth();

  const [updates, setUpdates] = useState<WeeklyUpdate[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stats, setStats] = useState<StatsResponse>({ totalUnread: 0, pendingClients: [] });
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [thisWeekOnly, setThisWeekOnly] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(true);

  useEffect(() => {
    api
      .get<StatsResponse>("/updates/stats")
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadPage = async (targetPage: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLoadError("");
    try {
      const query = new URLSearchParams({ page: String(targetPage), limit: "20" });
      if (filter === "unread") query.set("unreadOnly", "true");
      const data = await api.get<{ updates: WeeklyUpdate[]; page: number; totalPages: number }>(`/updates?${query.toString()}`);
      setUpdates((current) => (append ? [...current, ...data.updates] : data.updates));
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Δεν φορτώθηκαν τα updates.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const markAsRead = async (id: number) => {
    setUpdates((current) => current.map((item) => (item.id === id ? { ...item, is_read: 1 } : item)));
    setStats((current) => ({ ...current, totalUnread: Math.max(0, current.totalUnread - 1) }));
    try {
      await api.put(`/updates/${id}/read`, { isRead: true });
    } catch {
      // Best-effort — the UI already reflects the change optimistically.
    }
  };

  const visibleUpdates = useMemo(() => {
    const currentWeekStart = getCurrentWeekStart();
    return updates.filter((item) => {
      if (search.trim() && !item.client_name?.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (thisWeekOnly && item.week_start !== currentWeekStart) return false;
      return true;
    });
  }, [updates, search, thisWeekOnly]);

  if (!["coach", "admin"].includes(user?.role || "")) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 font-bold text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Δεν έχεις πρόσβαση σε αυτή τη σελίδα.
      </div>
    );
  }

  return (
    <CoachShell title="Updates" user={user} logout={logout}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-3xl font-bold">Εβδομαδιαία Updates</h2>
        {stats.totalUnread > 0 && (
          <Badge className="h-auto rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-600">
            {stats.totalUnread} αδιάβαστα
          </Badge>
        )}
      </div>

      {stats.pendingClients.length > 0 && (
        <Collapsible open={pendingOpen} onOpenChange={setPendingOpen} className="mb-6">
          <Card className="border-amber-200 bg-amber-50 p-0 dark:border-amber-900 dark:bg-amber-950/30">
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-left">
              <div>
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Εκκρεμή Updates ({stats.pendingClients.length} πελάτες)
                </div>
                <p className="mt-1 text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Δεν έχουν στείλει update αυτή την εβδομάδα
                </p>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-amber-700 transition-transform dark:text-amber-400", pendingOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 px-5 pb-5">
                {stats.pendingClients.map((client) => (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}`}
                    className="flex items-center gap-3 rounded-lg bg-white/60 px-3 py-2 hover:bg-white dark:bg-black/10 dark:hover:bg-black/20"
                  >
                    <UserAvatar initials={getInitials(client.fullName || client.email)} size="h-8 w-8" />
                    <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      {client.fullName || client.email} · Update day: {dayLabels[client.dayOfWeek] ?? "-"}
                    </div>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(value) => value && setFilter(value as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">Όλα</TabsTrigger>
            <TabsTrigger value="unread">Αδιάβαστα</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Αναζήτηση πελάτη..."
          className="h-9 w-56"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <Switch checked={thisWeekOnly} onCheckedChange={(checked) => setThisWeekOnly(checked === true)} />
          Αυτή την εβδομάδα
        </label>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {loadError}
        </div>
      )}

      {loading ? (
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>
      ) : !visibleUpdates.length ? (
        <div className="grid place-items-center gap-3 rounded-lg border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="font-semibold text-muted-foreground">Δεν υπάρχουν updates ακόμα</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleUpdates.map((item) => {
            const { weight, trainingRating, nutritionRating, generalRating, notesPreview } = extractQuickStats(item.answers);
            const photos = item.files.filter((file) => file.file_type === "photo");
            const hasStats = weight || trainingRating || nutritionRating || generalRating;

            return (
              <Card key={item.id} className={cn("p-5", !item.is_read && "border-primary/30 bg-primary/5")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      initials={getInitials(item.client_name || item.client_email)}
                      photoUrl={item.client_photo ? resolveMediaUrl(item.client_photo) : undefined}
                    />
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-50">{item.client_name || item.client_email}</div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(item.submitted_at)}</div>
                    </div>
                  </div>
                  {!item.is_read && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Αδιάβαστο
                    </span>
                  )}
                </div>

                {hasStats && (
                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {weight && <span>⚖️ {weight}kg</span>}
                    {generalRating && <span>⭐ {generalRating}/5</span>}
                    {trainingRating && <span>🏋️⭐{trainingRating}/5</span>}
                    {nutritionRating && <span>🥗⭐{nutritionRating}/5</span>}
                  </div>
                )}

                {notesPreview && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">&ldquo;{notesPreview}&rdquo;</p>}

                {photos.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {photos.map((file) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={file.file_url}
                        src={resolveMediaUrl(file.file_url)}
                        alt=""
                        className="h-14 w-14 rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  {!item.is_read && (
                    <Button type="button" variant="outline" size="sm" onClick={() => markAsRead(item.id)} className="gap-1.5 font-bold">
                      <Check className="h-3.5 w-3.5" />
                      Σημείωσε ως διαβασμένο
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/clients/${item.client_id}`} />}
                    className="gap-1.5 font-bold"
                  >
                    Δες πελάτη →
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && page < totalPages && (
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" onClick={() => loadPage(page + 1, true)} disabled={loadingMore} className="h-11 px-6 font-bold">
            {loadingMore ? "Φόρτωση..." : "Φόρτωση περισσότερων"}
          </Button>
        </div>
      )}
    </CoachShell>
  );
}

export default function CoachUpdatesPage() {
  return (
    <ProtectedRoute>
      <CoachUpdatesContent />
    </ProtectedRoute>
  );
}
