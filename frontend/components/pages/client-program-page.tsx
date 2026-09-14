"use client";

import { useEffect, useState } from "react";
import { ClientShell } from "@/components/shell/client-shell";
import WorkoutProgramView, { type TrainingProgram } from "@/components/shared/workout-program-view";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ClientDashboardData {
  paymentApproved?: boolean;
  unreadNotifications?: number;
  training?: TrainingProgram | null;
}

function ClientProgramContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<ClientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<ClientDashboardData>("/client-dashboard")
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Δεν φορτώθηκε το πρόγραμμα προπόνησης."),
      )
      .finally(() => setLoading(false));
  }, []);

  const paymentApproved = Boolean(data?.paymentApproved);

  return (
    <ClientShell
      title="Η Προπόνησή μου"
      user={user}
      logout={logout}
      paymentApproved={paymentApproved}
      unreadNotifications={data?.unreadNotifications || 0}
      active="training"
    >
      {loading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          Φόρτωση...
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {error}
        </div>
      )}
      {!loading && !error && <WorkoutProgramView training={data?.training} />}
    </ClientShell>
  );
}

export default function ClientProgramPage() {
  return (
    <ProtectedRoute allow="client-active">
      <ClientProgramContent />
    </ProtectedRoute>
  );
}
