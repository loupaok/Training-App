"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { login, loading } = useAuth();
  const { branding } = useBranding();
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

  const backgroundImage = branding.loginBackgroundUrl ? `url("${resolveMediaUrl(branding.loginBackgroundUrl)}")` : undefined;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-slate-50 px-5 py-10" style={backgroundImage ? { backgroundImage, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
      {backgroundImage && <div className="absolute inset-0" style={{ backgroundColor: "color-mix(in oklab, #000000 45%, transparent)" }} />}
      <section className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-8 shadow-2xl shadow-slate-900/15 sm:p-10">
        <div className="text-center">
          {branding.logoUrl ? (
            <img src={resolveMediaUrl(branding.logoUrl)} alt={branding.appName} className="mx-auto max-h-16 max-w-44 object-contain" />
          ) : (
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-700"><LockKeyhole className="h-6 w-6" /></div>
          )}
          <p className="mt-4 text-sm font-semibold text-slate-600">{branding.appName}</p>
          <h1 className="mt-8 text-3xl font-bold text-slate-900">Καλώς ήρθες πίσω</h1>
          <p className="mt-3 text-sm text-slate-600">Συνδέσου για να συνεχίσεις το ταξίδι σου.</p>
        </div>

        {error && <Alert variant="destructive" className="mt-7"><AlertDescription>{error}</AlertDescription></Alert>}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="Email Address" value={email} onChange={(event) => setEmail(event.target.value)} required className="h-13 rounded-lg border-slate-300 px-4 focus-visible:border-primary" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Κωδικός</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required className="h-13 rounded-lg border-slate-300 px-4 pr-12 focus-visible:border-primary" />
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((current) => !current)} className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}>{showPassword ? <EyeOff /> : <Eye />}</Button>
            </div>
          </div>
          <Button type="submit" size="lg" disabled={loading} className="mt-3 h-12 w-full rounded-lg font-semibold shadow-lg shadow-primary/20">
            {loading ? "Σύνδεση..." : "Σύνδεση"}
          </Button>
          <p className="pt-2 text-center text-sm text-slate-600">Δεν έχεις λογαριασμό; <Link href="/register" className="font-semibold text-primary hover:underline">Ξεκίνα εδώ</Link></p>
        </form>
      </section>
    </main>
  );
}
