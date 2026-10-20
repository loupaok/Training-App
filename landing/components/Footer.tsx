import Image from "next/image";
import { Instagram, TikTok, Youtube } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];
type Branding = Awaited<ReturnType<typeof getSiteContent>>["branding"];

function toHomeAnchor(href: string) {
  return href.startsWith("#") ? `/${href}` : href;
}

export function Footer({ settings, branding }: { settings: Settings; branding?: Branding }) {
  const footerNavigationLinks = settings?.footerNavigationLinks?.length
    ? settings.footerNavigationLinks
    : settings?.navLinks || [];
  const footerMembersLinks = settings?.footerMembersLinks?.length
    ? settings.footerMembersLinks
    : [
        { label: "Τιμές", href: "#pricing" },
        { label: settings?.loginLabel || "Σύνδεση", href: settings?.loginHref || "/login" },
        { label: "FAQ", href: "#faq" },
      ];
  const footerLegalLinks = settings?.footerLegalLinks?.length
    ? settings.footerLegalLinks
    : [
        { label: "Όροι χρήσης", href: "/terms" },
        { label: "Απόρρητο", href: "/privacy" },
        { label: "Cookies", href: "/cookies" },
      ];
  const contact = [
    settings?.phone ? [settings.phone, "tel:" + settings.phone.replace(/\s/g, "")] : null,
    settings?.email ? [settings.email, "mailto:" + settings.email] : null,
  ].filter((item): item is [string, string] => Boolean(item));
  const socials = [{ Icon: Instagram, label: "Instagram" }, { Icon: Youtube, label: "YouTube" }, { Icon: TikTok, label: "TikTok" }];

  return <footer className="bg-[#0b0b0b] px-5 pb-7 pt-16 text-white sm:px-8 lg:px-20 lg:pt-20">
    <div className="mx-auto grid max-w-[1280px] gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div>
        {branding?.logoWhite ? <Image src={branding.logoWhite} alt={branding.siteName || "SP Team"} width={132} height={42} className="h-10 w-auto" /> : <p className="text-2xl font-black italic">SP TEAM</p>}
        <p className="mt-6 max-w-sm text-body leading-6 text-[#a0a0a0]">{settings?.footerDescription || "Προσωπικό coaching με πλάνο προπόνησης, διατροφής και συνεχή καθοδήγηση."}</p>
        <a href={toHomeAnchor(settings?.footerCtaHref || "#pricing")} className="btn-header mt-7 bg-lime text-navy-900">{settings?.footerCtaLabel || "Ξεκίνα"} <span className="ml-2">→</span></a>
      </div>
      <FooterList title={settings?.footerNavigationTitle || "Πλοήγηση"} links={footerNavigationLinks.map((link) => [link.label, toHomeAnchor(link.href)] as const)} />
      <FooterList title={settings?.footerMembersTitle || "Μέλη"} links={footerMembersLinks.map((link) => [link.label, toHomeAnchor(link.href)] as const)} />
      <div><p className="text-label uppercase tracking-[.18em] text-[#9a9a9a]">{settings?.footerContactTitle || "Επικοινωνία"}</p><div className="mt-5 grid gap-3 text-xsmall text-[#d8d8d8]">{contact.map(([label, href]) => <a key={label} href={href} className="hover:text-lime">{label}</a>)}</div><p className="mt-9 text-label uppercase tracking-[.18em] text-[#9a9a9a]">Ακολούθησε</p><div className="mt-4 flex gap-2">{socials.map(({ Icon, label }) => <a key={label} href="#" aria-label={label} className="grid h-11 w-11 place-items-center rounded-full border border-[#3a3a3a] text-white transition hover:border-lime hover:text-lime"><Icon className="h-4 w-4" /></a>)}</div></div>
    </div>
    <div className="mx-auto mt-14 flex max-w-[1280px] flex-col gap-4 border-t border-[#222] pt-7 text-xsmall text-[#9a9a9a] sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} {settings?.footerText || "SP Team"} | <a href="https://lkouros.com/" target="_blank" rel="noreferrer" className="hover:text-lime">Developed by Loukas Kouros</a></span><div className="flex gap-5">{footerLegalLinks.map((link) => <a key={link.href} href={toHomeAnchor(link.href)} className="hover:text-lime">{link.label}</a>)}</div></div>
  </footer>;
}

function FooterList({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return <div><p className="text-label uppercase tracking-[.18em] text-[#9a9a9a]">{title}</p><div className="mt-5 grid gap-3 text-xsmall text-[#d8d8d8]">{links.map(([label, href]) => <a key={label} href={href} className="hover:text-lime">{label}</a>)}</div></div>;
}
