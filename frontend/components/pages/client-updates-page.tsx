"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Inbox, Clock, CheckCircle2, TrendingUp, Calendar, Eye, Check, MoreVertical, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import PaginationControls from "@/components/shared/pagination-controls";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";

interface UpdateStat {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: string;
}

interface UpdateRow {
  name: string;
  initials: string;
  tone: string;
  date: string;
  time: string;
  type: string;
  status: string;
}

const stats: UpdateStat[] = [
  { label: "Νέα Updates", value: "0", note: "Περιμένουν έλεγχο", icon: Inbox, tone: "bg-blue-50 text-blue-600" },
  { label: "Εκκρεμή Updates", value: "0", note: "Σε επεξεργασία", icon: Clock, tone: "bg-amber-50 text-amber-600" },
  { label: "Εγκεκριμένα Σήμερα", value: "0", note: "Ολοκληρώθηκαν", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
  { label: "Σύνολο Αυτής της Εβδομάδας", value: "0", note: "Από πραγματικές υποβολές", icon: TrendingUp, tone: "bg-violet-50 text-violet-600" },
];

const updates: UpdateRow[] = [];

function Filter({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <Button
      variant="outline"
      className={`h-12 justify-between rounded-lg border-slate-200 px-5 text-sm font-semibold text-slate-700 shadow-sm ${wide ? "w-[250px]" : "w-[220px]"}`}
    >
      {label}
      <ChevronDown className="h-4 w-4" />
    </Button>
  );
}

function ClientUpdatesContent() {
  const { user, logout } = useAuth();
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const paginatedUpdates = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return updates.slice(start, start + pageSize);
  }, [currentPage, pageSize]);

  const changePageSize = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <CoachShell title="Updates Πελατών" user={user} logout={logout}>
      <div className="mb-7 flex items-start justify-between">
        <div>
          <div className="mb-7 flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="font-semibold text-blue-600">
              Dashboard
            </Link>
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
          <Button variant="outline" className="h-12 w-[270px] justify-start gap-3 rounded-lg border-slate-200 px-5 text-sm font-semibold text-slate-700 shadow-sm">
            <Calendar className="h-4 w-4" />
            18/05/2024 - 18/05/2024
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center gap-5">
              <span className={`grid h-16 w-16 place-items-center rounded-full ${stat.tone}`}>
                <stat.icon className="h-7 w-7" />
              </span>
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
          <Table>
            <TableHeader>
              <TableRow className="h-16 text-left text-sm font-extrabold">
                <TableHead className="px-6">Πελάτης</TableHead>
                <TableHead className="px-5">
                  Ημερομηνία Υποβολής <ChevronDown className="ml-2 inline h-4 w-4" />
                </TableHead>
                <TableHead className="px-5">Τύπος Update</TableHead>
                <TableHead className="px-5">Κατάσταση</TableHead>
                <TableHead className="px-5">Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUpdates.map((update) => (
                <TableRow key={`${update.name}-${update.time}`} className="h-[82px]">
                  <TableCell className="px-6">
                    <div className="flex items-center gap-4">
                      <UserAvatar initials={update.initials} tone={update.tone} />
                      <span className="font-extrabold">{update.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-5">
                    <div className="font-semibold">{update.date}</div>
                    <div className="mt-1 text-sm text-slate-500">{update.time}</div>
                  </TableCell>
                  <TableCell className="px-5">
                    <div className="flex items-center gap-3 text-sm text-slate-600">{update.type}</div>
                  </TableCell>
                  <TableCell className="px-5">
                    <Badge className="bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600 hover:bg-blue-50">{update.status}</Badge>
                  </TableCell>
                  <TableCell className="px-5">
                    <div className="flex items-center gap-4">
                      <Button variant="ghost" size="icon-sm" className="hover:text-blue-600">
                        <Eye className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="text-emerald-600 hover:text-emerald-700">
                        <Check className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="hover:text-red-600">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!paginatedUpdates.length && (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center font-semibold text-slate-500">
                    Δεν υπάρχουν πραγματικά updates για έλεγχο.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

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
            <Button variant="ghost" size="icon-sm" className="text-slate-700 hover:text-red-600">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="mt-8 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
            Επίλεξε ένα πραγματικό update από τη λίστα για να δεις λεπτομέρειες.
          </div>
        </Card>
      </div>
    </CoachShell>
  );
}

export default function ClientUpdatesPage() {
  return (
    <ProtectedRoute>
      <ClientUpdatesContent />
    </ProtectedRoute>
  );
}
