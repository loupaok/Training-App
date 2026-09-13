export interface CoachNavChild {
  key: string;
  label: string;
  path?: string;
}

export interface CoachNavSection {
  key: string;
  label: string;
  path?: string;
  spacerBefore?: boolean;
  coachOrAdminOnly?: boolean;
  adminOnly?: boolean;
  children?: CoachNavChild[];
}

// Single source of truth for the coach/admin nav — every page used to keep its own copy of this,
// which had drifted out of sync (different ordering, wrong page marked active, AdminDashboard had
// none at all). `active` is derived from the route, not hardcoded per page.
export const coachNavSections: CoachNavSection[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "clients", label: "Πελάτες", path: "/clients" },
  { key: "updates", label: "Updates Πελατών", path: "/updates" },
  { key: "exercises", label: "Βιβλιοθήκη Ασκήσεων", path: "/exercises" },
  { key: "analytics", label: "Analytics", path: "/analytics" },
  { key: "media", label: "Media Library", path: "/media-library" },
  { key: "team", label: "Team", path: "/team" },
  { key: "notifications", label: "Ειδοποιήσεις", path: "/notifications", spacerBefore: true },
  {
    key: "settings",
    label: "Ρυθμίσεις",
    coachOrAdminOnly: true,
    children: [
      { key: "discord", label: "Discord" },
      { key: "pricing-plans", label: "Πλάνα & Τιμές", path: "/pricing-plans" },
      { key: "branding", label: "Branding" },
    ],
  },
  { key: "admin", label: "Admin Panel", path: "/admin", adminOnly: true, spacerBefore: true },
];

export interface ClientNavSection {
  key: string;
  label: string;
  path?: string;
  locked?: boolean;
  spacerBefore?: boolean;
}

export const clientNavSections: ClientNavSection[] = [
  { label: "Αρχική", path: "/client-dashboard", key: "dashboard" },
  { label: "Πρόγραμμα", path: "/client-program", locked: true, key: "training" },
  { label: "Διατροφή", locked: true, key: "nutrition" },
  { label: "Progress", locked: true, key: "progress" },
  { label: "Πληρωμές και Συνδρομή", path: "/client-billing", key: "billing" },
  { label: "Προφίλ", path: "/client-profile", key: "profile" },
  { label: "Ειδοποιήσεις", path: "/client-notifications", key: "notifications", spacerBefore: true },
];

export function isActivePath(pathname: string, path?: string): boolean {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}
