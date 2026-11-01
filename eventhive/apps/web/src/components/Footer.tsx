import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart } from 'lucide-react';
import { APP_NAME, APP_TAGLINE } from '@eventhive/shared';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex flex-col items-center md:items-start space-y-1">
          <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-slate-100 text-base">
            <span>{APP_NAME}</span>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-mono">RFC 9474</span>
          </div>
          <p className="text-xs text-slate-400">{APP_TAGLINE}</p>
        </div>

        <div className="flex items-center space-x-6 text-sm">
          <Link to="/events" className="hover:text-primary transition">Browse Events</Link>
          <Link
            to="/privacy"
            className="flex items-center space-x-1.5 text-primary hover:underline font-medium"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Cryptographic Privacy</span>
          </Link>
        </div>

        <div className="text-xs text-slate-400 text-center md:text-right">
          Anonymous & unlinkable by design. Built for campus privacy.
        </div>
      </div>
    </footer>
  );
};
