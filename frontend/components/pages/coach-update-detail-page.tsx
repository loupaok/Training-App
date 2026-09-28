"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, FileText, ImageIcon, Star, Weight, X } from "lucide-react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { getInitials, resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type UpdateAnswer = { question_id: number; answer: string; question: string; type: string; standard_key: string | null };
type UpdateFile = { file_url: string; file_type: "photo" | "pdf"; original_name: string };
type WeeklyUpdate = { id: number; client_id: number; submitted_at: string; week_start: string; is_read: 0 | 1; client_name: string; client_email: string; client_photo: string | null; answers: UpdateAnswer[]; files: UpdateFile[] };

function formatDate(value: string) { return new Intl.DateTimeFormat("el-GR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function parseAnswer(answer: UpdateAnswer) { if (answer.type !== "multi_select") return answer.answer || "-"; try { const value = JSON.parse(answer.answer || "[]"); return Array.isArray(value) ? value.join(", ") : String(value); } catch { return answer.answer || "-"; } }
function Rating({ value }: { value: string }) { const numeric = Math.max(0, Math.min(5, Number(value) || 0)); return <span className="inline-flex gap-0.5">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={cn("h-4 w-4", index < numeric ? "fill-primary text-primary" : "text-muted-foreground/30")} />)}</span>; }

function CoachUpdateDetailContent({ updateId }: { updateId: string }) {
  const { user, logout } = useAuth();
  const [update, setUpdate] = useState<WeeklyUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get<WeeklyUpdate>(`/updates/${updateId}`).then(async (response) => {
      if (!active) return;
      setUpdate(response);
      if (!response.is_read) {
        setUpdate((current) => current ? { ...current, is_read: 1 } : current);
        try {
          await api.put(`/updates/${response.id}/read`, { isRead: true });
          window.dispatchEvent(new Event("coach-updates-read"));
        } catch { /* visual state is still correct */ }
      }
    }).catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Δεν βρέθηκε το update."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [updateId]);

  const photos = update?.files.filter((file) => file.file_type === "photo") || [];
  const documents = update?.files.filter((file) => file.file_type === "pdf") || [];
  const weight = update?.answers.find((answer) => answer.standard_key === "weight_kg")?.answer;
  const visibleAnswers = update?.answers.filter((answer) => answer.standard_key !== "weight_kg") || [];

  return <CoachShell title="Update πελάτη" user={user} logout={logout}>
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Button nativeButton={false} render={<Link href="/coach/updates" />} variant="ghost" className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4" />Πίσω στα Updates</Button>
      {loading && <div className="space-y-4"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>}
      {error && <Card className="border-destructive/30"><CardContent className="p-5 text-destructive">{error}</CardContent></Card>}
      {update && <>
        <Card><CardContent className="flex flex-wrap items-center gap-5 p-6"><UserAvatar initials={getInitials(update.client_name || update.client_email)} photoUrl={update.client_photo ? resolveMediaUrl(update.client_photo) : undefined} size="h-14 w-14" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{update.client_name || update.client_email}</h1><Badge variant="secondary">Εβδομαδιαίο update</Badge></div><p className="mt-1 text-sm text-muted-foreground">Υποβλήθηκε {formatDate(update.submitted_at)}</p></div><Button nativeButton={false} render={<Link href={`/clients/${update.client_id}`} />} variant="outline">Άνοιγμα πελάτη</Button></CardContent></Card>
        <section className="max-w-xs"><Metric label="Βάρος" value={weight ? `${weight} kg` : "-"} icon={Weight} /></section>
        <Card><CardHeader><CardTitle className="text-lg">Απαντήσεις</CardTitle></CardHeader><CardContent className="space-y-5">{visibleAnswers.map((answer) => <section key={answer.question_id} className="border-b pb-5 last:border-0 last:pb-0"><p className="text-sm font-medium text-muted-foreground">{answer.question}</p>{answer.type === "rating" ? <div className="mt-2"><Rating value={answer.answer} /></div> : <p className="mt-2 whitespace-pre-wrap leading-7">{parseAnswer(answer)}</p>}</section>)}</CardContent></Card>
        {(photos.length > 0 || documents.length > 0) && <Card><CardHeader><CardTitle className="text-lg">Επισυνάψεις</CardTitle></CardHeader><CardContent className="space-y-5">{photos.length > 0 && <div><div className="mb-3 flex items-center gap-2 text-sm font-medium"><ImageIcon className="h-4 w-4" />Φωτογραφίες</div><UpdatePhotoGallery files={photos} /></div>}{documents.length > 0 && <div className="space-y-2">{documents.map((file) => <a key={file.file_url} href={resolveMediaUrl(file.file_url)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border p-3 font-medium transition-colors hover:bg-muted"><FileText className="h-5 w-5 text-muted-foreground" />{file.original_name || "PDF"}</a>)}</div>}</CardContent></Card>}
      </>}
    </main>
  </CoachShell>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Weight }) { return <Card><CardContent className="flex items-center gap-3 p-4"><span className="grid h-9 w-9 place-items-center rounded-md bg-muted"><Icon className="h-4 w-4" /></span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div></CardContent></Card>; }

function UpdatePhotoGallery({ files }: { files: UpdateFile[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? null : files[selectedIndex];

  useEffect(() => {
    if (selectedIndex === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") setSelectedIndex((index) => index === null ? null : (index - 1 + files.length) % files.length);
      if (event.key === "ArrowRight") setSelectedIndex((index) => index === null ? null : (index + 1) % files.length);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [files.length, selectedIndex]);

  const previous = () => setSelectedIndex((index) => index === null ? null : (index - 1 + files.length) % files.length);
  const next = () => setSelectedIndex((index) => index === null ? null : (index + 1) % files.length);

  return <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((file, index) => <button key={file.file_url} type="button" onClick={() => setSelectedIndex(index)} className="overflow-hidden rounded-lg border transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><img src={resolveMediaUrl(file.file_url)} alt={file.original_name || "Φωτογραφία update"} className="aspect-square w-full object-cover" decoding="async" /></button>)}</div>{selected && <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-center justify-center bg-black/95 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label="Προβολή φωτογραφιών update"><button type="button" onClick={() => setSelectedIndex(null)} aria-label="Κλείσιμο" className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><X className="h-5 w-5" /></button>{files.length > 1 && <button type="button" onClick={previous} aria-label="Προηγούμενη φωτογραφία" className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:left-6"><ChevronLeft className="h-6 w-6" /></button>}<img src={resolveMediaUrl(selected.file_url)} alt={selected.original_name || "Φωτογραφία update"} className="max-h-full max-w-full object-contain" decoding="async" />{files.length > 1 && <button type="button" onClick={next} aria-label="Επόμενη φωτογραφία" className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25 sm:right-6"><ChevronRight className="h-6 w-6" /></button>}{files.length > 1 && <div className="absolute bottom-5 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">{selectedIndex! + 1} / {files.length}</div>}</div>}</>;
}
export default function CoachUpdateDetailPage({ updateId }: { updateId: string }) { return <ProtectedRoute><CoachUpdateDetailContent updateId={updateId} /></ProtectedRoute>; }
