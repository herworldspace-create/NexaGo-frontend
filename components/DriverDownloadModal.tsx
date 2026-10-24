"use client";

import React from 'react';

interface DriverDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DriverDownloadModal({ isOpen, onClose }: DriverDownloadModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-800 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition"
        >
          ✕
        </button>

        <div className="text-center space-y-4 pt-2">
          <div className="w-16 h-16 mx-auto bg-emerald-950/80 border border-emerald-500/50 rounded-2xl flex items-center justify-center text-3xl shadow-lg shadow-emerald-900/20">
            🛺
          </div>

          <div>
            <h3 className="text-lg font-bold">Become a NexaGo Driver</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              To accept trips, manage earnings, and drive with NexaGo, download our dedicated Driver App.
            </p>
          </div>

          <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/50 text-left space-y-2">
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Flexible work hours & daily payouts</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>In-app GPS & instant navigation</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-300">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Low service fees per trip</span>
            </div>
          </div>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert("Driver App APK download will start here!");
            }}
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-950/50 text-sm"
          >
            Download Driver App (.APK)
          </a>

          <p className="text-[10px] text-slate-500">Compatible with Android 7.0 and above</p>
        </div>
      </div>
    </div>
  );
}
