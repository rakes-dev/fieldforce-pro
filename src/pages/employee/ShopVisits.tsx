import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { Search, MapPin, Store, ChevronRight, X, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function ShopVisits() {
  const { user } = useAuth();
  const { currentPosition } = useTracking();
  const [shops, setShops] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<any>(null);

  useEffect(() => {
    const fetchShops = async () => {
      if (!user) return;
      const q = query(
        collection(db, 'shops'), 
        where('employeeId', '==', user.uid)
      );
      const snap = await getDocs(q);
      setShops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchShops();
  }, [user]);

  const filteredShops = shops.filter(s => 
    s.shopName.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Shop Visits</h2>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Search by name or city..." 
          className="input-field pl-12 py-4"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filteredShops.map((shop) => (
          <div 
            key={shop.id}
            onClick={() => setSelectedShop(shop)}
            className="card p-4 flex items-center justify-between cursor-pointer hover:border-accent transition-all animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-500">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900">{shop.shopName}</h4>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{shop.address}, {shop.city}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-300" />
          </div>
        ))}
      </div>

      {/* Shop Detail Drawer/Modal */}
      <AnimatePresence>
        {selectedShop && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedShop(null)}
              className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-white z-[105] rounded-t-3xl p-8 pb-32 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold">{selectedShop.shopName}</h3>
                <button onClick={() => setSelectedShop(null)} className="p-2 hover:bg-zinc-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="max-w-md mx-auto w-full">
                  <div className="aspect-video bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-100 shadow-sm">
                    <img src={selectedShop.selfieWithShopImage} className="w-full h-full object-cover" alt="Verification" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Details</p>
                  <div className="bg-zinc-50 p-4 rounded-2xl space-y-2">
                    <p className="text-sm"><strong>Owner:</strong> {selectedShop.ownerName}</p>
                    <p className="text-sm"><strong>Phone:</strong> {selectedShop.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedShop.latitude},${selectedShop.longitude}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="py-3.5 bg-zinc-900 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-zinc-800 transition-all active:scale-98 shadow-md shadow-zinc-900/10 text-center"
                  >
                    <MapPin className="w-4 h-4 shrink-0" />
                    Navigate
                  </a>
                  <a 
                    href={`tel:${selectedShop.phone}`}
                    className="py-3.5 bg-emerald-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-all active:scale-98 shadow-md shadow-emerald-500/10 text-center"
                  >
                    <Phone className="w-4 h-4 shrink-0" />
                    Call
                  </a>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
