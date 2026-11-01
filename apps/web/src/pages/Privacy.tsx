import React from 'react';
import { Shield, Lock, EyeOff, Key, FileText, CheckCircle, ArrowRight } from 'lucide-react';

export const Privacy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
          <Shield className="w-3.5 h-3.5" />
          CRYPTOGRAPHIC GUARANTEES
        </span>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-2">
          How EventHive Protects Your Anonymity
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          EventHive uses RFC 9474 RSA blind signatures and separated services so the issuer can verify attendance without learning the feedback content, while the collector receives feedback without a user identity.
        </p>

      </div>

      {/* The Carbon Paper Metaphor */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 mb-10 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-3">
          The Carbon-Paper Envelope Analogy
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          Imagine writing a secret review on paper, putting it inside a carbon-paper lined envelope, and sealing it. You hand this sealed envelope to the college registrar. The registrar checks your student ID, stamps the outside of the envelope with their official seal, and hands it back to you. The carbon paper transfers their stamp onto your secret paper inside.
          <br /><br />
          You take the paper out and drop it into a public ballot box. The box only sees an authentic official seal—it cannot tell which envelope it came from!
        </p>

        {/* 3 Step Protocol Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block mb-1">STEP 1: BLIND</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Your Browser Multiplies</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your browser generates a random blinding factor \(r\) and obscures your feedback token before anyone sees it.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/50 dark:purple-950/30 border border-purple-100 dark:border-purple-900">
            <span className="text-xs font-black text-purple-600 dark:text-purple-400 block mb-1">STEP 2: SIGN</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Issuer Checks Attendance</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              The Issuer verifies you attended, signs the blinded blob with RSA-2048, but NEVER sees the review content.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900">
            <span className="text-xs font-black text-teal-600 dark:text-teal-400 block mb-1">STEP 3: UNBLIND</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Collector Verifies Math</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your browser strips \(r\) and submits to Collector with NO cookies or authorization headers. The collector receives the unblinded token without the login cookie or authorization header.
            </p>
          </div>
        </div>
      </div>

      {/* Database Separation & Strict Isolation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 mb-10 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          Strict Zero-Knowledge Database Separation
        </h2>
        <p className="text-xs text-slate-500 mb-6">
          EventHive enforces architectural separation between three services and their dedicated database roles:
        </p>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              MAIN
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">eventhive_main Database</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Contains users, passwords (bcrypt), profiles, registrations, QR tokens. Has NO feedback responses or anonymous comments.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              ISSUER
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">eventhive_issuer Database</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Holds Ed25519 signing private keys and hashed issuance grants. It never receives or stores feedback text, ratings, or user profiles.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              COLL
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">eventhive_collector Database</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Holds anonymous feedback ratings and comments. It strictly enforces schema isolation: NO `user_id`, NO `email`, NO `ip_address`, and NO `created_at` timestamp columns exist on feedback tables.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Honest Limits & Threat Model */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">Honest Limits & Threat Model</h2>
        <ul className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong>Writing Style:</strong> If you write distinctive phrases or include identifying details in open comments, organizers may infer who you are. We suggest reviewing your text before submitting.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong>Small Sample Sizes:</strong> If an event has fewer than 5 attendees, individual responses could be deduced. EventHive seals reports until the threshold is met.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span><strong>Header Rejection:</strong> The Collector API explicitly rejects requests containing Authorization or Cookie headers with HTTP 400 IDENTITY_MATERIAL_REJECTED.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
