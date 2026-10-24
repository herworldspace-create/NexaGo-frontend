"use client";

import React, { useState } from 'react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [method, setMethod] = useState<'passkey' | 'whatsapp'>('passkey');
  const [phoneNumber, setPhoneNumber] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 text-white rounded-2xl p-6 shadow-2xl border border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold">Welcome to NexaGo</h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
          <button
            onClick={() => setMethod('passkey')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              method === 'passkey' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            Fingerprint / Face ID
          </button>
          <button
            onClick={() => setMethod('whatsapp')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              method === 'whatsapp' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400'
            }`}
          >
            WhatsApp OTP
          </button>
        </div>

        {method === 'passkey' ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 mx-auto bg-emerald-950/60 border border-emerald-500/50 rounded-full flex items-center justify-center text-2xl text-emerald-400">
              👆
            </div>
            <p className="text-xs text-slate-400">Use your device biometrics to sign in instantly.</p>
            <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm">
              Authenticate with Passkey
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Phone Number</label>
              <input 
                type="tel"
                placeholder="+234 800 000 0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg text-sm">
              Send WhatsApp Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
