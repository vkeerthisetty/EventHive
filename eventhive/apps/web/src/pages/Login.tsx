import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Mail, ArrowRight, UserCheck, Sparkles } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      navigate(redirect);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">Welcome Back</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Log in to your EventHive campus account
        </p>
      </div>

      {/* Demo 1-Click Login Box */}
      <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Quick Demo Logins</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleDemoLogin('riya@eventhive.test', 'Student@123')}
            className="p-2 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center transition"
          >
            Riya
            <span className="block text-[9px] text-slate-400 font-normal">Student</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('tech@eventhive.test', 'Organizer@123')}
            className="p-2 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center transition"
          >
            Priya
            <span className="block text-[9px] text-slate-400 font-normal">Organizer</span>
          </button>
          <button
            type="button"
            onClick={() => handleDemoLogin('admin@eventhive.test', 'Admin@123')}
            className="p-2 bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-slate-800 dark:text-slate-200 text-center transition"
          >
            Admin
            <span className="block text-[9px] text-slate-400 font-normal">System</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition"
          >
            <span>{loading ? 'Logging In...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Don't have an account?{' '}
            <Link to={`/signup?redirect=${redirect}`} className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              Create an Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
