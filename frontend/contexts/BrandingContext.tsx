"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/media";

export interface BrandingData {
  appName: string;
  primaryColor: string;
  fontColor: string;
  titleColor: string;
  buttonColor: string;
  buttonHoverColor: string;
  buttonTextColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

const defaults: BrandingData = {
  appName: "CoachApp",
  primaryColor: "#e74c3c",
  fontColor: "#1a1a2e",
  titleColor: "#1a1a2e",
  buttonColor: "#e74c3c",
  buttonHoverColor: "#c0392b",
  buttonTextColor: "#ffffff",
  logoUrl: null,
  faviconUrl: null,
};

interface BrandingContextValue {
  branding: BrandingData;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function hexToHsl(hex: string): string {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : defaults.primaryColor.slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  hue = Math.round(hue * 60);
  if (hue < 0) hue += 360;

  return `${hue} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function applyBranding(branding: BrandingData) {
  document.title = branding.appName;
  const root = document.documentElement;
  const asHslColor = (color: string) => `hsl(${hexToHsl(color)})`;

  root.style.setProperty("--brand-primary", asHslColor(branding.primaryColor));
  root.style.setProperty("--foreground", asHslColor(branding.fontColor));
  root.style.setProperty("--title-color", asHslColor(branding.titleColor));
  root.style.setProperty("--primary", asHslColor(branding.buttonColor));
  root.style.setProperty("--button-hover", asHslColor(branding.buttonHoverColor));
  root.style.setProperty("--primary-foreground", asHslColor(branding.buttonTextColor));

  let buttonHoverStyle = document.getElementById("branding-button-hover-style") as HTMLStyleElement | null;
  if (!buttonHoverStyle) {
    buttonHoverStyle = document.createElement("style");
    buttonHoverStyle.id = "branding-button-hover-style";
    document.head.appendChild(buttonHoverStyle);
  }
  buttonHoverStyle.textContent = `
    .btn-primary:hover,
    [data-primary-btn]:hover,
    button[data-slot="button"].bg-primary:hover {
      background-color: ${branding.buttonHoverColor} !important;
    }
  `;

  if (!branding.faviconUrl) return;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }

  favicon.href = resolveMediaUrl(branding.faviconUrl);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingData>(defaults);

  const refreshBranding = useCallback(async () => {
    const nextBranding = await api.get<BrandingData>("/branding");
    setBranding(nextBranding);
  }, []);

  useEffect(() => {
    void refreshBranding().catch(() => undefined);
  }, [refreshBranding]);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding, refreshBranding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);

  if (!context) {
    throw new Error("useBranding must be used within a BrandingProvider");
  }

  return context;
}
