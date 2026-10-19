"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { contactSchema, type ContactFormValues } from "@/lib/contact-schema";
import { CheckCircle } from "./icons";

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (values: ContactFormValues) => {
    setStatus("idle");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-lime/30 bg-lime/10 p-10 text-center">
        <CheckCircle className="h-10 w-10 text-lime-700 dark:text-lime" />
        <h3 className="mt-4 text-lg font-extrabold">Ευχαριστούμε!</h3>
        <p className="mt-2 text-sm text-navy-600 dark:text-white/70">Λάβαμε το μήνυμά σου και θα επικοινωνήσουμε σύντομα.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm font-bold text-lime-700 underline-offset-4 hover:underline dark:text-lime"
        >
          Αποστολή νέου μηνύματος
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Όνομα" error={errors.name?.message}>
          <input {...register("name")} type="text" autoComplete="name" placeholder="Το όνομά σου" className={inputClass(Boolean(errors.name))} />
        </Field>
        <Field label="Τηλέφωνο" error={errors.phone?.message}>
          <input {...register("phone")} type="tel" autoComplete="tel" placeholder="69xxxxxxxx" className={inputClass(Boolean(errors.phone))} />
        </Field>
      </div>
      <Field label="Email" error={errors.email?.message}>
        <input {...register("email")} type="email" autoComplete="email" placeholder="to@email.sou" className={inputClass(Boolean(errors.email))} />
      </Field>
      <Field label="Μήνυμα" error={errors.message?.message}>
        <textarea
          {...register("message")}
          rows={5}
          placeholder="Πες μας λίγα λόγια για τον στόχο σου..."
          className={inputClass(Boolean(errors.message))}
        />
      </Field>

      {status === "error" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-400">
          Κάτι πήγε στραβά. Δοκίμασε ξανά ή επικοινώνησε τηλεφωνικά.
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-lime px-6 py-4 text-sm font-bold text-navy-900 shadow-lg shadow-lime/30 transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {isSubmitting ? "Αποστολή..." : "Αποστολή Μηνύματος"}
      </button>
    </form>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-xl border bg-white px-4 py-3 text-sm text-navy-900 outline-none transition-colors placeholder:text-navy-300 focus:border-lime dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 ${
    hasError ? "border-red-400" : "border-navy-200 dark:border-white/15"
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-navy-800 dark:text-white/90">{label}</span>
      {children}
      {error && <span className="block text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}
