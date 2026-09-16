"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface MessageRow {
  id: number | string;
  sender_role: "coach" | "client";
  body: string;
  created_at?: string;
}

interface DashboardPeek {
  paymentApproved?: boolean;
}

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("el-GR", { dateStyle: "short", timeStyle: "short" });
}

function ClientMessagesContent() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = () => {
    api
      .get<MessageRow[]>("/clients/me/messages")
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMessages();
    api
      .get<DashboardPeek>("/client-dashboard")
      .then((data) => setPaymentApproved(Boolean(data.paymentApproved)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async () => {
    if (!draft.trim()) return;
    setSending(true);
    setError("");
    try {
      await api.post("/clients/me/messages", { message: draft.trim() });
      setDraft("");
      loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν στάλθηκε το μήνυμα.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ClientShell title="Μηνύματα" user={user} logout={logout} paymentApproved={paymentApproved} active="messages">
      <div className="mb-7">
        <h2 className="text-3xl font-extrabold">Μηνύματα</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Ασύγχρονη επικοινωνία με τον coach σου.</p>
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <CardTitle className="text-lg font-black">Συνομιλία</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 space-y-3 overflow-y-auto p-6">
            {loading && <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Φόρτωση...</div>}
            {!loading && !messages.length && (
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Δεν υπάρχουν μηνύματα ακόμα.</div>
            )}
            {messages.map((item) => (
              <div key={item.id} className={`flex ${item.sender_role === "client" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-3 text-sm font-semibold ${
                    item.sender_role === "client"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-50"
                  }`}
                >
                  <div>{item.body}</div>
                  <div className={`mt-1 text-xs font-bold ${item.sender_role === "client" ? "text-red-100" : "text-slate-500 dark:text-slate-400"}`}>
                    {formatDateTime(item.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t border-slate-200 p-6 dark:border-slate-800">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
                {error}
              </div>
            )}
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Γράψε ένα μήνυμα..." className="min-h-20" />
            <div className="flex justify-end">
              <Button type="button" onClick={sendMessage} disabled={sending || !draft.trim()}>
                {sending ? "Αποστολή..." : "Αποστολή"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </ClientShell>
  );
}

export default function ClientMessagesPage() {
  return (
    <ProtectedRoute>
      <ClientMessagesContent />
    </ProtectedRoute>
  );
}
