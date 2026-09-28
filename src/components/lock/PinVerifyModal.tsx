'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Shield, X, Lock, AlertTriangle, Delete } from 'lucide-react';
import { audioAlerts } from '@/lib/audio-alerts';

interface PinVerifyModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  correctPin: string;
  requiresSureText?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PinVerifyModal: React.FC<PinVerifyModalProps> = ({
  isOpen,
  title,
  subtitle,
  correctPin,
  requiresSureText = false,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState('');
  const [sureInput, setSureInput] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const targetLength = correctPin?.length || 4;

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setSureInput('');
      setIsError(false);
      setErrorMsg('');
      // Focus hidden input for physical keyboard support
      setTimeout(() => {
        hiddenInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const verifyPin = (candidatePin: string) => {
    if (candidatePin === correctPin) {
      if (requiresSureText) {
        // When destructive confirmation is needed, wait for "Sure" text
        if (sureInput.trim().toLowerCase() === 'sure') {
          handleSuccess();
        } else {
          setErrorMsg('Type "Sure" below and confirm');
        }
      } else {
        // INSTANT AUTO-ENTER: Instant verification and success
        handleSuccess();
      }
    } else {
      // Incorrect PIN: Shake and auto-clear after 400ms for fast retry
      setIsError(true);
      setErrorMsg('Incorrect PIN. Please try again.');
      try {
        audioAlerts.playOverdueAlert();
      } catch (e) {
        // ignore audio failure
      }
      setTimeout(() => {
        setPin('');
        setIsError(false);
      }, 450);
    }
  };

  const handleSuccess = () => {
    try {
      audioAlerts.playSuccessChime();
    } catch (e) {
      // ignore
    }
    setPin('');
    setSureInput('');
    setIsError(false);
    setErrorMsg('');
    onSuccess();
  };

  const handleDigit = (digit: string) => {
    if (pin.length < targetLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setIsError(false);
      setErrorMsg('');

      // Auto-enter immediately when the required number of digits is reached
      if (nextPin.length === targetLength) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setIsError(false);
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setIsError(false);
    setErrorMsg('');
  };

  const handleClose = () => {
    setPin('');
    setSureInput('');
    setIsError(false);
    setErrorMsg('');
    onCancel();
  };

  // Keyboard navigation & physical typing listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is typing in the "Sure" text input, let them type normally
      if (requiresSureText && document.activeElement?.tagName === 'INPUT' && document.activeElement !== hiddenInputRef.current) {
        return;
      }

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'Enter') {
        if (pin.length === targetLength) {
          verifyPin(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, targetLength, correctPin, requiresSureText, sureInput]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn select-none"
      onClick={handleClose}
    >
      <div 
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 sm:p-6 relative flex flex-col items-center"
        onClick={(e) => {
          e.stopPropagation();
          hiddenInputRef.current?.focus();
        }}
      >
        {/* Hidden input for physical keyboard / mobile accessibility */}
        <input
          ref={hiddenInputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, targetLength);
            setPin(val);
            if (val.length === targetLength) {
              verifyPin(val);
            }
          }}
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          tabIndex={-1}
        />

        {/* Modal Top Header */}
        <div className="w-full flex items-start justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
              requiresSureText ? 'bg-rose-100 text-rose-600' : 'bg-teal-50 text-teal-600 border border-teal-100'
            }`}>
              {requiresSureText ? <AlertTriangle className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {subtitle || 'Auto-unlocks instantly upon 4th digit'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PIN Indicators / Auto-Enter Feedback */}
        <div className={`flex justify-center items-center gap-3.5 my-5 ${isError ? 'animate-shake' : ''}`}>
          {Array.from({ length: targetLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? isError
                    ? 'bg-rose-500 border-rose-500 scale-110 shadow-sm shadow-rose-300'
                    : 'bg-teal-600 border-teal-600 scale-110 shadow-sm shadow-teal-300'
                  : 'bg-slate-100 border-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {errorMsg ? (
          <p className="text-xs font-semibold text-rose-600 mb-3 text-center animate-fadeIn">
            {errorMsg}
          </p>
        ) : (
          <p className="text-[11px] font-medium text-slate-400 mb-3 text-center">
            Tap or type your {targetLength}-digit PIN
          </p>
        )}

        {/* Optional "Sure" Confirmation for Destructive Actions */}
        {requiresSureText && (
          <div className="w-full mb-4">
            <label className="block text-xs font-semibold text-rose-700 mb-1 text-center">
              Type <span className="font-bold underline">Sure</span> to permanently confirm:
            </label>
            <input
              type="text"
              value={sureInput}
              onChange={(e) => {
                setSureInput(e.target.value);
                setErrorMsg('');
              }}
              placeholder='Type "Sure"'
              className="w-full bg-rose-50/50 border border-rose-200 p-2 rounded-xl text-center text-xs font-bold text-rose-900 focus:bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
            />
          </div>
        )}

        {/* Touch Number Pad (Optimized for Mobile Phones & Quick Desktop Clicking) */}
        <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px] touch-manipulation">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="h-12 rounded-xl bg-slate-50 hover:bg-teal-50 active:bg-teal-100 active:scale-95 text-slate-800 hover:text-teal-700 font-bold text-lg border border-slate-200 transition-all shadow-2xs flex items-center justify-center select-none"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-500 font-semibold text-xs border border-slate-200 transition-all flex items-center justify-center select-none"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-xl bg-slate-50 hover:bg-teal-50 active:bg-teal-100 active:scale-95 text-slate-800 hover:text-teal-700 font-bold text-lg border border-slate-200 transition-all shadow-2xs flex items-center justify-center select-none"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-12 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-600 border border-slate-200 transition-all flex items-center justify-center select-none"
            title="Backspace"
          >
            <Delete className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Bottom Actions for Destructive Modals */}
        {requiresSureText && (
          <div className="flex gap-2 w-full mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => verifyPin(pin)}
              disabled={pin.length !== targetLength || sureInput.trim().toLowerCase() !== 'sure'}
              className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40"
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
