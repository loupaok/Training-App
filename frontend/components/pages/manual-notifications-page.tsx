"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ManualNotification {
  id: number | string;
  title: string;
  body?: string;
  created_at: string;
  created_by_name?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("el-GR");
}

function ManualNotificationsContent() {
  const { user, logout } = useAuth();
  const [items, setItems] = useState<ManualNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.get<ManualNotification[]>("/manual-notifications");
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν φορτώθηκαν οι ειδοποιήσεις."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api.post("/manual-notifications", { title, body });
      setTitle("");
      setBody("");
      setOpen(false);
      fetchData();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν στάλθηκε η ειδοποίηση."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number | string) => {
    try {
      await api.delete(`/manual-notifications/${id}`);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(getErrorMessage(err, "Δεν διαγράφηκε η ειδοποίηση."));
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Δεν έχεις δικαίωμα πρόσβασης σε αυτή τη σελίδα.</p>
        </div>
      </div>
    );
  }

  return (
    <CoachShell title="Manual Notifications" user={user} logout={logout}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-slate-50">Manual Notifications</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Στείλε ένα μήνυμα σε όλους τους ενεργούς χρήστες της εφαρμογής.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Νέα Ειδοποίηση</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Νέα Ειδοποίηση</DialogTitle>
              <DialogDescription>Θα σταλεί σε όλους τους ενεργούς χρήστες, ανεξαρτήτως ρόλου.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notif-title">Τίτλος</Label>
                <Input id="notif-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notif-body">Μήνυμα</Label>
                <Textarea id="notif-body" value={body} onChange={(event) => setBody(event.target.value)} rows={4} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Αποστολή..." : "Αποστολή"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}
        {!loading && items.length === 0 && (
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν έχουν σταλεί ειδοποιήσεις ακόμα.</p>
        )}
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{item.title}</CardTitle>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {formatDate(item.created_at)} · {item.created_by_name}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(item.id)} aria-label="Διαγραφή">
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            {item.body && <CardContent className="text-sm text-slate-600 dark:text-slate-400">{item.body}</CardContent>}
          </Card>
        ))}
      </div>
    </CoachShell>
  );
}

export default function ManualNotificationsPage() {
  return (
    <ProtectedRoute>
      <ManualNotificationsContent />
    </ProtectedRoute>
  );
}
