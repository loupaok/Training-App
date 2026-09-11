import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PaginationControls from '../components/PaginationControls';
import { CoachShell, Avatar, Card } from '../components/CoachShell';

const stats = [
  { label: 'Νέα Updates', value: '0', note: 'Περιμένουν έλεγχο', icon: '▤', tone: 'bg-blue-50 text-blue-600' },
  { label: 'Εκκρεμή Updates', value: '0', note: 'Σε επεξεργασία', icon: '◷', tone: 'bg-amber-50 text-amber-600' },
  { label: 'Εγκεκριμένα Σήμερα', value: '0', note: 'Ολοκληρώθηκαν', icon: '✓', tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Σύνολο Αυτής της Εβδομάδας', value: '0', note: 'Από πραγματικές υποβολές', icon: '↗', tone: 'bg-violet-50 text-violet-600' },
];

const updates = [];

function Filter({ label, wide = false }) {
  return (
    <button className={`flex h-12 items-center justify-between rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm ${wide ? 'w-[250px]' : 'w-[220px]'}`}>
      {label}
      <span className="text-lg">⌄</span>
    </button>
  );
}

export default function ClientUpdates() {
  const { user, logout } = useAuth();
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedUpdates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return updates.slice(start, start + pageSize);
  }, [currentPage, pageSize]);

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <CoachShell title="Updates Πελατών" user={user} logout={logout}>
          <div className="mb-7 flex items-start justify-between">
            <div>
              <div className="mb-7 flex items-center gap-3 text-sm">
                <Link to="/dashboard" className="font-semibold text-blue-600">Dashboard</Link>
                <span className="text-slate-400">›</span>
                <span className="font-semibold text-blue-600">Updates Πελατών</span>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Νέα Updates</span>
              </div>
              <h2 className="text-3xl font-extrabold">Νέα Updates</h2>
              <p className="mt-2 text-base text-slate-600">Ενημερώσεις που έχουν υποβληθεί από τους πελάτες σας.</p>
            </div>

            <div className="mt-16 flex items-center gap-4">
              <Filter label="Κατάσταση: Νέα" />
              <Filter label="Πελάτης: Όλοι" />
              <button className="flex h-12 w-[270px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">
                <span className="text-lg">▣</span>
                18/05/2024 - 18/05/2024
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-5">
            {stats.map((stat) => (
              <Card key={stat.label} className="p-6">
                <div className="flex items-center gap-5">
                  <span className={`grid h-16 w-16 place-items-center rounded-full text-3xl ${stat.tone}`}>{stat.icon}</span>
                  <div>
                    <p className="text-base font-semibold text-slate-600">{stat.label}</p>
                    <p className="mt-3 text-3xl font-extrabold">{stat.value}</p>
                    <p className="mt-3 text-sm text-slate-600">{stat.note}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-7 grid grid-cols-12 gap-5">
            <Card className="col-span-8 overflow-hidden">
              <PaginationControls
                totalItems={updates.length}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageSizeChange={changePageSize}
                onPageChange={setCurrentPage}
                itemLabel="updates"
                variant="summary"
              />
              <table className="w-full border-collapse">
                <thead>
                  <tr className="h-16 border-b border-slate-200 text-left text-sm font-extrabold">
                    <th className="px-6">Πελάτης</th>
                    <th className="px-5">Ημερομηνία Υποβολής <span className="ml-2">⌄</span></th>
                    <th className="px-5">Τύπος Update</th>
                    <th className="px-5">Κατάσταση</th>
                    <th className="px-5">Ενέργειες</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUpdates.map((update) => (
                    <tr key={`${update.name}-${update.time}`} className="h-[82px] border-b border-slate-200 last:border-b-0">
                      <td className="px-6">
                        <div className="flex items-center gap-4">
                          <Avatar initials={update.initials} tone={update.tone} />
                          <span className="font-extrabold">{update.name}</span>
                        </div>
                      </td>
                      <td className="px-5">
                        <div className="font-semibold">{update.date}</div>
                        <div className="mt-1 text-sm text-slate-500">{update.time}</div>
                      </td>
                      <td className="px-5">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <span className="text-lg text-indigo-600">{update.icon}</span>
                          {update.type}
                        </div>
                      </td>
                      <td className="px-5">
                        <span className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600">{update.status}</span>
                      </td>
                      <td className="px-5">
                        <div className="flex items-center gap-4 text-xl">
                          <button className="hover:text-blue-600">⊙</button>
                          <button className="text-emerald-600 hover:text-emerald-700">✓</button>
                          <button className="hover:text-red-600">⋮</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!paginatedUpdates.length && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center font-semibold text-slate-500">
                        Δεν υπάρχουν πραγματικά updates για έλεγχο.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <PaginationControls
                totalItems={updates.length}
                pageSize={pageSize}
                currentPage={currentPage}
                onPageSizeChange={changePageSize}
                onPageChange={setCurrentPage}
                itemLabel="updates"
                variant="pages"
              />

            </Card>

            <Card className="col-span-4 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold">Λεπτομέρειες Update</h3>
                <button className="text-2xl text-slate-700 hover:text-red-600">×</button>
              </div>

              <div className="mt-8 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                Επίλεξε ένα πραγματικό update από τη λίστα για να δεις λεπτομέρειες.
              </div>
            </Card>
          </div>
    </CoachShell>
  );
}

function Metric({ label, value, positive = false }) {
  return (
    <div>
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`mt-2 text-lg font-extrabold ${positive ? 'text-emerald-600' : ''}`}>{value}</div>
    </div>
  );
}

