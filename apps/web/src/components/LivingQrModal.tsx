import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { X, ShieldCheck } from 'lucide-react';

interface LivingQrModalProps {
  registrationId: string;
  onClose: () => void;
  localTicket?: { secret: string; studentName: string; eventTitle: string };
}

export const LivingQrModal: React.FC<LivingQrModalProps> = ({ registrationId, onClose, localTicket }) => {
  const [data, setData] = useState<{
    secret: string;
    studentName: string;
    eventTitle: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(30);

  // Fetch secret once and keep in memory
  useEffect(() => {
    if (localTicket) {
      setData(localTicket);
      setLoading(false);
      return;
    }
    let active = true;
    fetch(`/api/registrations/${registrationId}/qr-secret`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.error?.message || 'Failed to fetch ticket secret');
        }
        return res.json();
      })
      .then((resData) => {
        if (active) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [registrationId, localTicket]);

  // Compute HMAC and update QR code every second
  useEffect(() => {
    if (!data) return;

    let timer: NodeJS.Timeout;

    const updateQr = async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const windowIdx = Math.floor(nowSec / 30);
      const remaining = 30 - (nowSec % 30);
      setSecondsRemaining(remaining);

      // WebCrypto HMAC computation
      const secretBytes = new Uint8Array(
        data.secret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const dataToSign = new TextEncoder().encode(`${registrationId}.${windowIdx}`);
      const sigBuf = await window.crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
      const sigHex = Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const mac = sigHex.substring(0, 20);
      const payload = `EH1.${registrationId}.${windowIdx}.${mac}`;

      const url = await QRCode.toDataURL(payload, {
        margin: 2,
        width: 260,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });
      setQrDataUrl(url);
    };

    const refresh = () => {
      updateQr().catch(() => setError('Unable to generate this ticket. Please reload and try again.'));
    };

    refresh();
    timer = setInterval(refresh, 1000);

    return () => clearInterval(timer);
  }, [data, registrationId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center space-x-1.5 text-primary mb-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-xs tracking-wider uppercase">Living QR Ticket</span>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-500">Generating secure rotating ticket...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-danger text-sm">{error}</div>
        ) : (
          <div>
            <div className="relative inline-block p-3 bg-white rounded-2xl shadow-inner border border-slate-100 mb-4">
              {qrDataUrl && <img src={qrDataUrl} alt="Living QR Code" className="w-60 h-60 rounded-lg mx-auto" />}

              {/* Circular countdown indicator */}
              <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-mono font-bold px-3 py-0.5 rounded-full shadow-md flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{secondsRemaining}s</span>
              </div>
            </div>

            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mt-2">
              {data?.studentName}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-xs mx-auto">
              {data?.eventTitle}
            </p>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Rotates every 30s. Offline TOTP verification. Screenshots expire within 60s.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
