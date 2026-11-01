import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Check, AlertCircle, Save } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { if (user) setBio(user.bio || ''); }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/auth/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bio }) });
      if (res.ok) { setMsg({ type: 'success', text: 'Profile updated successfully!' }); await refreshUser(); }
      else { const err = await res.json(); setMsg({ type: 'error', text: err.error?.message || 'Failed to update profile' }); }
    } catch { setMsg({ type: 'error', text: 'Network error saving profile' }); } finally { setSaving(false); }
  };

  return <div className="max-w-2xl mx-auto px-4 py-8">
    <div className="flex items-center gap-4 mb-8"><div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center font-black text-2xl text-indigo-600 dark:text-indigo-400">{user?.name?.charAt(0) || 'U'}</div><div><h1 className="text-2xl font-black text-slate-900 dark:text-white">{user?.name}</h1><p className="text-xs text-slate-500 dark:text-slate-400">{user?.department} • Year {user?.year} • {user?.email}</p></div></div>
    {msg && <div className={`p-3.5 rounded-xl mb-6 text-xs font-semibold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>{msg.type === 'success' ? <Check className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}<span>{msg.text}</span></div>}
    <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div><label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Bio (Max 280 characters)</label><textarea rows={4} maxLength={280} value={bio} onChange={(e)=>setBio(e.target.value)} placeholder="Tell people a little about yourself..." className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500"/><span className="text-[11px] text-slate-400 mt-1 block text-right">{bio.length}/280</span></div>
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end"><button type="submit" disabled={saving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition"><Save className="w-4 h-4"/><span>{saving ? 'Saving...' : 'Save Profile'}</span></button></div>
    </form>
  </div>;
};
