"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, MessageSquare, Pill } from "lucide-react";
import { api } from "@/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";

type Supplement = {
  id: number;
  name: string;
  dose_amount: number | string | null;
  dose_unit: "ml" | "gr" | "mg";
  times_per_day: number | string | null;
  link: string | null;
};

export function ClientSupplementsCard({ className = "" }: { className?: string }) {
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const loadSupplements = useCallback(async () => {
    try {
      const result = await api.get<{ items: Supplement[]; generalNotes: string }>("/client/supplements", { cache: "no-store" });
      setSupplements(result.items);
      setGeneralNotes(result.generalNotes || "");
    } catch {
      // Keep the last valid list visible during a transient network error.
    }
  }, []);

  useEffect(() => {
    void loadSupplements();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSupplements();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(loadSupplements, 60_000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [loadSupplements]);

  if (supplements.length === 0) return null;

  return (
    <Card className={`rounded-[20px] border-border bg-card shadow-none ${className}`}>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-foreground text-accent">
            <Pill className="h-4 w-4" />
          </span>
          <h2 className="flex-1 text-[16px] font-extrabold">Συμπληρώματα</h2>
          <span className="text-xs text-muted-foreground">{supplements.length}</span>
        </div>
        <div className="space-y-2">
          {supplements.map((supplement) => (
            <div key={supplement.id} className="flex items-center gap-3 rounded-[14px] border border-border p-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-muted text-sm font-extrabold text-muted-foreground" aria-hidden="true">
                {supplement.name.trim().charAt(0).toLocaleUpperCase("el-GR")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">{supplement.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {supplement.dose_amount ? `${supplement.dose_amount} ${supplement.dose_unit}` : null}
                  {supplement.dose_amount && supplement.times_per_day ? " · " : null}
                  {supplement.times_per_day ? `${supplement.times_per_day}× την ημέρα` : ""}
                </p>
              </div>
              {supplement.link && (
                <a href={supplement.link} target="_blank" rel="noreferrer" className="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 text-xs font-extrabold text-accent-foreground">
                  eshop <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
        {generalNotes && (
          <div className="flex gap-2.5 rounded-[14px] bg-muted p-3 text-[13px] leading-[1.4] text-muted-foreground">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div><strong className="mb-0.5 block text-xs text-foreground">Σημείωση από τον coach</strong>{generalNotes}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
