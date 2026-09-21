import {
  LayoutDashboard,
  Users,
  RefreshCw,
  Dumbbell,
  BarChart3,
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
  Megaphone,
  ScrollText,
  MessageCircleMore,
  LayoutTemplate,
  Apple,
  Images,
  HelpCircle,
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
  {
    key: "templates",
    label: "Πρότυπα Πλάνων",
    icon: LayoutTemplate,
    coachOrAdminOnly: true,
    children: [
      { key: "templates-training", label: "Πρότυπα Προπόνησης", path: "/coach/templates/training", icon: Dumbbell },
      { key: "templates-nutrition", label: "Πρότυπα Διατροφής", path: "/coach/templates/nutrition", icon: Salad },
    ],
  },
  { key: "foods", label: "Βιβλιοθήκη Τροφίμων", path: "/coach/foods", icon: Apple, coachOrAdminOnly: true },
  { key: "exercise-media", label: "Media", path: "/coach/media", icon: Images, coachOrAdminOnly: true },
  { key: "analytics", label: "Analytics", path: "/analytics", icon: BarChart3 },
  { key: "changelog", label: "Αλλαγές & Νέα", path: "/changelog", icon: ScrollText },
  { key: "notifications", label: "Ειδοποιήσεις", path: "/notifications", icon: Bell, spacerBefore: true },
  {
    key: "settings",
    label: "Ρυθμίσεις",
    icon: Settings,
    coachOrAdminOnly: true,
    children: [
      { key: "discord", label: "Discord", icon: MessageCircle },
      { key: "pricing-plans", label: "Πλάνα & Τιμές", path: "/coach/pricing", icon: Tag },
      { key: "questionnaire", label: "Ερωτηματολόγιο", path: "/coach/questionnaire", icon: HelpCircle },
      { key: "branding", label: "Branding", path: "/coach/branding", icon: Palette },
    ],
  },
  { key: "admin", label: "Admin Panel", path: "/admin", icon: Shield, adminOnly: true, spacerBefore: true },
  {
    key: "manual-notifications",
    label: "Manual Notifications",
    path: "/manual-notifications",
    icon: Megaphone,
    adminOnly: true,
  },
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
  { label: "Αλλαγές & Νέα", path: "/changelog", key: "changelog", icon: ScrollText },
  { label: "Μηνύματα", path: "/client-messages", key: "messages", icon: MessageCircleMore },
  { label: "Ειδοποιήσεις", path: "/client-notifications", key: "notifications", icon: Bell, spacerBefore: true },
];

export function isActivePath(pathname: string, path?: string): boolean {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}
