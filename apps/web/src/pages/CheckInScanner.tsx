import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle, Clipboard, QrCode, XCircle } from 'lucide-react';
import { getDemoEvents } from '../lib/demoEvents';
import {
  checkInDemoRegistration,
  getDemoRegistrations,
} from '../lib/demoRegistrations';

type ScanResult = {
  kind: 'success' | 'error' | 'already';
  title: string;
  message: string;
};

async function computeMac(secret: string, registrationId: string, windowIndex: number) {
  const pairs = secret.match(/.{1,2}/g);
  if (!pairs) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16))),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${registrationId}.${windowIndex}`)
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20);
}

export const CheckInScanner: React.FC = () => {
  const events = getDemoEvents();
  const [eventId, setEventId] = useState(events[0]?.id || '');
  const [payload, setPayload] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  const stopScanner = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => stopScanner(), []);

  const verifyAndCheckIn = async (rawPayload: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      setResult(null);
      const parts = rawPayload.trim().split('.');
      if (parts.length !== 4 || parts[0] !== 'EH1') {
        setResult({ kind: 'error', title: 'Invalid ticket', message: 'This is not an EventHive Living QR code.' });
        return;
      }

      const [, registrationId, windowRaw, suppliedMac] = parts;
      const windowIndex = Number.parseInt(windowRaw, 10);
      const currentWindow = Math.floor(Date.now() / 1000 / 30);
      if (!Number.isInteger(windowIndex) || Math.abs(currentWindow - windowIndex) > 1) {
        setResult({ kind: 'error', title: 'Ticket expired', message: 'Ask the student to show the current rotating QR code.' });
        return;
      }

      const registration = getDemoRegistrations().find((item) => item.id === registrationId);
      if (!registration || registration.status !== 'registered') {
        setResult({ kind: 'error', title: 'Registration not found', message: 'This ticket is not active in this demo browser.' });
        return;
      }
      if (registration.eventId !== eventId) {
        setResult({ kind: 'error', title: 'Wrong event', message: 'This ticket belongs to another event.' });
        return;
      }

      const event = events.find((item) => item.id === eventId);
      if (!event) {
        setResult({ kind: 'error', title: 'Event not found', message: 'Select a valid organizer event.' });
        return;
      }

      const now = Date.now();
      const allowedStart = new Date(event.starts_at).getTime() - 60 * 60 * 1000;
      const eventEnd = new Date(event.ends_at).getTime();
      if (now < allowedStart || now > eventEnd) {
        setResult({ kind: 'error', title: 'Check-in closed', message: 'Check-in runs from 60 minutes before the event until it ends.' });
        return;
      }

      const expectedMac = await computeMac(registration.secret, registrationId, windowIndex);
      if (!/^[0-9a-f]{20}$/i.test(suppliedMac) || suppliedMac.toLowerCase() !== expectedMac) {
        setResult({ kind: 'error', title: 'Invalid signature', message: 'The ticket code was changed or is not authentic.' });
        return;
      }

      if (registration.checkedInAt) {
        setResult({
          kind: 'already',
          title: 'Already checked in',
          message: `${registration.studentName || 'Student'} was checked in earlier.`,
        });
        stopScanner();
        return;
      }

      const updated = checkInDemoRegistration(registrationId);
      setResult({
        kind: 'success',
        title: 'Check-in successful',
        message: `${updated?.studentName || 'Student'} is now marked present.`,
      });
      setPayload('');
      stopScanner();
    } finally {
      busyRef.current = false;
    }
  };

  const startScanner = async () => {
    setResult(null);
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      setResult({ kind: 'error', title: 'Camera scanner unavailable', message: 'Use Chrome/Edge or paste the ticket code below.' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      const detector = new Detector({ formats: ['qr_code'] });
      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes[0]?.rawValue) {
            await verifyAndCheckIn(codes[0].rawValue);
            return;
          }
        } catch {
          // The next animation frame retries transient camera decode failures.
        }
        frameRef.current = requestAnimationFrame(scanFrame);
      };
      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setResult({ kind: 'error', title: 'Camera permission needed', message: 'Allow camera access, or paste the ticket code below.' });
      stopScanner();
    }
  };

  const selectedEvent = events.find((event) => event.id === eventId);
  const checkedInCount = getDemoRegistrations().filter(
    (registration) => registration.eventId === eventId && registration.checkedInAt
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Organizer tool</span>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1">QR Check-in Scanner</h1>
        <p className="text-sm text-slate-500 mt-2">
          Verify a rotating Living QR ticket and mark the student present.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-5">
        <label className="block space-y-2">
          <span className="text-xs font-bold uppercase text-slate-500">Event</span>
          <select
            value={eventId}
            onChange={(event) => { setEventId(event.target.value); setResult(null); }}
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            {events.length === 0 && <option value="">Create an event first</option>}
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </label>

        {selectedEvent && (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
              <div className="text-2xl font-black">{selectedEvent.confirmedCount || 0}</div>
              <div className="text-[11px] uppercase text-slate-400">Registered</div>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <div className="text-2xl font-black text-emerald-600">{checkedInCount}</div>
              <div className="text-[11px] uppercase text-slate-400">Checked in</div>
            </div>
          </div>
        )}

        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center">
          <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`} muted playsInline />
          {!scanning && <QrCode className="w-16 h-16 text-slate-600" />}
          {scanning && <div className="absolute inset-8 border-2 border-white/80 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />}
        </div>

        <button
          type="button"
          disabled={!eventId}
          onClick={scanning ? stopScanner : startScanner}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {scanning ? <CameraOff className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
          {scanning ? 'Stop camera' : 'Start camera scanner'}
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400"><div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" />OR<div className="h-px bg-slate-200 dark:bg-slate-700 flex-1" /></div>

        <form
          onSubmit={(event) => { event.preventDefault(); verifyAndCheckIn(payload); }}
          className="space-y-3"
        >
          <label className="block space-y-2">
            <span className="text-xs font-bold uppercase text-slate-500">Paste ticket code</span>
            <textarea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              rows={3}
              placeholder="EH1.registration-id.window.signature"
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
            />
          </label>
          <button
            type="submit"
            disabled={!eventId || !payload.trim()}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Clipboard className="w-4 h-4" /> Verify and check in
          </button>
        </form>

        {result && (
          <div className={`rounded-2xl p-4 flex items-start gap-3 ${result.kind === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' : result.kind === 'already' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'}`}>
            {result.kind === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
            <div><div className="font-bold text-sm">{result.title}</div><div className="text-xs mt-0.5">{result.message}</div></div>
          </div>
        )}
      </div>
    </div>
  );
};
