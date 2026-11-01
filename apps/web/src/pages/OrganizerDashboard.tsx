import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, PlusCircle } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getDemoEvents } from '../lib/demoEvents';

export const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    setLoading(true);

    try {
      const demoEvents = getDemoEvents();

      /*
        For demo purposes, show events created in this browser.
        Later this can be replaced with API events belonging
        to the logged-in organizer.
      */

      const organizerEvents = demoEvents.filter(
        (event) =>
          !user?.name ||
          event.organizer_name === user.name
      );

      setEvents(organizerEvents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    const handleUpdate = () => {
      loadDashboard();
    };

    window.addEventListener(
      'demo-events-updated',
      handleUpdate
    );

    window.addEventListener(
      'storage',
      handleUpdate
    );

    return () => {
      window.removeEventListener(
        'demo-events-updated',
        handleUpdate
      );

      window.removeEventListener(
        'storage',
        handleUpdate
      );
    };
  }, [user]);

  const totalEvents = events.length;

  const totalRegistrations = events.reduce(
    (total, event) =>
      total + (event.registrationCount || 0),
    0
  );

  const totalAttended = events.reduce(
    (total, event) =>
      total + (event.confirmedCount || 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">

        <div>

          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            Organizer Portal
          </span>

          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            Organizer Dashboard
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            Create and manage demo campus events.
          </p>

        </div>

        <Link
          to="/organizer/create"
          className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          Create Event
        </Link>

      </div>

      {/* METRICS */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">

          <span className="text-xs font-bold uppercase text-slate-400">
            Managed Events
          </span>

          <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
            {totalEvents}
          </p>

        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">

          <span className="text-xs font-bold uppercase text-slate-400">
            Total Registrations
          </span>

          <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {totalRegistrations}
          </p>

        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">

          <span className="text-xs font-bold uppercase text-slate-400">
            Confirmed Attendees
          </span>

          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {totalAttended}
          </p>

        </div>

      </div>

      {/* EVENTS */}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">

        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">

          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Your Events
          </h2>

          <span className="text-xs text-slate-400">
            Stored locally for demo
          </span>

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

            <p className="text-xs text-slate-400 mt-1 mb-5">
              Create your first demo event to see it here.
            </p>

            <Link
              to="/organizer/create"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
            >
              <PlusCircle className="w-4 h-4" />
              Create Your First Event
            </Link>

          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-left text-sm">

              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase text-slate-500">

                <tr>

                  <th className="px-6 py-3.5">
                    Event
                  </th>

                  <th className="px-6 py-3.5">
                    Date & Venue
                  </th>

                  <th className="px-6 py-3.5 text-center">
                    Registrations
                  </th>

                  <th className="px-6 py-3.5 text-center">
                    Status
                  </th>

                  <th className="px-6 py-3.5 text-right">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                {events.map((event) => (

                  <tr
                    key={event.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                  >

                    <td className="px-6 py-4">

                      <Link
                        to={`/events/${event.id}`}
                        className="font-bold text-slate-900 dark:text-white hover:underline"
                      >
                        {event.title}
                      </Link>

                      <span className="block text-xs text-slate-400 mt-0.5">
                        {event.category}
                      </span>

                    </td>

                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">

                      <div>
                        {new Date(
                          event.starts_at
                        ).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>

                      <div className="text-slate-400">
                        {event.venue_name}
                      </div>

                    </td>

                    <td className="px-6 py-4 text-center font-bold text-xs">

                      {event.registrationCount} / {event.capacity}

                    </td>

                    <td className="px-6 py-4 text-center">

                      <span className="inline-flex px-2 py-1 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">

                        {event.status.toUpperCase()}

                      </span>

                    </td>

                    <td className="px-6 py-4 text-right">

                      <Link
                        to={`/events/${event.id}`}
                        className="text-indigo-600 hover:underline text-xs font-bold"
                      >
                        View Event
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