import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import { useState } from 'react';

export default function ClientExpired() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      {sidebarOpen && <ClientSidebar user={user} paymentApproved={false} active="billing" />}
      <ClientTopbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Λήξη Συνδρομής" />
      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="mx-auto max-w-3xl px-8 py-12">
          <section className="rounded-lg border border-red-200 bg-white p-8 shadow-sm dark:border-red-900 dark:bg-slate-900">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-2xl font-black text-red-700">×</div>
            <h1 className="mt-6 text-3xl font-black">Η συνδρομή σου έχει λήξει</h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
              Ανανεώνοντας τη συνδρομή σου, θα αποκτήσεις ξανά πρόσβαση στο πρόγραμμα, τη διατροφή και το progress.
            </p>
            <Link to="/client-billing" className="mt-6 inline-grid h-12 place-items-center rounded-md bg-red-600 px-6 font-black text-white hover:bg-red-700">
              Ανανέωση συνδρομής
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
