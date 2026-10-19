"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Compound = { id: number; name: string; dose: number | string; unit: string; frequency?: string | null };
type Cycle = { total_weeks: number; current_week: number; client_notes?: string | null; compounds: Compound[] };

export function ClientCycleCard() {
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const loadCycle = useCallback(async () => {
    try {
      const result = await api.get<{ cycle: Cycle | null }>("/my/nutrition/cycle", { cache: "no-store" });
      setCycle(result.cycle);
    } catch {
      // Keep the last valid protocol visible during a transient network error.
    }
  }, []);

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
  return <Accordion defaultValue={["cycle-protocol"]} className="overflow-hidden rounded-xl border border-border bg-card shadow-none">
    <AccordionItem value="cycle-protocol" className="border-0">
      <AccordionTrigger className="bg-[#E53935]/[0.08] px-5 py-4 hover:bg-[#E53935]/[0.12] hover:no-underline">
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-3"><div className="flex items-center gap-2 text-sm font-bold text-[#E53935]"><Activity className="h-4 w-4" />Cycle Protocol</div><span className="shrink-0 rounded-md border border-[#E53935]/20 bg-[#E53935]/[0.08] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#E53935]">Εβδ. {currentWeek} / {totalWeeks}</span></div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-[#E53935]/20">
    <CardContent className="space-y-4 p-5 pb-5">
      {cycle.compounds.length > 0 && <div className="overflow-hidden rounded-lg border border-border"><div className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem] gap-2 bg-muted/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><span>Σκεύασμα</span><span>Δόση</span><span>Συχνότητα</span></div>{cycle.compounds.map((compound) => <div key={compound.id} className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem] items-center gap-2 border-t border-border px-3 py-3 text-sm"><span className="min-w-0 font-semibold">{compound.name}</span><span className="font-semibold tabular-nums">{compound.dose} {compound.unit}</span><span className="w-fit rounded-md border border-[#E53935]/20 bg-[#E53935]/[0.08] px-2 py-0.5 text-[11px] font-bold text-[#E53935]">{compound.frequency || "-"}</span></div>)}</div>}
      <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-muted-foreground">Πρόοδος κύκλου</span><span className="tabular-nums text-muted-foreground">{currentWeek} / {totalWeeks} εβδομάδες · {progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-[#E53935] to-[#FF7043] transition-[width] duration-300" style={{ width: `${progress}%` }} /></div><div className="mt-3 flex flex-wrap gap-1.5">{Array.from({ length: totalWeeks }, (_, index) => { const week = index + 1; const state = week < currentWeek ? "bg-[#E53935] text-white border-[#E53935]" : week === currentWeek ? "border-2 border-[#E53935] bg-[#E53935]/[0.08] text-[#E53935]" : "border-border bg-muted/60 text-muted-foreground"; return <span key={week} className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold ${state}`}>{week}</span>; })}</div></div>
      {cycle.client_notes && <div className="rounded-lg bg-muted/60 px-3 py-3 text-sm leading-6 text-muted-foreground"><strong className="mb-0.5 block text-xs text-foreground">Σημείωση από τον coach</strong>{cycle.client_notes}</div>}
    </CardContent>
      </AccordionContent>
    </AccordionItem>
  </Accordion>;
}
