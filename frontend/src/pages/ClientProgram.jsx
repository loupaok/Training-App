import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClientSidebar, ClientTopbar } from '../components/ClientShell';
import WorkoutProgramView from '../components/WorkoutProgramView';
import { api } from '../services/api';

export default function ClientProgram() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/client-dashboard')
      .then(setData)
      .catch((err) => setError(err.message || 'Δεν φορτώθηκε το πρόγραμμα προπόνησης.'))
      .finally(() => setLoading(false));
  }, []);

  const paymentApproved = Boolean(data?.paymentApproved);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <ClientSidebar user={user} paymentApproved={paymentApproved} unreadNotifications={data?.unreadNotifications || 0} active="training" />}
      <ClientTopbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} title="Η Προπόνησή μου" />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">
          {loading && <div className="rounded-lg border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">Φόρτωση...</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>}
          {!loading && !error && <WorkoutProgramView training={data?.training} />}
        </div>
      </main>
    </div>
  );
}
