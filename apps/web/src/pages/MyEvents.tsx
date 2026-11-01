import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { formatEventDateTime } from '@eventhive/shared';
import { LivingQrModal } from '../components/LivingQrModal';
import { getDemoEvents } from '../lib/demoEvents';
import { getDemoRegistrations } from '../lib/demoRegistrations';

export const MyEvents: React.FC = () => {
  const [tab, setTab] = useState<'upcoming' | 'waitlisted' | 'past' | 'cancelled'>('upcoming');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/me/events?tab=${tab}`, { credentials: 'include' })
      .then(async (res) => { if (!res.ok) throw new Error('Failed to load your events'); return res.json(); })
      .then((data) => {
        const localItems = getDemoRegistrations().flatMap((registration) => {
          const event = getDemoEvents().find((item) => item.id === registration.eventId);
          if (!event) return [];
          const past = new Date(event.ends_at).getTime() <= Date.now();
          if (tab !== (registration.status === 'cancelled' ? 'cancelled' : past ? 'past' : 'upcoming')) return [];
          return [{
            registration_id: registration.id,
            event_id: event.id,
            title: event.title,
            category: event.category,
            starts_at: event.starts_at,
            ends_at: event.ends_at,
            venue_name: event.venue_name,
            checked_in_at: past ? registration.createdAt : null,
          }];
        });
        setItems([...(data.items || []), ...localItems]);
      })
      .catch((e) => setError(e.message || 'Failed to load your events'))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">My Events</h1>
        <p className="text-xs text-slate-400 mt-1">Manage your registrations, waitlist, and active tickets</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {(['upcoming', 'waitlisted', 'past', 'cancelled'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 capitalize transition min-h-tap ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {error ? (<div className="p-6 text-center text-rose-600">{error}</div>) : loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800/60 rounded-2xl"></div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8">
          <p className="text-sm font-medium text-slate-500">No events found in this category.</p>
          <Link to="/events" className="text-xs text-primary font-bold hover:underline">
            Browse upcoming campus events
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((row) => (
            <div
              key={row.registration_id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  {row.category}
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  <Link to={`/events/${row.event_id}`} className="hover:text-primary transition">
                    {row.title}
                  </Link>
                </h3>
                <div className="text-xs text-slate-500 flex items-center space-x-3">
                  <span>{formatEventDateTime(row.starts_at)}</span>
                  <span>•</span>
                  <span>{row.venue_name}</span>
                </div>
              </div>

              {/* Action buttons per tab */}
              <div className="flex items-center space-x-2 shrink-0">
                {tab === 'upcoming' && (
                  <button
                    onClick={() => setSelectedTicketId(row.registration_id)}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-primary-dark transition flex items-center space-x-1.5 min-h-tap"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Show ticket</span>
                  </button>
                )}

                {tab === 'waitlisted' && (
                  <span className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold">
                    Position {row.waitlistPosition || 1}
                  </span>
                )}

                {tab === 'past' && (
                  <div className="flex items-center space-x-2">
                    {row.checked_in_at ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">
                        Checked In
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs">
                        Absent
                      </span>
                    )}

                    {row.checked_in_at && (
                      <>
                        <Link
                          to={`/events/${row.event_id}/feedback`}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition"
                        >
                          Feedback
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTicketId && (
        <LivingQrModal
          registrationId={selectedTicketId}
          localTicket={(() => {
            const registration = getDemoRegistrations().find((item) => item.id === selectedTicketId);
            const event = registration && getDemoEvents().find((item) => item.id === registration.eventId);
            return registration && event ? {
              secret: registration.secret,
              studentName: 'Demo Student',
              eventTitle: event.title,
            } : undefined;
          })()}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
    </div>
  );
};
