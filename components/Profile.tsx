"use client";

import React from 'react';

interface ProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
  signedIn?: boolean;
  user?: any;
  loading?: boolean;
  onOpenWallet?: () => void;
  onOpenSafety?: () => void;
  onUserUpdated?: (updated: any) => void;
  onSignIn?: () => void;
  onLogout?: () => void;
}

export default function Profile({
  isOpen = true,
  onClose = () => {},
  signedIn = false,
  user,
  loading = false,
  onOpenWallet,
  onOpenSafety,
  onUserUpdated,
  onSignIn,
  onLogout,
}: ProfileProps) {
  if (!isOpen) return null;

  const name = user?.passengerProfile?.fullName?.trim();
  const initial = (name || user?.email || 'G').charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col justify-between overflow-y-auto rounded-l-3xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Profile</h2>
            <button type="button" onClick={onClose} aria-label="Close profile" className="p-2 text-lg text-slate-500 hover:text-slate-800">✕</button>
          </div>

          <div className="flex items-center space-x-4 rounded-2xl bg-[#0b4d44] p-5 text-white shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-400 bg-slate-700 text-xl font-bold">{signedIn ? initial : 'G'}</div>
            <div>
              <h3 className="text-lg font-bold">{signedIn ? name || (loading ? 'Loading your profile…' : 'Your NexaGo account') : 'Guest rider'}</h3>
              <p className="text-xs text-emerald-200">{signedIn ? user?.passengerProfile?.verificationStatus || 'Passenger account' : 'Sign in to manage your rides and profile'}</p>
              {signedIn && user?.createdAt && <p className="mt-1 text-[10px] text-slate-300">Member since {new Date(user.createdAt).toLocaleDateString()}</p>}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center space-x-3"><span aria-hidden="true">✉️</span><span>{signedIn ? user?.email || 'No email on file' : 'Not signed in'}</span></div>
            <div className="flex items-center space-x-3"><span aria-hidden="true">📞</span><span>{signedIn ? user?.phone || 'No phone number on file' : 'Sign in to add contact details'}</span></div>
          </div>

          <div className="space-y-3 pt-2">
            <button type="button" onClick={onClose} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"><span aria-hidden="true">🛺</span><span className="ml-3">Nexa Ride</span></button>
            <button type="button" onClick={onClose} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"><span aria-hidden="true">✈️</span><span className="ml-3">Flight</span></button>
            <button type="button" onClick={() => { onClose(); onOpenWallet?.(); }} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"><span aria-hidden="true">💳</span><span className="ml-3">NexaPay wallet &amp; PIN</span></button>
            <button type="button" onClick={onClose} className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-100"><span aria-hidden="true">🎧</span><span className="ml-3">Contact support</span></button>
          </div>
        </div>

        <div className="pt-6">
          {signedIn ? <button type="button" onClick={() => { onClose(); onLogout?.(); }} className="w-full rounded-2xl bg-rose-50 py-3.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100">Sign out</button> : <button type="button" onClick={() => { onClose(); onSignIn?.(); }} className="w-full rounded-2xl bg-[#0b4d44] py-3.5 text-sm font-semibold text-white transition hover:bg-teal-900">Sign in or create account</button>}
        </div>
      </div>
    </div>
  );
}
