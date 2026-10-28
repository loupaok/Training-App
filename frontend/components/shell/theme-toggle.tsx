"use client";

import { useTheme } from "@/components/shell/theme-provider";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ThemeOption = "light" | "dark" | "system";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon-sm" aria-label="Αλλαγή θέματος">
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun /> Φωτεινό
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon /> Σκούρο
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor /> Σύστημα
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: ThemeOption; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Φωτεινό", icon: Sun },
    { value: "dark", label: "Σκούρο", icon: Moon },
    { value: "system", label: "Σύστημα", icon: Monitor },
  ];

  return <div className="inline-flex rounded-[14px] border border-border bg-muted p-1">
    {options.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => setTheme(value)} className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[12px] font-bold transition-colors ${theme === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
  </div>;
}
