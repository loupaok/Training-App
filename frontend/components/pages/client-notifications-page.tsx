"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { ClientShell } from "@/components/shell/client-shell";
import { clearUnreadNotifications } from "@/lib/notification-count";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { buildClientNotifications, type ClientNotificationsResponse } from "@/lib/client-notifications";

function ClientNotificationsContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ClientNotificationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    clearUnreadNotifications()
      .catch(() => {})
      .then(() => api.get<ClientNotificationsResponse>("/clients/me/notifications"))
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι ειδοποιήσεις."))
      .finally(() => setLoading(false));
  }, []);

  const notifications = useMemo(() => buildClientNotifications(data), [data]);
  const paymentApproved = Boolean(data?.paymentApproved);

  return (
    <ClientShell
      title="Ειδοποιήσεις"
      user={user}
      logout={logout}
      paymentApproved={paymentApproved}
      unreadNotifications={data?.unreadNotifications || 0}
      active="notifications"
    >
      <div className="mb-7">
        <h2 className="text-3xl font-extrabold">Ειδοποιήσεις</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">Ενημερώσεις που αφορούν μόνο τον δικό σου λογαριασμό.</p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{error}</div>
      )}
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Φόρτωση...</div>
      )}

      {!loading && (
        <Card className="gap-0 overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="text-lg font-black">Οι ενημερώσεις σου</h3>
          </div>
          <div className="divide-y divide-slate-200">
            {notifications.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="flex items-start gap-4 px-6 py-5">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-950">{item.title}</div>
                    <div className="mt-1 text-sm font-semibold leading-6 text-slate-500">{item.body}</div>
                    <div className="mt-2 text-xs font-bold text-slate-400">{item.date}</div>
                  </div>
                  {item.href && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 font-black text-slate-600 hover:border-red-200 hover:text-red-600"
                      nativeButton={false}
                      render={<Link href={item.href}>Προβολή</Link>}
                    />
                  )}
                </div>
              );
            })}
            {!notifications.length && (
              <div className="px-6 py-12 text-center font-bold text-slate-500">Δεν υπάρχουν ειδοποιήσεις ακόμα.</div>
            )}
          </div>
        </Card>
      )}
    </ClientShell>
  );
}

export default function ClientNotificationsPage() {
  return (
    <ProtectedRoute>
      <ClientNotificationsContent />
    </ProtectedRoute>
  );
}
