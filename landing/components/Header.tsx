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

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-navy-100/60 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-navy-900/80"
          : "bg-transparent"
      }`}
    >
      <div className="container-x flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {settings?.logo ? (
            <Image src={settings.logo} alt={settings?.siteName || "SP Team"} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-navy text-sm font-extrabold text-lime">SP</span>
          )}
          <span className="text-lg font-extrabold tracking-tight">{settings?.siteName || "SP Team"}</span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-navy-700 transition-colors hover:text-lime-700 dark:text-white/80 dark:hover:text-lime"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <a
            href="#contact"
            className="rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-navy-900 shadow-sm shadow-lime/30 transition-transform hover:-translate-y-0.5"
          >
            Κλείσε Ραντεβού
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Μενού"
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full border border-navy-200 dark:border-white/15"
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
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-lime px-5 py-3 text-center text-sm font-bold text-navy-900"
              >
                Κλείσε Ραντεβού
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
