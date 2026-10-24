"use client";

import React from 'react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">NexaPay Wallet</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2 py-1 bg-slate-800 rounded-lg"
          >
            ✕
          </button>
        </div>

        <div className="bg-slate-800/80 p-4 rounded-xl mb-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Available Balance</p>
          <p className="text-3xl font-extrabold text-emerald-400">₦0.00</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 rounded-xl text-sm transition">
            + Add Funds
          </button>
          <button className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-xl text-sm border border-slate-700 transition">
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
