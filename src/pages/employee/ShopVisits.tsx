import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { Search, MapPin, Store, ChevronRight, Plus, ShoppingBag, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function ShopVisits() {
  const { user } = useAuth();
  const { currentPosition } = useTracking();
  const [shops, setShops] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchShops = async () => {
      const q = query(collection(db, 'shops'), where('status', '==', 'approved'));
      const snap = await getDocs(q);
      setShops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchShops();
  }, []);

  const filteredShops = shops.filter(s => 
    s.shopName.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1, price: 0 }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const submitOrder = async () => {
    if (!currentPosition || !selectedShop) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'orders'), {
        employeeId: user?.uid,
        shopId: selectedShop.id,
        orderTotal: total,
        items,
        geoLat: currentPosition.lat,
        geoLng: currentPosition.lng,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      setIsOrderModalOpen(false);
      setSelectedShop(null);
      setItems([]);
      alert("Order submitted successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

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
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl p-8 max-h-[90vh] overflow-y-auto"
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
                    <p className="text-sm"><strong>Category:</strong> {selectedShop.category}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsOrderModalOpen(true)}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 py-4"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Place New Order
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Order Entry Modal */}
      <AnimatePresence>
        {isOrderModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[60] p-6 overflow-y-auto"
          >
            <div className="max-w-xl mx-auto space-y-8 pb-32">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">New Order</h3>
                <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full text-zinc-400">
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between font-bold text-zinc-500 uppercase tracking-widest text-[10px]">
                  <span>Product</span>
                  <span>Qty & Price</span>
                </div>
                
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 animate-in fade-in slide-in-from-right-2">
                    <input 
                      type="text" 
                      placeholder="Product Name" 
                      className="input-field flex-1"
                      value={item.productName}
                      onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                    />
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      className="input-field w-20"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value))}
                    />
                    <input 
                      type="number" 
                      placeholder="Price" 
                      className="input-field w-24"
                      value={item.price}
                      onChange={(e) => updateItem(idx, 'price', parseFloat(e.target.value))}
                    />
                  </div>
                ))}

                <button 
                  onClick={addItem}
                  className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl flex items-center justify-center gap-2 text-zinc-400 hover:text-accent hover:border-accent transition-all font-bold text-sm"
                >
                  <Plus className="w-5 h-5" />
                  Add Product Line
                </button>
              </div>

              {/* Total Summary */}
              <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-zinc-100 flex items-center justify-between gap-6 shadow-2xl">
                <div>
                   <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Total Amount</p>
                   <p className="text-2xl font-bold text-zinc-900">₹{total.toLocaleString()}</p>
                </div>
                <button 
                  onClick={submitOrder}
                  disabled={isSubmitting || items.length === 0}
                  className="flex-1 btn-primary py-4 text-base font-bold flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Order'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
