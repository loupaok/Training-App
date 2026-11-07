"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, MessageSquare } from "lucide-react";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";

type Compound = { id: number; name: string; dose: number | string; unit: string; frequency?: string | null };
type Cycle = { total_weeks: number; current_week: number; client_notes?: string | null; compounds: Compound[] };

export function ClientCycleCard({ className = "", onPresenceChange }: { className?: string; onPresenceChange?: (hasCycle: boolean) => void }) {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const loadCycle = useCallback(async () => {
    try {
      const result = await api.get<{ cycle: Cycle | null }>("/my/nutrition/cycle", { cache: "no-store" });
      setCycle(result.cycle);
      onPresenceChange?.(Boolean(result.cycle));
    } catch {
      // Keep the last valid protocol visible during a transient network error.
    }
  }, [onPresenceChange]);

  useEffect(() => {
    void loadCycle();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadCycle();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(loadCycle, 60_000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [loadCycle]);

  if (!cycle) return null;
  const totalWeeks = Math.max(1, Number(cycle.total_weeks) || 1);
  const currentWeek = Math.min(totalWeeks, Math.max(1, Number(cycle.current_week) || 1));
  const progress = Math.round((currentWeek / totalWeeks) * 100);
  return <Card className={`rounded-[20px] border-border bg-card shadow-none ${className}`}>
    <CardContent className="space-y-3 p-5">
      <div className="flex items-center gap-2.5"><span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-foreground text-accent"><Activity className="h-4 w-4" /></span><h2 className="flex-1 text-[16px] font-extrabold">Cycle Protocol</h2><span className="rounded-full bg-foreground px-2.5 py-1 text-[11px] font-extrabold text-accent">Εβδ. {currentWeek} / {totalWeeks}</span></div>
      {cycle.compounds.length > 0 && <div>{cycle.compounds.map((compound) => <div key={compound.id} className="flex items-center gap-2 border-t border-border/70 py-2.5 text-sm first:border-t-0"><span className="min-w-0 flex-1 font-extrabold">{compound.name}</span><span className="shrink-0 font-bold tabular-nums">{compound.dose} {compound.unit}</span><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-bold">{compound.frequency || "-"}</span></div>)}</div>}
      <div><div className="mb-2 flex justify-between gap-2 text-xs"><span className="font-extrabold">Πρόοδος κύκλου</span><span className="text-muted-foreground">{currentWeek} / {totalWeeks} εβδομάδες · {progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex justify-between gap-1 overflow-hidden">{Array.from({ length: totalWeeks }, (_, index) => { const week = index + 1; return <span key={week} className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${week === currentWeek ? "bg-foreground text-accent" : week < currentWeek ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{week}</span>; })}</div></div>
      {cycle.client_notes && <div className="flex gap-2.5 rounded-[14px] bg-muted p-3 text-[13px] leading-[1.4] text-muted-foreground"><MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div><strong className="mb-0.5 block text-xs text-foreground">Σημείωση από τον coach</strong>{cycle.client_notes}</div></div>}
    </CardContent>
  </Card>;
}
