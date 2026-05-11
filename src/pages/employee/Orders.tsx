import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, doc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { ShoppingBag, Filter, Search, Calendar, MapPin, Lock, Edit3, X, Check, Plus, Camera, ScanLine } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { cn } from '../../lib/utils';
import { format, isSameDay } from 'date-fns';

export default function EmployeeOrders() {
  const { user } = useAuth();
  const { currentPosition } = useTracking();
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [newTotal, setNewTotal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Create Order State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([{ productName: '', quantity: 1, price: 0 }]);
  const [selfie, setSelfie] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const orderTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const addItem = () => setItems([...items, { productName: '', quantity: 1, price: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: field === 'productName' ? val : Number(val) };
    setItems(next);
  };

  // Proximity math
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getActiveShop = () => {
    if (!currentPosition) return null;
    return shops.find(shop => {
      const dist = getDistance(
        currentPosition.lat, 
        currentPosition.lng, 
        shop.latitude, 
        shop.longitude
      );
      return dist <= 50; // 50 meters
    });
  };

  const activeShop = getActiveShop();
  
  // Check if first visit of the day for current active shop
  const isFirstVisitOfDay = activeShop && !orders.find(o => {
    if (!o.timestamp || o.shopId !== activeShop.id) return false;
    const date = o.timestamp.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
    return isSameDay(date, new Date());
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        // Fetch Orders
        const q = query(
          collection(db, 'orders'), 
          where('employeeId', '==', user.uid),
          orderBy('timestamp', 'desc')
        );
        const orderSnap = await getDocs(q);
        setOrders(orderSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Approved Shops
        const shopSnap = await getDocs(query(collection(db, 'shops'), where('status', '==', 'approved')));
        setShops(shopSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleUpdateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShop || !editingOrder) return;
    
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), {
        orderTotal: Number(newTotal),
        updatedAt: serverTimestamp()
      });
      
      setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, orderTotal: Number(newTotal) } : o));
      setEditingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${editingOrder.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShop || !user || !currentPosition) return;
    if (isFirstVisitOfDay && !selfie) {
      alert("Selfie with shop is required for the first visit of the day.");
      return;
    }
    if (items.some(item => !item.productName || item.quantity <= 0)) {
      alert("Please ensure all items have names and valid quantities.");
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        employeeId: user.uid,
        shopId: activeShop.id,
        shopName: activeShop.shopName,
        orderTotal: orderTotal,
        items: items,
        geoLat: currentPosition.lat,
        geoLng: currentPosition.lng,
        status: 'pending',
        timestamp: serverTimestamp(),
        visitSelfieUrl: selfie || null
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Update local state (optimistic or just refresh)
      setOrders([{ id: docRef.id, ...orderData, timestamp: { toDate: () => new Date() } }, ...orders]);
      
      setIsCreateModalOpen(false);
      setItems([{ productName: '', quantity: 1, price: 0 }]);
      setSelfie(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelfie(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Field Orders</h2>
          <p className="text-zinc-500">Manage shop orders while in territory.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {activeShop ? (
            <>
              <div className="px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Geofence Active</span>
                   <span className="text-xs font-bold text-emerald-900">{activeShop.shopName}</span>
                 </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary flex items-center gap-2 shadow-lg shadow-accent/25"
              >
                <Plus className="w-4 h-4" />
                Place Order
              </button>
            </>
          ) : (
            <div className="px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center gap-3">
               <MapPin className="w-4 h-4 text-zinc-400" />
               <div className="flex flex-col">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</span>
                 <span className="text-xs font-bold text-zinc-600">Outside Shop Range</span>
               </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
             <button className="px-4 py-1.5 text-xs font-bold rounded-md bg-white shadow-sm text-zinc-900">
               All Records
             </button>
          </div>
          {!activeShop && (
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
              <Lock className="w-3 h-3" />
              Locked
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 font-medium tracking-tight">Syncing encrypted data...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-6 h-6 text-zinc-300" />
            </div>
            <p className="font-bold text-zinc-900">No telemetry found</p>
            <p className="text-sm text-zinc-500 mt-1">Visit a shop to log records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Shop</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr key={order.id} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        order.status === 'approved' || order.status === 'confirmed' ? "text-emerald-700 bg-emerald-50" : 
                        order.status === 'pending' ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
                      )}>
                        {order.status}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <p className="font-bold text-zinc-900 text-sm truncate max-w-[150px]">{order.shopName || 'Unknown Shop'}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-zinc-900">₹{order.orderTotal?.toLocaleString() || '0'}</td>
                    <td className="px-6 py-4 text-xs text-zinc-500">
                      {order.timestamp ? format(order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp), 'MMM d, h:mm a') : 'Recent'}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                        disabled={!activeShop || activeShop.id !== order.shopId}
                        onClick={() => {
                          setEditingOrder(order);
                          setNewTotal(order.orderTotal?.toString() || '');
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-all",
                          (activeShop && activeShop.id === order.shopId)
                            ? "hover:bg-accent/10 text-zinc-400 hover:text-accent" 
                            : "text-zinc-200 cursor-not-allowed"
                        )}
                        title={activeShop ? (activeShop.id === order.shopId ? "Edit Order" : "Visit this shop to edit") : "Visit shop to unlock editing"}
                       >
                         {(activeShop && activeShop.id === order.shopId) ? <Edit3 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!activeShop && (
        <div className="p-4 bg-zinc-900 text-white rounded-2xl flex items-start gap-4">
           <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
             <MapPin className="w-5 h-5 text-accent" />
           </div>
           <div>
             <h4 className="font-bold text-sm">Location Lock Enabled</h4>
             <p className="text-[10px] text-zinc-400 leading-relaxed mt-1">
               Order editing is mathematically restricted by satellite geofencing. You must be physically present within 50 meters of an approved shop location to modify field records.
             </p>
           </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-zinc-900">New Order</h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="p-6 space-y-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                 <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Target Shop</p>
                 <p className="font-bold text-zinc-900">{activeShop?.shopName}</p>
                 <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold uppercase mt-1">
                   <ScanLine className="w-3 h-3" />
                   Verified Registry Location
                 </div>
              </div>

              {isFirstVisitOfDay && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selfie with Shop (Daily First Visit)</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden",
                      selfie ? "border-emerald-500 bg-emerald-50" : "border-zinc-200 hover:border-accent hover:bg-zinc-50"
                    )}
                  >
                    {selfie ? (
                      <img src={selfie} alt="Selfie" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-zinc-300 mb-2" />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tap to capture</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="user" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </div>
              )}
              
              <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-2 scrollbar-thin">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-3 relative group">
                    {items.length > 1 && (
                      <button 
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="absolute right-2 top-2 p-1 text-zinc-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Product Name</label>
                      <input 
                        type="text"
                        required
                        value={item.productName}
                        onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-zinc-100 rounded-lg text-sm font-bold"
                        placeholder="e.g. Widget A"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Qty</label>
                        <input 
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-zinc-100 rounded-lg text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Price (₹)</label>
                        <input 
                          type="number"
                          required
                          min="0"
                          value={item.price}
                          onChange={(e) => updateItem(idx, 'price', e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-zinc-100 rounded-lg text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                type="button"
                onClick={addItem}
                className="w-full py-2 border-2 border-dashed border-zinc-200 rounded-xl text-[10px] font-black uppercase text-zinc-400 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-3 h-3" />
                Add Item
              </button>
              
              <div className="p-4 bg-zinc-900 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Value</p>
                  <p className="text-xl font-black text-white">₹{orderTotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Line Items</p>
                   <p className="text-sm font-bold text-accent">{items.length}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 rounded-2xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting || (isFirstVisitOfDay && !selfie)}
                  className="flex-1 py-3 bg-accent text-white font-bold rounded-2xl shadow-xl shadow-accent/25 hover:bg-accent/90 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Check className="w-4 h-4" />}
                  Place Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-black text-xl text-zinc-900">Modify Order</h3>
              <button 
                onClick={() => setEditingOrder(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateOrder} className="p-6 space-y-4">
              <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                 <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Target Shop</p>
                 <p className="font-bold text-zinc-900">{activeShop?.shopName}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">New Order Total (₹)</label>
                <input 
                  type="number"
                  required
                  value={newTotal}
                  onChange={(e) => setNewTotal(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold text-lg transition-all"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-50 rounded-2xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-zinc-900 text-white font-bold rounded-2xl shadow-xl hover:bg-zinc-800 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Check className="w-4 h-4" />}
                  Confirm Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
