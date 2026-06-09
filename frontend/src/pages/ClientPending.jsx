import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import { useState } from 'react';

export default function ClientPending() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && <ClientSidebar user={user} paymentApproved={false} active="billing" />}
      <ClientTopbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Εκκρεμής Πληρωμή" />
      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="mx-auto max-w-3xl px-8 py-12">
          <section className="rounded-lg border border-amber-200 bg-white p-8 shadow-sm dark:border-amber-900 dark:bg-slate-900">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-2xl font-black text-amber-700">!</div>
            <h1 className="mt-6 text-3xl font-black">Η πληρωμή σου είναι σε εκκρεμότητα</h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
              Μόλις ο coach εγκρίνει την πληρωμή σου, θα ανοίξουν το πρόγραμμα, η διατροφή και το progress.
            </p>
            <Link to="/client-billing" className="mt-6 inline-grid h-12 place-items-center rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700">
              Πληρωμές και Συνδρομή
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
