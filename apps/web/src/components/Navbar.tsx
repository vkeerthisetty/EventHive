import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Search,
  Bell,
  Sun,
  Moon,
  User,
  LogOut,
  Compass,
  Trophy,
  LayoutDashboard,
  Shield,
  Check,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { APP_NAME } from '@eventhive/shared';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  // Poll notifications every 30 seconds as required by Section 6.9
  useEffect(() => {
    if (!user) return;

    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/me/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/me/notifications/read-all', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    } catch {}
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <Link to="/" className="flex items-center space-x-2 text-primary font-bold text-xl tracking-tight shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-slate-900 dark:text-slate-100 font-extrabold">{APP_NAME}</span>
        </Link>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full bg-slate-100 dark:bg-slate-800/80 text-sm text-slate-800 dark:text-slate-200 pl-10 pr-4 py-2 rounded-xl border border-transparent focus:border-primary focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </form>

        {/* Navigation Items */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <Link
            to="/events"
            className="hidden sm:inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary transition rounded-lg min-h-tap"
          >
            Events
          </Link>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-tap min-w-tap flex items-center justify-center"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>

          {user && (
            /* Notification Bell */
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs(!showNotifs)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition relative min-h-tap min-w-tap flex items-center justify-center"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-white dark:ring-slate-900"></span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">No notifications yet</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3 text-xs leading-relaxed transition ${
                            !n.read_at ? 'bg-primary/5 dark:bg-primary/10' : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {n.payload?.title || n.type}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            {n.payload?.message || JSON.stringify(n.payload)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Avatar Menu or Login/Signup */}
          {user ? (
            <div className="relative" ref={avatarRef}>
              <button
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition min-h-tap"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-primary flex items-center justify-center font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </button>

              {showAvatarMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-2 z-50 animate-fade-in text-sm">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{user.role} • {user.department}</p>
                  </div>

                  <Link
                    to="/me/profile"
                    onClick={() => setShowAvatarMenu(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    to="/me/events"
                    onClick={() => setShowAvatarMenu(false)}
                    className="flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300 transition"
                  >
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>My Events</span>
                  </Link>

                  {(user.role === 'organizer' || user.role === 'admin') && (
                    <>
                      <Link
                        to="/organizer"
                        onClick={() => setShowAvatarMenu(false)}
                        className="flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-indigo-600 dark:text-indigo-400 font-medium transition"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Organizer Dashboard</span>
                      </Link>
                      <Link
                        to="/organizer/check-in"
                        onClick={() => setShowAvatarMenu(false)}
                        className="flex items-center space-x-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-indigo-600 dark:text-indigo-400 font-medium transition"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Scan Tickets</span>
                      </Link>
                    </>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                  <button
                    onClick={() => {
                      setShowAvatarMenu(false);
                      logout();
                    }}
                    className="w-full flex items-center space-x-2.5 px-4 py-2 text-danger hover:bg-danger/10 transition text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-primary transition rounded-xl"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 text-sm font-semibold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
