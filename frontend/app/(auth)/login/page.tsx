"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";

const benefits = [
  "Δες το πρόγραμμά σου",
  "Παρακολούθησε την πρόοδό σου",
  "Επικοινώνησε με τον coach σου",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const result = await login(email, password);
    if (result.success) {
      router.push(result.redirectTo || "/");
    } else {
      setError(result.message || "");
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[2fr_3fr]">
      <aside className="hidden min-h-screen flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-primary/80 p-12 text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white lg:flex">
        <div>
          <div className="text-2xl font-bold tracking-tight">CoachApp</div>
          <p className="mt-2 max-w-xs text-sm text-white/70">Η πλατφόρμα για online personal training</p>
        </div>

        <div className="my-auto max-w-md">
          <h1 className="text-4xl font-bold tracking-tight">Καλώς ήρθες πίσω!</h1>
          <ul className="mt-8 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-sm text-white/90">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <blockquote className="max-w-sm rounded-xl bg-white/10 p-5 text-sm leading-6 text-white/80">
          <p className="mt-3 italic">«Έχασα 12kg σε 4 μήνες! Το καλύτερο επένδυση που έκανα.»</p>
          <footer className="mt-3 text-xs text-white/60">— Μαρία Κ.</footer>
        </blockquote>
      </aside>

      <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Σύνδεση</h1>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Κωδικός</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-11 pr-11"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
              {loading ? "Σύνδεση..." : "Σύνδεση"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Δεν έχεις λογαριασμό;{" "}
              <Link href="/pricing-plans" className="font-medium text-primary hover:underline">
                Ξεκίνα εδώ →
              </Link>
            </p>
          </form>

        </div>
      </main>
    </div>
  );
}
