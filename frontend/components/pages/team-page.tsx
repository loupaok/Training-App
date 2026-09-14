"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { CoachShell } from "@/components/shell/coach-shell";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface TeamUser {
  id: number | string;
  full_name?: string;
  email?: string;
  role: string;
  is_active?: boolean;
  specializations?: string;
  [key: string]: unknown;
}

interface TeamForm {
  fullName: string;
  email: string;
  password: string;
  role: string;
  specializations: string;
}

const roles = [
  { value: "admin", label: "Admin / Coach" },
  { value: "moderator", label: "Moderator" },
];

const emptyForm: TeamForm = {
  fullName: "",
  email: "",
  password: "",
  role: "moderator",
  specializations: "",
};

function TeamContent() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isAdmin = user?.role === "admin";

  const loadUsers = async () => {
    setError("");
    try {
      const rows = await api.get<TeamUser[]>("/admin/users");
      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν φορτώθηκε το team.");
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    if (roleFilter === "all") return users;
    return users.filter((row) => row.role === roleFilter);
  }, [roleFilter, users]);

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/admin/users", form);
      setMessage("Το άτομο προστέθηκε στο team.");
      setForm(emptyForm);
      setShowForm(false);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε προσθήκη.");
    }
  };

  const updateUser = async (targetUser: TeamUser, changes: Record<string, unknown>) => {
    setError("");
    setMessage("");
    try {
      await api.put(`/admin/users/${targetUser.id}`, changes);
      setMessage("Ο χρήστης ενημερώθηκε.");
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Δεν έγινε ενημέρωση.");
    }
  };

  return (
    <CoachShell title="Team" user={user} logout={logout}>
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="font-semibold text-blue-600">
              Dashboard
            </Link>
            <span className="text-slate-400 dark:text-slate-500">›</span>
            <span className="text-slate-600 dark:text-slate-400">Team</span>
          </div>
          <h2 className="mt-5 text-3xl font-extrabold">Team &amp; Roles</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">Ορίζεις μόνο την εσωτερική ομάδα: Admin/Coach και Moderator.</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowForm((value) => !value)}
            className="h-12 px-6 font-bold shadow-lg shadow-red-200"
          >
            {showForm ? "Κλείσιμο" : "Προσθήκη Ατόμου"}
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          Μόνο ο Admin μπορεί να διαχειριστεί το Team.
        </div>
      )}

      {isAdmin && (
        <>
          {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">{error}</div>}
          {message && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-sm font-bold text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-400">{message}</div>}

          {showForm && (
            <form onSubmit={createUser} className="mb-7 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Ονοματεπώνυμο">
                  <Input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required />
                </FormField>
                <FormField label="Email">
                  <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
                </FormField>
                <FormField label="Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Ρόλος">
                  <Select value={form.role} onValueChange={(value) => value && setForm({ ...form, role: value })}>
                    <SelectTrigger className="mt-2 h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Specializations / Σημείωση">
                  <Input value={form.specializations} onChange={(event) => setForm({ ...form, specializations: event.target.value })} />
                </FormField>
              </div>
              <Button type="submit" className="mt-5 h-11 bg-slate-950 px-5 font-bold text-white hover:bg-slate-800">
                Αποθήκευση
              </Button>
            </form>
          )}

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <h3 className="text-xl font-extrabold">Χρήστες</h3>
              <Select value={roleFilter} onValueChange={(value) => value && setRoleFilter(value)}>
                <SelectTrigger className="h-11 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Όλη η ομάδα</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader className="bg-slate-50 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <TableRow>
                  <TableHead className="px-5 py-4">Όνομα</TableHead>
                  <TableHead className="px-5 py-4">Email</TableHead>
                  <TableHead className="px-5 py-4">Ρόλος</TableHead>
                  <TableHead className="px-5 py-4">Status</TableHead>
                  <TableHead className="px-5 py-4">Σημείωση</TableHead>
                  <TableHead className="px-5 py-4">Ενέργειες</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-5 py-4 font-bold">{row.full_name}</TableCell>
                    <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400">{row.email}</TableCell>
                    <TableCell className="px-5 py-4">
                      <Select value={row.role} onValueChange={(value) => value && updateUser(row, { role: value })}>
                        <SelectTrigger className="h-10 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge className={row.is_active ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"}>
                        {row.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-slate-600 dark:text-slate-400">{row.specializations || "-"}</TableCell>
                    <TableCell className="px-5 py-4">
                      <Button
                        variant="outline"
                        className="font-bold text-slate-700 hover:border-red-200 hover:text-red-600 dark:text-slate-200"
                        onClick={() => updateUser(row, { isActive: !row.is_active })}
                      >
                        {row.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredUsers.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-10 text-center font-semibold text-slate-500 dark:text-slate-400">
                      Δεν υπάρχουν χρήστες.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </>
      )}
    </CoachShell>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="flex flex-col items-start gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
      {label}
      {children}
    </Label>
  );
}

export default function TeamPage() {
  return (
    <ProtectedRoute>
      <TeamContent />
    </ProtectedRoute>
  );
}
