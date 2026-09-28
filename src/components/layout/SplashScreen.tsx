'use client';

import React, { useEffect, useState } from 'react';
import { Pill } from 'lucide-react';

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
      className={`fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col items-center justify-between p-8 select-none cursor-pointer transition-all duration-400 ease-in-out ${
        fadeOut ? 'opacity-0 scale-[0.98] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-900/30 via-slate-950/85 to-slate-950 pointer-events-none" />

      {/* Decorative subtle orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      {/* Empty spacer for flex layout balance */}
      <div className="h-6 w-full" />

      {/* Center Essentials: Logo + Name */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Glowing Brand Pill Emblem */}
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-gradient-to-tr from-teal-500/40 via-emerald-400/30 to-teal-600/40 rounded-3xl blur-xl animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 flex items-center justify-center shadow-2xl shadow-teal-500/40 text-white border border-white/20">
            <Pill className="w-12 h-12 text-white stroke-[2.2]" />
          </div>
        </div>

        {/* Essential Brand Heading: Sarita Pharmacy - Med Reminder */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
          Sarita Pharmacy
        </h1>
        <p className="text-sm sm:text-base font-semibold text-teal-400 mt-1 tracking-wide">
          Med Reminder
        </p>
      </div>

      {/* Bottom Essential: Powered by Oasis Medteck */}
      <div className="relative z-10 text-center pb-2">
        <p className="text-xs sm:text-sm font-medium text-slate-400 tracking-wider">
          Powered by <span className="font-semibold text-slate-200">Oasis Medteck</span>
        </p>
      </div>
    </div>
  );
};
