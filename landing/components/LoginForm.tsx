"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, ArrowRight } from "./icons";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Λάθος κωδικός.");
        setLoading(false);
        return;
      }

      const from = searchParams.get("from") || "/keystatic";
      router.push(from);
      router.refresh();
    } catch {
      setError("Κάτι πήγε στραβά. Δοκίμασε ξανά.");
      setLoading(false);
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-white/10 bg-navy-900/80 p-8 shadow-2xl backdrop-blur"
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-lime/15 text-lime">
        <Lock className="h-5 w-5" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold text-white">Σύνδεση Admin</h1>
      <p className="mt-1.5 text-sm text-white/50">Συνδέσου με τον κωδικό πρόσβασης για να μπεις στο πίνακα διαχείρισης.</p>

      <label className="mt-7 block text-xs font-bold uppercase tracking-wide text-white/50">Κωδικός</label>
      <div className="relative mt-2">
        <input
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          placeholder="••••••••"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-lime"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {error && <p className="mt-3 text-sm font-medium text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3 text-sm font-bold text-navy-900 transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {loading ? "Σύνδεση..." : "Σύνδεση"}
        {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
      </button>
    </motion.form>
  );
}
