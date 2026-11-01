import React from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { formatEventDateTime } from '@eventhive/shared';

interface ClashItem {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

interface ClashWarningModalProps {
  clashes: ClashItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const ClashWarningModal: React.FC<ClashWarningModalProps> = ({ clashes, onConfirm, onCancel }) => {
  if (clashes.length === 0) return null;
  const first = clashes[0];
  const timeRange = `${formatEventDateTime(first.starts_at)} - ${formatEventDateTime(first.ends_at)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400 mb-4">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">Schedule Clash Detected</h3>
        </div>

        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 leading-relaxed">
          This overlaps with <span className="font-semibold text-slate-900 dark:text-slate-100">"{first.title}"</span> ({timeRange}). Register anyway?
        </p>

        {clashes.length > 1 && (
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500">
            + {clashes.length - 1} other overlapping event(s) registered
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition min-h-tap min-w-tap"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-xl shadow-sm transition min-h-tap"
          >
            Register anyway
          </button>
        </div>
      </div>
    </div>
  );
};
