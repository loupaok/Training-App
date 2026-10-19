import { Mail, Phone, MapPin } from "./icons";
import { FadeIn } from "./FadeIn";
import { ContactForm } from "./ContactForm";
import type { getSiteContent } from "@/lib/keystatic/reader";

type Content = Awaited<ReturnType<typeof getSiteContent>>;

export function Contact({ contact, settings }: { contact: Content["contact"]; settings: Content["settings"] }) {
  return (
    <section id="contact" className="bg-navy-900 py-24 text-white sm:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-5">
        <FadeIn className="lg:col-span-2">
          <p className="text-xs font-bold uppercase tracking-wide text-lime">{contact?.eyebrow || "Επικοινωνία"}</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{contact?.heading || "Ξεκίνα το ταξίδι σου σήμερα"}</h2>
          <p className="mt-4 text-white/70">
            {contact?.subheading || "Συμπλήρωσε τη φόρμα και θα επικοινωνήσουμε μαζί σου εντός 24 ωρών."}
          </p>

          <div className="mt-10 space-y-5">
            {settings?.phone && (
              <a href={`tel:${settings.phone}`} className="flex items-center gap-3 text-sm font-semibold text-white/90 hover:text-lime">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
                  <Phone className="h-4 w-4" />
                </span>
                {settings.phone}
              </a>
            )}
            {settings?.email && (
              <a href={`mailto:${settings.email}`} className="flex items-center gap-3 text-sm font-semibold text-white/90 hover:text-lime">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
                  <Mail className="h-4 w-4" />
                </span>
                {settings.email}
              </a>
            )}
            {settings?.address && (
              <div className="flex items-center gap-3 text-sm font-semibold text-white/90">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
                  <MapPin className="h-4 w-4" />
                </span>
                {settings.address}
              </div>
            )}
          </div>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-3">
          <div className="rounded-3xl bg-white p-8 text-navy-900 shadow-2xl sm:p-10">
            <ContactForm />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
