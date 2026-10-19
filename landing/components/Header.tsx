"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "./icons";
import { ThemeToggle } from "./ThemeToggle";
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
        scrolled
          ? "border-b border-navy-100/60 bg-white/90 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/90"
          : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {logoLight || logoDark ? (
            <>
              {logoLight && (
                <Image
                  src={logoLight}
                  alt={settings?.siteName || "SP Team"}
                  width={120}
                  height={32}
                  className={`h-8 w-auto ${scrolled ? "hidden dark:block" : "block"}`}
                  priority
                />
              )}
              {logoDark && (
                <Image
                  src={logoDark}
                  alt={settings?.siteName || "SP Team"}
                  width={120}
                  height={32}
                  className={`h-8 w-auto ${scrolled ? "block dark:hidden" : "hidden"}`}
                  priority
                />
              )}
            </>
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
              className={`group relative text-sm font-semibold transition-colors hover:text-lime ${
                scrolled ? "text-navy-700 dark:text-white/80" : "text-white/90"
              }`}
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-[2px] w-0 bg-lime transition-all duration-300 group-hover:w-full" />
            </motion.a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle inverted={!scrolled} />
          <a
            href={settings?.loginHref || "/login"}
            className={`text-sm font-semibold transition-colors hover:text-lime ${
              scrolled ? "text-navy-700 dark:text-white/80" : "text-white/90"
            }`}
          >
            {settings?.loginLabel || "Σύνδεση"}
          </a>
          <a
            href={settings?.ctaHref || "#pricing"}
            className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-navy-900 shadow-sm shadow-lime/30 transition-transform hover:-translate-y-0.5"
          >
            {settings?.ctaLabel || "Ξεκίνα"}
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle inverted={!scrolled} />
          <button
            type="button"
            aria-label="Μενού"
            onClick={() => setOpen((v) => !v)}
            className={`grid h-10 w-10 place-items-center rounded-full border ${
              scrolled ? "border-navy-200 text-navy-900 dark:border-white/15 dark:text-white" : "border-white/30 text-white"
            }`}
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
            className="overflow-hidden border-t border-navy-100 bg-white lg:hidden dark:border-white/10 dark:bg-navy-900"
          >
            <div className="container-x flex flex-col gap-1 py-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-navy-800 hover:bg-navy-50 dark:text-white dark:hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}
              <a
                href={settings?.ctaHref || "#pricing"}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-lime px-5 py-3 text-center text-sm font-bold text-navy-900"
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
