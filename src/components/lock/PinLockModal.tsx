'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Pill, Lock, Delete } from 'lucide-react';
import { BRAND } from '@/lib/brand.config';
import { audioAlerts } from '@/lib/audio-alerts';

interface PinLockModalProps {
  isLocked: boolean;
  correctPin: string;
  onUnlock: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  isLocked,
  correctPin,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const pinLength = correctPin?.length || 4;

  useEffect(() => {
    if (isLocked) {
      setPin('');
      setError(false);
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 50);
    }
  }, [isLocked]);

  const verifyPin = (candidate: string) => {
    if (candidate === correctPin) {
      setPin('');
      setError(false);
      try {
        audioAlerts.playSuccessChime();
      } catch (e) {
        // ignore
      }
      onUnlock();
    } else {
      setError(true);
      try {
        audioAlerts.playOverdueAlert();
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        setPin('');
        setError(false);
      }, 450);
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < pinLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === pinLength) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  // Keyboard support for physical keyboards
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        if (pin.length === pinLength) {
          verifyPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, pin, correctPin, pinLength]);

  if (!isLocked) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none animate-fadeIn"
      onClick={() => hiddenInputRef.current?.focus()}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 flex flex-col items-center">
        {/* Hidden input for mobile keyboard / accessibility auto-fill */}
        <input
          ref={hiddenInputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, pinLength);
            setPin(val);
            if (val.length === pinLength) {
              verifyPin(val);
            }
          }}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          tabIndex={-1}
        />

        {/* Brand Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/25 text-white mb-4">
          <Pill className="w-8 h-8 text-white" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Sarita Pharmacy
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Enter staff PIN to unlock
        </p>

        {/* PIN Indicators with instant auto-enter feedback */}
        <div className={`flex justify-center items-center gap-3.5 my-6 ${error ? 'animate-shake' : ''}`}>
          {Array.from({ length: pinLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? error
                    ? 'bg-rose-500 border-rose-500 scale-110 shadow-sm shadow-rose-300'
                    : 'bg-teal-600 border-teal-600 scale-110 shadow-sm shadow-teal-300'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {error ? (
          <p className="text-xs font-semibold text-rose-600 mb-4 animate-fadeIn">
            Incorrect PIN. Please try again.
          </p>
        ) : (
          <p className="text-[11px] font-medium text-slate-400 mb-4">
            Instant unlock upon entering {pinLength} digits
          </p>
        )}

        {/* Touch-optimized Number Pad */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] touch-manipulation">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-13 rounded-2xl bg-slate-50 hover:bg-teal-50 active:bg-teal-100 active:scale-95 text-slate-800 hover:text-teal-700 font-bold text-lg border border-slate-200 transition-all shadow-2xs flex items-center justify-center select-none"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-500 font-semibold text-xs border border-slate-200 transition-all flex items-center justify-center select-none"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-13 rounded-2xl bg-slate-50 hover:bg-teal-50 active:bg-teal-100 active:scale-95 text-slate-800 hover:text-teal-700 font-bold text-lg border border-slate-200 transition-all shadow-2xs flex items-center justify-center select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 transition-all flex items-center justify-center select-none"
            title="Backspace"
          >
            <Delete className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-100 text-center w-full">
          <p className="text-[10px] text-slate-400 font-medium">
            {BRAND.tagline}
          </p>
        </div>
      </div>
    </div>
  );
};
