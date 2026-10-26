"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { useBranding } from "@/contexts/BrandingContext";
import { resolveMediaUrl } from "@/lib/media";
import { greekCaps } from "@/lib/utils";

const contactEmail = process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL || "support@example.com";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [brandingVersion, setBrandingVersion] = useState<string | null>(null);
  const { login, loading } = useAuth();
  const { branding, refreshBranding } = useBranding();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    void refreshBranding()
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setBrandingVersion(String(Date.now()));
      });

    return () => {
      mounted = false;
    };
  }, [refreshBranding]);

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

  const versionedMediaUrl = (url: string | null) => {
    if (!url || !brandingVersion) return "";
    const resolvedUrl = resolveMediaUrl(url);
    return `${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}v=${brandingVersion}`;
  };
  const backgroundUrl = versionedMediaUrl(branding.loginBackgroundUrl);
  const backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : undefined;
  const loginLogoUrl = branding.loginLogoUrl || branding.logoUrl;
  const logoUrl = versionedMediaUrl(loginLogoUrl);

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14 lg:pb-8 lg:pt-11">
        {logoUrl ? (
          <img key={logoUrl} src={logoUrl} alt={branding.appName} className="h-9 w-auto self-start object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/sp-team-logo-black.svg" alt="SP Team" className="h-9 w-auto self-start object-contain" />
        )}

        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[400px] flex-col gap-[18px] py-10 lg:py-0">
            <div className="flex items-center gap-3">
              <span style={{ width: "44px", height: "5px", background: "#b0f90c", transform: "skewX(-30deg)" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3.5px", color: "#444444" }} className="uppercase">Consistency creates results</span>
            </div>

            <div className="flex flex-col gap-[6px]">
              <h1 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.05, margin: 0 }} className="text-slate-900">Καλώς ήρθες πίσω</h1>
              <p style={{ fontSize: "15px", lineHeight: 1.5, color: "#555555", margin: 0 }}>Συνδέσου για να συνεχίσεις το πρόγραμμά σου.</p>
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
              <div className="flex flex-col gap-2 pt-1.5">
                <Label htmlFor="email" style={{ fontSize: "13px", fontWeight: 700 }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="το email σου"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-[52px] rounded-xl border-[1.5px] border-[#0b0b0b] bg-white px-4 text-slate-900 placeholder:text-slate-400 focus-visible:border-[#0b0b0b] focus-visible:ring-[4px] focus-visible:ring-[rgba(176,249,12,0.45)] dark:bg-white dark:text-slate-900"
                />
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="password" style={{ fontSize: "13px", fontWeight: 700 }}>Κωδικός</Label>
                  <a href={`mailto:${contactEmail}`} style={{ fontSize: "13px", fontWeight: 600, color: "#555555" }} className="hover:underline">Ξέχασες τον κωδικό;</a>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="ο κωδικός σου"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-[52px] rounded-xl border-[#dcdcd8] bg-white px-4 pr-12 text-slate-900 placeholder:text-slate-400 focus-visible:border-lime-400 focus-visible:ring-lime-400/30 dark:bg-white dark:text-slate-900"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((current) => !current)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6a6a6a]" aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                </div>
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2.5" style={{ fontSize: "13px", color: "#444444" }}>
                <Checkbox
                  checked={remember}
                  onCheckedChange={(value) => setRemember(value === true)}
                  className="h-[18px] w-[18px] rounded-[5px] border-0 bg-[#0b0b0b] text-[#b0f90c] data-checked:border-0 data-checked:bg-[#0b0b0b]"
                />
                Να με θυμάσαι
              </label>

              <Button type="submit" disabled={loading} style={{ height: "54px", borderRadius: "999px", background: "#0b0b0b" }} className="relative w-full font-extrabold text-white hover:bg-[#1a1a1a]">
                {loading ? "Σύνδεση..." : "Σύνδεση"}
                <span className="absolute right-2 top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-full bg-lime-400"><ArrowRight className="h-3.5 w-3.5 text-[#0b0b0b]" /></span>
              </Button>

              <div className="flex items-center gap-3" style={{ fontSize: "12px", color: "#9a9a9a" }}>
                <span className="h-px flex-grow" style={{ background: "#ececea" }} />ή<span className="h-px flex-grow" style={{ background: "#ececea" }} />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-[14px] p-4" style={{ backgroundColor: "#f6f6f3" }}>
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>Νέος στο SP Team;</span>
                  <span style={{ fontSize: "12px", color: "#6a6a6a" }}>Κλείσε δωρεάν κλήση γνωριμίας</span>
                </div>
                <Button asChild variant="lime" style={{ height: "38px", borderRadius: "999px", fontSize: "13px" }} className="shrink-0 px-4 font-extrabold">
                  <Link href="/register">Ξεκίνα εδώ</Link>
                </Button>
              </div>
            </form>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 pt-6" style={{ fontSize: "12px", color: "#8a8a8a" }}>
          <p>© {new Date().getFullYear()} SP Team</p>
          <nav className="flex items-center gap-[18px]">
            <Link href="/terms" className="hover:underline">Όροι χρήσης</Link>
            <Link href="/privacy" className="hover:underline">Απόρρητο</Link>
            <a href={`mailto:${contactEmail}`} className="hover:underline">Βοήθεια</a>
          </nav>
        </footer>
      </div>

      <div
        className="relative hidden min-h-screen overflow-hidden bg-black lg:block"
        style={backgroundImage ? { backgroundImage, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
      >
        {!backgroundImage && <div className="absolute inset-0 grid place-items-center text-slate-700"><LockKeyhole className="h-16 w-16" /></div>}
        <div className="absolute inset-0 bg-black/55" />
        <span aria-hidden="true" className="pointer-events-none absolute -top-10 left-1/3 h-[140%] w-16 -skew-x-[18deg] bg-lime-400" />

        <div className="absolute right-6 top-6 flex items-center gap-3 rounded-2xl bg-black/40 px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-400 text-xs font-bold text-black">ΠΣ</span>
          <div>
            <p className="text-sm font-semibold text-white">Coach Παντελής</p>
            <p className="text-xs text-white/60">«Σε περιμένει το update σου»</p>
          </div>
        </div>

        <div className="absolute inset-x-10 bottom-10">
          <p style={{ fontSize: "50px", fontWeight: 800, fontStyle: "italic", letterSpacing: "-1.5px", lineHeight: 0.95 }} className="text-white">
            {greekCaps("Δεν χρειάζεσαι")}<br />MOTIVATION.<br />{greekCaps("Χρειάζεσαι")}<br /><span style={{ color: "#b0f90c" }}>{greekCaps("συνέπεια.")}</span>
          </p>
          <p className="mt-4 text-sm text-white/60">— Παντελής Σταυρουλάκης, founder &amp; head coach</p>
        </div>
      </div>
    </main>
  );
}
