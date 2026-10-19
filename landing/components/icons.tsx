type IconProps = { className?: string };

const base = "stroke-current fill-none";

export function Sun({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" className={base} />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" className={base} />
    </svg>
  );
}

export function Moon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" className={base} />
    </svg>
  );
}

export function Menu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" className={base} />
    </svg>
  );
}

export function X({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" className={base} />
    </svg>
  );
}

export function ArrowRight({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" className={base} />
    </svg>
  );
}

export function Star({ className, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={1.5} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
    </svg>
  );
}

export function Mail({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" className={base} />
      <path d="m3 7 9 6 9-6" className={base} />
    </svg>
  );
}

export function Phone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v2a2 2 0 0 1-2.18 2 19.72 19.72 0 0 1-8.63-3.07 19.42 19.42 0 0 1-6-6A19.72 19.72 0 0 1 2.11 3.18 2 2 0 0 1 4.11 1h2a2 2 0 0 1 2 1.72c.13.96.36 1.9.68 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.32 1.85.55 2.81.68A2 2 0 0 1 22 16.92Z" className={base} />
    </svg>
  );
}

export function MapPin({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" className={base} />
      <circle cx="12" cy="10" r="3" className={base} />
    </svg>
  );
}

export function CheckCircle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" className={base} />
      <path d="m9 12 2 2 4-4" className={base} />
    </svg>
  );
}

export function Instagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" className={base} />
      <circle cx="12" cy="12" r="4" className={base} />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Facebook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" className={base} />
    </svg>
  );
}

export function Youtube({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="4" className={base} />
      <path d="m10 9 6 3-6 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTok({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.75V15a6 6 0 1 1-6-6h.5v3.3H10a2.7 2.7 0 1 0 2.7 2.7V3Z" className={base} />
    </svg>
  );
}
