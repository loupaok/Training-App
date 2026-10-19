"use client";

import { Moon, Sun } from "./icons";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Εναλλαγή θέματος"
      className={`grid h-10 w-10 place-items-center rounded-full border border-navy-200 text-navy-800 transition-colors hover:border-lime hover:text-navy-900 dark:border-white/15 dark:text-white dark:hover:border-lime ${className}`}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
