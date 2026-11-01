import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sparkles, Flame, Clock, Calendar, ArrowRight, MapPin, Users } from 'lucide-react';
import { CATEGORIES, formatEventDateTime, formatEventDateShort, APP_NAME, APP_TAGLINE } from '@eventhive/shared';
import { EventArt } from '../components/EventArt';

interface HomeProps {
  onOpenTwoHours: () => void;
}

export const Home: React.FC<HomeProps> = ({ onOpenTwoHours }) => {
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events?pageSize=30')
      .then((res) => res.json())
      .then((data) => setAllEvents(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/events?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  const now = new Date();
  const happeningNow = allEvents.filter((e) => new Date(e.startsAt) <= now && new Date(e.endsAt) > now);
  const fillingFast = allEvents.filter((e) => e.isFillingFast);

  // This week: next 7 days
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thisWeek = allEvents.filter((e) => new Date(e.startsAt) > now && new Date(e.startsAt) <= nextWeek);

  const upcoming = allEvents.slice(0, 12);

  return (
    <div className="space-y-14 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 bg-gradient-to-b from-indigo-50/50 via-white to-transparent dark:from-indigo-950/20 dark:via-slate-950 dark:to-transparent rounded-3xl p-6 sm:p-12 text-center border border-indigo-100/60 dark:border-indigo-900/20">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover campus life with true privacy</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-tight">
            Every event on campus, from <span className="text-primary">discovery</span> to <span className="text-indigo-500">feedback</span>.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
            Discover events, register or join a waitlist, carry a rotating Living QR ticket, and give anonymous feedback designed to stay unlinkable to your identity.
          </p>

          {/* Event Search */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto relative shadow-xl rounded-2xl">
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search events by title, description, or tags"
              className="w-full pl-12 pr-28 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-dark transition shadow"
            >
              Search
            </button>
          </form>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                to={`/events?category=${cat}`}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition shadow-2xs"
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* Happening Now Row */}
      {happeningNow.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Happening Now</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {happeningNow.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

      {/* Filling Fast Row */}
      {fillingFast.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
              <Flame className="w-5 h-5 text-amber-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Filling Fast</h2>
            </div>
            <Link to="/events" className="text-xs text-primary font-semibold hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {fillingFast.slice(0, 3).map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

      {/* This Week */}
      {thisWeek.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">This Week on Campus</h2>
            <Link to="/events" className="text-xs text-primary font-semibold hover:underline">
              See schedule
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {thisWeek.slice(0, 3).map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Explore Upcoming Events</h2>
            <p className="text-xs text-slate-400 mt-1">Discover campus workshops, hackathons, sports, and culture</p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center space-x-1 text-sm font-semibold text-primary hover:underline"
          >
            <span>Browse All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-72 bg-slate-200 dark:bg-slate-800/60 rounded-2xl"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcoming.map((ev) => (
              <EventCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const EventCard: React.FC<{ event: any }> = ({ event }) => {
  const seatsLeft = event.seatsLeft !== undefined ? event.seatsLeft : Math.max(0, event.capacity - (event.confirmedCount || 0));
  const seatsLabel =
    seatsLeft === 0
      ? 'Full, join waitlist'
      : seatsLeft <= 3
      ? `Only ${seatsLeft} left`
      : `${seatsLeft} seats left`;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card overflow-hidden shadow-sm hover:shadow-md transition group flex flex-col">
      {/* Banner or Generative Art */}
      <div className="h-44 relative bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <EventArt eventId={event.id} category={event.category} className="w-full h-full" />
        )}

        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
            {event.category}
          </span>
          {event.isFillingFast && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500 text-white flex items-center space-x-1 shadow-sm">
              <Flame className="w-3 h-3" />
              <span>Filling Fast</span>
            </span>
          )}
        </div>

        <div className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 backdrop-blur-sm shadow">
          {event.isPaid ? `₹${event.priceInr}` : 'Free'}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="text-xs text-primary font-semibold mb-1">
            {formatEventDateTime(event.startsAt)}
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 group-hover:text-primary transition line-clamp-1">
            <Link to={`/events/${event.id}`}>{event.title}</Link>
          </h3>
        </div>

        <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="flex items-center space-x-1 truncate max-w-[180px]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{event.venueName}</span>
            </span>
            <span
              className={`font-semibold ${
                seatsLeft === 0
                  ? 'text-danger'
                  : seatsLeft <= 3
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-500'
              }`}
            >
              {seatsLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
