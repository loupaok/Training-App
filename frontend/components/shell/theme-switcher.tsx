"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = mounted ? theme : "light";

  return (
    <ToggleGroup
      value={current ? [current] : []}
      onValueChange={(values) => values[0] && setTheme(values[0])}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value="light" className="text-xs font-black data-[state=on]:text-primary">
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" className="text-xs font-black data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
        Dark
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
