import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  Tag,
  FileText,
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { createDemoEvent } from '../lib/demoEvents';

export const CreateEvent: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technical');

  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');

  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');

  const [venueName, setVenueName] = useState('');
  const [capacity, setCapacity] = useState(100);

  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState(0);

  const [tags, setTags] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    if (!title.trim()) {
      alert('Please enter an event title');
      return;
    }

    if (!description.trim()) {
      alert('Please enter an event description');
      return;
    }

    if (!startDate || !startTime) {
      alert('Please select the event start date and time');
      return;
    }

    if (!endDate || !endTime) {
      alert('Please select the event end date and time');
      return;
    }

    if (!venueName.trim()) {
      alert('Please enter a venue');
      return;
    }

    if (capacity < 1) {
      alert('Capacity must be at least 1');
      return;
    }

    setLoading(true);

    const startsAt = new Date(
      `${startDate}T${startTime}`
    ).toISOString();

    const endsAt = new Date(
      `${endDate}T${endTime}`
    ).toISOString();

    const newEvent = createDemoEvent({
      title: title.trim(),
      description: description.trim(),

      category,

      starts_at: startsAt,
      ends_at: endsAt,

      startsAt,
      endsAt,

      venue_name: venueName.trim(),
      venueName: venueName.trim(),

      organizer_name: user.name || 'Campus Organizer',

      capacity: Number(capacity),

      status: 'published',

      is_paid: isPaid,
      price_inr: isPaid ? Number(price) : 0,

      accessibility: [],
      dietary: [],

      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),

      banner_url: '',

      is_team_event: false,

      venue_step_free: true,
    });

    setSuccess('Event created successfully!');

    setTimeout(() => {
      navigate(`/events/${newEvent.id}`);
    }, 700);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">

      <button
        onClick={() => navigate('/organizer')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Organizer Dashboard
      </button>

      <div className="mb-8">
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
          Organizer Portal
        </span>

        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-2">
          Create a New Event
        </h1>

        <p className="text-sm text-slate-500 mt-2">
          Create a demo campus event. This event is stored locally in your browser.
        </p>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2 text-sm font-semibold">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6"
      >

        {/* EVENT TITLE */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Event Title *
          </label>

          <div className="relative">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Tech Fest 2026"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />

            <Calendar className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* DESCRIPTION */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Description *
          </label>

          <div className="relative">
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Tell students what this event is about..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none"
            />

            <FileText className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* CATEGORY */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Category
          </label>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
          >
            <option value="technical">Technical</option>
            <option value="cultural">Cultural</option>
            <option value="sports">Sports</option>
            <option value="workshop">Workshop</option>
            <option value="seminar">Seminar</option>
            <option value="competition">Competition</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* START DATE */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2">
              Start Date *
            </label>

            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2">
              Start Time *
            </label>

            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

        </div>

        {/* END DATE */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2">
              End Date *
            </label>

            <input
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider mb-2">
              End Time *
            </label>

            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />
          </div>

        </div>

        {/* VENUE */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Venue *
          </label>

          <div className="relative">
            <input
              type="text"
              required
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. Main Auditorium"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />

            <MapPin className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* CAPACITY */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Capacity *
          </label>

          <div className="relative">
            <input
              type="number"
              required
              min="1"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />

            <Users className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          </div>
        </div>

        {/* PRICE */}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">

          <label className="flex items-center gap-3 cursor-pointer">

            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="w-4 h-4"
            />

            <span className="text-sm font-bold">
              This is a paid event
            </span>

          </label>

          {isPaid && (
            <div className="mt-4">

              <label className="block text-xs font-bold uppercase tracking-wider mb-2">
                Ticket Price (₹)
              </label>

              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />

            </div>
          )}

        </div>

        {/* TAGS */}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider mb-2">
            Tags
          </label>

          <div className="relative">

            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="coding, ai, technology"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            />

            <Tag className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />

          </div>

          <p className="text-xs text-slate-400 mt-1">
            Separate tags using commas.
          </p>
        </div>

        {/* SUBMIT */}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition"
        >
          {loading ? 'Creating Event...' : 'Create Event'}
        </button>

      </form>
    </div>
  );
};