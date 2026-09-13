"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? theme : "light";

  return (
    <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`h-9 rounded px-3 text-xs font-black ${
          current === "light"
            ? "bg-white text-red-600 shadow-sm dark:bg-slate-800"
            : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        }`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`h-9 rounded px-3 text-xs font-black ${
          current === "dark" ? "bg-red-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        }`}
      >
        Dark
      </button>
    </div>
  );
}
