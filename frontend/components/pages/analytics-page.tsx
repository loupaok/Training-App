"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AreaChart, BarChart, DonutChart } from "@tremor/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CoachShell } from "@/components/shell/coach-shell";
import { useAuth } from "@/lib/auth/auth-context";

type PeriodKey = "week" | "month" | "quarter" | "year";
type PaymentStatus = "paid" | "pending" | "failed";
type PaymentStatusFilter = "all" | PaymentStatus;
type SubscriptionStatusFilter = "all" | "active" | "ending" | "inactive";
type ViewFilter = "all" | "revenue" | "clients" | "payments";

interface PeriodPoint {
  label: string;
  value: number;
}

interface PeriodEntry {
  title: string;
  revenueLabel: string;
  annualRevenue: string;
  comparison: string;
  activeSubscriptions: number;
  pendingAmount: string;
  churnRate: string;
  endingSoon: number;
  activeClients: number;
  inactiveClients: number;
  revenue: PeriodPoint[];
  clients: PeriodPoint[];
}

interface Payment {
  client: string;
  plan: string;
  amount: number;
  date: string;
  status: PaymentStatus;
  subscription: SubscriptionStatusFilter;
  renewal: boolean;
}

interface ClientRevenueItem {
  client: string;
  payments: number;
  revenue: string;
}

const periodData: Record<PeriodKey, PeriodEntry> = {
  week: {
    title: "Αυτή η εβδομάδα",
    revenueLabel: "Έσοδα εβδομάδας",
    annualRevenue: "€21.740",
    comparison: "+6.1%",
    activeSubscriptions: 98,
    pendingAmount: "€240",
    churnRate: "1.1%",
    endingSoon: 4,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: "Δευ", value: 120 },
      { label: "Τρι", value: 80 },
      { label: "Τετ", value: 160 },
      { label: "Πεμ", value: 220 },
      { label: "Παρ", value: 100 },
      { label: "Σαβ", value: 0 },
      { label: "Κυρ", value: 0 },
    ],
    clients: [
      { label: "Δευ", value: 2 },
      { label: "Τρι", value: 1 },
      { label: "Τετ", value: 3 },
      { label: "Πεμ", value: 2 },
      { label: "Παρ", value: 1 },
      { label: "Σαβ", value: 0 },
      { label: "Κυρ", value: 0 },
    ],
  },
  month: {
    title: "Αυτός ο μήνας",
    revenueLabel: "Μηνιαία έσοδα",
    annualRevenue: "€21.740",
    comparison: "+12.4%",
    activeSubscriptions: 98,
    pendingAmount: "€390",
    churnRate: "2.4%",
    endingSoon: 12,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: "1η εβδ.", value: 1320 },
      { label: "2η εβδ.", value: 1680 },
      { label: "3η εβδ.", value: 1490 },
      { label: "4η εβδ.", value: 2120 },
    ],
    clients: [
      { label: "1η εβδ.", value: 7 },
      { label: "2η εβδ.", value: 10 },
      { label: "3η εβδ.", value: 6 },
      { label: "4η εβδ.", value: 12 },
    ],
  },
  quarter: {
    title: "Τρέχον τρίμηνο",
    revenueLabel: "Έσοδα τριμήνου",
    annualRevenue: "€21.740",
    comparison: "+8.7%",
    activeSubscriptions: 98,
    pendingAmount: "€740",
    churnRate: "3.8%",
    endingSoon: 18,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: "Απρ", value: 5140 },
      { label: "Μαι", value: 6220 },
      { label: "Ιουν", value: 6610 },
    ],
    clients: [
      { label: "Απρ", value: 18 },
      { label: "Μαι", value: 23 },
      { label: "Ιουν", value: 35 },
    ],
  },
  year: {
    title: "Τρέχον έτος",
    revenueLabel: "Ετήσια τάση εσόδων",
    annualRevenue: "€21.740",
    comparison: "+18.2%",
    activeSubscriptions: 98,
    pendingAmount: "€1.120",
    churnRate: "6.5%",
    endingSoon: 32,
    activeClients: 98,
    inactiveClients: 14,
    revenue: [
      { label: "Ιαν", value: 2620 },
      { label: "Φεβ", value: 3180 },
      { label: "Μαρ", value: 3560 },
      { label: "Απρ", value: 5140 },
      { label: "Μαι", value: 6220 },
      { label: "Ιουν", value: 6610 },
    ],
    clients: [
      { label: "Ιαν", value: 9 },
      { label: "Φεβ", value: 12 },
      { label: "Μαρ", value: 14 },
      { label: "Απρ", value: 18 },
      { label: "Μαι", value: 23 },
      { label: "Ιουν", value: 35 },
    ],
  },
};

const payments: Payment[] = [];

const clientRevenue: ClientRevenueItem[] = [];

function AnalyticsContent() {
  const { user, logout } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("all");
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusFilter>("all");
  const [view, setView] = useState<ViewFilter>("all");
  const [visiblePayments, setVisiblePayments] = useState(10);

  const selectedPeriod = periodData[period];
  const totalRevenue = selectedPeriod.revenue.reduce((sum, point) => sum + point.value, 0);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesPayment = paymentStatus === "all" || payment.status === paymentStatus;
      const matchesSubscription = subscriptionStatus === "all" || payment.subscription === subscriptionStatus;
      return matchesPayment && matchesSubscription;
    });
  }, [paymentStatus, subscriptionStatus]);

  const visibleRows = filteredPayments.slice(0, visiblePayments);
  const paidCount = filteredPayments.filter((payment) => payment.status === "paid").length;
  const unpaidCount = filteredPayments.filter((payment) => payment.status !== "paid").length;
  const showFinancials = view === "all" || view === "revenue";
  const showClients = view === "all" || view === "clients";
  const showPayments = view === "all" || view === "payments";

  const activePercent = selectedPeriod.activeClients + selectedPeriod.inactiveClients
    ? Math.round((selectedPeriod.activeClients / (selectedPeriod.activeClients + selectedPeriod.inactiveClients)) * 100)
    : 0;

  return (
    <CoachShell title="Analytics" user={user} logout={logout}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
              <Link href="/dashboard" className="font-semibold text-blue-600">
                Dashboard
              </Link>
              <span>›</span>
              <span>Analytics</span>
            </div>
            <h2 className="text-3xl font-bold">Analytics</h2>
            <p className="mt-2 text-slate-600">Οικονομικά, πελάτες και πληρωμές με φίλτρα περιόδου.</p>
          </div>
          <Button className="h-12 px-5 font-semibold shadow-lg shadow-red-900/20">Σύνδεση Stripe</Button>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <FilterSelect
              label="Περίοδος"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "week", label: "Εβδομάδα" },
                { value: "month", label: "Μήνας" },
                { value: "quarter", label: "Τρίμηνο" },
                { value: "year", label: "Έτος" },
              ]}
            />
            <FilterSelect
              label="Πληρωμές"
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={[
                { value: "all", label: "Όλα τα status" },
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "failed", label: "Failed" },
              ]}
            />
            <FilterSelect
              label="Συνδρομές"
              value={subscriptionStatus}
              onChange={setSubscriptionStatus}
              options={[
                { value: "all", label: "Όλες" },
                { value: "active", label: "Ενεργές" },
                { value: "ending", label: "Λήγουν σύντομα" },
                { value: "inactive", label: "Ανενεργές" },
              ]}
            />
            <FilterSelect
              label="Προβολή"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "Όλα" },
                { value: "revenue", label: "Οικονομικά" },
                { value: "clients", label: "Πελάτες" },
                { value: "payments", label: "Πληρωμές" },
              ]}
            />
            <FilterSelect
              label="Πληρωμές ανά προβολή"
              value={visiblePayments}
              onChange={setVisiblePayments}
              options={[
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 20, label: "20" },
                { value: 50, label: "50" },
              ]}
            />
            <Button
              variant="outline"
              className="h-[54px] self-end font-semibold text-slate-700"
              onClick={() => {
                setPeriod("month");
                setPaymentStatus("all");
                setSubscriptionStatus("all");
                setView("all");
                setVisiblePayments(10);
              }}
            >
              Reset
            </Button>
          </div>
        </section>

        {showFinancials && (
          <section className="space-y-4">
            <SectionHeader title="Οικονομικά" subtitle={selectedPeriod.title} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard title={selectedPeriod.revenueLabel} value={`€${totalRevenue.toLocaleString("el-GR")}`} hint="Σύνολο περιόδου" />
              <MetricCard title="Ετήσια έσοδα" value={selectedPeriod.annualRevenue} hint="YTD" />
              <MetricCard title="Σύγκριση" value={selectedPeriod.comparison} hint="Με προηγούμενη περίοδο" tone="green" />
              <MetricCard title="Ενεργές συνδρομές" value={selectedPeriod.activeSubscriptions} hint="Πληρώνουν τώρα" />
              <MetricCard title="Pending / unpaid" value={selectedPeriod.pendingAmount} hint="Θέλουν έλεγχο" tone="amber" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5 xl:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-bold">{selectedPeriod.revenueLabel}</h3>
                  <span className="text-sm text-slate-500">{selectedPeriod.title}</span>
                </div>
                <AreaChart
                  className="h-72"
                  data={selectedPeriod.revenue}
                  index="label"
                  categories={["value"]}
                  colors={["blue"]}
                  valueFormatter={(value: number) => `€${value.toLocaleString("el-GR")}`}
                  showLegend={false}
                  showAnimation
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-5 text-lg font-bold">Έσοδα ανά πελάτη</h3>
                <div className="space-y-4">
                  {clientRevenue.map((item) => (
                    <RevenueRow key={item.client} item={item} />
                  ))}
                  {!clientRevenue.length && (
                    <div className="rounded-md bg-slate-50 p-4 text-sm font-semibold text-slate-500">Δεν υπάρχουν δεδομένα ακόμα.</div>
                  )}
                </div>
              </Card>
            </div>
          </section>
        )}

        {showClients && (
          <section className="space-y-4">
            <SectionHeader title="Πελάτες" subtitle="Νέοι πελάτες, churn και συνδρομές που λήγουν." />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Νέοι πελάτες"
                value={selectedPeriod.clients.reduce((sum, point) => sum + point.value, 0)}
                hint={selectedPeriod.title}
              />
              <MetricCard
                title="Ενεργοί vs ανενεργοί"
                value={`${selectedPeriod.activeClients}/${selectedPeriod.inactiveClients}`}
                hint="Ενεργοί / ανενεργοί"
              />
              <MetricCard title="Churn rate" value={selectedPeriod.churnRate} hint="Πελάτες που έφυγαν" tone="red" />
              <MetricCard title="Λήγουν αυτή την εβδομάδα" value={selectedPeriod.endingSoon} hint="Χρειάζονται follow-up" tone="amber" />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Card className="p-5 xl:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Νέοι πελάτες ανά περίοδο</h3>
                  <span className="text-sm text-slate-500">{selectedPeriod.title}</span>
                </div>
                <BarChart
                  className="h-72"
                  data={selectedPeriod.clients}
                  index="label"
                  categories={["value"]}
                  colors={["blue"]}
                  showLegend={false}
                  showAnimation
                />
              </Card>
              <Card className="p-5">
                <h3 className="mb-5 text-lg font-bold">Ενεργοί vs ανενεργοί</h3>
                <div className="flex items-center justify-center py-2">
                  <DonutChart
                    data={[
                      { name: "Ενεργοί", value: selectedPeriod.activeClients },
                      { name: "Ανενεργοί", value: selectedPeriod.inactiveClients },
                    ]}
                    category="value"
                    index="name"
                    colors={["emerald", "red"]}
                    className="h-44 w-44"
                    label={`${activePercent}%`}
                    showAnimation
                  />
                </div>
                <Legend
                  items={[
                    { label: "Ενεργοί", value: selectedPeriod.activeClients, color: "bg-green-500" },
                    { label: "Ανενεργοί", value: selectedPeriod.inactiveClients, color: "bg-red-500" },
                  ]}
                />
              </Card>
            </div>
          </section>
        )}

        {showPayments && (
          <section className="space-y-4">
            <SectionHeader
              title="Πληρωμές"
              subtitle={`Εμφανίζονται ${visibleRows.length} από ${filteredPayments.length} πληρωμές. Paid: ${paidCount}, unpaid: ${unpaidCount}.`}
            />
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Πελάτης</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Πρόγραμμα</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Ποσό</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Ημερομηνία</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Status</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Ανανέωση</TableHead>
                      <TableHead className="px-5 py-4 font-semibold text-slate-600">Ενέργειες</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((payment) => (
                      <TableRow key={`${payment.client}-${payment.date}`}>
                        <TableCell className="px-5 py-4 font-semibold">{payment.client}</TableCell>
                        <TableCell className="px-5 py-4 text-slate-600">{payment.plan}</TableCell>
                        <TableCell className="px-5 py-4 font-bold">€{payment.amount}</TableCell>
                        <TableCell className="px-5 py-4 text-slate-600">{payment.date}</TableCell>
                        <TableCell className="px-5 py-4">
                          <StatusBadge status={payment.status} />
                        </TableCell>
                        <TableCell className="px-5 py-4">{payment.renewal ? "Ενεργή" : "Όχι"}</TableCell>
                        <TableCell className="px-5 py-4">
                          <Button variant="outline" size="sm" className="text-sm font-semibold">
                            Υπενθύμιση
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!visibleRows.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="px-5 py-8 text-center text-sm font-semibold text-slate-500">
                          Δεν υπάρχουν πληρωμές για αυτά τα φίλτρα.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
            <Card className="p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <IntegrationItem title="Stripe integration" text="Έτοιμη θέση για σύνδεση κάρτας και webhooks." />
                <IntegrationItem title="Αυτόματη ανανέωση" text="Θα δένει με τη συνδρομή κάθε πελάτη." />
                <IntegrationItem title="Υπενθυμίσεις" text="Αποστολή σε pending ή failed πληρωμές." />
              </div>
            </Card>
          </section>
        )}
      </div>
    </CoachShell>
  );
}

interface FilterOption<T extends string | number> {
  value: T;
  label: string;
}

function FilterSelect<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
}) {
  const isNumeric = typeof value === "number";

  return (
    <div>
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <Select
        value={String(value)}
        onValueChange={(nextValue) => onChange((isNumeric ? Number(nextValue) : nextValue) as T)}
      >
        <SelectTrigger className="h-11 w-full font-semibold text-slate-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h3 className="text-xl font-bold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone = "slate",
}: {
  title: string;
  value: string | number;
  hint: string;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const colors: Record<string, string> = {
    slate: "text-slate-950",
    green: "text-green-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };

  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-slate-500">{title}</div>
      <div className={`mt-3 text-3xl font-black ${colors[tone]}`}>{value}</div>
      <div className="mt-2 text-sm text-slate-500">{hint}</div>
    </Card>
  );
}

function Legend({ items }: { items: { label: string; value: number; color: string }[] }) {
  return (
    <div className="mt-5 space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${item.color}`} />
            <span className="text-slate-600">{item.label}</span>
          </div>
          <span className="font-bold">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueRow({ item }: { item: ClientRevenueItem }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold">{item.client}</div>
        <div className="text-sm text-slate-500">{item.payments} πληρωμές</div>
      </div>
      <div className="font-black">{item.revenue}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const labels: Record<PaymentStatus, string> = {
    paid: "Paid",
    pending: "Pending",
    failed: "Failed",
  };
  const styles: Record<PaymentStatus, string> = {
    paid: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };

  return <Badge className={`rounded-md px-3 py-1 text-xs font-bold ${styles[status]}`}>{labels[status]}</Badge>;
}

function IntegrationItem({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="font-bold">{title}</div>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
