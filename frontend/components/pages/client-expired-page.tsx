"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientShell } from "@/components/shell/client-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";

function ClientExpiredContent() {
  const { user, logout } = useAuth();

  return (
    <ClientShell title="Λήξη Συνδρομής" user={user} logout={logout} paymentApproved={false} active="billing">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-lg border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-slate-900">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-2xl font-bold text-red-700 dark:bg-red-500/10 dark:text-red-400">
            ×
          </div>
          <h1 className="mt-6 text-3xl font-bold">Η συνδρομή σου έχει λήξει</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Ανανεώνοντας τη συνδρομή σου, θα αποκτήσεις ξανά πρόσβαση στο πρόγραμμα, τη διατροφή και το progress.
          </p>
          <Button
            nativeButton={false}
            className="mt-6 h-12 rounded-md bg-red-600 px-6 font-bold text-white hover:bg-red-700"
            render={<Link href="/client-billing">Ανανέωση συνδρομής</Link>}
          />
        </section>
      </div>
    </ClientShell>
  );
}

export default function ClientExpiredPage() {
  return (
    <ProtectedRoute allow="client-expired">
      <ClientExpiredContent />
    </ProtectedRoute>
  );
}
