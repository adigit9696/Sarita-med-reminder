'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Application Error Boundary caught error]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">
            Unable to Load Page Section
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            A temporary view issue occurred. Your data in Firebase remains completely safe.
          </p>
          {error?.message && (
            <p className="text-[11px] font-mono text-rose-300 bg-rose-950/40 p-2 rounded-lg mt-2 text-left truncate">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
}
