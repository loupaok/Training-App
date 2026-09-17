"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("el-GR");
}

export function PlanHeader({
  title,
  subtitle,
  onSave,
  onCreateNew,
  saving,
}: {
  title: string;
  subtitle: string;
  onSave: () => void;
  onCreateNew?: () => void;
  saving: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="flex gap-2">
        {onCreateNew && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (window.confirm("Το τρέχον πλάνο θα μετακινηθεί στο ιστορικό και θα ξεκινήσει ένα καινούργιο, κενό πλάνο. Συνέχεια;")) {
                onCreateNew();
              }
            }}
            disabled={saving}
            className="h-11 px-5 text-sm font-bold"
          >
            Νέο Πλάνο
          </Button>
        )}
        <Button type="button" onClick={onSave} disabled={saving} className="h-11 bg-red-600 px-5 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700">
          {saving ? "Αποθήκευση..." : "Αποθήκευση"}
        </Button>
      </div>
    </div>
  );
}

export interface PlanHistoryRow {
  id: number | string;
  title: string;
  created_at?: string;
  status?: string;
  day_count?: number;
  exercise_count?: number;
  daily_calories?: number;
}

export function PlanHistory({ rows, countLabel }: { rows: PlanHistoryRow[]; countLabel: (row: PlanHistoryRow) => string }) {
  const [open, setOpen] = useState(false);
  const previous = rows.filter((row) => row.status !== "active");
  if (!previous.length) return null;

  const statusLabels: Record<string, string> = { archived: "Αρχειοθετημένο", completed: "Ολοκληρωμένο", draft: "Πρόχειρο" };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-bold text-slate-700 dark:text-slate-200"
      >
        Ιστορικό πλάνων ({previous.length})
        <span className="text-xs font-bold text-slate-400">{open ? "Απόκρυψη" : "Εμφάνιση"}</span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {previous.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-50">{row.title}</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {formatDate(row.created_at)} · {countLabel(row)}
                </div>
              </div>
              <Badge variant="outline" className="font-bold">
                {statusLabels[row.status || ""] || row.status || "-"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  compact = false,
  className = "",
}: {
  label: string;
  value: string | number | undefined;
  onChange: (value: string) => void;
  type?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`block ${className}`}>
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${compact ? "h-10" : "h-11"} mt-1 w-full text-sm font-semibold`}
      />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="block">
      <Label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</Label>
      <Select
        items={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))}
        value={value ?? ""}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger className="mt-1 h-11 w-full text-sm font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
