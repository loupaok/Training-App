import {
  LayoutDashboard,
  Users,
  RefreshCw,
  Dumbbell,
  BarChart3,
  Image as ImageIcon,
  UsersRound,
  Bell,
  Settings,
  MessageCircle,
  Tag,
  Palette,
  Shield,
  Home,
  Salad,
  TrendingUp,
  CreditCard,
  User,
  type LucideIcon,
} from "lucide-react";

export interface CoachNavChild {
  key: string;
  label: string;
  path?: string;
  icon?: LucideIcon;
}

export interface CoachNavSection {
  key: string;
  label: string;
  path?: string;
  icon?: LucideIcon;
  spacerBefore?: boolean;
  coachOrAdminOnly?: boolean;
  adminOnly?: boolean;
  children?: CoachNavChild[];
}

// Single source of truth for the coach/admin nav — every page used to keep its own copy of this,
// which had drifted out of sync (different ordering, wrong page marked active, AdminDashboard had
// none at all). `active` is derived from the route, not hardcoded per page.
export const coachNavSections: CoachNavSection[] = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { key: "clients", label: "Πελάτες", path: "/clients", icon: Users },
  { key: "updates", label: "Updates Πελατών", path: "/updates", icon: RefreshCw },
  { key: "exercises", label: "Βιβλιοθήκη Ασκήσεων", path: "/exercises", icon: Dumbbell },
  { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3 },
  { key: "media", label: "Media Library", path: "/media-library", icon: ImageIcon },
  { key: "team", label: "Team", path: "/team", icon: UsersRound },
  { key: "notifications", label: "Ειδοποιήσεις", path: "/notifications", icon: Bell, spacerBefore: true },
  {
    key: "settings",
    label: "Ρυθμίσεις",
    icon: Settings,
    coachOrAdminOnly: true,
    children: [
      { key: "discord", label: "Discord", icon: MessageCircle },
      { key: "pricing-plans", label: "Πλάνα & Τιμές", path: "/pricing-plans", icon: Tag },
      { key: "branding", label: "Branding", icon: Palette },
    ],
  },
  { key: "admin", label: "Admin Panel", path: "/admin", icon: Shield, adminOnly: true, spacerBefore: true },
];

export interface ClientNavSection {
  key: string;
  label: string;
  path?: string;
  icon?: LucideIcon;
  locked?: boolean;
  spacerBefore?: boolean;
}

export const clientNavSections: ClientNavSection[] = [
  { label: "Αρχική", path: "/client-dashboard", key: "dashboard", icon: Home },
  { label: "Πρόγραμμα", path: "/client-program", locked: true, key: "training", icon: Dumbbell },
  { label: "Διατροφή", locked: true, key: "nutrition", icon: Salad },
  { label: "Progress", locked: true, key: "progress", icon: TrendingUp },
  { label: "Πληρωμές και Συνδρομή", path: "/client-billing", key: "billing", icon: CreditCard },
  { label: "Προφίλ", path: "/client-profile", key: "profile", icon: User },
  { label: "Ειδοποιήσεις", path: "/client-notifications", key: "notifications", icon: Bell, spacerBefore: true },
];

export function isActivePath(pathname: string, path?: string): boolean {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}
