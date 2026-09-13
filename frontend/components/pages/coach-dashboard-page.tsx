"use client";

import { useEffect, useState } from "react";
import { LineChart, DonutChart } from "@tremor/react";
import { Plus, ListChecks, Dumbbell, Salad, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CoachShell } from "@/components/shell/coach-shell";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ViewAllButton } from "@/components/shared/view-all-button";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { getInitials } from "@/lib/media";
import { useAuth } from "@/lib/auth/auth-context";
import { api } from "@/lib/api/client";

interface ClientRow {
  id: number | string;
  full_name?: string;
  email?: string;
  client_status_key?: string;
  latest_update_at?: string;
  latest_update_weight?: number | string;
}

const tasks = [
  { label: "Έλεγχος 7 νέων updates", done: true },
  { label: "Έλεγχος εκκρεμών συνδρομών" },
  { label: "Ενημέρωση προγράμματος πελατών", done: true },
  { label: "Αποστολή υπενθυμίσεων" },
];

const quickActions = [
  { label: "Προσθήκη Νέου Πελάτη", icon: Plus, color: "text-orange-600" },
  { label: "Δημιουργία Προγράμματος Προπόνησης", icon: Dumbbell, color: "text-blue-600" },
  { label: "Δημιουργία Προγράμματος Διατροφής", icon: Salad, color: "text-green-600" },
  { label: "Αποστολή Μηνύματος", icon: Mail, color: "text-indigo-600" },
];

const weightChartData = [
  { date: "01/04", "Βάρος (kg)": 82 },
  { date: "08/04", "Βάρος (kg)": 81 },
  { date: "15/04", "Βάρος (kg)": 79.5 },
  { date: "22/04", "Βάρος (kg)": 78 },
  { date: "29/04", "Βάρος (kg)": 76.5 },
];

function WeightChart() {
  return (
    <Card className="p-6 lg:col-span-5">
      <div className="mb-7 flex items-start justify-between">
        <h2 className="text-lg font-extrabold">Γράφημα Βάρους (Όλοι οι Πελάτες)</h2>
        <Button variant="outline" size="sm" className="text-slate-600">
          Τελευταίες 30 ημέρες
        </Button>
      </div>
      <LineChart
        className="h-[250px]"
        data={weightChartData}
        index="date"
        categories={["Βάρος (kg)"]}
        colors={["blue"]}
        showLegend={false}
        showAnimation
      />
    </Card>
  );
}

function SubscriptionCard({ total, active, pending, inactive }: { total: number; active: number; pending: number; inactive: number }) {
  const data = [
    { name: "Ενεργοί", value: active },
    { name: "Εκκρεμείς", value: pending },
    { name: "Ανενεργοί", value: inactive },
  ];

  return (
    <Card className="p-6 lg:col-span-4">
      <h2 className="text-lg font-extrabold">Κατάσταση Συνδρομών</h2>
      <div className="mt-9 flex items-center gap-10">
        <DonutChart
          data={data}
          category="value"
          index="name"
          colors={["emerald", "amber", "red"]}
          className="h-44 w-44 shrink-0"
          label={String(total)}
          showAnimation
        />
        <div className="space-y-5 text-sm">
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-green-500" /> Ενεργοί <span className="ml-5 text-slate-500">{active}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-amber-400" /> Εκκρεμείς <span className="ml-2 text-slate-500">{pending}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 rounded-full bg-red-500" /> Ανενεργοί <span className="ml-2 text-slate-500">{inactive}</span>
          </div>
        </div>
      </div>
      <ViewAllButton />
    </Card>
  );
}

function CoachDashboardContent() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);

  useEffect(() => {
    api
      .get<ClientRow[]>("/clients")
      .then((rows) => setClients(Array.isArray(rows) ? rows : []))
      .catch(() => setClients([]));
  }, []);

  const totalClients = clients.length;
  const activeClients = clients.filter((client) => client.client_status_key === "active").length;
  const pendingClients = clients.filter((client) => client.client_status_key === "pending").length;
  const inactiveClients = clients.filter((client) => client.client_status_key === "inactive").length;
  const activePercentText = totalClients ? `${Math.round((activeClients / totalClients) * 100)}% του συνόλου` : "0% του συνόλου";

  const stats = [
    { label: "Σύνολο Πελατών", value: totalClients, note: "Πραγματικές εγγραφές", color: "text-blue-600" },
    { label: "Ενεργοί Πελάτες", value: activeClients, note: activePercentText, color: "text-indigo-600" },
    { label: "Εκκρεμείς Πληρωμές", value: pendingClients, note: "Αναμονή έγκρισης", color: "text-amber-500" },
    { label: "Ανενεργοί Πελάτες", value: inactiveClients, note: "Χωρίς ενεργή πληρωμή", color: "text-red-500" },
    { label: "Νέα Updates", value: 0, note: "Από πραγματικές υποβολές", color: "text-sky-600" },
  ];

  const latestUpdates = clients
    .filter((client) => client.latest_update_at)
    .slice(0, 4)
    .map((client) => ({
      name: client.full_name || client.email || "Πελάτης",
      date: new Date(client.latest_update_at as string).toLocaleDateString("el-GR"),
      weight: client.latest_update_weight ? `${client.latest_update_weight} kg` : "-",
      initials: getInitials(client.full_name || client.email),
    }));

  const topClients: { name: string; initials: string; change: string }[] = [];

  return (
    <CoachShell title="Dashboard" user={user} logout={logout}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-extrabold">Καλωσήρθες, Coach! 👋</h2>
          <p className="mt-2 text-lg text-slate-600">Εδώ είναι μια συνοπτική εικόνα της επιχείρησής σου.</p>
        </div>
        <Button className="h-12 gap-3 px-6 font-bold shadow-lg shadow-red-200">
          <Plus className="h-5 w-5" />
          Προσθήκη Νέου
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center gap-5">
              <div className="text-sm text-slate-600">{stat.label}</div>
            </div>
            <div className={`mt-5 text-3xl font-extrabold ${stat.color}`}>{stat.value}</div>
            <div className="mt-3 text-sm text-slate-600">{stat.note}</div>
          </Card>
        ))}
      </div>

      <div id="progress" className="mt-6 grid scroll-mt-28 grid-cols-1 gap-6 lg:grid-cols-12">
        <WeightChart />

        <Card className="p-6 lg:col-span-3">
          <h2 className="text-lg font-extrabold">Τελευταία Updates</h2>
          <div className="mt-5 space-y-4">
            {latestUpdates.map((update) => (
              <div key={update.name} className="flex items-center gap-4">
                <UserAvatar initials={update.initials} tone="bg-slate-900" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{update.name}</div>
                  <div className="text-sm text-slate-500">{update.date}</div>
                </div>
                <div className="font-extrabold">{update.weight}</div>
              </div>
            ))}
            {!latestUpdates.length && (
              <div className="rounded-md bg-slate-50 p-5 text-sm font-semibold text-slate-500">Δεν υπάρχουν πραγματικά updates ακόμα.</div>
            )}
          </div>
          <ViewAllButton />
        </Card>

        <SubscriptionCard total={totalClients} active={activeClients} pending={pendingClients} inactive={inactiveClients} />

        <Card className="p-6 lg:col-span-4">
          <h2 className="text-lg font-extrabold">Κορυφαίοι Πελάτες (Αυτόν τον Μήνα)</h2>
          <div className="mt-7 space-y-6">
            {topClients.map((client, index) => (
              <div key={client.name} className="flex items-center gap-5">
                <div className="w-6 text-2xl font-extrabold">{index + 1}</div>
                <UserAvatar initials={client.initials} tone="bg-slate-900" />
                <div className="min-w-0 flex-1 truncate font-bold">{client.name}</div>
                <div className="font-extrabold text-emerald-600">{client.change}</div>
              </div>
            ))}
            {!topClients.length && (
              <div className="rounded-md bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                Δεν υπάρχουν αρκετά πραγματικά δεδομένα progress ακόμα.
              </div>
            )}
          </div>
          <ViewAllButton />
        </Card>

        <Card className="p-6 lg:col-span-4">
          <h2 className="text-lg font-extrabold">Σημερινές Εργασίες</h2>
          <div className="mt-5 space-y-3">
            {tasks.map((task) => (
              <label key={task.label} className="flex h-11 items-center gap-4 rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700">
                <Checkbox defaultChecked={task.done} />
                {task.label}
              </label>
            ))}
          </div>
          <Button variant="outline" className="mt-5 flex h-11 w-full items-center justify-center gap-3 text-sm font-semibold hover:border-red-200 hover:text-red-600">
            <ListChecks className="h-4 w-4" />
            Προβολή Ημερολογίου
          </Button>
        </Card>

        <Card className="p-6 lg:col-span-4">
          <h2 className="text-lg font-extrabold">Γρήγορες Ενέργειες</h2>
          <div className="mt-5 space-y-3">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="flex h-11 w-full items-center justify-start gap-5 px-5 text-left text-sm font-medium hover:border-red-200 hover:text-red-600"
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                {action.label}
              </Button>
            ))}
          </div>
        </Card>
      </div>
    </CoachShell>
  );
}

export default function CoachDashboardPage() {
  return (
    <ProtectedRoute allow="coach">
      <CoachDashboardContent />
    </ProtectedRoute>
  );
}
