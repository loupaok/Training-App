"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrandingProvider } from "@/contexts/BrandingContext";
import { AuthProvider } from "@/lib/auth/auth-context";
import { FontSizeProvider } from "@/components/shell/font-size-context";
import { OfflineSupport } from "@/components/offline/offline-support";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <BrandingProvider>
          <FontSizeProvider>
            <TooltipProvider>
              <OfflineSupport />
              {children}
              <Toaster />
            </TooltipProvider>
          </FontSizeProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
