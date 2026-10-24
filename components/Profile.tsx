"use client";

import React from 'react';

interface ProfileProps {
  isOpen: boolean;
  onClose: () => void;
  signedIn?: boolean;
  user?: any;
  loading?: boolean;
  onOpenWallet?: () => void;
  onOpenSafety?: () => void;
  onOpenDriver?: () => void;
  onUserUpdated?: (updated: any) => void;
  onSignIn?: () => void;
  onLogout?: () => void;
}

export default function Profile({
  isOpen,
  onClose,
  signedIn,
  user,
  loading,
  onOpenWallet,
  onOpenSafety,
  onOpenDriver,
  onUserUpdated,
  onSignIn,
  onLogout,
}: ProfileProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white text-slate-900 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto rounded-l-3xl">
        
        {/* Header & User Info */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Profile</h2>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 text-lg">✕</button>
          </div>

          <div className="bg-[#0b4d44] text-white p-5 rounded-2xl flex items-center space-x-4 shadow-md">
            <div className="w-14 h-14 rounded-full bg-slate-700 border-2 border-emerald-400 flex items-center justify-center text-xl font-bold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'H'}
            </div>
            <div>
              <h3 className="font-bold text-lg">{user?.name || 'Herworldspace'}</h3>
              <p className="text-xs text-emerald-200">Identity not yet verified</p>
              <p className="text-[10px] text-slate-300 mt-1">Member since October 2026</p>
            </div>
          </div>

          {/* User Details */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 text-sm text-slate-600">
            <div className="flex items-center space-x-3">
              <span>✉️</span>
              <span>{user?.email || 'Herworldspace@gmail.com'}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span>📞</span>
              <span>{user?.phone || 'No phone number on file'}</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="space-y-3 pt-2">
            <button 
              onClick={() => onClose()}
              className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3 text-slate-800 font-semibold text-sm transition text-left"
            >
              <span className="text-lg">🛺</span>
              <span>Nexa Ride</span>
            </button>

            <button 
              onClick={() => onClose()}
              className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3 text-slate-800 font-semibold text-sm transition text-left"
            >
              <span className="text-lg">✈️</span>
              <span>Flight</span>
            </button>

            <button 
              onClick={() => {
                onClose();
                if (onOpenWallet) onOpenWallet();
              }}
              className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3 text-slate-800 font-semibold text-sm transition text-left"
            >
              <span className="text-lg">💳</span>
              <span>NexaPay wallet & PIN</span>
            </button>

            <button 
              onClick={() => onClose()}
              className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 flex items-center space-x-3 text-slate-800 font-semibold text-sm transition text-left"
            >
              <span className="text-lg">🎧</span>
              <span>Contact support</span>
            </button>
          </div>
        </div>

        {/* Footer Sign Out */}
        <div className="pt-6">
          <button 
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold py-3.5 rounded-2xl transition text-sm"
          >
            Sign out
          </button>
        </div>

      </div>
    </div>
  );
}
