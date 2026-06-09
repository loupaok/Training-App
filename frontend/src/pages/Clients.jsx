import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MenuToggle, TopbarActions } from '../components/TopbarControls';
import PaginationControls from '../components/PaginationControls';
import { api } from '../services/api';

const navSections = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Πελάτες', path: '/clients', active: true },
  { label: 'Updates Πελατών', path: '/updates' },
  { label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Media Library', path: '/media-library' },
  { label: 'Team', path: '/team' },
  { label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
  {
    label: 'Ρυθμίσεις',
    adminOnly: true,
    children: [
      { label: 'Discord' },
      { label: 'Πλάνα & Τιμές', path: '/pricing-plans' },
      { label: 'Branding' },
    ],
  },
];

const emptyClientForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  weightKg: '',
  fitnessGoal: '',
};

const updateDayOptions = [
  { value: 1, label: 'Δευτέρα' },
  { value: 2, label: 'Τρίτη' },
  { value: 3, label: 'Τετάρτη' },
  { value: 4, label: 'Πέμπτη' },
  { value: 5, label: 'Παρασκευή' },
  { value: 6, label: 'Σάββατο' },
  { value: 0, label: 'Κυριακή' },
];

function getInitials(name) {
  return String(name || 'CL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CL';
}

function slugify(value) {
  return String(value || 'manual')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9α-ω]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'manual';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('el-GR');
}

function mapApiClient(row) {
  const statusKey = row.client_status_key || (row.is_active === 0 || row.coaching_status === 'inactive' ? 'inactive' : 'active');
  const statusMeta = {
    active: { label: 'Ενεργός', style: 'bg-emerald-50 text-emerald-700' },
    pending: { label: 'Εκκρεμής', style: 'bg-amber-50 text-amber-700' },
    inactive: { label: 'Ανενεργός', style: 'bg-red-50 text-red-700' },
  }[statusKey] || { label: 'Ανενεργός', style: 'bg-red-50 text-red-700' };
  const currentWeight = row.latest_update_weight || row.weight_kg;
  const updateDay = row.update_day === null || row.update_day === undefined ? '' : String(row.update_day);
  return {
    id: row.id,
    name: row.full_name || row.email || 'Χωρίς όνομα',
    email: row.email || '',
    status: statusMeta.label,
    statusKey,
    program: row.fitness_goal || 'Χωρίς στόχο',
    programKey: slugify(row.fitness_goal || 'Χωρίς στόχο'),
    statusStyle: statusMeta.style,
    currentWeight: currentWeight ? `${currentWeight} kg` : '-',
    goal: row.fitness_goal || '-',
    updateDay,
    updateDayLabel: updateDayOptions.find((item) => String(item.value) === updateDay)?.label || '-',
    nextUpdate: formatDate(row.next_update_date),
    nextUpdateDate: row.next_update_date || '2099-12-31',
    onlineStatus: row.is_online ? 'Online' : 'Offline',
    isOnline: Boolean(row.is_online),
    createdAt: row.created_at || new Date().toISOString(),
    initials: getInitials(row.full_name || row.email),
    tone: 'bg-slate-900',
  };
}

function Avatar({ initials, tone = 'bg-slate-900', size = 'h-12 w-12' }) {
  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

function Sidebar({ user }) {
  const canSeeAdmin = user?.role === 'admin' || user?.role === 'coach';
  const settingsIsActive = navSections.some((section) => section.children?.some((child) => child.active));
  const [settingsOpen, setSettingsOpen] = React.useState(settingsIsActive);

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
          {navSections.filter((section) => !section.adminOnly || canSeeAdmin).map((section) => {
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              section.active
                ? 'bg-red-600 text-white shadow-lg shadow-red-950/30'
                : 'text-slate-100 hover:bg-white/10'
            }`;

            const item = section.children ? (
              <button onClick={() => setSettingsOpen((value) => !value)} className={className}>
                <span className="truncate">{section.label}</span>
                <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
              </button>
            ) : section.path ? (
              <Link to={section.path} className={className}>
                <span className="truncate">{section.label}</span>
              </Link>
            ) : (
              <button className={className}>
                <span className="truncate">{section.label}</span>
              </button>
            );

            return (
              <div key={section.label} className={section.spacerBefore ? 'mt-6' : ''}>
                {item}
                {section.children && canSeeAdmin && (
                  <div className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {section.children.map((child) => (
                      child.path ? (
                        <Link key={child.label} to={child.path} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</Link>
                      ) : (
                        <button key={child.label} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">{child.label}</button>
                      )
                    ))}
                  </div>
                )}
              </div>
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

function Topbar({ user, logout, sidebarOpen, onToggleSidebar }) {
  return (
    <header className={`fixed ${sidebarOpen ? 'left-[300px]' : 'left-0'} right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm transition-all duration-200`}>
      <div className="flex items-center gap-9">
        <MenuToggle onClick={onToggleSidebar} />
        <h1 className="text-2xl font-extrabold">Πελάτες</h1>
      </div>

      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

const actionIcons = {
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z',
  calendar: 'M7 3v4M17 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  trash: 'M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 11v6M14 11v6',
  more: 'M12 5h.01M12 12h.01M12 19h.01',
  search: 'M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  chevron: 'M6 9l6 6 6-6',
};

function InlineIcon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={actionIcons[name]} />
    </svg>
  );
}

function FilterBox({ children, className = '' }) {
  return (
    <div className={`flex h-[68px] items-center rounded-lg border border-slate-200 bg-white px-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function ActionButton({ icon, label, onClick }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="grid h-8 w-8 place-items-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-red-600">
      <InlineIcon name={icon} className="h-4 w-4" />
    </button>
  );
}

function LinkActionButton({ icon, label, to }) {
  return (
    <Link to={to} title={label} aria-label={label} className="grid h-8 w-8 place-items-center rounded-md text-slate-700 hover:bg-slate-100 hover:text-red-600">
      <InlineIcon name={icon} className="h-4 w-4" />
    </Link>
  );
}

function FilterSelect({ value, onChange, options, label }) {
  return (
    <div className="relative w-full">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-full appearance-none bg-transparent pr-8 text-base font-medium text-slate-700 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <InlineIcon name="chevron" className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function getWeightNumber(value) {
  return Number.parseFloat(String(value).replace(',', '.')) || 0;
}

export default function Clients() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [clientRows, setClientRows] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientMessage, setClientMessage] = useState('');
  const [clientError, setClientError] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingClientId, setDeletingClientId] = useState(null);

  const loadClients = React.useCallback(async () => {
    setLoadingClients(true);
    setClientError('');
    try {
      const rows = await api.get('/clients');
      setClientRows(rows.map(mapApiClient));
    } catch (error) {
      setClientError('Δεν φορτώθηκαν οι πελάτες από τη βάση.');
      setClientRows([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  React.useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const results = clientRows.filter((client) => {
      const matchesSearch = !searchTerm || [client.name, client.email, client.program, client.status]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm);
      const matchesStatus = statusFilter === 'all' || client.statusKey === statusFilter;
      const matchesProgram = programFilter === 'all' || client.programKey === programFilter;
      return matchesSearch && matchesStatus && matchesProgram;
    });

    return [...results].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'nextUpdate') return new Date(a.nextUpdateDate) - new Date(b.nextUpdateDate);
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'el');
      if (sortBy === 'weightDesc') return getWeightNumber(b.currentWeight) - getWeightNumber(a.currentWeight);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [clientRows, programFilter, search, sortBy, statusFilter]);

  const programOptions = useMemo(() => {
    const seen = new Map();
    clientRows.forEach((client) => {
      if (!seen.has(client.programKey)) {
        seen.set(client.programKey, client.program);
      }
    });
    return [
      { value: 'all', label: 'Στόχος: Όλοι' },
      ...Array.from(seen.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [clientRows]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [currentPage, filteredClients, pageSize]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, programFilter, sortBy]);

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, filteredClients.length, pageSize]);

  const changePageSize = (size) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setProgramFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const handleManualClientSubmit = async (event) => {
    event.preventDefault();
    setClientError('');
    setClientMessage('');

    try {
      await api.post('/clients', {
        fullName: clientForm.fullName,
        email: clientForm.email,
        password: clientForm.password,
        phone: clientForm.phone,
        weightKg: clientForm.weightKg || null,
        fitnessGoal: clientForm.fitnessGoal,
      });
      setClientMessage('Ο πελάτης προστέθηκε στη βάση και εμφανίζεται στη σελίδα Πελάτες.');
      setClientForm(emptyClientForm);
      setShowAddClient(false);
      loadClients();
    } catch (error) {
      setClientError(error.message || 'Δεν έγινε προσθήκη πελάτη.');
    }
  };

  const handleDeleteClient = async (client) => {
    const confirmed = window.confirm(`Θέλεις σίγουρα να διαγραφεί οριστικά ο πελάτης ${client.name}; Θα διαγραφούν και όλα τα δεδομένα του από τη βάση.`);
    if (!confirmed) return;

    setDeletingClientId(client.id);
    setClientError('');
    setClientMessage('');

    try {
      await api.delete(`/clients/${client.id}`);
      setClientRows((rows) => rows.filter((row) => row.id !== client.id));
      setClientMessage('Ο πελάτης διαγράφηκε οριστικά από τη βάση.');
    } catch (error) {
      setClientError(error.message || 'Δεν διαγράφηκε ο πελάτης.');
    } finally {
      setDeletingClientId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <Sidebar user={user} />}
      <Topbar user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
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

            <button onClick={() => setShowAddClient(true)} className="flex h-14 items-center gap-3 rounded-md bg-red-600 px-7 font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
              <span className="text-2xl leading-none">＋</span>
              Προσθήκη Νέου Πελάτη
            </button>
          </div>

          {clientError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700">{clientError}</div>}
          {clientMessage && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700">{clientMessage}</div>}

          <div className="grid grid-cols-12 gap-5">
            <FilterBox className="col-span-4">
              <InlineIcon name="search" className="mr-4 h-5 w-5 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Αναζήτηση πελάτη..."
                className="w-full bg-transparent text-base outline-none placeholder:text-slate-500"
              />
            </FilterBox>

            <FilterBox className="col-span-2">
              <FilterSelect
                label="Κατάσταση"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Κατάσταση: Όλα' },
                  { value: 'active', label: 'Ενεργοί Πελάτες' },
                  { value: 'pending', label: 'Εκκρεμείς Πληρωμές' },
                  { value: 'inactive', label: 'Ανενεργοί Πελάτες' },
                ]}
              />
            </FilterBox>

            <FilterBox className="col-span-2">
              <FilterSelect
                label="Πρόγραμμα"
                value={programFilter}
                onChange={setProgramFilter}
                options={programOptions}
              />
            </FilterBox>

            <FilterBox className="col-span-3">
              <FilterSelect
                label="Ταξινόμηση"
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'newest', label: 'Ταξινόμηση: Νεότεροι' },
                  { value: 'oldest', label: 'Παλαιότεροι' },
                  { value: 'nextUpdate', label: 'Επόμενο Update' },
                  { value: 'name', label: 'Αλφαβητικά' },
                  { value: 'weightDesc', label: 'Βάρος: Μεγαλύτερο' },
                ]}
              />
            </FilterBox>

            <button
              type="button"
              onClick={resetFilters}
              className="col-span-1 flex h-[68px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 shadow-sm hover:border-red-200 hover:text-red-600"
            >
              Reset
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <PaginationControls
              totalItems={filteredClients.length}
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
                  <th className="w-[30%] px-8">Πελάτης</th>
                  <th className="w-[13%] px-5">Κατάσταση</th>
                  <th className="w-[13%] px-5">Τρέχον Βάρος</th>
                  <th className="w-[20%] px-5">Επόμενο Update</th>
                  <th className="w-[10%] px-5">Status</th>
                  <th className="w-[14%] px-5">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client) => (
                  <tr key={client.id} className="h-[104px] border-b border-slate-200 last:border-b-0">
                    <td className="px-8">
                      <Link to={`/clients/${client.id}`} className="flex items-center gap-4 text-slate-950 hover:text-red-600">
                        <Avatar initials={client.initials} tone={client.tone} />
                        <div>
                          <div className="font-extrabold">{client.name}</div>
                          <div className="mt-1 text-sm text-slate-600">{client.email}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">{client.program}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-5">
                      <span className={`rounded-md px-3 py-2 text-sm font-bold ${client.statusStyle}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-5 text-base">{client.currentWeight}</td>
                    <td className="px-5">
                      <div>
                        <div className="font-bold text-slate-900">{client.nextUpdate}</div>
                        <div className="mt-1 text-xs font-bold text-slate-500">{client.updateDayLabel}</div>
                      </div>
                    </td>
                    <td className="px-5">
                      <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${client.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`h-2 w-2 rounded-full ${client.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {client.onlineStatus}
                      </span>
                    </td>
                    <td className="px-5">
                      <div className="relative flex items-center gap-2">
                        <LinkActionButton icon="edit" label="Επεξεργασία πελάτη" to={`/clients/${client.id}?action=edit`} />
                        <LinkActionButton icon="calendar" label="Προσθήκη update" to={`/clients/${client.id}?action=update`} />
                        <ActionButton
                          icon="trash"
                          label="Οριστική διαγραφή πελάτη"
                          onClick={() => handleDeleteClient(client)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!paginatedClients.length && (
                  <tr>
                    <td colSpan="6" className="px-8 py-12 text-center font-semibold text-slate-500">
                      {loadingClients ? 'Φόρτωση πελατών...' : 'Δεν υπάρχουν εγγεγραμμένοι πελάτες με αυτά τα φίλτρα.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <PaginationControls
              totalItems={filteredClients.length}
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

      {showAddClient && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-8">
          <form onSubmit={handleManualClientSubmit} className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold">Προσθήκη Νέου Πελάτη</h2>
                <p className="mt-1 text-sm text-slate-500">Ο πελάτης αποθηκεύεται στη βάση ως user με role client και profile πελάτη.</p>
              </div>
              <button type="button" onClick={() => setShowAddClient(false)} className="text-3xl text-slate-500 hover:text-red-600">×</button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <ModalInput label="Ονοματεπώνυμο" value={clientForm.fullName} onChange={(value) => setClientForm({ ...clientForm, fullName: value })} required />
              <ModalInput label="Email" type="email" value={clientForm.email} onChange={(value) => setClientForm({ ...clientForm, email: value })} required />
              <ModalInput label="Password" type="password" autoComplete="new-password" value={clientForm.password} onChange={(value) => setClientForm({ ...clientForm, password: value })} required />
              <ModalInput label="Τηλέφωνο" value={clientForm.phone} onChange={(value) => setClientForm({ ...clientForm, phone: value })} />
              <ModalInput label="Τρέχον βάρος (kg)" type="number" value={clientForm.weightKg} onChange={(value) => setClientForm({ ...clientForm, weightKg: value })} />
              <ModalInput label="Στόχος" value={clientForm.fitnessGoal} onChange={(value) => setClientForm({ ...clientForm, fitnessGoal: value })} />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddClient(false)} className="h-11 rounded-md border border-slate-200 px-5 font-bold hover:border-red-200 hover:text-red-600">Άκυρο</button>
              <button type="submit" className="h-11 rounded-md bg-red-600 px-5 font-bold text-white hover:bg-red-700">Αποθήκευση Πελάτη</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ModalInput({ label, type = 'text', value, onChange, required = false, autoComplete }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300"
      />
    </label>
  );
}

