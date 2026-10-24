"use client";

import React, { useState } from 'react';

interface VehicleOption {
  id: string;
  name: string;
  eta: string;
  price: string;
  icon: string;
}

const vehicles: VehicleOption[] = [
  { id: 'standard', name: 'NexaGo Standard', eta: '3 min away', price: '₦1,200', icon: '🚗' },
  { id: 'keke', name: 'NexaKeke / Bike', eta: '2 min away', price: '₦600', icon: '🛺' },
  { id: 'comfort', name: 'Nexa Comfort', eta: '5 min away', price: '₦2,100', icon: '🚘' },
];

export default function VehicleSelector() {
  const [selected, setSelected] = useState('standard');

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl border border-slate-800 shadow-2xl">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Choose Ride Type</h3>
      <div className="space-y-2">
        {vehicles.map((v) => (
          <div
            key={v.id}
            onClick={() => setSelected(v.id)}
            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
              selected === v.id
                ? 'bg-emerald-950/40 border-emerald-500/80 shadow-sm'
                : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-2xl">{v.icon}</span>
              <div>
                <p className="text-sm font-bold">{v.name}</p>
                <p className="text-xs text-slate-400">{v.eta}</p>
              </div>
            </div>
            <p className="text-sm font-bold text-emerald-400">{v.price}</p>
          </div>
        ))}
      </div>
      <button className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition shadow-lg">
        Confirm Ride
      </button>
    </div>
  );
}
