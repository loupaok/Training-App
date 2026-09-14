"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatRange(range?: DateRange): string {
  if (!range?.from) return "Επιλογή περιόδου";
  if (!range.to) return range.from.toLocaleDateString("el-GR");
  return `${range.from.toLocaleDateString("el-GR")} - ${range.to.toLocaleDateString("el-GR")}`;
}

export function DateRangePicker({ className }: { className?: string }) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  });

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="h-4 w-4" />
              {formatRange(range)}
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="range" defaultMonth={range?.from} selected={range} onSelect={setRange} numberOfMonths={2} />
        </PopoverContent>
      </Popover>
    </div>
  );
}
