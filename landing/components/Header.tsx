"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "./icons";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Settings = Awaited<ReturnType<typeof getSiteContent>>["settings"];

export function Header({ settings }: { settings: Settings }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = settings?.navLinks || [];
  const logoLight = settings?.logoWhite;
  const logoDark = settings?.logoBlack;

  return (
    <header
      className={`fixed inset-x-0 top-9 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur-lg" : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {logoLight || logoDark ? (
            <Image
              src={logoLight || logoDark || ""}
              alt={settings?.siteName || "SP Team"}
              width={120}
              height={32}
              className="h-8 w-auto"
              priority
            />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-lime text-sm font-extrabold text-navy-900">SP</span>
          )}
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link, i) => (
            <motion.a
              key={link.href}
              href={link.href}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="group relative text-navlink text-white/90 transition-colors hover:text-lime"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-lime transition-all duration-300 group-hover:w-full" />
            </motion.a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={settings?.loginHref || "/login"}
            className="text-navlink text-white/90 transition-colors hover:text-lime"
          >
            {settings?.loginLabel || "Σύνδεση"}
          </a>
          <a
            href={settings?.ctaHref || "#pricing"}
            className="btn-header bg-lime text-navy-900 shadow-sm shadow-lime/30 transition-transform hover:-translate-y-0.5"
          >
            {settings?.ctaLabel || "Ξεκίνα"}
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            aria-label="Μενού"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/30 text-white"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-white/10 bg-[#0b0b0b] lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-navlink text-white hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={settings?.ctaHref || "#pricing"}
                onClick={() => setOpen(false)}
                className="btn-header mt-2 justify-center bg-lime text-center text-navy-900"
              >
                {settings?.ctaLabel || "Ξεκίνα"}
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
