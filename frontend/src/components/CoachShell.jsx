import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MenuToggle, TopbarActions } from './TopbarControls';

// Single source of truth for the coach/admin nav — every page used to keep its own copy of this,
// which had drifted out of sync (different ordering, wrong page marked active, AdminDashboard had
// none at all). `active` is now derived from the route, not hardcoded per page.
const navSections = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'clients', label: 'Πελάτες', path: '/clients' },
  { key: 'updates', label: 'Updates Πελατών', path: '/updates' },
  { key: 'exercises', label: 'Βιβλιοθήκη Ασκήσεων', path: '/exercises' },
  { key: 'analytics', label: 'Analytics', path: '/analytics' },
  { key: 'media', label: 'Media Library', path: '/media-library' },
  { key: 'team', label: 'Team', path: '/team' },
  { key: 'notifications', label: 'Ειδοποιήσεις', path: '/notifications', spacerBefore: true },
  {
    key: 'settings',
    label: 'Ρυθμίσεις',
    coachOrAdminOnly: true,
    children: [
      { key: 'discord', label: 'Discord' },
      { key: 'pricing-plans', label: 'Πλάνα & Τιμές', path: '/pricing-plans' },
      { key: 'branding', label: 'Branding' },
    ],
  },
  { key: 'admin', label: 'Admin Panel', path: '/admin', adminOnly: true, spacerBefore: true },
];

function isActivePath(pathname, path) {
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

const API_ORIGIN = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function getInitials(name) {
  return String(name || 'CA')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CA';
}

export function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${String(url).replace(/^\/+/, '')}`;
}

// photoUrl is optional — pages that only ever show initials (no profile photo concept) can omit
// it. This is also what the topbar's own avatar renders, so it must support it: a coach/admin's
// own profile_photo needs to show there too, not just on client rows.
export function Avatar({ initials, tone = 'bg-slate-900', size = 'h-10 w-10', photoUrl }) {
  const src = resolveMediaUrl(photoUrl);
  if (src) {
    return <img src={src} alt="" className={`${size} rounded-full object-cover shadow-sm`} />;
  }

  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export function ViewAllButton({ children = 'Προβολή όλων' }) {
  return (
    <button className="mt-5 h-11 w-full rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:border-red-200 hover:text-red-600">
      {children}
    </button>
  );
}

function CoachSidebar({ user }) {
  const { pathname } = useLocation();
  const canSeeCoachSettings = user?.role === 'admin' || user?.role === 'coach';
  const isAdmin = user?.role === 'admin';
  const settingsHasActiveChild = navSections
    .find((section) => section.key === 'settings')
    ?.children?.some((child) => isActivePath(pathname, child.path));
  const [settingsOpen, setSettingsOpen] = React.useState(Boolean(settingsHasActiveChild));

  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">
          K
        </div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {navSections
            .filter((section) => (!section.coachOrAdminOnly || canSeeCoachSettings) && (!section.adminOnly || isAdmin))
            .map((section) => {
              const active = isActivePath(pathname, section.path);
              const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
                active ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'
              }`;

              const item = section.children ? (
                <button onClick={() => setSettingsOpen((value) => !value)} className={className}>
                  <span className="truncate">{section.label}</span>
                  <span className={`ml-auto text-xs transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>⌄</span>
                </button>
              ) : section.path ? (
                <Link to={section.path} className={className}>
                  <span className="truncate">{section.label}</span>
                </Link>
              ) : (
                <button className={className}>
                  <span className="truncate">{section.label}</span>
                </button>
              );

              return (
                <div key={section.key} className={section.spacerBefore ? 'mt-6' : ''}>
                  {item}
                  {section.children && canSeeCoachSettings && (
                    <div
                      className={`ml-4 overflow-hidden border-l border-white/10 pl-3 transition-all duration-200 ${
                        settingsOpen ? 'mt-1 max-h-40 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                    >
                      {section.children.map((child) =>
                        child.path ? (
                          <Link
                            key={child.key}
                            to={child.path}
                            className={`flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold ${
                              isActivePath(pathname, child.path) ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ) : (
                          <button key={child.key} className="flex h-10 w-full items-center rounded-md px-4 text-left text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">
                            {child.label}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <Avatar initials={getInitials(user?.fullName)} tone="bg-red-600" size="h-12 w-12" photoUrl={user?.profilePhoto} />
          <div>
            <div className="font-bold">{user?.fullName || 'Coach Admin'}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Online
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function CoachTopbar({ title, user, logout, sidebarOpen, onToggleSidebar }) {
  return (
    <header
      className={`fixed ${sidebarOpen ? 'left-[300px]' : 'left-0'} right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 shadow-sm transition-all duration-200`}
    >
      <div className="flex items-center gap-9">
        <MenuToggle onClick={onToggleSidebar} />
        <h1 className="text-2xl font-extrabold">{title}</h1>
      </div>

      <TopbarActions user={user} logout={logout} Avatar={Avatar} />
    </header>
  );
}

// Wraps every coach/admin page with the shared sidebar + topbar. `title` shows in the topbar;
// pass whatever the page's own heading was. `user`/`logout` come from useAuth() in the page.
export function CoachShell({ title, user, logout, children }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {sidebarOpen && <CoachSidebar user={user} />}
      <CoachTopbar title={title} user={user} logout={logout} sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((value) => !value)} />

      <main className={`${sidebarOpen ? 'ml-[300px]' : 'ml-0'} pt-[86px] transition-all duration-200`}>
        <div className="px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
