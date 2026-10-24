"use client";

import React from 'react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideDrawer({ isOpen, onClose }: SideDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer Content */}
      <div className="relative w-80 max-w-full bg-slate-900 text-white h-full shadow-2xl border-r border-slate-800 flex flex-col z-10 p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center font-bold text-emerald-400">
              NG
            </div>
            <div>
              <h4 className="font-bold text-sm">NexaGo User</h4>
              <p className="text-xs text-slate-400">View Profile</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-lg text-xs"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 flex-1">
          <a href="#trips" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition">
            <span>🕒</span>
            <span className="text-sm font-medium">Trip History</span>
          </a>
          <a href="#wallet" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition">
            <span>💳</span>
            <span className="text-sm font-medium">NexaPay Wallet</span>
          </a>
          <a href="#safety" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition">
            <span>🛡️</span>
            <span className="text-sm font-medium">Safety Toolkit</span>
          </a>
          <a href="#settings" className="flex items-center space-x-3 p-3 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition">
            <span>⚙️</span>
            <span className="text-sm font-medium">Settings</span>
          </a>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button className="w-full bg-slate-800 hover:bg-red-950/45 hover:text-red-400 text-slate-300 font-medium py-2.5 rounded-xl text-sm border border-slate-700 transition">
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
