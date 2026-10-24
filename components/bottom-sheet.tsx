"use client";

import React from 'react';

interface BottomSheetProps {
  onSelectService?: (service: string) => void;
  activeTab?: string;
}

export default function BottomSheet({ onSelectService, activeTab = 'ride' }: BottomSheetProps) {
  return (
    <div className="w-full bg-white rounded-t-3xl border-t border-slate-100 p-4 shadow-xl">
      <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
      
      {/* Service Selection Tabs (Driver removed) */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => onSelectService && onSelectService('ride')}
          className={`p-3 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
            activeTab === 'ride' 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
              : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span className="text-xl">🛺</span>
          <span className="text-xs">Nexa Ride</span>
        </button>

        <button
          onClick={() => onSelectService && onSelectService('flight')}
          className={`p-3 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
            activeTab === 'flight' 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
              : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span className="text-xl">✈️</span>
          <span className="text-xs">Flight</span>
        </button>

        <button
          onClick={() => onSelectService && onSelectService('wallet')}
          className={`p-3 rounded-2xl border flex flex-col items-center justify-center space-y-1 transition ${
            activeTab === 'wallet' 
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
              : 'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <span className="text-xl">💳</span>
          <span className="text-xs">NexaPay</span>
        </button>
      </div>
    </div>
  );
}
