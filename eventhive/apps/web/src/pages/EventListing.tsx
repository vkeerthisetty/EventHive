import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { CATEGORIES, ACCESSIBILITY_OPTIONS, DIETARY_OPTIONS } from '@eventhive/shared';
import { EventCard } from './Home';

export const EventListing: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryQ = searchParams.get('q') || '';
  const selectedCategories = searchParams.getAll('category');
  const selectedAccessibility = searchParams.getAll('accessibility');
  const selectedDietary = searchParams.getAll('dietary');
  const sort = searchParams.get('sort') || 'soonest';
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const showPast = searchParams.get('showPast') === 'true';

  const [searchInput, setSearchInput] = useState(queryQ);
  const [events, setEvents] = useState<any[]>([]);
  const [venues, setVenues] = useState<Array<{ id: string; name: string }>>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  useEffect(() => {
    fetch('/api/events/filters/meta')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setVenues(d.venues || []))
      .catch(() => setVenues([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== queryQ) {
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          if (searchInput.trim()) next.set('q', searchInput.trim());
          else next.delete('q');
          next.set('page', '1');
          return next;
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, queryQ, setSearchParams]);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/events?${searchParams.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error?.message || 'Failed to load events');
        return data;
      })
      .then((data) => {
        setEvents(data.items || []);
        setTotal(data.total || 0);
        setPageSize(data.pageSize || 12);
      })
      .catch((e) => setError(e.message || 'Failed to load events'))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const mutate = (fn: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      fn(next);
      next.set('page', '1');
      return next;
    });
  };

  const toggleRepeated = (key: string, value: string) => mutate((next) => {
    const values = next.getAll(key);
    next.delete(key);
    const updated = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    updated.forEach((v) => next.append(key, v));
  });

  const clearAllFilters = () => {
    setSearchInput('');
    setSearchParams(new URLSearchParams());
    setShowFiltersDrawer(false);
  };

  const FilterControls = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-bold mb-2">Price</label>
        <select value={searchParams.get('free') || ''} onChange={(e) => mutate((n) => e.target.value ? n.set('free', e.target.value) : n.delete('free'))} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Any price</option><option value="true">Free only</option><option value="false">Paid only</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold mb-2">Venue</label>
        <select value={searchParams.get('venue') || ''} onChange={(e) => mutate((n) => e.target.value ? n.set('venue', e.target.value) : n.delete('venue'))} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
          <option value="">Any venue</option>{venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold">From<input type="date" value={searchParams.get('from') || ''} onChange={(e) => mutate((n) => e.target.value ? n.set('from', e.target.value) : n.delete('from'))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm" /></label>
        <label className="text-xs font-bold">To<input type="date" value={searchParams.get('to') || ''} onChange={(e) => mutate((n) => e.target.value ? n.set('to', e.target.value) : n.delete('to'))} className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-2 text-sm" /></label>
      </div>
      <div><p className="text-xs font-bold mb-2">Accessibility</p><div className="flex flex-wrap gap-2">{ACCESSIBILITY_OPTIONS.map((x) => <button type="button" key={x} onClick={() => toggleRepeated('accessibility', x)} className={`px-2.5 py-1.5 rounded-full text-[11px] border ${selectedAccessibility.includes(x) ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-slate-700'}`}>{x.replace(/_/g, ' ')}</button>)}</div></div>
      <div><p className="text-xs font-bold mb-2">Dietary</p><div className="flex flex-wrap gap-2">{DIETARY_OPTIONS.map((x) => <button type="button" key={x} onClick={() => toggleRepeated('dietary', x)} className={`px-2.5 py-1.5 rounded-full text-[11px] border ${selectedDietary.includes(x) ? 'bg-primary text-white border-primary' : 'border-slate-200 dark:border-slate-700'}`}>{x.replace(/_/g, ' ')}</button>)}</div></div>
      <button type="button" onClick={clearAllFilters} className="text-xs font-bold text-rose-600 hover:underline">Clear all filters</button>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasAdvanced = ['free','venue','from','to'].some((k) => searchParams.has(k)) || selectedAccessibility.length > 0 || selectedDietary.length > 0;

  return <div className="space-y-8 pb-16">
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">All Campus Events</h1><p className="text-xs text-slate-400 mt-1">Showing {events.length} of {total} events</p></div>
        <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={showPast} onChange={(e) => mutate((n) => e.target.checked ? n.set('showPast','true') : n.delete('showPast'))} /> Show past events</label>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1"><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search title, description, or tags..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm" /><Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" /></div>
        <select value={sort} onChange={(e) => mutate((n) => n.set('sort', e.target.value))} className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium"><option value="soonest">Soonest</option><option value="newest">Newest</option><option value="popular">Most popular</option></select>
        <button onClick={() => setShowFiltersDrawer(true)} className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold"><SlidersHorizontal className="w-4 h-4" /> Filters{hasAdvanced ? ' •' : ''}</button>
      </div>
      <div className="flex flex-wrap gap-2">{CATEGORIES.map((cat) => <button key={cat} onClick={() => toggleRepeated('category', cat)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${selectedCategories.includes(cat) ? 'bg-primary text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>{cat[0].toUpperCase()+cat.slice(1)}</button>)}</div>
    </div>

    {error ? <div className="p-8 text-center text-rose-600 border rounded-2xl">{error}</div> : loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">{[1,2,3,4,5,6].map((i)=><div key={i} className="h-72 bg-slate-200 dark:bg-slate-800/60 rounded-2xl" />)}</div> : events.length === 0 ? <div className="py-20 text-center space-y-3 border rounded-3xl"><p className="font-semibold">No events found.</p><button onClick={clearAllFilters} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl">Clear filters</button></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">{events.map((ev)=><EventCard key={ev.id} event={ev}/>)}</div>}

    {totalPages > 1 && <div className="flex items-center justify-center gap-2 pt-6"><button disabled={page<=1} onClick={()=>setSearchParams((prev)=>{const n=new URLSearchParams(prev);n.set('page',String(page-1));return n;})} className="p-2 rounded-xl border disabled:opacity-40"><ChevronLeft className="w-4 h-4"/></button>{Array.from({length:totalPages},(_,i)=>i+1).map((p)=><button key={p} onClick={()=>setSearchParams((prev)=>{const n=new URLSearchParams(prev);n.set('page',String(p));return n;})} className={`w-9 h-9 rounded-xl text-xs font-bold ${page===p?'bg-primary text-white':'border'}`}>{p}</button>)}<button disabled={page>=totalPages} onClick={()=>setSearchParams((prev)=>{const n=new URLSearchParams(prev);n.set('page',String(page+1));return n;})} className="p-2 rounded-xl border disabled:opacity-40"><ChevronRight className="w-4 h-4"/></button></div>}

    {showFiltersDrawer && <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={()=>setShowFiltersDrawer(false)}><aside className="h-full w-full max-w-sm bg-white dark:bg-slate-950 p-6 overflow-y-auto" onClick={(e)=>e.stopPropagation()}><div className="flex items-center justify-between mb-6"><h2 className="text-lg font-black">Filters</h2><button onClick={()=>setShowFiltersDrawer(false)} aria-label="Close filters"><X className="w-5 h-5"/></button></div><FilterControls/><button onClick={()=>setShowFiltersDrawer(false)} className="w-full mt-6 py-3 bg-primary text-white font-bold rounded-xl">Show {total} results</button></aside></div>}
  </div>;
};
