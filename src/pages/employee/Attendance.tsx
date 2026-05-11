import React, { useState, useEffect } from 'react';
import { useTracking } from '../../context/TrackingContext';
import { MapPin, CheckCircle2, XCircle, Navigation, Info, RefreshCw, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function EmployeeAttendance() {
  const { homeLocation, isCheckedIn, currentPosition, registerHome, checkOut, refreshLocation } = useTracking();
  const [shops, setShops] = useState<any[]>([]);

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const q = query(collection(db, 'shops'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        setShops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.warn("Failed to fetch shops for map");
      }
    };
    fetchShops();
  }, []);

  const handleRegisterHome = () => {
    if (currentPosition) {
      registerHome(currentPosition.lat, currentPosition.lng);
    } else {
      alert("Fetching current location... Please wait and try again.");
    }
  };

  const shopMarkers = shops.map(s => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    label: s.shopName,
    type: 'shop' as const
  }));

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Attendance & Geofencing</h2>
        <p className="text-zinc-500">Manage your Home Location and check current tracking status.</p>
      </div>

      {/* Map View Section */}
      <div className="card overflow-hidden">
        <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-900 font-bold">
            <Navigation className="w-5 h-5 text-accent" />
            <span>Map Overview</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-blue-500" />
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">You</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-2 h-2 rounded-full bg-amber-500" />
               <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Shops</span>
            </div>
            <button 
              onClick={refreshLocation}
              className="p-2 hover:bg-zinc-100 rounded-full transition-colors group ml-2"
              title="Refresh Location"
            >
              <RefreshCw className="w-5 h-5 text-zinc-400 group-hover:text-accent transition-colors" />
            </button>
          </div>
        </div>
        <div className="h-[350px]">
          {currentPosition ? (
            <MapView 
              center={currentPosition} 
              markerPosition={currentPosition} 
              circleRadius={homeLocation ? 50 : undefined}
              extraMarkers={shopMarkers}
            />
          ) : (
            <div className="w-full h-full bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="font-bold text-zinc-900">Locating your device...</p>
              <p className="text-sm text-zinc-500 max-w-[200px] mt-1">Please ensure GPS is enabled and permissions are granted.</p>
            </div>
          )}
        </div>
      </div>

      {/* Home Location Status */}
      <div className="card p-8 group transition-all hover:shadow-md">
        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            "p-3 rounded-2xl transition-colors",
            homeLocation ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
          )}>
            <MapPin className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Home Geofence</h3>
            <p className="text-sm text-zinc-500 font-mono">
              {homeLocation 
                ? `Lat: ${homeLocation.lat.toFixed(6)}, Lng: ${homeLocation.lng.toFixed(6)}`
                : 'No home location registered yet.'}
            </p>
          </div>
        </div>

        {!homeLocation ? (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-zinc-400 mt-0.5" />
              <p className="text-xs text-zinc-600 leading-relaxed">
                Stand at your permanent residence and click the button below. This will create a 50-meter safety zone. Your attendance will start automatically when you leave this zone.
              </p>
            </div>
            <button 
              onClick={handleRegisterHome}
              disabled={!currentPosition}
              className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2 group"
            >
              <Navigation className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              Register Home Location
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-between border border-emerald-100 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-bold">Home Location Locked</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black opacity-50">
                <Lock className="w-3 h-3" />
                Immutable
              </div>
            </div>
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 flex items-start gap-3">
               <Info className="w-5 h-5 text-zinc-400 mt-0.5" />
               <div>
                 <p className="text-xs font-bold text-zinc-600 mb-1">Location Locking Policy</p>
                 <p className="text-[10px] text-zinc-500 leading-relaxed">
                   Your home geofence is now permanent. For security and audit purposes, changes to these coordinates require direct administrator approval. Contact your supervisor to update your residence.
                 </p>
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Tracking Status */}
      <div className="card p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold">Live Tracking Status</h3>
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-100 rounded-full">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isCheckedIn ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
            )} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
              {isCheckedIn ? 'System Active' : 'System Idle'}
            </span>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="font-semibold text-lg">{isCheckedIn ? 'Currently On Field' : 'Off-Duty'}</p>
            </div>
            {isCheckedIn && (
              <button 
                onClick={() => checkOut()}
                className="px-4 py-2 border-2 border-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
              >
                End Session
              </button>
            )}
          </div>

          {isCheckedIn && currentPosition && (
            <div className="bg-zinc-950 text-white p-6 rounded-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Navigation className="w-24 h-24 rotate-45" />
               </div>
              <div className="flex items-center justify-between mb-4 relative z-10">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Live Coordinates</p>
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] uppercase font-bold">Transmitting</span>
                </div>
              </div>
              <p className="text-3xl font-mono relative z-10 mb-2">
                {currentPosition.lat.toFixed(6)}
              </p>
              <p className="text-3xl font-mono relative z-10 opacity-70">
                {currentPosition.lng.toFixed(6)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Battery Mode</p>
                <p className="text-sm font-bold text-zinc-700 font-mono">Optimized (HI-ACC)</p>
             </div>
             <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-1">Status Code</p>
                <p className="text-sm font-bold text-zinc-700 font-mono">OK-Tracking</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

