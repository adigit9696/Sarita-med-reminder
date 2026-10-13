'use client';

import React, { useEffect, useState } from 'react';
import { Pill } from 'lucide-react';
import { BRAND } from '@/lib/brand.config';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 1800,
}) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Begin smooth fade-out slightly before completion
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, Math.max(durationMs - 450, 800));

    const completeTimer = setTimeout(() => {
      onComplete();
    }, durationMs);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, durationMs]);

  const handleSkip = () => {
    setFadeOut(true);
    setTimeout(onComplete, 200);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col items-center justify-between p-8 select-none cursor-pointer transition-clinical ${
        fadeOut ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Empty spacer for flex layout balance */}
      <div className="h-6 w-full" />

      {/* Center Essentials: Logo + Name */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Brand Pill Emblem */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-teal-600 flex items-center justify-center shadow-lg text-white border border-teal-500/30 ring-1 ring-white/10">
            <Pill className="w-10 h-10 text-white stroke-[2]" />
          </div>
        </div>

        {/* Essential Brand Heading: Sarita Pharmacy - Med Reminder */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
          {BRAND.pharmacy.name}
        </h1>
        <p className="text-sm font-semibold text-teal-400 mt-1 tracking-wide uppercase">
          Med Reminder
        </p>

        {/* Minimal Clinical Progress Line */}
        <div className="w-32 h-1 bg-slate-800 rounded-full mt-6 overflow-hidden">
          <div className="w-full h-full bg-teal-500 rounded-full animate-progress" />
        </div>
      </div>

      {/* Bottom Essential: Powered by Oasis MedTeck */}
      <div className="relative z-10 text-center pb-2">
        <p className="text-xs font-medium text-slate-400 tracking-wider">
          Powered by <span className="font-semibold text-slate-200">Oasis MedTeck</span>
        </p>
      </div>
    </div>
  );
};
