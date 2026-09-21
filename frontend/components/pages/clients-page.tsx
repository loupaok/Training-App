"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, X, Mail, Ban, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import PaginationControls from "@/components/shared/pagination-controls";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getInitials } from "@/lib/media";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

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
  subscription_end_date?: string | null;
  is_expiring_soon?: boolean | number;
  latest_update_at?: string | null;
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
  subscriptionExpiry: string;
  subscriptionExpiryRaw: string;
  lastUpdateAtRaw: string;
  onlineStatus: string;
  isOnline: boolean;
  isActive: boolean;
  createdAt: string;
  profilePhoto: string | null;
  initials: string;
  tone: string;
}

interface TrashedClient {
  id: number | string;
  full_name?: string;
  email?: string;
  deleted_at?: string | null;
  deleted_by?: number | string | null;
  deleted_by_name?: string | null;
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

function formatRelativeDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "μόλις τώρα";
  if (minutes < 60) return `πριν από ${minutes} λεπτά`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `πριν από ${hours} ώρες`;
  return `πριν από ${Math.floor(hours / 24)} ημέρες`;
}

function mapApiClient(row: ClientApiRow): MappedClient {
  const baseStatusKey = row.client_status_key || (row.is_active === 0 || row.coaching_status === "inactive" ? "inactive" : "active");
  const statusKey = baseStatusKey === "active" && row.is_expiring_soon ? "expiring" : baseStatusKey;
  const statusMeta: Record<string, { label: string; style: string }> = {
    active: { label: "Ενεργός", style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" },
    expiring: { label: "Λήγει σύντομα", style: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" },
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
    subscriptionExpiry: formatDate(row.subscription_end_date || undefined),
    subscriptionExpiryRaw: row.subscription_end_date || "2099-12-31",
    lastUpdateAtRaw: row.latest_update_at || "1970-01-01",
    onlineStatus: row.is_online ? "Online" : "Offline",
    isOnline: Boolean(row.is_online),
    isActive: row.is_active !== 0,
    createdAt: row.created_at || new Date().toISOString(),
    profilePhoto: row.profile_photo || null,
    initials: getInitials(row.full_name || row.email),
    tone: "bg-slate-900",
  };
}

function ClientsContent() {
  const { user, logout } = useAuth();
  const [clientRows, setClientRows] = useState<MappedClient[]>([]);
  const [trashedClients, setTrashedClients] = useState<TrashedClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [clientMessage, setClientMessage] = useState("");
  const [clientError, setClientError] = useState("");
  const [trashError, setTrashError] = useState("");
  const [clientListTab, setClientListTab] = useState("active");
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [bulkMessageText, setBulkMessageText] = useState("");
  const [bulkSending, setBulkSending] = useState(false);

  // Debounce search input by 300ms before it drives filtering.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

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

  const loadTrash = useCallback(async () => {
    setLoadingTrash(true);
    setTrashError("");
    try {
      const rows = await api.get<TrashedClient[]>("/clients/trash");
      setTrashedClients(rows);
    } catch (error) {
      setTrashError(error instanceof Error ? error.message : "Δεν φορτώθηκε ο κάδος.");
      setTrashedClients([]);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
    loadTrash();
  }, [loadClients, loadTrash]);

  const restoreClient = async (client: TrashedClient) => {
    await api.put(`/clients/${client.id}/restore`);
    toast.success("Ο πελάτης επανήλθε στη λίστα ενεργών.");
    await Promise.all([loadClients(), loadTrash()]);
  };

  const permanentlyDeleteClient = async (client: TrashedClient) => {
    await api.delete(`/clients/${client.id}/permanent`);
    toast.success("Ο πελάτης διαγράφηκε οριστικά.");
    await Promise.all([loadClients(), loadTrash()]);
  };

  const filteredClients = useMemo(() => {
    const searchTerm = debouncedSearch.trim().toLowerCase();
    const results = clientRows.filter((client) => {
      const matchesSearch =
        !searchTerm || [client.name, client.email, client.program, client.status].join(" ").toLowerCase().includes(searchTerm);
      const matchesStatus = statusFilter === "all" || client.statusKey === statusFilter;
      const matchesProgram = programFilter === "all" || client.programKey === programFilter;
      return matchesSearch && matchesStatus && matchesProgram;
    });

    return [...results].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "el");
      if (sortBy === "subscriptionExpiry") return new Date(a.subscriptionExpiryRaw).getTime() - new Date(b.subscriptionExpiryRaw).getTime();
      if (sortBy === "lastUpdate") return new Date(b.lastUpdateAtRaw).getTime() - new Date(a.lastUpdateAtRaw).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [clientRows, programFilter, debouncedSearch, sortBy, statusFilter]);

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

  const stats = useMemo(() => {
    const total = clientRows.length;
    const active = clientRows.filter((client) => client.statusKey === "active").length;
    const expiring = clientRows.filter((client) => client.statusKey === "expiring").length;
    const pending = clientRows.filter((client) => client.statusKey === "pending").length;
    return { total, active, expiring, pending, activePct: total ? Math.round((active / total) * 100) : 0 };
  }, [clientRows]);

  const toggleStatusCard = (key: string) => {
    setStatusFilter((current) => (current === key ? "all" : key));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, programFilter, sortBy]);

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

  const toggleSelected = (id: number | string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      paginatedClients.forEach((client) => {
        if (checked) next.add(client.id);
        else next.delete(client.id);
      });
      return next;
    });
  };

  const handleBulkSendMessage = async () => {
    const text = bulkMessageText.trim();
    if (!text) return;
    const ids = Array.from(selectedIds);
    setBulkSending(true);
    const results = await Promise.allSettled(ids.map((id) => api.post(`/clients/${id}/messages`, { message: text })));
    const failed = results.filter((result) => result.status === "rejected").length;
    setBulkSending(false);
    setBulkMessageOpen(false);
    setBulkMessageText("");
    setSelectedIds(new Set());
    if (failed) toast.error(`Το μήνυμα απέτυχε για ${failed} από ${ids.length} πελάτες.`);
    else toast.success(`Το μήνυμα στάλθηκε σε ${ids.length} πελάτες.`);
  };

  const handleBulkDeactivate = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = window.confirm(`Απενεργοποίηση ${ids.length} πελατών;`);
    if (!confirmed) return;

    setBulkSending(true);
    const results = await Promise.allSettled(ids.map((id) => api.put(`/clients/${id}`, { isActive: false })));
    const failed = results.filter((result) => result.status === "rejected").length;
    setBulkSending(false);
    setSelectedIds(new Set());
    if (failed) toast.error(`Η απενεργοποίηση απέτυχε για ${failed} από ${ids.length} πελάτες.`);
    else toast.success(`${ids.length} πελάτες απενεργοποιήθηκαν.`);
    loadClients();
  };

  return (
    <CoachShell title="Πελάτες" user={user} logout={logout}>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Πελάτες</h2>
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

      <Tabs value={clientListTab} onValueChange={setClientListTab}>
        <TabsList>
          <TabsTrigger value="active">Ενεργοί</TabsTrigger>
          <TabsTrigger value="trash" className="gap-2">
            Κάδος
            <Trash2 className="h-4 w-4" />
            {trashedClients.length > 0 && <Badge className="ml-1">{trashedClients.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-5">
      {clientError && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">{clientError}</div>}
      {clientMessage && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-200">{clientMessage}</div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatFilterCard
          label="Σύνολο"
          value={stats.total}
          note="πελάτες"
          tone="text-slate-900 dark:text-slate-50"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
        />
        <StatFilterCard
          label="Ενεργοί"
          value={stats.active}
          note={`${stats.activePct}%`}
          tone="text-emerald-600 dark:text-emerald-400"
          active={statusFilter === "active"}
          onClick={() => toggleStatusCard("active")}
        />
        <StatFilterCard
          label="Λήγουν"
          value={stats.expiring}
          note="εντός 7 ημερών"
          tone="text-orange-600 dark:text-orange-400"
          active={statusFilter === "expiring"}
          onClick={() => toggleStatusCard("expiring")}
        />
        <StatFilterCard
          label="Εκκρεμείς"
          value={stats.pending}
          note="προς έγκριση"
          tone="text-amber-600 dark:text-amber-400"
          active={statusFilter === "pending"}
          onClick={() => toggleStatusCard("pending")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-md border border-slate-200 px-2.5 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Αναζήτηση πελάτη..."
            className="h-auto border-none bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
        </div>

        <Select
          items={[
            { value: "all", label: "Κατάσταση: Όλοι" },
            { value: "active", label: "Ενεργοί" },
            { value: "expiring", label: "Λήγουν" },
            { value: "inactive", label: "Έληξε" },
            { value: "pending", label: "Εκκρεμής έγκριση" },
          ]}
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? "all")}
        >
          <SelectTrigger size="sm" className="w-auto shrink-0 font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Κατάσταση: Όλοι</SelectItem>
            <SelectItem value="active">Ενεργοί</SelectItem>
            <SelectItem value="expiring">Λήγουν</SelectItem>
            <SelectItem value="inactive">Έληξε</SelectItem>
            <SelectItem value="pending">Εκκρεμής έγκριση</SelectItem>
          </SelectContent>
        </Select>

        <Select items={programOptions} value={programFilter} onValueChange={(value) => setProgramFilter(value ?? "all")}>
          <SelectTrigger size="sm" className="w-auto shrink-0 font-semibold">
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

        <Select
          items={[
            { value: "name", label: "Ταξινόμηση: Όνομα A-Z" },
            { value: "subscriptionExpiry", label: "Λήξη συνδρομής" },
            { value: "lastUpdate", label: "Τελευταίο update" },
            { value: "newest", label: "Ημ. εγγραφής" },
          ]}
          value={sortBy}
          onValueChange={(value) => setSortBy(value ?? "newest")}
        >
          <SelectTrigger size="sm" className="w-auto shrink-0 font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Ταξινόμηση: Όνομα A-Z</SelectItem>
            <SelectItem value="subscriptionExpiry">Λήξη συνδρομής</SelectItem>
            <SelectItem value="lastUpdate">Τελευταίο update</SelectItem>
            <SelectItem value="newest">Ημ. εγγραφής</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={resetFilters} className="shrink-0 font-bold">
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
              <TableHead className="w-12 px-4">
                <Checkbox
                  checked={paginatedClients.length > 0 && paginatedClients.every((client) => selectedIds.has(client.id))}
                  onCheckedChange={(checked) => toggleSelectAllOnPage(Boolean(checked))}
                  aria-label="Επιλογή όλων"
                />
              </TableHead>
              <TableHead className="w-[28%] px-8 text-base font-bold text-slate-950 dark:text-slate-50">Πελάτης</TableHead>
              <TableHead className="w-[13%] px-5 text-base font-bold text-slate-950 dark:text-slate-50">Κατάσταση</TableHead>
              <TableHead className="w-[13%] px-5 text-base font-bold text-slate-950 dark:text-slate-50">Τρέχον Βάρος</TableHead>
              <TableHead className="w-[20%] px-5 text-base font-bold text-slate-950 dark:text-slate-50">Επόμενο Update</TableHead>
              <TableHead className="w-[10%] px-5 text-base font-bold text-slate-950 dark:text-slate-50">Status</TableHead>
              <TableHead className="w-[14%] px-5 text-base font-bold text-slate-950 dark:text-slate-50">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedClients.map((client) => (
              <TableRow key={client.id} className="h-[104px]">
                <TableCell className="px-4">
                  <Checkbox
                    checked={selectedIds.has(client.id)}
                    onCheckedChange={(checked) => toggleSelected(client.id, Boolean(checked))}
                    aria-label={`Επιλογή ${client.name}`}
                  />
                </TableCell>
                <TableCell className="px-8">
                  <Link href={`/clients/${client.id}`} className="flex items-center gap-4 text-slate-950 hover:text-red-600 dark:text-slate-50">
                    <UserAvatar initials={client.initials} tone={client.tone} photoUrl={client.profilePhoto} />
                    <div>
                      <div className="font-bold">{client.name}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">{client.email}</div>
                      <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">{client.program}</div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="px-5">
                  <span className={`rounded-md px-3 py-2 text-sm font-bold ${client.statusStyle}`}>{client.status}</span>
                  {client.subscriptionExpiry !== "-" && (
                    <div className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Λήξη: {client.subscriptionExpiry}</div>
                  )}
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
                  <Button variant="outline" className="border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground" nativeButton={false} render={<Link href={`/clients/${client.id}`} />}>
                    Επεξεργασία
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!paginatedClients.length && (
              <TableRow>
                <TableCell colSpan={7} className="px-8 py-12 text-center font-semibold text-slate-500 dark:text-slate-400">
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

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-3 text-white shadow-lg dark:bg-slate-800">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{selectedIds.size} πελάτες επιλεγμένοι</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setBulkMessageOpen(true)}
              className="gap-2 text-white hover:bg-white/10 hover:text-white"
            >
              <Mail className="h-4 w-4" /> Μήνυμα
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleBulkDeactivate}
              disabled={bulkSending}
              className="gap-2 text-red-300 hover:bg-white/10 hover:text-red-200"
            >
              <Ban className="h-4 w-4" /> Απενεργοποίηση
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-white hover:bg-white/10 hover:text-white"
            >
              Ακύρωση
            </Button>
          </div>
        </div>
      )}

      <Dialog open={bulkMessageOpen} onOpenChange={setBulkMessageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Μήνυμα σε {selectedIds.size} πελάτες</DialogTitle>
            <DialogDescription>Το μήνυμα θα σταλεί ξεχωριστά σε κάθε επιλεγμένο πελάτη.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={bulkMessageText}
            onChange={(event) => setBulkMessageText(event.target.value)}
            placeholder="Γράψε το μήνυμά σου..."
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkMessageOpen(false)}>
              Ακύρωση
            </Button>
            <Button type="button" onClick={handleBulkSendMessage} disabled={bulkSending || !bulkMessageText.trim()}>
              {bulkSending ? "Αποστολή..." : "Αποστολή"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="trash" className="mt-5">
          <TrashClientsTable
            clients={trashedClients}
            loading={loadingTrash}
            error={trashError}
            onRestore={restoreClient}
            onPermanentDelete={permanentlyDeleteClient}
            canPermanentlyDelete={user?.role === "admin"}
          />
        </TabsContent>
      </Tabs>
    </CoachShell>
  );
}

function TrashClientsTable({
  clients,
  loading,
  error,
  onRestore,
  onPermanentDelete,
  canPermanentlyDelete,
}: {
  clients: TrashedClient[];
  loading: boolean;
  error: string;
  onRestore: (client: TrashedClient) => Promise<void>;
  onPermanentDelete: (client: TrashedClient) => Promise<void>;
  canPermanentlyDelete: boolean;
}) {
  const [restoreTarget, setRestoreTarget] = useState<TrashedClient | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TrashedClient | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);

  const restore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await onRestore(restoreTarget);
      setRestoreTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Δεν έγινε επαναφορά του πελάτη.");
    } finally {
      setRestoring(false);
    }
  };

  const permanentlyDelete = async () => {
    if (!permanentDeleteTarget) return;
    setPermanentlyDeleting(true);
    try {
      await onPermanentDelete(permanentDeleteTarget);
      setPermanentDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Δεν έγινε μόνιμη διαγραφή του πελάτη.");
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  return (
    <>
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Διαγράφηκε</TableHead>
              <TableHead>Από</TableHead>
              <TableHead className="text-right">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{client.full_name || client.email || "-"}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{client.email || "-"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{formatRelativeDate(client.deleted_at)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{formatDate(client.deleted_at || undefined)}</div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{client.deleted_by_name || "-"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white" onClick={() => setRestoreTarget(client)}>
                      <Undo2 className="h-4 w-4" />
                      Επαναφορά
                    </Button>
                    {canPermanentlyDelete && (
                      <Button type="button" variant="outline" size="sm" className="border-destructive text-destructive hover:bg-destructive hover:text-white" onClick={() => setPermanentDeleteTarget(client)}>
                        <Trash2 className="h-4 w-4" />
                        Μόνιμη Διαγραφή
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!clients.length && (
              <TableRow>
                <TableCell colSpan={4} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
                    <Trash2 className="h-8 w-8" />
                    <p>{loading ? "Φόρτωση κάδου..." : error || "Ο κάδος είναι άδειος"}</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <AlertDialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Επαναφορά πελάτη;</AlertDialogTitle>
            <AlertDialogDescription>Ο πελάτης θα επιστρέψει στη λίστα ενεργών.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction disabled={restoring} onClick={restore} className="bg-green-600 text-white hover:bg-green-700">
              {restoring ? "Επαναφορά..." : "Επαναφορά"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(permanentDeleteTarget)} onOpenChange={(open) => !open && setPermanentDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Μόνιμη διαγραφή;</AlertDialogTitle>
            <AlertDialogDescription>Αυτή η ενέργεια δεν αναιρείται. Όλα τα δεδομένα θα διαγραφούν οριστικά.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
            <AlertDialogAction disabled={permanentlyDeleting} onClick={permanentlyDelete} className="bg-destructive text-white hover:bg-destructive/90">
              {permanentlyDeleting ? "Διαγραφή..." : "Μόνιμη Διαγραφή"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatFilterCard({
  label,
  value,
  note,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  note: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick();
      }}
      className={cn(
        "cursor-pointer p-5 transition-colors hover:border-slate-300 dark:hover:border-slate-700",
        active && "border-red-500 ring-1 ring-red-500 dark:border-red-500",
      )}
    >
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("text-3xl font-bold", tone)}>{value}</span>
        <span className="text-sm text-slate-400 dark:text-slate-500">{note}</span>
      </div>
    </Card>
  );
}

export default function ClientsPage() {
  return (
    <ProtectedRoute>
      <ClientsContent />
    </ProtectedRoute>
  );
}
