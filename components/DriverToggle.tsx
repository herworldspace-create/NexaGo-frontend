"use client";

import React, { useState } from 'react';

export default function DriverToggle() {
  const [mode, setMode] = useState<'rider' | 'driver'>('rider');
  const [isOnline, setIsOnline] = useState(false);

  return (
    <div className="fixed top-4 right-4 z-40 bg-slate-900/90 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl flex items-center space-x-2">
      {/* Rider / Driver Switch */}
      <div className="bg-slate-800 p-1 rounded-xl flex items-center space-x-1">
        <button
          onClick={() => setMode('rider')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mode === 'rider'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Passenger
        </button>
        <button
          onClick={() => setMode('driver')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            mode === 'driver'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Driver
        </button>
      </div>

      {/* Online/Offline Toggle for Driver Mode */}
      {mode === 'driver' && (
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            isOnline
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          {isOnline ? '● Online' : '○ Offline'}
        </button>
      )}
    </div>
  );
}
