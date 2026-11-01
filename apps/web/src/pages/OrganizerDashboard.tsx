import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEMO_EVENTS = [
  {
    id: '1',
    title: 'AI & Machine Learning Workshop',
    category: 'Technology',
    startsAt: '2026-11-15T10:00:00',
    venueName: 'Main Auditorium',
    registrationCount: 42,
    capacity: 100,
    status: 'published',
  },
  {
    id: '2',
    title: 'Web Development Bootcamp',
    category: 'Technology',
    startsAt: '2026-11-20T14:00:00',
    venueName: 'Computer Lab',
    registrationCount: 28,
    capacity: 50,
    status: 'published',
  },
];

export const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo-only dashboard data
    setEvents(DEMO_EVENTS);
    setLoading(false);
  }, []);

  const stats = {
    totalEvents: events.length,
    totalRegistrations: events.reduce(
      (total, event) => total + event.registrationCount,
      0
    ),
    totalAttended: 38,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Organizer Portal
          </span>

          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            Organizer Dashboard
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Welcome back, {user?.name}. View your event activity at a glance.
          </p>
        </div>

        <span className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
          Demo Mode
        </span>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">
            Managed Events
          </span>

          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {stats.totalEvents}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">
            Total Registrations
          </span>

          <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {stats.totalRegistrations}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-400">
            Verified Attendances
          </span>

          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {stats.totalAttended}
          </p>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Your Campus Events
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">
            Loading dashboard...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />

            <p className="text-base font-bold text-slate-700 dark:text-slate-300">
              No events created yet
            </p>

            <p className="text-xs text-slate-400 mt-1">
              No events are assigned to this organizer yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Event</th>
                  <th className="px-6 py-3.5">Date & Venue</th>
                  <th className="px-6 py-3.5 text-center">
                    Registrations
                  </th>
                  <th className="px-6 py-3.5 text-center">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {events.map((ev) => (
                  <tr
                    key={ev.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                  >
                    <td className="px-6 py-4">
                      <Link
                        to={`/events/${ev.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:underline"
                      >
                        {ev.title}
                      </Link>

                      <span className="block text-xs text-slate-400 mt-0.5">
                        {ev.category}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        {new Date(ev.startsAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <div className="text-slate-400">
                        {ev.venueName}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {ev.registrationCount} / {ev.capacity}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                          ev.status === 'published'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {ev.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/events/${ev.id}`}
                        className="text-indigo-600 hover:underline text-xs font-semibold"
                      >
                        View event
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};