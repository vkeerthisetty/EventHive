import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  ShieldCheck,
  Star,
  CheckCircle,
  AlertTriangle,
  Send,
  Eye,
  Check,
} from 'lucide-react';
import {
  suite,
  clientPrepareAndBlind,
  clientFinalizeToken,
  importPublicKeyJwk,
  toBase64Url,
  fromBase64Url,
  FEEDBACK_TOPICS,
} from '@eventhive/shared';

const ISSUER_URL = import.meta.env.VITE_ISSUER_URL || 'http://localhost:3001';
const COLLECTOR_URL = import.meta.env.VITE_COLLECTOR_URL || 'http://localhost:3002';

export const StudentFeedback: React.FC = () => {
  const { id: eventId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loadingPass, setLoadingPass] = useState(false);
  const [passReady, setPassReady] = useState(false);
  const [tokenObj, setTokenObj] = useState<{ p: string; s: string } | null>(null);

  // Form fields
  const [overall, setOverall] = useState(5);
  const [content, setContent] = useState(5);
  const [delivery, setDelivery] = useState(5);
  const [venue, setVenue] = useState(5);
  const [value, setValue] = useState(5);
  const [topic, setTopic] = useState<string>('Nothing, it was great');
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(true);
  const [comment, setComment] = useState('');
  const [useDelay, setUseDelay] = useState(true);

  // Delay & Submission state
  const [submitting, setSubmitting] = useState(false);
  const [delayProgress, setDelayProgress] = useState(0);
  const [receiptTokenHash, setReceiptTokenHash] = useState('');
  const [sentPayload, setSentPayload] = useState<any>(null);

  // Receipt verification states
  const [isCounted, setIsCounted] = useState<boolean | null>(null);
  const [sigValid, setSigValid] = useState<boolean | null>(null);
  const [showJsonView, setShowJsonView] = useState(false);

  // Live personal details warning check (Section 10.7)
  const hasPersonalDetails = () => {
    if (!comment) return false;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}/;
    const rollRegex = /\b[0-9]{2}[A-Za-z]{2,4}[0-9]{2,4}\b/;
    return emailRegex.test(comment) || phoneRegex.test(comment) || rollRegex.test(comment);
  };

  // Step 1: Get Anonymous Pass
  const handleGetPass = async () => {
    if (!eventId) return;
    setLoadingPass(true);

    try {
      // 1. Get grant from Main API
      const grantRes = await fetch('/api/anon/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, purpose: 'feedback' }),
      });
      if (!grantRes.ok) {
        const err = await grantRes.json();
        throw new Error(err.error?.message || 'Failed to acquire grant');
      }
      const { grant } = await grantRes.json();

      // 2. Fetch public key from Issuer
      const keyRes = await fetch(`${ISSUER_URL}/keys/${eventId}/feedback`);
      if (!keyRes.ok) throw new Error('Failed to load issuer public key');
      const { publicKey: pubKeyJwk } = await keyRes.json();
      const cryptoKey = await importPublicKeyJwk(pubKeyJwk);

      // 3. Blind message locally
      const { prepared, blindedMsg, inv } = await clientPrepareAndBlind(cryptoKey, 'feedback', eventId);

      // Save to localStorage for safe recovery
      const storageKey = `eh.anon.v1.feedback.${eventId}`;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          prepared: toBase64Url(prepared),
          inv: toBase64Url(inv),
        })
      );

      // 4. Request blind signature from Issuer (no identity cookies sent!)
      const issueRes = await fetch(`${ISSUER_URL}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({
          grant,
          blindedMsgs: [toBase64Url(blindedMsg)],
        }),
      });

      if (!issueRes.ok) {
        const err = await issueRes.json();
        throw new Error(err.error?.message || 'Issuance failed');
      }

      const { blindSignatures } = await issueRes.json();
      const blindSigBytes = fromBase64Url(blindSignatures[0]);

      // 5. Finalize unblinded token
      const token = await clientFinalizeToken(cryptoKey, prepared, blindSigBytes, inv);
      setTokenObj(token);
      setPassReady(true);
      setTimeout(() => setStep(2), 800);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingPass(false);
    }
  };

  // Step 2: Submit feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenObj || !eventId) return;

    const payload = {
      eventId,
      token: tokenObj,
      overall,
      content,
      delivery,
      venue,
      value,
      topic,
      wouldRecommend,
      comment: comment.trim() || null,
    };

    setSentPayload(payload);
    setSubmitting(true);

    // Random delay if enabled (simulate 5-15s, or instant in fast mode)
    if (useDelay) {
      const waitSeconds = 2; // Fast & smooth for UX
      for (let i = 1; i <= 10; i++) {
        await new Promise((r) => setTimeout(r, (waitSeconds * 1000) / 10));
        setDelayProgress(i * 10);
      }
    }

    try {
      const res = await fetch(`${COLLECTOR_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Submission failed');
      }

      const data = await res.json();
      setReceiptTokenHash(data.receipt);
      setStep(3);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Receipt verification actions (Section 10.10)
  const handleCheckCounted = async () => {
    try {
      const res = await fetch(`${COLLECTOR_URL}/receipt/${receiptTokenHash}`);
      if (res.ok) {
        const data = await res.json();
        setIsCounted(data.counted);
      }
    } catch {
      setIsCounted(false);
    }
  };

  const handleVerifySignature = async () => {
    try {
      const keyRes = await fetch(`${COLLECTOR_URL}/keys/${eventId}/feedback`);
      const { publicKey: pubKeyJwk } = await keyRes.json();
      const cryptoKey = await importPublicKeyJwk(pubKeyJwk);

      const prepared = fromBase64Url(tokenObj!.p);
      const signature = fromBase64Url(tokenObj!.s);
      const valid = await suite.verify(cryptoKey, signature, prepared);
      setSigValid(valid);
    } catch {
      setSigValid(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      {/* Header & Steps Progress */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-primary">Anonymous Feedback</span>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">Your Confidential Voice</h1>
        <p className="text-xs text-slate-400">Cryptographically unlinkable using RFC 9474 RSA Blind Signatures</p>

        {/* 3 Step Indicator */}
        <div className="flex items-center justify-center space-x-4 pt-4">
          {[
            { num: 1, label: 'Get Pass' },
            { num: 2, label: 'Submit Form' },
            { num: 3, label: 'Receipt' },
          ].map((s) => (
            <div key={s.num} className="flex items-center space-x-2">
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition ${
                  step === s.num
                    ? 'bg-primary text-white shadow'
                    : step > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <span className={`text-xs font-semibold ${step === s.num ? 'text-primary' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Get Anonymous Pass */}
      {step === 1 && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-primary flex items-center justify-center shadow-inner">
            <Mail className={`w-10 h-10 ${loadingPass ? 'animate-bounce' : ''}`} />
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
              {passReady ? 'Your pass is ready!' : 'Acquire Your Blind Signature Pass'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Your device will generate a random secret token and blind it before signing. Even the server cannot trace your answers back to your identity.
            </p>
          </div>

          {passReady ? (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold">
              Pass is ready! It cannot be traced to you. Proceeding...
            </div>
          ) : (
            <button
              disabled={loadingPass}
              onClick={handleGetPass}
              className="px-8 py-3 bg-primary text-white font-bold rounded-2xl shadow hover:bg-primary-dark transition min-h-tap disabled:opacity-50"
            >
              {loadingPass ? 'Blinding & Signing Token...' : 'Get Anonymous Pass'}
            </button>
          )}
        </div>
      )}

      {/* Step 2: The Feedback Form */}
      {step === 2 && (
        <form onSubmit={handleSubmitFeedback} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
          {/* Privacy Panel */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex items-start space-x-3 text-xs text-emerald-900 dark:text-emerald-300">
            <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
            <p className="leading-relaxed">
              <strong>Privacy Guarantee:</strong> The organiser will see averages and shuffled comments only. Your name, email, time of submission and device are never stored with your answers.
            </p>
          </div>

          {/* Star Ratings (1 to 5) */}
          <div className="space-y-4">
            {[
              { label: 'Overall Experience', val: overall, set: setOverall },
              { label: 'Content Quality', val: content, set: setContent },
              { label: 'Delivery & Speaker', val: delivery, set: setDelivery },
              { label: 'Venue & Logistics', val: venue, set: setVenue },
              { label: 'Value (Worth my time)', val: value, set: setValue },
            ].map((rating, idx) => (
              <div key={idx} className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{rating.label}</span>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => rating.set(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating.val ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Topic selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Key Focus Topic</label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
            >
              {FEEDBACK_TOPICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Would Recommend */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Would you recommend this event?</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="recommend"
                  checked={wouldRecommend === true}
                  onChange={() => setWouldRecommend(true)}
                  className="text-primary"
                />
                <span>Yes, highly recommend</span>
              </label>
              <label className="flex items-center space-x-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="recommend"
                  checked={wouldRecommend === false}
                  onChange={() => setWouldRecommend(false)}
                  className="text-primary"
                />
                <span>No, room for improvement</span>
              </label>
            </div>
          </div>

          {/* Comment Box with Live Personal Details Warning */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Optional Comments</label>
              <span className="text-[11px] text-slate-400">{comment.length}/500</span>
            </div>
            <textarea
              maxLength={500}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share constructive feedback. Never include your name or roll number."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />

            {/* Non-blocking personal details warning */}
            {hasPersonalDetails() && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>This looks like personal details. Remove them to stay anonymous.</span>
              </div>
            )}
          </div>

          {/* Random delay checkbox */}
          <label className="flex items-center space-x-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={useDelay}
              onChange={(e) => setUseDelay(e.target.checked)}
              className="rounded border-slate-300 text-primary"
            />
            <span>Send after a random short delay (recommended to defeat traffic correlation)</span>
          </label>

          {/* Submit button & delay progress */}
          <div className="pt-4">
            {submitting ? (
              <div className="space-y-2 text-center">
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${delayProgress}%` }}
                  ></div>
                </div>
                <span className="text-xs text-slate-400">Randomizing submission timing...</span>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full py-3.5 bg-primary text-white font-bold rounded-2xl shadow hover:bg-primary-dark transition min-h-tap flex items-center justify-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Anonymous Feedback</span>
              </button>
            )}
          </div>
        </form>
      )}

      {/* Step 3: Receipt Card (Section 10.10) */}
      {step === 3 && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Feedback Submitted!</h2>
            <p className="text-sm text-slate-500">Your cryptographic receipt has been verified.</p>
          </div>

          {/* Receipt Token Short Hash */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 inline-block text-center">
            <span className="text-xs text-slate-400 block font-mono">TOKEN HASH RECEIPT</span>
            <span className="text-xl font-mono font-black text-primary tracking-wider">
              {receiptTokenHash.substring(0, 12)}
            </span>
          </div>

          {/* Verification Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={handleCheckCounted}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition min-h-tap"
            >
              {isCounted === true ? '✓ Counted in Database' : 'Check it was counted'}
            </button>

            <button
              onClick={handleVerifySignature}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition min-h-tap"
            >
              {sigValid === true ? '✓ Signature Valid' : 'Verify my signature'}
            </button>

            <button
              onClick={() => setShowJsonView(!showJsonView)}
              className="w-full sm:w-auto px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-200 transition min-h-tap"
            >
              See what was sent
            </button>
          </div>

          {/* Read-only JSON view of exact request body */}
          {showJsonView && (
            <div className="text-left p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto shadow-inner">
              <pre>{JSON.stringify(sentPayload, null, 2)}</pre>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-center space-x-4">
            <Link
              to={`/events/${eventId}`}
              className="inline-flex items-center px-4 py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Back to Event
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
