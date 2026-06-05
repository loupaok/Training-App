import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PaginationControls from '../components/PaginationControls';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients', active: true },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Πρόοδος Πελατών', path: '/dashboard#progress' },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Επιβράβευση' },
  { label: 'Discord' },
  { label: 'Ειδοποιήσεις' },
  { label: 'Αναφορές' },
  { label: 'Ρυθμίσεις' },
];

const clients = [
  {
    id: 'nikos-antoniou',
    name: 'Νίκος Αντωνίου',
    email: 'nikos@example.com',
    status: 'Ενεργός',
    statusStyle: 'bg-emerald-50 text-emerald-700',
    currentWeight: '78.4 kg',
    goal: '75 kg',
    nextUpdate: '25/05/2024',
    initials: 'ΝΑ',
    tone: 'bg-slate-900',
  },
  {
    id: 'maria-karali',
    name: 'Μαρία Καραλή',
    email: 'maria@example.com',
    status: 'Ενεργός',
    statusStyle: 'bg-emerald-50 text-emerald-700',
    currentWeight: '65.2 kg',
    goal: '60 kg',
    nextUpdate: '26/05/2024',
    initials: 'ΜΚ',
    tone: 'bg-zinc-900',
  },
  {
    id: 'kostas-dimitriou',
    name: 'Κώστας Δημητρίου',
    email: 'kostas@example.com',
    status: 'Ενεργός',
    statusStyle: 'bg-emerald-50 text-emerald-700',
    currentWeight: '84.1 kg',
    goal: '80 kg',
    nextUpdate: '25/05/2024',
    initials: 'ΚΔ',
    tone: 'bg-orange-600',
  },
  {
    id: 'elena-papadaki',
    name: 'Έλενα Παπαδάκη',
    email: 'elena@example.com',
    status: 'Ενεργός',
    statusStyle: 'bg-emerald-50 text-emerald-700',
    currentWeight: '58.6 kg',
    goal: '55 kg',
    nextUpdate: '24/05/2024',
    initials: 'ΕΠ',
    tone: 'bg-zinc-800',
  },
  {
    id: 'alexandros-papadopoulos',
    name: 'Αλέξανδρος Παπαδόπουλος',
    email: 'alex@example.com',
    status: 'Ανενεργός',
    statusStyle: 'bg-red-50 text-red-700',
    currentWeight: '92.3 kg',
    goal: '85 kg',
    nextUpdate: '10/05/2024',
    initials: 'ΑΠ',
    tone: 'bg-slate-700',
  },
  {
    id: 'giannis-papadopoulos',
    name: 'Γιάννης Παπαδόπουλος',
    email: 'giannis@example.com',
    status: 'Λήγει Σύντομα',
    statusStyle: 'bg-orange-50 text-orange-600',
    currentWeight: '88.7 kg',
    goal: '82 kg',
    nextUpdate: '20/05/2024',
    initials: 'ΓΠ',
    tone: 'bg-stone-900',
  },
  {
    id: 'dimitra-ioannou',
    name: 'Δήμητρα Ιωάννου',
    email: 'dimitra@example.com',
    status: 'Ενεργός',
    statusStyle: 'bg-emerald-50 text-emerald-700',
    currentWeight: '61.3 kg',
    goal: '58 kg',
    nextUpdate: '27/05/2024',
    initials: 'ΔΙ',
    tone: 'bg-zinc-900',
  },
];

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

function Sidebar({ user }) {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">
          K
        </div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections.map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              section.active
                ? 'bg-red-600 text-white shadow-lg shadow-red-950/30'
                : 'text-slate-100 hover:bg-white/10'
            }`;

            return section.path ? (
              <Link key={section.label} to={section.path} className={className}>
                <span className="truncate">{section.label}</span>
              </Link>
            ) : (
              <button key={section.label} className={className}>
                <span className="truncate">{section.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <Avatar initials={(user?.fullName || 'Coach Admin').slice(0, 2).toUpperCase()} tone="bg-red-600" />
          <div>
            <div className="font-bold">{user?.fullName || 'Coach Admin'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Online
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ user, logout }) {
  return (
    <header className="fixed left-[300px] right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm">
      <div className="flex items-center gap-9">
        <button className="grid h-10 w-10 place-items-center rounded-md text-2xl text-slate-900 hover:bg-slate-100">≡</button>
        <h1 className="text-2xl font-extrabold">Πελάτες</h1>
      </div>

      <div className="flex items-center gap-5 text-slate-900">
        {['⌕', '♢', '✉'].map((icon) => (
          <button key={icon} className="grid h-10 w-10 place-items-center rounded-md text-xl hover:bg-slate-100">
            {icon}
          </button>
        ))}
        <button onClick={logout} className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-slate-100">
          <Avatar initials={(user?.fullName || 'CA').slice(0, 2).toUpperCase()} tone="bg-slate-900" size="h-11 w-11" />
          <span className="font-bold">{user?.fullName || 'Coach Admin'}</span>
          <span className="text-sm">⌄</span>
        </button>
      </div>
    </header>
  );
}

function FilterBox({ children, className = '' }) {
  return (
    <div className={`flex h-[68px] items-center rounded-lg border border-slate-200 bg-white px-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function ActionButton({ children }) {
  return (
    <button className="grid h-9 w-9 place-items-center rounded-md text-xl text-slate-900 hover:bg-slate-100">
      {children}
    </button>
  );
}

export default function Clients() {
  const { user, logout } = useAuth();
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return clients.slice(start, start + pageSize);
  }, [currentPage, pageSize]);

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <Sidebar user={user} />
      <Topbar user={user} logout={logout} />

      <main className="ml-[300px] pt-[86px]">
        <div className="px-10 py-8">
          <div className="mb-7 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-extrabold">Πελάτες</h2>
              <div className="mt-3 flex items-center gap-3 text-base">
                <Link to="/dashboard" className="font-semibold text-blue-600 hover:text-blue-700">
                  Dashboard
                </Link>
                <span className="text-slate-400">›</span>
                <span className="text-slate-600">Πελάτες</span>
              </div>
            </div>

            <button className="flex h-14 items-center gap-3 rounded-md bg-red-600 px-7 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
              <span className="text-2xl leading-none">＋</span>
              Προσθήκη Νέου Πελάτη
            </button>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <FilterBox className="col-span-5">
              <span className="mr-4 text-2xl text-slate-500">⌕</span>
              <input
                type="search"
                placeholder="Αναζήτηση πελάτη..."
                className="w-full bg-transparent text-base outline-none placeholder:text-slate-500"
              />
            </FilterBox>

            {[
              { label: 'Κατάσταση: Όλα', span: 'col-span-2' },
              { label: 'Πρόγραμμα: Όλα', span: 'col-span-2' },
              { label: 'Ταξινόμηση: Νεότεροι', span: 'col-span-3' },
            ].map((filter) => (
              <FilterBox key={filter.label} className={filter.span}>
                <button className="flex w-full items-center justify-between text-left text-base font-medium text-slate-700">
                  {filter.label}
                  <span className="text-xl">⌄</span>
                </button>
              </FilterBox>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <PaginationControls
              totalItems={clients.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="πελάτες"
              variant="summary"
            />
          </div>

          <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="h-[72px] border-b border-slate-200 text-left text-base font-extrabold">
                  <th className="w-[27%] px-8">Πελάτης</th>
                  <th className="w-[14%] px-5">Κατάσταση</th>
                  <th className="w-[14%] px-5">Τρέχον Βάρος</th>
                  <th className="w-[12%] px-5">Στόχος</th>
                  <th className="w-[16%] px-5">Επόμενο Update</th>
                  <th className="w-[17%] px-5">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => (
                  <tr key={client.email} className="h-[94px] border-b border-slate-200 last:border-b-0">
                    <td className="px-8">
                      <Link to={`/clients/${client.id}`} className="flex items-center gap-4 text-slate-950 hover:text-red-600">
                        <Avatar initials={client.initials} tone={client.tone} />
                        <div>
                          <div className="font-extrabold">{client.name}</div>
                          <div className="mt-1 text-sm text-slate-600">{client.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5">
                      <span className={`rounded-md px-3 py-2 text-sm font-bold ${client.statusStyle}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-5 text-base">{client.currentWeight}</td>
                    <td className="px-5 text-base">{client.goal}</td>
                    <td className="px-5 text-base">{client.nextUpdate}</td>
                    <td className="px-5">
                      <div className="flex items-center gap-3">
                        <Link to={`/clients/${client.id}`} className="grid h-9 w-9 place-items-center rounded-md text-xl text-slate-900 hover:bg-slate-100">
                          ⊙
                        </Link>
                        <ActionButton>♢</ActionButton>
                        <ActionButton>▣</ActionButton>
                        <ActionButton>⋮</ActionButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <PaginationControls
              totalItems={clients.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageSizeChange={changePageSize}
              onPageChange={setCurrentPage}
              itemLabel="πελάτες"
              variant="pages"
            />
          </section>
        </div>
      </main>
    </div>
  );
}

