import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, doc, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { ShoppingBag, Search, MapPin, Lock, Edit3, X, Check, Plus, ScanLine, RefreshCw, ChevronDown, ChevronUp, Minus, AlertCircle, Navigation, Info, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { cn } from '../../lib/utils';
import { format, isSameDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function EmployeeOrders() {
  const { user } = useAuth();
  const { currentPosition, refreshLocation } = useTracking();
  const [orders, setOrders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [newTotal, setNewTotal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isRefreshingGPS, setIsRefreshingGPS] = useState(false);
  
  // Filtering & Expanding
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Create Order State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [items, setItems] = useState<any[]>([
    { productName: 'Product A', quantity: 1, price: 0 },
    { productName: 'Product B', quantity: 1, price: 0 }
  ]);
  const [modalError, setModalError] = useState<string | null>(null);

  const orderTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const addItem = () => {
    setModalError(null);
    const nextLetter = String.fromCharCode(65 + items.length);
    const defaultName = items.length < 26 ? `Product ${nextLetter}` : 'Product';
    setItems([...items, { productName: defaultName, quantity: 1, price: 0 }]);
  };

  const removeItem = (idx: number) => {
    setModalError(null);
    setItems(items.filter((_, i) => i !== idx));
  };
  
  const updateItem = (idx: number, field: string, val: any) => {
    setModalError(null);
    const next = [...items];
    next[idx] = { ...next[idx], [field]: field === 'productName' ? val : Number(val) };
    setItems(next);
  };

  // Edit Order State
  const [editItems, setEditItems] = useState<any[]>([]);
  const editOrderTotal = editItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const addEditItem = () => {
    const nextLetter = String.fromCharCode(65 + editItems.length);
    const defaultName = editItems.length < 26 ? `Product ${nextLetter}` : 'Product';
    setEditItems([...editItems, { productName: defaultName, quantity: 1, price: 0 }]);
  };

  const removeEditItem = (idx: number) => {
    setEditItems(editItems.filter((_, i) => i !== idx));
  };

  const updateEditItem = (idx: number, field: string, val: any) => {
    const next = [...editItems];
    next[idx] = { ...next[idx], [field]: field === 'productName' ? val : Number(val) };
    setEditItems(next);
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

  const getClosestShop = () => {
    if (!currentPosition || shops.length === 0) return null;
    let closest = null;
    let minDist = Infinity;
    
    shops.forEach(shop => {
      const dist = getDistance(
        currentPosition.lat, 
        currentPosition.lng, 
        shop.latitude, 
        shop.longitude
      );
      if (dist < minDist) {
        minDist = dist;
        closest = { shop, distance: dist };
      }
    });
    return closest;
  };

  const activeShop = getActiveShop();
  const closestShopInfo = getClosestShop();

  const handleRefreshPosition = () => {
    setIsRefreshingGPS(true);
    refreshLocation();
    setTimeout(() => {
      setIsRefreshingGPS(false);
    }, 1200);
  };

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
        const shopSnap = await getDocs(query(
          collection(db, 'shops'), 
          where('employeeId', '==', user.uid)
        ));
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

    if (editItems.some(item => !item.productName.trim() || item.quantity <= 0)) {
      alert("Please ensure product names are entered and quantities are positive.");
      return;
    }
    
    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'orders', editingOrder.id), {
        items: editItems,
        orderTotal: editOrderTotal,
        updatedAt: serverTimestamp()
      });
      
      setOrders(orders.map(o => o.id === editingOrder.id ? { ...o, items: editItems, orderTotal: editOrderTotal } : o));
      setEditingOrder(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${editingOrder.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteOrder = async (orderId: string) => {
    setDeleteError(null);
    setSubmitting(true);
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setOrders(orders.filter(o => o.id !== orderId));
      setPendingDeleteId(null);
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      setDeleteError("Failed to delete order: " + errMsg);
      try {
        handleFirestoreError(error, OperationType.DELETE, `orders/${orderId}`);
      } catch (e) {
        // Suppress additional throw so UI doesn't crash
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShop || !user || !currentPosition) return;
    
    // Check if any fields empty
    if (items.some(item => !item.productName.trim() || item.quantity <= 0)) {
      setModalError("Please select product names and ensure quantity is positive.");
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
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      setOrders([{ id: docRef.id, ...orderData, timestamp: { toDate: () => new Date() } }, ...orders]);
      setIsCreateModalOpen(false);
      setItems([
        { productName: 'Product A', quantity: 1, price: 0 },
        { productName: 'Product B', quantity: 1, price: 0 }
      ]);
      setModalError(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    } finally {
      setSubmitting(false);
    }
  };

  // Live filtering
  const filteredOrders = orders.filter(order => {
    const term = searchQuery.toLowerCase();
    const matchesQuery = !term || 
      order.shopName?.toLowerCase().includes(term) ||
      (order.items && order.items.some((i: any) => i.productName?.toLowerCase().includes(term)));
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-zinc-900">Field Orders</h2>
          <p className="text-sm text-zinc-500">Log customer requests and dispatch orders on the go.</p>
        </div>
        
        {/* Geofencing Controller Bar for Mobile */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          {activeShop ? (
            <div className="flex-1 bg-emerald-50 border border-emerald-100 p-3.5 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                 <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                 <div className="flex flex-col">
                   <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Verified Proximity</span>
                   <span className="text-sm font-bold text-emerald-950">{activeShop.shopName}</span>
                 </div>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition-all shrink-0 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                Place Order
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-zinc-50 border border-zinc-100 p-3.5 rounded-2xl flex flex-col xs:flex-row xs:items-center justify-between gap-3">
               <div className="flex items-center gap-2.5">
                 <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                    <MapPin className="w-5 h-5" />
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Order Dispatch Mode</span>
                   <span className="text-xs font-bold text-zinc-600">
                     {closestShopInfo ? `Nearest: ${closestShopInfo.shop.shopName} (~${Math.round(closestShopInfo.distance)}m)` : "Geofencing Active"}
                   </span>
                 </div>
               </div>
               <button
                 onClick={handleRefreshPosition}
                 disabled={isRefreshingGPS}
                 className="self-start xs:self-auto text-xs font-bold text-zinc-700 bg-white border border-zinc-200 px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-sm active:bg-zinc-50 hover:bg-zinc-50 transition-all shrink-0"
               >
                 <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-400", isRefreshingGPS && "animate-spin text-accent")} />
                 {isRefreshingGPS ? "Pinpointing..." : "Refresh GPS"}
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Search and Filters for Mobile Tapping */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by shop or product name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm shadow-sm transition-all text-zinc-900"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Dropdown Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full appearance-none bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-900 shadow-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all pr-10"
            style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2352525b\' stroke-width=\'2.5\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\' /%3E%3C/svg%3E")', 
              backgroundPosition: 'right 1rem center', 
              backgroundRepeat: 'no-repeat', 
              backgroundSize: '1.25rem' 
            }}
          >
            <option value="all">Show All Orders</option>
            <option value="pending">Pending Orders</option>
            <option value="approved">Approved Orders</option>
            <option value="rejected">Rejected Orders</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-zinc-100 shadow-sm">
            <div className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-zinc-500 text-xs font-semibold tracking-tight">Syncing territory files...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-zinc-100 shadow-sm">
            <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-6 h-6 text-zinc-300" />
            </div>
            <p className="font-bold text-zinc-900 text-sm">No Matching Orders</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              {searchQuery || statusFilter !== 'all' 
                ? "Adjustment your filter variables or search terms above." 
                : "Move closer to your registered clients to open order logs."}
            </p>
          </div>
        ) : (
          /* Mobile Card-Based Grid List Over Rigid Table */
          <div className="grid grid-cols-1 gap-3.5">
            {filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const dateObj = order.timestamp?.toDate ? order.timestamp.toDate() : new Date(order.timestamp || Date.now());
              const formattedDate = format(dateObj, 'MMM d, h:mm a');
              const isEditable = activeShop && activeShop.id === order.shopId && order.status === 'pending';

              return (
                <div 
                  key={order.id}
                  className={cn(
                    "bg-white border rounded-3xl p-4 transition-all shadow-sm flex flex-col gap-3",
                    isExpanded ? "border-zinc-300 ring-2 ring-zinc-100" : "border-zinc-100 hover:border-zinc-200"
                  )}
                >
                  {/* Card Header Summary */}
                  <div 
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="flex items-start justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                          order.status === 'approved' || order.status === 'confirmed' ? "text-emerald-700 bg-emerald-50" : 
                          order.status === 'pending' ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"
                        )}>
                          {order.status}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-semibold">{formattedDate}</span>
                      </div>
                      <h4 className="font-bold text-zinc-900 text-sm truncate">{order.shopName || "Registered Client"}</h4>
                      
                      <p className="text-[11px] text-zinc-500 font-medium">
                        {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'} registered • <span className="text-zinc-400">Tap to details</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <p className="font-black text-sm text-zinc-900">₹{order.orderTotal?.toLocaleString() || '0'}</p>
                      <div className="p-1.5 rounded-full bg-zinc-50 text-zinc-400 group-hover:text-zinc-600">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details View with Accordion Line Items */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden border-t border-zinc-100 pt-3.5 mt-1 space-y-3"
                      >
                        <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Order Details</h5>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {order.items && order.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-xs">
                              <div className="min-w-0 pr-2">
                                <p className="font-bold text-zinc-800 truncate">{item.productName}</p>
                                <p className="text-[10px] text-zinc-500 font-medium">Qty: {item.quantity} × ₹{item.price}</p>
                              </div>
                              <p className="font-bold text-zinc-900 shrink-0">₹{(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>

                          <div className="flex flex-col gap-2 w-full">
                            {deleteError && pendingDeleteId === order.id && (
                              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-[11px] font-bold text-rose-600">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>{deleteError}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-between w-full">
                              <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
                                <ScanLine className="w-3 h-3 text-emerald-500" /> GPS Tagged Entry
                              </span>

                              <div className="flex items-center gap-2">
                                {order.status === 'pending' && (
                                  pendingDeleteId === order.id ? (
                                    <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                                      <span className="text-[10px] font-black text-rose-600 mr-1 uppercase tracking-wider">Are you sure?</span>
                                      <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteOrder(order.id);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-all active:scale-95 disabled:opacity-50 font-sans"
                                      >
                                        Yes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPendingDeleteId(null);
                                          setDeleteError(null);
                                        }}
                                        className="text-[10px] font-black uppercase tracking-wider py-1.5 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 transition-all active:scale-95 border border-zinc-200 font-sans"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={submitting}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeleteId(order.id);
                                        setDeleteError(null);
                                      }}
                                      className="text-xs font-bold py-2 px-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 font-sans"
                                      title="Delete pending order"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete
                                    </button>
                                  )
                                )}
                                <button
                              disabled={!isEditable}
                              onClick={() => {
                                setEditingOrder(order);
                                setEditItems(order.items?.map((item: any) => ({ ...item })) || [
                                  { productName: 'Product A', quantity: 1, price: 0 },
                                  { productName: 'Product B', quantity: 1, price: 0 }
                                ]);
                              }}
                              className={cn(
                                "text-xs font-bold py-2 px-3.5 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95",
                                isEditable
                                  ? "bg-zinc-900 border-zinc-900 text-white shadow-md hover:bg-zinc-800"
                                  : "bg-zinc-50 border-zinc-200 text-zinc-400 cursor-not-allowed"
                              )}
                              title={isEditable ? "Modify Order Value" : "Visit shop and verify status is pending to edit"}
                            >
                              {isEditable ? (
                                <>
                                  <Edit3 className="w-3.5 h-3.5" />
                                  Edit Items
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3.5 h-3.5" />
                                  Locked
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Geofencing Disclaimer bottom note */}
      {!activeShop && closestShopInfo && (
        <div className="p-4 bg-zinc-900 text-white rounded-[24px] flex items-start gap-3.5">
           <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
             <MapPin className="w-4 h-4 text-accent animate-pulse" />
           </div>
           <div>
             <h4 className="font-bold text-xs text-white">Geofencing Active</h4>
             <p className="text-[10px] text-zinc-400 leading-relaxed mt-0.5">
               New order submission and logs require verification of your device location within 50m of your mapped shop. Visit the registered shop site to unlock the active orders catalog.
             </p>
           </div>
        </div>
      )}

      {/* NEW ORDER SUBMISSION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-[130] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom pb-4 sm:pb-0">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-0.5">Live Dispatch</span>
                <h3 className="font-black text-lg text-zinc-900 truncate max-w-[260px]">{activeShop?.shopName}</h3>
              </div>
              <button 
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setModalError(null);
                }}
                className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400 hover:text-zinc-600 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Form Scrollable */}
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Error Box */}
              {modalError && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in shake duration-300">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Step Directions */}
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-600">
                <span className="flex items-center gap-1.5"><ScanLine className="w-4 h-4 text-emerald-500" /> GPS Lock Connected</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase">Active</span>
              </div>

              {/* Item inputs list */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Line items list</label>
                
                <div className="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1 scrollbar-thin">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-4 bg-zinc-50 border border-zinc-100 rounded-[24px] space-y-3 relative">
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="absolute right-3.5 top-3.5 p-1 text-zinc-400 hover:text-rose-500 active:scale-90 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Product Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Product Input</label>
                        <input 
                          type="text"
                          required
                          value={item.productName}
                          onChange={(e) => updateItem(idx, 'productName', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-accent/15 focus:border-accent outline-none"
                          placeholder="Type product name..."
                        />
                      </div>

                      {/* Quantity Stepper and Price */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Quantity</label>
                          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl px-1 py-0.5">
                            <button 
                              type="button" 
                              onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))}
                              className="w-7 h-7 rounded-lg bg-zinc-50 hover:bg-zinc-100 active:scale-90 text-zinc-800 font-bold flex items-center justify-center transition-all"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input 
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                              className="flex-1 w-full text-center bg-transparent focus:outline-none font-black text-xs text-zinc-900 py-1"
                            />
                            <button 
                              type="button" 
                              onClick={() => updateItem(idx, 'quantity', item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-zinc-50 hover:bg-zinc-100 active:scale-90 text-zinc-800 font-bold flex items-center justify-center transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Price (₹)</label>
                          <input 
                            type="number"
                            required
                            min="0"
                            placeholder="Price"
                            value={item.price || ''}
                            onChange={(e) => updateItem(idx, 'price', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-accent/15 focus:border-accent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Row Button */}
              <button 
                type="button"
                onClick={addItem}
                className="w-full py-2.5 border-2 border-dashed border-zinc-200 rounded-2xl text-[10px] font-black uppercase text-zinc-400 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Segment Row
              </button>
              
              {/* Grand Total Indicator */}
              <div className="p-4 bg-zinc-900 rounded-2xl flex items-center justify-between text-white">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Calculated Value</p>
                  <p className="text-lg font-black text-white">₹{orderTotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Lines</p>
                   <p className="text-sm font-bold text-accent">{items.length}</p>
                </div>
              </div>

              {/* Submission Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setModalError(null);
                  }}
                  className="flex-1 py-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50 rounded-xl border border-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-accent text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-accent/90 focus:ring-4 focus:ring-accent/20 transition-all shadow-lg shadow-accent/10 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Place Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT/MODIFY ORDER MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-[130] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom pb-4 sm:pb-0">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest block mb-0.5">Edit Live Order</span>
                <h3 className="font-black text-lg text-zinc-900 truncate max-w-[260px]">{editingOrder.shopName}</h3>
              </div>
              <button 
                onClick={() => setEditingOrder(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400 hover:text-zinc-600 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Form Scrollable */}
            <form onSubmit={handleUpdateOrder} className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Step Directions */}
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between text-xs font-semibold text-zinc-600">
                <span className="flex items-center gap-1.5"><ScanLine className="w-4 h-4 text-amber-500" /> GPS Tagged Verification</span>
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[10px] uppercase">Unlocked</span>
              </div>

              {/* Item inputs list */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Line items list</label>
                
                <div className="space-y-3.5 max-h-[35vh] overflow-y-auto pr-1 scrollbar-thin">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="p-4 bg-zinc-50 border border-zinc-100 rounded-[24px] space-y-3 relative">
                      {editItems.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeEditItem(idx)}
                          className="absolute right-3.5 top-3.5 p-1 text-zinc-400 hover:text-rose-500 active:scale-90 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      
                      {/* Product Selector */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Product Input</label>
                        <input 
                          type="text"
                          required
                          value={item.productName}
                          onChange={(e) => updateEditItem(idx, 'productName', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-accent/15 focus:border-accent outline-none"
                          placeholder="Type product name..."
                        />
                      </div>

                      {/* Quantity Stepper and Price */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Quantity</label>
                          <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-xl px-1 py-0.5">
                            <button 
                              type="button" 
                              onClick={() => updateEditItem(idx, 'quantity', Math.max(1, item.quantity - 1))}
                              className="w-7 h-7 rounded-lg bg-zinc-50 hover:bg-zinc-100 active:scale-90 text-zinc-800 font-bold flex items-center justify-center transition-all"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input 
                              type="number"
                              required
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateEditItem(idx, 'quantity', e.target.value)}
                              className="flex-1 w-full text-center bg-transparent focus:outline-none font-black text-xs text-zinc-900 py-1"
                            />
                            <button 
                              type="button" 
                              onClick={() => updateEditItem(idx, 'quantity', item.quantity + 1)}
                              className="w-7 h-7 rounded-lg bg-zinc-50 hover:bg-zinc-100 active:scale-90 text-zinc-800 font-bold flex items-center justify-center transition-all"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Price (₹)</label>
                          <input 
                            type="number"
                            required
                            min="0"
                            placeholder="Price"
                            value={item.price || ''}
                            onChange={(e) => updateEditItem(idx, 'price', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-900 focus:ring-2 focus:ring-accent/15 focus:border-accent outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Row Button */}
              <button 
                type="button"
                onClick={addEditItem}
                className="w-full py-2.5 border-2 border-dashed border-zinc-200 rounded-2xl text-[10px] font-black uppercase text-zinc-400 hover:border-accent hover:text-accent transition-all flex items-center justify-center gap-1.5 active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Segment Row
              </button>
              
              {/* Grand Total Indicator */}
              <div className="p-4 bg-zinc-900 rounded-2xl flex items-center justify-between text-white">
                <div>
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Calculated Value</p>
                  <p className="text-lg font-black text-white">₹{editOrderTotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Active Lines</p>
                   <p className="text-sm font-bold text-accent">{editItems.length}</p>
                </div>
              </div>

              {/* Submission Buttons */}
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="flex-1 py-3 text-xs font-bold text-zinc-600 hover:bg-zinc-50 rounded-xl border border-zinc-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-accent text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 hover:bg-accent/90 focus:ring-4 focus:ring-accent/20 transition-all shadow-lg shadow-accent/10 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

