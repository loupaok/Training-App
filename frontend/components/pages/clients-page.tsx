"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Pencil, Calendar, Trash2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import PaginationControls from "@/components/shared/pagination-controls";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getInitials } from "@/lib/media";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ClientApiRow {
  id: number | string;
  client_status_key?: string;
  is_active?: number;
  coaching_status?: string;
  full_name?: string;
  email?: string;
  fitness_goal?: string;
  latest_update_weight?: number | string;
  weight_kg?: number | string;
  update_day?: number | string | null;
  next_update_date?: string;
  is_online?: boolean | number;
  created_at?: string;
  profile_photo?: string | null;
}

interface MappedClient {
  id: number | string;
  name: string;
  email: string;
  status: string;
  statusKey: string;
  program: string;
  programKey: string;
  statusStyle: string;
  currentWeight: string;
  updateDayLabel: string;
  nextUpdate: string;
  nextUpdateDate: string;
  onlineStatus: string;
  isOnline: boolean;
  createdAt: string;
  profilePhoto: string | null;
  initials: string;
  tone: string;
}

const emptyClientForm = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  weightKg: "",
  fitnessGoal: "",
};

const updateDayOptions = [
  { value: 1, label: "Δευτέρα" },
  { value: 2, label: "Τρίτη" },
  { value: 3, label: "Τετάρτη" },
  { value: 4, label: "Πέμπτη" },
  { value: 5, label: "Παρασκευή" },
  { value: 6, label: "Σάββατο" },
  { value: 0, label: "Κυριακή" },
];

function slugify(value: string): string {
  return (
    String(value || "manual")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9α-ω]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "manual"
  );
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("el-GR");
}

function mapApiClient(row: ClientApiRow): MappedClient {
  const statusKey = row.client_status_key || (row.is_active === 0 || row.coaching_status === "inactive" ? "inactive" : "active");
  const statusMeta: Record<string, { label: string; style: string }> = {
    active: { label: "Ενεργός", style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
    pending: { label: "Εκκρεμής", style: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" },
    inactive: { label: "Ανενεργός", style: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" },
  };
  const meta = statusMeta[statusKey] || { label: "Ανενεργός", style: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" };
  const currentWeight = row.latest_update_weight || row.weight_kg;
  const updateDay = row.update_day === null || row.update_day === undefined ? "" : String(row.update_day);
  return {
    id: row.id,
    name: row.full_name || row.email || "Χωρίς όνομα",
    email: row.email || "",
    status: meta.label,
    statusKey,
    program: row.fitness_goal || "Χωρίς στόχο",
    programKey: slugify(row.fitness_goal || "Χωρίς στόχο"),
    statusStyle: meta.style,
    currentWeight: currentWeight ? `${currentWeight} kg` : "-",
    updateDayLabel: updateDayOptions.find((item) => String(item.value) === updateDay)?.label || "-",
    nextUpdate: formatDate(row.next_update_date),
    nextUpdateDate: row.next_update_date || "2099-12-31",
    onlineStatus: row.is_online ? "Online" : "Offline",
    isOnline: Boolean(row.is_online),
    createdAt: row.created_at || new Date().toISOString(),
    profilePhoto: row.profile_photo || null,
    initials: getInitials(row.full_name || row.email),
    tone: "bg-slate-900",
  };
}

function getWeightNumber(value: string): number {
  return Number.parseFloat(String(value).replace(",", ".")) || 0;
}

function FilterBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex h-[68px] items-center rounded-lg border border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>
  );
}

function ClientsContent() {
  const { user, logout } = useAuth();
  const [clientRows, setClientRows] = useState<MappedClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientMessage, setClientMessage] = useState("");
  const [clientError, setClientError] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingClientId, setDeletingClientId] = useState<number | string | null>(null);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    setClientError("");
    try {
      const rows = await api.get<ClientApiRow[]>("/clients");
      setClientRows(rows.map(mapApiClient));
    } catch {
      setClientError("Δεν φορτώθηκαν οι πελάτες από τη βάση.");
      setClientRows([]);
    } finally {
      setLoadingClients(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    const results = clientRows.filter((client) => {
      const matchesSearch =
        !searchTerm || [client.name, client.email, client.program, client.status].join(" ").toLowerCase().includes(searchTerm);
      const matchesStatus = statusFilter === "all" || client.statusKey === statusFilter;
      const matchesProgram = programFilter === "all" || client.programKey === programFilter;
      return matchesSearch && matchesStatus && matchesProgram;
    });

    return [...results].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "nextUpdate") return new Date(a.nextUpdateDate).getTime() - new Date(b.nextUpdateDate).getTime();
      if (sortBy === "name") return a.name.localeCompare(b.name, "el");
      if (sortBy === "weightDesc") return getWeightNumber(b.currentWeight) - getWeightNumber(a.currentWeight);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clientRows, programFilter, search, sortBy, statusFilter]);

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    clientRows.forEach((client) => {
      if (!seen.has(client.programKey)) seen.set(client.programKey, client.program);
    });
    return [{ value: "all", label: "Στόχος: Όλοι" }, ...Array.from(seen.entries()).map(([value, label]) => ({ value, label }))];
  }, [clientRows]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [currentPage, filteredClients, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, programFilter, sortBy]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, filteredClients.length, pageSize]);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setProgramFilter("all");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const handleManualClientSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setClientError("");
    setClientMessage("");

    try {
      await api.post("/clients", {
        fullName: clientForm.fullName,
        email: clientForm.email,
        password: clientForm.password,
        phone: clientForm.phone,
        weightKg: clientForm.weightKg || null,
        fitnessGoal: clientForm.fitnessGoal,
      });
      setClientMessage("Ο πελάτης προστέθηκε στη βάση και εμφανίζεται στη σελίδα Πελάτες.");
      setClientForm(emptyClientForm);
      setShowAddClient(false);
      loadClients();
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Δεν έγινε προσθήκη πελάτη.");
    }
  };

  const handleDeleteClient = async (client: MappedClient) => {
    const confirmed = window.confirm(
      `Θέλεις σίγουρα να διαγραφεί οριστικά ο πελάτης ${client.name}; Θα διαγραφούν και όλα τα δεδομένα του από τη βάση.`,
    );
    if (!confirmed) return;

    setDeletingClientId(client.id);
    setClientError("");
    setClientMessage("");

    try {
      await api.delete(`/clients/${client.id}`);
      setClientRows((rows) => rows.filter((row) => row.id !== client.id));
      setClientMessage("Ο πελάτης διαγράφηκε οριστικά από τη βάση.");
    } catch (error) {
      setClientError(error instanceof Error ? error.message : "Δεν διαγράφηκε ο πελάτης.");
    } finally {
      setDeletingClientId(null);
    }
  };

  return (
    <CoachShell title="Πελάτες" user={user} logout={logout}>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold">Πελάτες</h2>
          <div className="mt-3 flex items-center gap-3 text-base">
            <Link href="/dashboard" className="font-semibold text-blue-600 hover:text-blue-700">
              Dashboard
            </Link>
            <span className="text-slate-400 dark:text-slate-500">›</span>
            <span className="text-slate-600 dark:text-slate-400">Πελάτες</span>
          </div>
        </div>

        <Button onClick={() => setShowAddClient(true)} className="h-14 gap-3 px-7 font-bold shadow-lg shadow-red-200">
          <Plus className="h-5 w-5" />
          Προσθήκη Νέου Πελάτη
        </Button>
      </div>

      {clientError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{clientError}</div>}
      {clientMessage && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">{clientMessage}</div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-12">
        <FilterBox className="lg:col-span-4">
          <Search className="mr-3 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση πελάτη..."
            className="h-auto border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
        </FilterBox>

        <FilterBox className="lg:col-span-2">
          <Select
            items={[
              { value: "all", label: "Κατάσταση: Όλα" },
              { value: "active", label: "Ενεργοί Πελάτες" },
              { value: "pending", label: "Εκκρεμείς Πληρωμές" },
              { value: "inactive", label: "Ανενεργοί Πελάτες" },
            ]}
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value ?? "all")}
          >
            <SelectTrigger className="h-full w-full border-none px-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Κατάσταση: Όλα</SelectItem>
              <SelectItem value="active">Ενεργοί Πελάτες</SelectItem>
              <SelectItem value="pending">Εκκρεμείς Πληρωμές</SelectItem>
              <SelectItem value="inactive">Ανενεργοί Πελάτες</SelectItem>
            </SelectContent>
          </Select>
        </FilterBox>

        <FilterBox className="lg:col-span-2">
          <Select items={programOptions} value={programFilter} onValueChange={(value) => setProgramFilter(value ?? "all")}>
            <SelectTrigger className="h-full w-full border-none px-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {programOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBox>

        <FilterBox className="lg:col-span-3">
          <Select
            items={[
              { value: "newest", label: "Ταξινόμηση: Νεότεροι" },
              { value: "oldest", label: "Παλαιότεροι" },
              { value: "nextUpdate", label: "Επόμενο Update" },
              { value: "name", label: "Αλφαβητικά" },
              { value: "weightDesc", label: "Βάρος: Μεγαλύτερο" },
            ]}
            value={sortBy}
            onValueChange={(value) => setSortBy(value ?? "newest")}
          >
            <SelectTrigger className="h-full w-full border-none px-0 shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Ταξινόμηση: Νεότεροι</SelectItem>
              <SelectItem value="oldest">Παλαιότεροι</SelectItem>
              <SelectItem value="nextUpdate">Επόμενο Update</SelectItem>
              <SelectItem value="name">Αλφαβητικά</SelectItem>
              <SelectItem value="weightDesc">Βάρος: Μεγαλύτερο</SelectItem>
            </SelectContent>
          </Select>
        </FilterBox>

        <Button variant="outline" onClick={resetFilters} className="h-[68px] font-extrabold lg:col-span-1">
          Reset
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

      <section className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow className="h-[72px]">
              <TableHead className="w-[30%] px-8 text-base font-extrabold text-slate-950 dark:text-slate-50">Πελάτης</TableHead>
              <TableHead className="w-[13%] px-5 text-base font-extrabold text-slate-950 dark:text-slate-50">Κατάσταση</TableHead>
              <TableHead className="w-[13%] px-5 text-base font-extrabold text-slate-950 dark:text-slate-50">Τρέχον Βάρος</TableHead>
              <TableHead className="w-[20%] px-5 text-base font-extrabold text-slate-950 dark:text-slate-50">Επόμενο Update</TableHead>
              <TableHead className="w-[10%] px-5 text-base font-extrabold text-slate-950 dark:text-slate-50">Status</TableHead>
              <TableHead className="w-[14%] px-5 text-base font-extrabold text-slate-950 dark:text-slate-50">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.map((client) => (
              <TableRow key={client.id} className="h-[104px]">
                <TableCell className="px-8">
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-4 text-slate-950 hover:text-red-600 dark:text-slate-50">
                    <UserAvatar initials={client.initials} tone={client.tone} photoUrl={client.profilePhoto} />
                    <div>
                      <div className="font-extrabold">{client.name}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{client.email}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{client.program}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="px-5">
                  <span className={`rounded-md px-3 py-2 text-sm font-bold ${client.statusStyle}`}>{client.status}</span>
                </TableCell>
                <TableCell className="px-5 text-base">{client.currentWeight}</TableCell>
                <TableCell className="px-5">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-50">{client.nextUpdate}</div>
                    <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{client.updateDayLabel}</div>
                  </div>
                </TableCell>
                <TableCell className="px-5">
                  <span
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${
                      client.isOnline
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${client.isOnline ? "bg-emerald-500" : "bg-slate-400"}`} />
                    {client.onlineStatus}
                  </span>
                </TableCell>
                <TableCell className="px-5">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Επεξεργασία πελάτη"
                      aria-label="Επεξεργασία πελάτη"
                      nativeButton={false}
                      render={<Link href={`/clients/${client.id}?action=edit`} />}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Προσθήκη update"
                      aria-label="Προσθήκη update"
                      nativeButton={false}
                      render={<Link href={`/clients/${client.id}?action=update`} />}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Οριστική διαγραφή πελάτη"
                      aria-label="Οριστική διαγραφή πελάτη"
                      disabled={deletingClientId === client.id}
                      onClick={() => handleDeleteClient(client)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!paginatedClients.length && (
              <TableRow>
                <TableCell colSpan={6} className="px-8 py-12 text-center font-semibold text-slate-500 dark:text-slate-400">
                  {loadingClients ? "Φόρτωση πελατών..." : "Δεν υπάρχουν εγγεγραμμένοι πελάτες με αυτά τα φίλτρα."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

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

      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Προσθήκη Νέου Πελάτη</DialogTitle>
            <DialogDescription>Ο πελάτης αποθηκεύεται στη βάση ως user με role client και profile πελάτη.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleManualClientSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ονοματεπώνυμο</Label>
                <Input value={clientForm.fullName} onChange={(event) => setClientForm({ ...clientForm, fullName: event.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={clientForm.password}
                  onChange={(event) => setClientForm({ ...clientForm, password: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Τηλέφωνο</Label>
                <Input value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Τρέχον βάρος (kg)</Label>
                <Input
                  type="number"
                  value={clientForm.weightKg}
                  onChange={(event) => setClientForm({ ...clientForm, weightKg: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Στόχος</Label>
                <Input value={clientForm.fitnessGoal} onChange={(event) => setClientForm({ ...clientForm, fitnessGoal: event.target.value })} />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setShowAddClient(false)}>
                <X className="h-4 w-4" />
                Άκυρο
              </Button>
              <Button type="submit">Αποθήκευση Πελάτη</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </CoachShell>
  );
}

export default function ClientsPage() {
  return (
    <ProtectedRoute>
      <ClientsContent />
    </ProtectedRoute>
  );
}
