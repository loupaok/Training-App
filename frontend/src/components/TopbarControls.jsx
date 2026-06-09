import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const NOTIFICATION_COUNT_KEY = 'coachUnreadNotifications';
const DEFAULT_NOTIFICATION_COUNT = 7;

export function getUnreadNotificationCount() {
  const stored = window.localStorage.getItem(NOTIFICATION_COUNT_KEY);
  if (stored === null) {
    window.localStorage.setItem(NOTIFICATION_COUNT_KEY, String(DEFAULT_NOTIFICATION_COUNT));
    return DEFAULT_NOTIFICATION_COUNT;
  }
  return Number(stored) || 0;
}

export function clearUnreadNotifications() {
  window.localStorage.setItem(NOTIFICATION_COUNT_KEY, '0');
  window.dispatchEvent(new CustomEvent('coach-notifications-read'));
}

const icons = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m2 0a2 2 0 0 0 4 0',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z',
  logout: 'M10 17l5-5-5-5M15 12H3M21 4v16',
  chevron: 'M6 9l6 6 6-6',
};

export function SvgIcon({ name, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

export function MenuToggle({ onClick }) {
  return (
    <button onClick={onClick} className="grid h-10 w-10 place-items-center rounded-md text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10" aria-label="Toggle menu">
      <SvgIcon name="menu" />
    </button>
  );
}

export function TopbarActions({ user, logout, Avatar }) {
  const { updateUser } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: user?.fullName || '', profileTitle: user?.profileTitle || '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(() => getUnreadNotificationCount());
  const location = useLocation();
  const isClient = user?.role === 'client';
  const notificationsPath = isClient ? '/client-notifications' : '/notifications';
  const visibleUnreadNotifications = isClient ? 0 : unreadNotifications;

  useEffect(() => {
    const updateCount = () => setUnreadNotifications(getUnreadNotificationCount());
    window.addEventListener('storage', updateCount);
    window.addEventListener('coach-notifications-read', updateCount);
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('coach-notifications-read', updateCount);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === notificationsPath) clearUnreadNotifications();
  }, [location.pathname, notificationsPath]);

  useEffect(() => {
    setProfileForm({ fullName: user?.fullName || '', profileTitle: user?.profileTitle || '' });
  }, [user?.fullName, user?.profileTitle]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    try {
      const data = await api.put('/auth/profile', profileForm);
      updateUser({ ...user, ...data.user });
      setProfileMessage('Το προφίλ ενημερώθηκε.');
      window.setTimeout(() => {
        setEditProfileOpen(false);
        setProfileMessage('');
      }, 700);
    } catch (error) {
      setProfileError(error.message || 'Δεν έγινε αποθήκευση.');
    }
  };

  return (
    <div className="relative flex items-center gap-5 text-slate-900 dark:text-white">
      <Link
        to={notificationsPath}
        onClick={clearUnreadNotifications}
        className="relative grid h-10 w-10 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10"
        aria-label="Notifications"
      >
        <SvgIcon name="bell" />
        {visibleUnreadNotifications > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-black leading-none text-white shadow-sm">
            {visibleUnreadNotifications}
          </span>
        )}
      </Link>

      <button className="grid h-10 w-10 place-items-center rounded-md hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Messages">
        <SvgIcon name="mail" />
      </button>

      <button onClick={() => setProfileOpen((value) => !value)} className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-slate-100 dark:hover:bg-white/10">
        <Avatar initials={(user?.fullName || user?.email || 'CA').slice(0, 2).toUpperCase()} tone="bg-slate-900" size="h-11 w-11" photoUrl={user?.profilePhoto} />
        <span className="text-left">
          <span className="block font-bold leading-tight">{user?.fullName || 'Coach Admin'}</span>
          {user?.profileTitle && <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">{user.profileTitle}</span>}
        </span>
        <SvgIcon name="chevron" className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
      </button>

      {profileOpen && (
        <div className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {isClient ? (
            <Link to="/client-profile" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/10">
              <SvgIcon name="user" className="h-4 w-4" />
              Επεξεργασία Προφίλ
            </Link>
          ) : (
            <button
              onClick={() => {
                setEditProfileOpen(true);
                setProfileOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/10"
            >
              <SvgIcon name="user" className="h-4 w-4" />
              Επεξεργασία προφίλ
            </button>
          )}
          <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50">
            <SvgIcon name="logout" className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}

      {editProfileOpen && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/60 p-6">
          <form onSubmit={saveProfile} className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-extrabold">Επεξεργασία προφίλ</h2>
                <p className="mt-1 text-sm text-slate-500">Άλλαξε το όνομα και τον τίτλο που εμφανίζονται στο panel.</p>
              </div>
              <button type="button" onClick={() => setEditProfileOpen(false)} className="text-2xl text-slate-500 hover:text-red-600">×</button>
            </div>

            {profileError && <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{profileError}</div>}
            {profileMessage && <div className="mt-5 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{profileMessage}</div>}

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Όνομα και επίθετο</span>
                <input
                  value={profileForm.fullName}
                  onChange={(event) => setProfileForm((form) => ({ ...form, fullName: event.target.value }))}
                  required
                  className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Τίτλος</span>
                <input
                  value={profileForm.profileTitle}
                  onChange={(event) => setProfileForm((form) => ({ ...form, profileTitle: event.target.value }))}
                  placeholder="π.χ. Admin"
                  className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-red-300"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditProfileOpen(false)} className="h-11 rounded-md border border-slate-200 px-5 font-bold hover:border-red-200 hover:text-red-600">
                Άκυρο
              </button>
              <button type="submit" className="h-11 rounded-md bg-red-600 px-5 font-bold text-white hover:bg-red-700">
                Αποθήκευση
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
