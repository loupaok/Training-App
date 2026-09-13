"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClientShell } from "@/components/shell/client-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";

function ClientPendingContent() {
  const { user, logout } = useAuth();

  return (
    <ClientShell title="Εκκρεμής Πληρωμή" user={user} logout={logout} paymentApproved={false} active="billing">
      <div className="mx-auto max-w-3xl">
        <section className="rounded-lg border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900 dark:bg-slate-900">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-2xl font-black text-amber-700">
            !
          </div>
          <h1 className="mt-6 text-3xl font-black">Η πληρωμή σου είναι σε εκκρεμότητα</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Μόλις ο coach εγκρίνει την πληρωμή σου, θα ανοίξουν το πρόγραμμα, η διατροφή και το progress.
          </p>
          <Button
            nativeButton={false}
            className="mt-6 h-12 rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700"
            render={<Link href="/client-billing">Πληρωμές και Συνδρομή</Link>}
          />
        </section>
      </div>
    </ClientShell>
  );
}

export default function ClientPendingPage() {
  return (
    <ProtectedRoute allow="client-pending">
      <ClientPendingContent />
    </ProtectedRoute>
  );
}
