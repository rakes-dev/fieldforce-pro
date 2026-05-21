import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { Store, Check, X, ExternalLink, MapPin, Search, Filter, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function AdminShops() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener for shops
    const q = query(collection(db, 'shops'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setShops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shops');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleApproval = async (id: string, approve: boolean) => {
    const status = approve ? 'approved' : 'rejected';
    try {
      await updateDoc(doc(db, 'shops', id), { status });
      setShops(shops.map(s => s.id === id ? { ...s, status } : s));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shops/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Shop Registry</h2>
          <p className="text-zinc-500">Directory of registered client shops.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {shops.map((shop) => (
          <div key={shop.id} className="card p-6 flex flex-col gap-6 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 shrink-0">
                  <Store className="w-8 h-8" />
                </div>
                <div>
                  <Link to={`/admin/shops/${shop.id}`} className="font-bold text-lg hover:text-accent transition-colors block">
                    {shop.shopName}
                  </Link>
                  <p className="text-sm text-zinc-500">{shop.ownerName} • {shop.city}</p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600">
                Active
              </div>
            </div>

            <div className="max-w-md mx-auto w-full">
               <p className="text-[10px] text-zinc-400 font-bold uppercase mb-2">Selfie with Shop (Verification)</p>
               <div className="aspect-video bg-zinc-100 rounded-xl overflow-hidden shadow-inner border border-zinc-200">
                 <img src={shop.selfieWithShopImage} className="w-full h-full object-cover" alt="Shop Verification" />
               </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
               <div className="flex items-center gap-4">
                  <a 
                    href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-blue-600 font-bold hover:underline"
                  >
                    <MapPin className="w-3 h-3" />
                    Google Maps
                  </a>
                  <Link 
                    to={`/admin/shops/${shop.id}`}
                    className="flex items-center gap-1.5 text-xs text-zinc-900 font-bold hover:text-accent transition-colors"
                  >
                    View Details
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
