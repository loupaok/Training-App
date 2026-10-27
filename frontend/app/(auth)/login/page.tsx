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
    <main className="grid min-h-screen bg-black lg:bg-white lg:grid-cols-2">
      <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-black px-6 pb-[34px] pt-[68px] text-white sm:px-10 lg:min-h-screen lg:bg-white lg:px-14 lg:pb-8 lg:pt-11 lg:text-[#0b0b0b]">
        {backgroundImage && <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center lg:hidden" style={{ backgroundImage }} />}
        <div aria-hidden="true" className="absolute inset-0 bg-black/55 lg:hidden" />
        {logoUrl ? (
          <img key={logoUrl} src={logoUrl} alt={branding.appName} className="relative z-10 h-7 w-auto self-start object-contain brightness-0 invert lg:h-9 lg:brightness-100 lg:invert-0" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <>
            <img src="/brand/sp-team-logo-white.svg" alt="SP Team" className="relative z-10 h-7 w-auto self-start object-contain lg:hidden" />
            <img src="/brand/sp-team-logo-black.svg" alt="SP Team" className="relative z-10 hidden h-9 w-auto self-start object-contain lg:block" />
          </>
        )}

        <div className="relative z-10 mt-auto flex flex-none items-end justify-center lg:mt-0 lg:flex-1 lg:items-center">
          <div className="flex w-full max-w-[400px] flex-col gap-4 lg:gap-[18px] lg:py-0">
            <div className="flex items-center gap-3">
              <span style={{ width: "44px", height: "5px", background: "#b0f90c", transform: "skewX(-30deg)" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3.5px" }} className="uppercase text-[#d0d0d0] lg:text-[#444444]">Consistency creates results</span>
            </div>

            <div className="flex flex-col gap-[6px] [&>h1]:italic [&>h1]:uppercase [&>h1]:!text-white [&>p]:hidden lg:[&>h1]:not-italic lg:[&>h1]:normal-case lg:[&>h1]:!text-slate-900 lg:[&>p]:block">
              <h1 style={{ fontSize: "40px", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.05, margin: 0 }} className="text-slate-900">Καλώς ήρθες πίσω</h1>
              <p style={{ fontSize: "15px", lineHeight: 1.5, color: "#555555", margin: 0 }}>Συνδέσου για να συνεχίσεις το πρόγραμμά σου.</p>
            </div>

            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 lg:gap-[18px]">
              <div className="relative flex flex-col gap-2 pt-1.5 lg:static">
                <Label htmlFor="email" style={{ fontSize: "13px", fontWeight: 700 }} className="absolute left-4 top-[11px] z-10 text-[11px] text-[#b0f90c] lg:static lg:text-[13px] lg:text-inherit">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="το email σου"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="h-[58px] rounded-[14px] border border-[#b0f90c] bg-[#161616] px-4 pb-1 pt-6 text-white placeholder:text-[#777] focus-visible:border-[#b0f90c] focus-visible:ring-2 focus-visible:ring-[#b0f90c]/30 lg:h-[52px] lg:rounded-xl lg:border-[1.5px] lg:border-[#0b0b0b] lg:bg-white lg:p-4 lg:text-slate-900 lg:placeholder:text-slate-400 lg:focus-visible:border-[#0b0b0b] lg:focus-visible:ring-[4px] lg:focus-visible:ring-[rgba(176,249,12,0.45)]"
                />
              </div>
              <div className="relative flex flex-col gap-2 [&_label]:absolute [&_label]:left-4 [&_label]:top-[11px] [&_label]:z-10 [&_label]:text-[11px] [&_label]:text-[#8a8a8a] [&_a]:hidden lg:[&_label]:static lg:[&_label]:text-[13px] lg:[&_label]:text-inherit lg:[&_a]:block">
                <div className="contents lg:flex lg:items-baseline lg:justify-between">
                  <Label htmlFor="password" style={{ fontSize: "13px", fontWeight: 700 }}>Κωδικός</Label>
                  <a href={`mailto:${contactEmail}`} style={{ fontSize: "13px", fontWeight: 600, color: "#555555" }} className="hover:underline">Ξέχασες τον κωδικό;</a>
                </div>
                <div className="relative [&_button]:!text-[#aaa] [&_button]:hover:!bg-transparent [&_button]:hover:!text-white lg:[&_button]:!text-[#6a6a6a] lg:[&_button]:hover:!bg-accent/10 lg:[&_button]:hover:!text-[#0b0b0b]">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="ο κωδικός σου"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-[58px] rounded-[14px] border border-[#2a2a2a] bg-[#161616] px-4 pb-1 pt-6 pr-12 text-white placeholder:text-[#777] focus-visible:border-[#b0f90c] focus-visible:ring-2 focus-visible:ring-[#b0f90c]/30 lg:h-[52px] lg:rounded-xl lg:border-[#dcdcd8] lg:bg-white lg:p-4 lg:pr-12 lg:text-slate-900 lg:placeholder:text-slate-400 lg:focus-visible:border-lime-400 lg:focus-visible:ring-lime-400/30"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => setShowPassword((current) => !current)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#6a6a6a]" aria-label={showPassword ? "Απόκρυψη κωδικού" : "Εμφάνιση κωδικού"}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                </div>
                <a href={`mailto:${contactEmail}`} className="self-end text-[13px] font-semibold text-[#d0d0d0] hover:underline lg:hidden">Ξέχασες τον κωδικό;</a>
              </div>

              <label className="hidden w-fit cursor-pointer items-center gap-2.5 lg:flex" style={{ fontSize: "13px", color: "#444444" }}>
                <Checkbox
                  checked={remember}
                  onCheckedChange={(value) => setRemember(value === true)}
                  className="h-[18px] w-[18px] rounded-[5px] border-0 bg-[#0b0b0b] text-[#b0f90c] data-checked:border-0 data-checked:bg-[#0b0b0b]"
                />
                Να με θυμάσαι
              </label>

              <Button type="submit" variant="lime" disabled={loading} style={{ height: "56px", borderRadius: "999px" }} className="relative w-full bg-[#b0f90c] font-extrabold text-[#0b0b0b] hover:bg-[#c4ff3c] lg:h-[54px] lg:bg-[#0b0b0b] lg:text-white lg:hover:bg-[#1a1a1a]">
                {loading ? "Σύνδεση..." : "Σύνδεση"}
                <span className="ml-1 inline-flex items-center lg:absolute lg:right-2 lg:top-1/2 lg:ml-0 lg:grid lg:h-[30px] lg:w-[30px] lg:-translate-y-1/2 lg:place-items-center lg:rounded-full lg:bg-lime-400"><ArrowRight className="h-4 w-4 text-[#0b0b0b] lg:h-3.5 lg:w-3.5" /></span>
              </Button>

              <div className="hidden items-center gap-3 lg:flex" style={{ fontSize: "12px", color: "#9a9a9a" }}>
                <span className="h-px flex-grow" style={{ background: "#ececea" }} />ή<span className="h-px flex-grow" style={{ background: "#ececea" }} />
              </div>

              <div className="hidden items-center justify-between gap-3 rounded-[14px] p-4 lg:flex" style={{ backgroundColor: "#f6f6f3" }}>
                <div className="flex flex-col gap-0.5">
                  <span style={{ fontSize: "14px", fontWeight: 700 }}>Νέος στο SP Team;</span>
                  <span style={{ fontSize: "12px", color: "#6a6a6a" }}>Κλείσε δωρεάν κλήση γνωριμίας</span>
                </div>
                <Button asChild variant="lime" style={{ height: "38px", borderRadius: "999px", fontSize: "13px" }} className="shrink-0 px-4 font-extrabold">
                  <Link href="/register">Ξεκίνα εδώ</Link>
                </Button>
              </div>
            </form>
            <p className="text-center text-sm text-[#9a9a9a] lg:hidden">Δεν έχεις λογαριασμό; <Link href="/register" className="font-extrabold text-white underline decoration-[#b0f90c] decoration-2 underline-offset-4">Ξεκίνα εδώ</Link></p>
            <nav className="flex items-center justify-center gap-4 text-[11px] text-[#6a6a6a] lg:hidden">
              <Link href="/terms" className="hover:text-white">Όροι</Link>
              <Link href="/privacy" className="hover:text-white">Απόρρητο</Link>
              <a href={`mailto:${contactEmail}`} className="hover:text-white">Βοήθεια</a>
            </nav>
          </div>
        </div>

        <footer className="hidden flex-wrap items-center justify-between gap-3 pt-6 lg:flex" style={{ fontSize: "12px", color: "#8a8a8a" }}>
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
