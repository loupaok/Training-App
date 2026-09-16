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
import { ClientShell } from "@/components/shell/client-shell";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ChangelogEntry {
  id: number | string;
  title: string;
  body?: string;
  created_at: string;
  created_by_name?: string;
}

interface ClientDashboardPeek {
  paymentApproved?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("el-GR");
}

function ChangelogContent() {
  const { user, logout } = useAuth();
  const isClient = user?.role === "client";
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const data = await api.get<ChangelogEntry[]>("/changelog");
      setEntries(data);
    } catch (err) {
      setError(getErrorMessage(err, "Δεν φορτώθηκαν οι αλλαγές."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    if (isClient) {
      api
        .get<ClientDashboardPeek>("/client-dashboard")
        .then((data) => setPaymentApproved(Boolean(data.paymentApproved)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await api.post("/changelog", { title, body });
      setTitle("");
      setBody("");
      setOpen(false);
      fetchEntries();
    } catch (err) {
      setError(getErrorMessage(err, "Δεν προστέθηκε η καταχώρηση."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number | string) => {
    try {
      await api.delete(`/changelog/${id}`);
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (err) {
      setError(getErrorMessage(err, "Δεν διαγράφηκε η καταχώρηση."));
    }
  };

  const content = (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-slate-50">Αλλαγές & Νέα</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Ό,τι νέο προσθέτουμε στην εφαρμογή.
          </p>
        </div>
        {user?.role === "admin" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button>Νέα Καταχώρηση</Button>} />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Νέα Καταχώρηση</DialogTitle>
                <DialogDescription>Ορατή σε όλους τους χρήστες, χωρίς να στέλνεται ειδοποίηση.</DialogDescription>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="changelog-title">Τίτλος</Label>
                  <Input id="changelog-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="changelog-body">Περιγραφή</Label>
                  <Textarea id="changelog-body" value={body} onChange={(event) => setBody(event.target.value)} rows={4} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Αποθήκευση..." : "Προσθήκη"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν υπάρχουν καταχωρήσεις ακόμα.</p>
        )}
        {entries.map((entry) => (
          <Card key={entry.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{entry.title}</CardTitle>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(entry.created_at)}</p>
              </div>
              {user?.role === "admin" && (
                <Button variant="ghost" size="icon-sm" onClick={() => remove(entry.id)} aria-label="Διαγραφή">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            {entry.body && <CardContent className="text-sm text-slate-600 dark:text-slate-400">{entry.body}</CardContent>}
          </Card>
        ))}
      </div>
    </>
  );

  if (isClient) {
    return (
      <ClientShell title="Αλλαγές & Νέα" user={user} logout={logout} paymentApproved={paymentApproved} active="changelog">
        {content}
      </ClientShell>
    );
  }

  return (
    <CoachShell title="Αλλαγές & Νέα" user={user} logout={logout}>
      {content}
    </CoachShell>
  );
}

export default function ChangelogPage() {
  return (
    <ProtectedRoute>
      <ChangelogContent />
    </ProtectedRoute>
  );
}
