"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface AdminUser {
  id: number | string;
  full_name?: string;
  email?: string;
  role: string;
  is_active?: boolean;
  specializations?: string;
  [key: string]: unknown;
}

interface AdminStats {
  admins?: number;
  moderators?: number;
  coaches?: number;
  clients?: number;
  totalUsers?: number;
  [key: string]: unknown;
}

interface AdminForm {
  fullName: string;
  email: string;
  password: string;
  role: string;
  specializations: string;
}

const roleOptions = [
  { value: "admin", label: "Admin / Coach", description: "Ο βασικός coach/admin. Βλέπει και διαχειρίζεται τα πάντα." },
  { value: "moderator", label: "Moderator", description: "Βλέπει επιλεγμένες ενότητες. Τα permissions θα τα εξειδικεύσουμε μετά." },
];

const emptyForm: AdminForm = {
  fullName: "",
  email: "",
  password: "",
  role: "moderator",
  specializations: "",
};

function AdminDashboardContent() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState<AdminForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersData, statsData] = await Promise.all([api.get<AdminUser[]>("/admin/users"), api.get<AdminStats>("/admin/stats")]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν φορτώθηκαν οι χρήστες.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((row) => row.role === roleFilter);
  }, [roleFilter, users]);

  const handleAddUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await api.post("/admin/users", {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        specializations: formData.specializations,
      });

      setMessage("Ο χρήστης δημιουργήθηκε.");
      setFormData(emptyForm);
      setShowAddUser(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε δημιουργία.");
    }
  };

  const updateUser = async (targetUser: AdminUser, changes: Record<string, unknown>) => {
    setError("");
    setMessage("");

    try {
      await api.put(`/admin/users/${targetUser.id}`, changes);
      setMessage("Ο χρήστης ενημερώθηκε.");
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε ενημέρωση.");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-slate-600">Δεν έχεις δικαίωμα πρόσβασης σε αυτή τη σελίδα.</p>
        </div>
      </div>
    );
  }

  return (
    <CoachShell title="Admin Panel" user={user} logout={logout}>
      {error && <Alert tone="red">{error}</Alert>}
      {message && <Alert tone="green">{message}</Alert>}

      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-5">
          <StatCard title="Admins" value={stats.admins || 0} />
          <StatCard title="Moderators" value={stats.moderators || 0} />
          <StatCard title="Coaches" value={stats.coaches || 0} />
          <StatCard title="Clients" value={stats.clients || 0} />
          <StatCard title="Total Users" value={stats.totalUsers || 0} />
        </div>
      )}

      <section className="mb-8 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div>
            <h2 className="text-xl font-black">Προσθήκη ατόμου</h2>
            <p className="mt-1 text-sm text-slate-500">Ο διαχειριστής ορίζει από εδώ μόνο την εσωτερική ομάδα. Οι πελάτες μπαίνουν από τη σελίδα Πελάτες.</p>
          </div>
          <Button onClick={() => setShowAddUser((value) => !value)} className="px-5 py-3 font-bold">
            {showAddUser ? "Κλείσιμο" : "Προσθήκη Χρήστη"}
          </Button>
        </div>

        {showAddUser && (
          <form onSubmit={handleAddUser} className="grid grid-cols-1 gap-4 bg-slate-50 p-6 md:grid-cols-2">
            <FormField label="Ονοματεπώνυμο">
              <Input value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} required />
            </FormField>
            <FormField label="Email">
              <Input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required />
            </FormField>
            <FormField label="Password">
              <Input
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                required
              />
            </FormField>
            <FormField label="Ρόλος">
              <Select value={formData.role} onValueChange={(value) => value && setFormData({ ...formData, role: value })}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Specializations / σημείωση">
              <Input value={formData.specializations} onChange={(event) => setFormData({ ...formData, specializations: event.target.value })} />
            </FormField>
            <div className="md:col-span-2">
              <Button type="submit" className="bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800">
                Δημιουργία Χρήστη
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        {roleOptions.map((role) => (
          <div key={role.value} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-black">{role.label}</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{role.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <h2 className="text-xl font-black">Όλοι οι χρήστες</h2>
          <Select value={roleFilter} onValueChange={(value) => value && setRoleFilter(value)}>
            <SelectTrigger className="h-11 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Όλη η ομάδα</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-5 py-4">Όνομα</TableHead>
              <TableHead className="px-5 py-4">Email</TableHead>
              <TableHead className="px-5 py-4">Ρόλος</TableHead>
              <TableHead className="px-5 py-4">Status</TableHead>
              <TableHead className="px-5 py-4">Specializations</TableHead>
              <TableHead className="px-5 py-4">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-8 text-center font-semibold text-slate-500">
                  Φόρτωση...
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filteredUsers.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-5 py-4 font-bold">{row.full_name}</TableCell>
                  <TableCell className="px-5 py-4 text-slate-600">{row.email}</TableCell>
                  <TableCell className="px-5 py-4">
                    <Select value={row.role} onValueChange={(value) => value && updateUser(row, { role: value })}>
                      <SelectTrigger className="h-10 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="px-5 py-4">
                    <Badge className={row.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                      {row.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 py-4 text-slate-600">{row.specializations || "-"}</TableCell>
                  <TableCell className="px-5 py-4">
                    <Button
                      variant="outline"
                      className="font-bold text-slate-700 hover:border-red-200 hover:text-red-600"
                      onClick={() => updateUser(row, { isActive: !row.is_active })}
                    >
                      {row.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-8 text-center font-semibold text-slate-500">
                  Δεν βρέθηκαν χρήστες.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>
    </CoachShell>
  );
}

function Alert({ children, tone }: { children: ReactNode; tone: "red" | "green" }) {
  const className = tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700";
  return <div className={`mb-5 rounded-lg border px-5 py-4 text-sm font-bold ${className}`}>{children}</div>;
}

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <Card className="p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500">{title}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
    </Card>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700">
      {label}
      {children}
    </Label>
  );
}

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
