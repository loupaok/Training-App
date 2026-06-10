import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuToggle, TopbarActions } from './TopbarControls';

const clientNavSections = [
  { label: 'Αρχική', path: '/client-dashboard', key: 'dashboard' },
  { label: 'Πρόγραμμα', path: '/client-program', locked: true, key: 'training' },
  { label: 'Διατροφή', locked: true, key: 'nutrition' },
  { label: 'Progress', locked: true, key: 'progress' },
  { label: 'Πληρωμές και Συνδρομή', path: '/client-billing', key: 'billing' },
  { label: 'Προφίλ', path: '/client-profile', key: 'profile' },
  { label: 'Ειδοποιήσεις', path: '/client-notifications', key: 'notifications', spacerBefore: true },
];

const API_ORIGIN = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

function resolveMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/uploads')) return `${API_ORIGIN}${url}`;
  return `${API_ORIGIN}/${url.replace(/^\/+/, '')}`;
}

export function ClientAvatar({ initials, tone = 'bg-red-600', size = 'h-10 w-10', photoUrl }) {
  const resolvedPhoto = resolveMediaUrl(photoUrl);
  if (resolvedPhoto) {
    return <img src={resolvedPhoto} alt="" className={`${size} rounded-full object-cover shadow-sm`} />;
  }

  return (
    <div className={`${size} ${tone} grid place-items-center rounded-full text-xs font-bold text-white shadow-sm`}>
      {initials}
    </div>
  );
}

export function ClientSidebar({ user, paymentApproved, unreadNotifications = 0, active = 'dashboard' }) {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-[300px] flex-col bg-[#07131d] text-white shadow-2xl">
      <div className="flex h-[86px] items-center gap-3 px-8">
        <div className="grid h-12 w-12 place-items-center rounded-full border-4 border-red-600 text-2xl font-black text-red-500">K</div>
        <div className="text-xl font-extrabold tracking-wide">COACH PANEL</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="space-y-1">
          {clientNavSections.map((section) => {
            const isLocked = section.locked && !paymentApproved;
            const isActive = active === section.key;
            const className = `flex h-12 w-full items-center rounded-md px-4 text-left text-[15px] font-semibold ${
              isActive ? 'bg-red-600 text-white shadow-lg shadow-red-950/30' : 'text-slate-100 hover:bg-white/10'
            } ${isLocked ? 'cursor-not-allowed opacity-45 blur-[1px]' : ''}`;

            const content = (
              <>
                <span className="truncate">{section.label}</span>
                {section.key === 'notifications' && unreadNotifications > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-xs text-white">{unreadNotifications}</span>
                )}
                {isLocked && <span className="ml-auto text-xs">Κλειδωμένο</span>}
              </>
            );

            return (
              <div key={section.key} className={section.spacerBefore ? 'mt-6' : ''}>
                {section.path && !isLocked ? (
                  <Link to={section.path} className={className}>{content}</Link>
                ) : (
                  <button type="button" disabled={isLocked} className={className}>{content}</button>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-white/10 p-7">
        <div className="flex items-center gap-3">
          <ClientAvatar initials={(user?.fullName || user?.email || 'CL').slice(0, 2).toUpperCase()} tone="bg-red-600" size="h-12 w-12" photoUrl={user?.profilePhoto} />
          <div className="min-w-0">
            <div className="truncate font-bold">{user?.fullName || 'Client'}</div>
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

export function ClientTopbar({ user, logout, sidebarOpen, onToggleSidebar, title = 'Αρχική' }) {
  return (
    <header className={`fixed ${sidebarOpen ? 'left-[300px]' : 'left-0'} right-0 top-0 z-10 flex h-[86px] items-center justify-between border-b border-slate-200 bg-white px-10 text-slate-950 shadow-sm transition-all duration-200 dark:border-slate-800 dark:bg-slate-950 dark:text-white`}>
      <div className="flex items-center gap-9">
        <MenuToggle onClick={onToggleSidebar} />
        <h1 className="text-2xl font-extrabold">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <TopbarActions user={user} logout={logout} Avatar={ClientAvatar} />
      </div>
    </header>
  );
}

function ThemeSwitcher() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`h-9 rounded px-3 text-xs font-black ${theme === 'light' ? 'bg-white text-red-600 shadow-sm dark:bg-slate-800' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`h-9 rounded px-3 text-xs font-black ${theme === 'dark' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'}`}
      >
        Dark
      </button>
    </div>
  );
}
