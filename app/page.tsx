"use client";

import React, { useState } from 'react';
import DriverToggle from '@/components/DriverToggle';
import VehicleSelector from '@/components/VehicleSelector';
import SideDrawer from '@/components/SideDrawer';
import WalletModal from '@/components/WalletModal';
import AuthModal from '@/components/AuthModal';

export default function Home() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Google Maps Canvas Background / Container */}
      <div id="map" className="absolute inset-0 z-0 bg-slate-900 flex items-center justify-center text-slate-500">
        {/* Your Map API Component renders here */}
        <p className="text-sm font-medium">Interactive Map View</p>
      </div>

      {/* Top Header Overlay */}
      <div className="absolute top-4 left-4 z-40 flex items-center space-x-2">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="bg-slate-900/90 text-white p-3 rounded-2xl border border-slate-800 shadow-xl hover:bg-slate-800 transition"
        >
          ☰
        </button>
        <button
          onClick={() => setIsWalletOpen(true)}
          className="bg-slate-900/90 text-emerald-400 font-bold px-4 py-2.5 rounded-2xl border border-slate-800 shadow-xl text-xs hover:bg-slate-800 transition"
        >
          💳 Wallet
        </button>
        <button
          onClick={() => setIsAuthOpen(true)}
          className="bg-slate-900/90 text-slate-200 font-medium px-3 py-2.5 rounded-2xl border border-slate-800 shadow-xl text-xs hover:bg-slate-800 transition"
        >
          👤 Login
        </button>
      </div>

      {/* Driver / Passenger Switcher (Top Right) */}
      <DriverToggle />

      {/* Vehicle Class Picker Sheet (Bottom Center) */}
      <VehicleSelector />

      {/* Slide-out Navigation Drawer */}
      <SideDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* NexaPay Wallet Modal */}
      <WalletModal isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} />

      {/* Fast Auth / Passkey Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </main>
  );
}
