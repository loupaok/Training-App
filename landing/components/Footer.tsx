import Image from "next/image";
import Link from "next/link";
import { Instagram, Facebook, TikTok, Youtube } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];

const socialIcons = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: TikTok,
  youtube: Youtube,
};

export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="border-t border-navy-100 bg-white py-12 dark:border-white/10 dark:bg-navy-900">
      <div className="container-x flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2">
          {settings?.logoBlack || settings?.logoWhite ? (
            <>
              {settings?.logoWhite && <Image src={settings.logoWhite} alt={settings?.siteName || "SP Team"} width={100} height={28} className="hidden h-6 w-auto dark:block" />}
              {settings?.logoBlack && <Image src={settings.logoBlack} alt={settings?.siteName || "SP Team"} width={100} height={28} className="h-6 w-auto dark:hidden" />}
            </>
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs font-extrabold text-lime">SP</span>
          )}
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-6">
          {(settings?.navLinks || []).map((link) => (
            <a key={link.href} href={link.href} className="text-sm font-medium text-navy-600 hover:text-lime-700 dark:text-white/60 dark:hover:text-lime">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {(settings?.socialLinks || []).map((social) => {
            const Icon = socialIcons[social.platform as keyof typeof socialIcons] || Instagram;
            return (
              <Link
                key={social.platform}
                href={social.url || "#"}
                target="_blank"
                rel="noreferrer"
                aria-label={social.platform}
                className="grid h-9 w-9 place-items-center rounded-full border border-navy-200 text-navy-600 transition-colors hover:border-lime hover:text-lime-700 dark:border-white/15 dark:text-white/60 dark:hover:text-lime"
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </div>
      </div>
      <p className="container-x mt-8 text-center text-xs text-navy-400 dark:text-white/30">
        {settings?.footerText || `© ${new Date().getFullYear()} SP Team. Με επιφύλαξη παντός δικαιώματος.`}
      </p>
    </footer>
  );
}
