import Image from "next/image";
import Link from "next/link";
import { Instagram, TikTok, Youtube } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];

export function Footer({ settings }: { settings: Settings }) {
  const links = settings?.navLinks || [];
  const contact = [
    settings?.email ? [settings.email, "mailto:" + settings.email] : null,
    ["Discord", "#coaching"],
    ["spteam.gr", "https://spteam.gr/"],
  ].filter((item): item is [string, string] => Boolean(item));
  const socials = [{ Icon: Instagram, label: "Instagram" }, { Icon: Youtube, label: "YouTube" }, { Icon: TikTok, label: "TikTok" }];

  return <footer className="bg-[#0b0b0b] px-5 pb-7 pt-16 text-white sm:px-8 lg:px-20 lg:pt-20">
    <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div>
        {settings?.logoWhite ? <Image src={settings.logoWhite} alt={settings.siteName || "SP Team"} width={132} height={42} className="h-10 w-auto" /> : <p className="text-2xl font-black italic">SP TEAM</p>}
        <p className="mt-6 max-w-sm text-sm leading-6 text-[#a0a0a0]">Προσωπικό coaching με πλάνο προπόνησης, διατροφής και συνεχή καθοδήγηση.</p>
        <a href={settings?.ctaHref || "#pricing"} className="mt-7 inline-flex rounded-full bg-lime px-6 py-3 text-sm font-extrabold text-navy-900">{settings?.ctaLabel || "Ξεκίνα"} <span className="ml-2">→</span></a>
      </div>
      <FooterList title="Πλοήγηση" links={links.map((link) => [link.label, link.href])} />
      <FooterList title="Μέλη" links={[["Τιμές", "#pricing"], [settings?.loginLabel || "Σύνδεση", settings?.loginHref || "/login"], ["FAQ", "#faq"]]} />
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a9a9a]">Επικοινωνία</p><div className="mt-5 grid gap-3 text-sm text-[#d8d8d8]">{contact.map(([label, href]) => <a key={label} href={href} className="hover:text-lime">{label}</a>)}</div><p className="mt-9 text-xs font-bold uppercase tracking-[.18em] text-[#9a9a9a]">Ακολούθησε</p><div className="mt-4 flex gap-2">{socials.map(({ Icon, label }) => <a key={label} href="#" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-[#3a3a3a] text-white transition hover:border-lime hover:text-lime"><Icon className="h-4 w-4" /></a>)}</div></div>
    </div>
    <div className="mx-auto mt-14 flex max-w-[1280px] flex-col gap-4 border-t border-[#222] pt-7 text-xs text-[#9a9a9a] sm:flex-row sm:items-center sm:justify-between"><span>{settings?.footerText || "© " + new Date().getFullYear() + " SP Team. Με επιφύλαξη παντός δικαιώματος."}</span><div className="flex gap-5"><Link href="/terms">Όροι χρήσης</Link><Link href="/privacy">Απόρρητο</Link><a href="#cookies">Cookies</a></div></div>
  </footer>;
}

function FooterList({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#9a9a9a]">{title}</p><div className="mt-5 grid gap-3 text-sm text-[#d8d8d8]">{links.map(([label, href]) => <a key={label} href={href} className="hover:text-lime">{label}</a>)}</div></div>;
}
