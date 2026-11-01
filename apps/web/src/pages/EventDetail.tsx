import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users2,
  Share2,
  Download,
  CheckCircle,
  Shield,
  MessageSquare,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { formatEventDateTime } from '@eventhive/shared';
import { EventArt } from '../components/EventArt';
import { LivingQrModal } from '../components/LivingQrModal';
import { ClashWarningModal } from '../components/ClashWarningModal';
import { EventCard } from './Home';
import {
  getDemoEventById,
  updateDemoEvent,
} from '../lib/demoEvents';

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buttonLoading, setButtonLoading] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [clashes, setClashes] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  const isDemoEvent = Boolean(id?.startsWith('demo-'));

  const fetchEvent = async () => {
    if (!id) {
      setError('Event not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (id.startsWith('demo-')) {
        const demoEvent = getDemoEventById(id);

        if (!demoEvent) {
          throw new Error('Event not found');
        }

        setEventData({
          event: demoEvent,
          userRegistration: null,
          buttonState: 'open',
          buttonReason: '',
          relatedEvents: [],
        });

        return;
      }

      const res = await fetch(`/api/events/${id}`);

      if (!res.ok) {
        throw new Error('Event not found');
      }

      const data = await res.json();

      setEventData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load event');
      setEventData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id, user]);

  useEffect(() => {
    if (!eventData?.event) return;

    const updateCountdown = () => {
      const now = Date.now();

      const start = new Date(
        eventData.event.starts_at
      ).getTime();

      const end = new Date(
        eventData.event.ends_at
      ).getTime();

      if (now < start) {
        const diff = start - now;

        const days = Math.floor(
          diff / (24 * 60 * 60 * 1000)
        );

        const hours = Math.floor(
          (diff % (24 * 60 * 60 * 1000)) /
            (60 * 60 * 1000)
        );

        const mins = Math.floor(
          (diff % (60 * 60 * 1000)) /
            (60 * 1000)
        );

        const secs = Math.floor(
          (diff % (60 * 1000)) / 1000
        );

        setTimeRemaining(
          `Starts in ${
            days > 0 ? `${days}d ` : ''
          }${hours}h ${mins}m ${secs}s`
        );
      } else if (now < end) {
        const diff = end - now;

        const mins = Math.floor(
          diff / (60 * 1000)
        );

        setTimeRemaining(
          `Happening now! Ends in ${mins} min`
        );
      } else {
        setTimeRemaining('Event ended');
      }
    };

    updateCountdown();

    const interval = setInterval(
      updateCountdown,
      1000
    );

    return () => clearInterval(interval);
  }, [eventData]);

  const handleRegisterClick = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!id) return;

    if (isDemoEvent) {
      setButtonLoading(true);

      try {
        const demoEvent = getDemoEventById(id);

        if (!demoEvent) {
          alert('Event not found');
          return;
        }

        if (demoEvent.seatsLeft <= 0) {
          alert('This event is full');
          return;
        }

        updateDemoEvent(id, {
          confirmedCount:
            demoEvent.confirmedCount + 1,

          seatsLeft: Math.max(
            0,
            demoEvent.seatsLeft - 1
          ),
        });

        await fetchEvent();

        alert(
          'Successfully registered for this demo event!'
        );
      } finally {
        setButtonLoading(false);
      }

      return;
    }

    setButtonLoading(true);

    try {
      const clashRes = await fetch(
        `/api/me/clashes?eventId=${id}`
      );

      if (clashRes.ok) {
        const clashData =
          await clashRes.json();

        if (
          clashData.clashes?.length > 0
        ) {
          setClashes(clashData.clashes);

          setButtonLoading(false);

          return;
        }
      }

      await performRegister();
    } catch {
      setButtonLoading(false);
    }
  };

  const performRegister = async () => {
    if (!id) return;

    setClashes([]);

    setButtonLoading(true);

    try {
      if (isDemoEvent) {
        const demoEvent =
          getDemoEventById(id);

        if (!demoEvent) {
          alert('Event not found');
          return;
        }

        if (demoEvent.seatsLeft <= 0) {
          alert('This event is full');
          return;
        }

        updateDemoEvent(id, {
          confirmedCount:
            demoEvent.confirmedCount + 1,

          seatsLeft: Math.max(
            0,
            demoEvent.seatsLeft - 1
          ),
        });

        await fetchEvent();

        alert(
          'Successfully registered for this demo event!'
        );

        return;
      }

      const res = await fetch(
        `/api/events/${id}/register`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      if (res.ok) {
        await fetchEvent();
      } else {
        const err = await res.json();

        alert(
          err.error?.message ||
            'Registration failed'
        );
      }
    } finally {
      setButtonLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    if (!id) return;

    if (
      !confirm(
        'Are you sure you want to cancel your registration?'
      )
    ) {
      return;
    }

    if (isDemoEvent) {
      alert(
        'Demo registration cancellation is not persistent.'
      );

      return;
    }

    setButtonLoading(true);

    try {
      const res = await fetch(
        `/api/events/${id}/cancel`,
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },
        }
      );

      if (res.ok) {
        await fetchEvent();
      }
    } finally {
      setButtonLoading(false);
    }
  };

  const copyEventLink = () => {
    navigator.clipboard.writeText(
      window.location.href
    );

    setCopiedLink(true);

    setTimeout(
      () => setCopiedLink(false),
      2000
    );
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />

        <p className="text-sm text-slate-500">
          Loading event details...
        </p>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-danger font-semibold">
          Event not found or failed to load.
        </p>

        <Link
          to="/events"
          className="text-xs text-primary underline"
        >
          Back to events
        </Link>
      </div>
    );
  }

  const {
    event,
    userRegistration,
    buttonState,
    buttonReason,
    relatedEvents,
  } = eventData;

  const isEnded =
    new Date() >= new Date(event.ends_at);

  const demoButtonState = isDemoEvent
    ? event.seatsLeft > 0
      ? 'open'
      : 'full'
    : buttonState;

  return (
    <div className="space-y-12 pb-20 max-w-5xl mx-auto">

      {/* Banner */}
      <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800">

        {event.banner_url ? (
          <img
            src={event.banner_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <EventArt
            eventId={event.id}
            category={event.category}
            className="w-full h-full"
          />
        )}

        <div className="absolute top-4 left-4 flex flex-wrap gap-2">

          <span className="px-3 py-1 bg-black/70 text-white backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
            {event.category}
          </span>

          {event.is_team_event && (
            <span className="px-3 py-1 bg-purple-600/90 text-white backdrop-blur-md rounded-full text-xs font-bold flex items-center space-x-1">

              <Users2 className="w-3.5 h-3.5" />

              <span>
                Team Event (
                {event.team_min}-{event.team_max}{' '}
                members)
              </span>

            </span>
          )}

        </div>

        <div className="absolute bottom-4 right-4 flex items-center space-x-2">

          <button
            onClick={copyEventLink}
            className="px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 backdrop-blur-md rounded-xl text-xs font-semibold shadow hover:bg-white transition flex items-center space-x-1.5"
          >

            <Share2 className="w-3.5 h-3.5" />

            <span>
              {copiedLink
                ? 'Copied Link!'
                : 'Copy link'}
            </span>

          </button>

          {!isDemoEvent && (
            <a
              href={`/api/events/${event.id}/calendar.ics`}
              download
              className="px-3 py-1.5 bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 backdrop-blur-md rounded-xl text-xs font-semibold shadow hover:bg-white transition flex items-center space-x-1.5"
            >

              <Download className="w-3.5 h-3.5" />

              <span>
                Add to calendar
              </span>

            </a>
          )}

        </div>

      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Event Details */}
        <div className="lg:col-span-2 space-y-6">

          <div className="space-y-2">

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
              {event.title}
            </h1>

            <p className="text-sm text-slate-500">
              Organized by{' '}

              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {event.organizer_name}
              </span>

            </p>

          </div>

          {/* Date and Venue */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm">

            <div className="flex items-start space-x-3">

              <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />

              <div>

                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {formatEventDateTime(
                    event.starts_at
                  )}
                </div>

                <div className="text-xs text-slate-400 mt-0.5">
                  {timeRemaining}
                </div>

              </div>

            </div>

            <div className="flex items-start space-x-3">

              <MapPin className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />

              <div>

                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {event.venue_name}
                </div>

                <div className="text-xs text-slate-400 mt-0.5">
                  {event.venue_step_free
                    ? '✓ Step-free accessible'
                    : 'Stairs required'}
                </div>

              </div>

            </div>

          </div>

          {/* Description */}
          <div className="space-y-3">

            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              About this event
            </h3>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>

          </div>

          {/* Features */}
          <div className="space-y-3 pt-2">

            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Features & Amenities
            </h4>

            <div className="flex flex-wrap gap-2">

              {event.accessibility?.map(
                (item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-xs font-medium"
                  >
                    ✓ {item.replace(/_/g, ' ')}
                  </span>
                )
              )}

              {event.dietary?.map(
                (item: string) => (
                  <span
                    key={item}
                    className="px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 rounded-full text-xs font-medium"
                  >
                    🥗 {item.replace(/_/g, ' ')}
                  </span>
                )
              )}

              {event.tags?.map(
                (tag: string) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs"
                  >
                    #{tag}
                  </span>
                )
              )}

            </div>

          </div>

        </div>

        {/* Registration */}
        <div className="space-y-6">

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-5">

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">

              <span className="text-sm font-semibold text-slate-500">
                Admission
              </span>

              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {event.is_paid
                  ? `₹${event.price_inr}`
                  : 'Free'}
              </span>

            </div>

            <div className="space-y-3 text-xs text-slate-500 dark:text-slate-400">

              <div className="flex justify-between">

                <span>Capacity:</span>

                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {event.capacity} seats
                </span>

              </div>

              <div className="flex justify-between">

                <span>
                  Confirmed Attendees:
                </span>

                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {event.confirmedCount}
                </span>

              </div>

              <div className="flex justify-between">

                <span>
                  Seats Remaining:
                </span>

                <span className="font-bold text-primary">
                  {event.seatsLeft}
                </span>

              </div>

            </div>

            <div className="pt-2 space-y-3">

              {!isDemoEvent &&
              demoButtonState === 'logged_out' ? (

                <button
                  onClick={() =>
                    navigate('/login')
                  }
                  className="w-full py-3 px-4 bg-primary text-white font-bold rounded-2xl shadow hover:bg-primary-dark transition min-h-tap"
                >
                  Log in to register
                </button>

              ) : demoButtonState === 'open' ? (

                <button
                  disabled={buttonLoading}
                  onClick={handleRegisterClick}
                  className="w-full py-3 px-4 bg-primary text-white font-bold rounded-2xl shadow hover:bg-primary-dark transition min-h-tap disabled:opacity-50"
                >
                  {buttonLoading
                    ? 'Registering...'
                    : 'Register'}
                </button>

              ) : demoButtonState === 'full' ? (

                <button
                  disabled
                  className="w-full py-3 px-4 bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold rounded-2xl"
                >
                  Event Full
                </button>

              ) : demoButtonState ===
                'registered' ? (

                <div className="space-y-2">

                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold text-center border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center space-x-1.5">

                    <CheckCircle className="w-4 h-4 text-emerald-500" />

                    <span>
                      You're registered
                    </span>

                  </div>

                  <button
                    onClick={() =>
                      setShowQrModal(true)
                    }
                    className="w-full py-2.5 bg-primary text-white font-semibold text-xs rounded-xl shadow hover:bg-primary-dark transition min-h-tap flex items-center justify-center space-x-1.5"
                  >

                    <Shield className="w-4 h-4" />

                    <span>
                      Show ticket
                    </span>

                  </button>

                  <button
                    onClick={
                      handleCancelRegistration
                    }
                    className="w-full py-2 text-xs font-semibold text-danger hover:underline transition text-center"
                  >
                    Cancel registration
                  </button>

                </div>

              ) : demoButtonState ===
                'waitlisted' ? (

                <div className="space-y-2">

                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-xl text-xs font-bold text-center border border-amber-200 dark:border-amber-800/60">
                    On the waitlist, position{' '}
                    {
                      userRegistration
                        ?.waitlistPosition ||
                        1
                    }
                  </div>

                  <button
                    onClick={
                      handleCancelRegistration
                    }
                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl hover:bg-slate-200 transition min-h-tap"
                  >
                    Leave waitlist
                  </button>

                </div>

              ) : (

                <button
                  disabled
                  className="w-full py-3 px-4 bg-slate-200 dark:bg-slate-800 text-slate-400 font-bold rounded-2xl cursor-not-allowed text-xs min-h-tap"
                >
                  {buttonReason ||
                    'Registration unavailable'}
                </button>

              )}

              {!isDemoEvent &&
                userRegistration?.checked_in_at &&
                isEnded && (
                  <Link
                    to={`/events/${event.id}/feedback`}
                    className="w-full inline-flex items-center justify-center space-x-1.5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
                  >

                    <MessageSquare className="w-4 h-4" />

                    <span>
                      Give Anonymous Feedback
                    </span>

                  </Link>
                )}

            </div>

          </div>

        </div>

      </div>

      {/* Related Events */}
      {relatedEvents?.length > 0 && (

        <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-800">

          <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
            More{' '}
            {event.category.toUpperCase()}{' '}
            Events
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {relatedEvents.map(
              (ev: any) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                />
              )
            )}

          </div>

        </div>

      )}

      {/* QR Ticket */}
      {!isDemoEvent &&
        showQrModal &&
        userRegistration && (
          <LivingQrModal
            registrationId={
              userRegistration.id
            }
            onClose={() =>
              setShowQrModal(false)
            }
          />
        )}

      {/* Clash Warning */}
      {clashes.length > 0 && (

        <ClashWarningModal
          clashes={clashes}
          onConfirm={performRegister}
          onCancel={() =>
            setClashes([])
          }
        />

      )}

    </div>
  );
};