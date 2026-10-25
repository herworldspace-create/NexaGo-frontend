"use client";

import React, { useEffect } from 'react';

export interface BottomSheetProps {
  onSelectService?: (service: string) => void;
  activeTab?: string;
  children?: React.ReactNode;
  title?: string;
  description?: string;
  onClose?: () => void;
}

export function BottomSheet({
  onSelectService,
  activeTab = 'ride',
  children,
  title,
  description,
  onClose,
}: BottomSheetProps) {
  return (
    <div className="w-full bg-white rounded-t-3xl border-t border-slate-100 p-4 shadow-xl">
      {title && (
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
            {description && (
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

      {children || (
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onSelectService && onSelectService("ride")}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-center ${
              activeTab === 'ride'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-xl">🚗</span>
            <span className="text-xs">Nexa Ride</span>
          </button>

          <button
            onClick={() => onSelectService && onSelectService("flight")}
            className={`p-3 rounded-2xl border flex flex-col items-center justify-center ${
              activeTab === 'flight'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold'
                : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="text-xl">✈️</span>
            <span className="text-xs">Nexa Flight</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function useDialogDismiss(onClose?: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}
