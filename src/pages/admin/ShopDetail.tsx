import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Store, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  ArrowLeft, 
  ShoppingBag,
  TrendingUp,
  Package,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';

export default function ShopDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchShopAndOrders = async () => {
      try {
        // Fetch Shop Details
        const shopDoc = await getDoc(doc(db, 'shops', id));
        if (shopDoc.exists()) {
          setShop({ id: shopDoc.id, ...shopDoc.data() });
        }

        // Fetch Shop Orders
        const ordersQ = query(
          collection(db, 'orders'),
          where('shopId', '==', id),
          orderBy('timestamp', 'desc')
        );
        const ordersSnap = await getDocs(ordersQ);
        setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `shops/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchShopAndOrders();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="text-center py-12">
        <Store className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold">Shop not found</h3>
        <button 
          onClick={() => navigate('/admin/shops')}
          className="text-accent font-bold mt-2 hover:underline"
        >
          Back to Registry
        </button>
      </div>
    );
  }

  const totalSales = orders.reduce((acc, order) => acc + (order.orderTotal || 0), 0);

  return (
    <div className="space-y-8 pb-12">
      <button 
        onClick={() => navigate('/admin/shops')}
        className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors uppercase tracking-widest text-[10px]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Registry
      </button>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Shop Info Card */}
        <div className="flex-1 space-y-6">
          <div className="card p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Store className="w-32 h-32" />
            </div>
            
            <div className="flex items-start gap-6 relative z-10">
              <div className="w-20 h-20 bg-zinc-100 rounded-3xl flex items-center justify-center text-zinc-400 shrink-0 border border-zinc-200">
                <Store className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-zinc-900">{shop.shopName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                    shop.status === 'approved' ? "bg-emerald-50 text-emerald-600" : 
                    shop.status === 'pending' ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                  )}>
                    {shop.status}
                  </div>
                  <span className="text-zinc-400 text-xs font-medium">Business Account</span>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-10 relative z-10">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-500">Owner:</span>
                  <span className="font-bold text-zinc-900">{shop.ownerName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-500">Contact:</span>
                  <span className="font-bold text-zinc-900">{shop.ownerContact}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                   <Calendar className="w-4 h-4 text-zinc-400" />
                   <span className="text-zinc-500">Registered:</span>
                   <span className="font-bold text-zinc-900">
                     {shop.createdAt ? format(shop.createdAt.toDate ? shop.createdAt.toDate() : new Date(shop.createdAt), 'PPP') : 'N/A'}
                   </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-500">Location:</span>
                  <span className="font-bold text-zinc-900 truncate">{shop.ownerAddress}, {shop.city}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span className="text-zinc-500">Working Hours:</span>
                  <span className="font-bold text-zinc-900">09:00 AM - 08:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="card p-6 border-l-4 border-accent">
               <div className="flex items-center gap-3 text-zinc-400 mb-2">
                 <ShoppingBag className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-widest">Total Orders</span>
               </div>
               <p className="text-3xl font-black text-zinc-900">{orders.length}</p>
            </div>
            <div className="card p-6 border-l-4 border-emerald-500">
               <div className="flex items-center gap-3 text-zinc-400 mb-2">
                 <TrendingUp className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-widest">Revenue</span>
               </div>
               <p className="text-3xl font-black text-zinc-900">₹{totalSales.toLocaleString()}</p>
            </div>
            <div className="card p-6 border-l-4 border-zinc-200">
               <div className="flex items-center gap-3 text-zinc-400 mb-2">
                 <Package className="w-4 h-4" />
                 <span className="text-xs font-bold uppercase tracking-widest">Active Status</span>
               </div>
               <p className="text-3xl font-black text-emerald-600">Active</p>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
               <h3 className="font-bold text-zinc-900 flex items-center gap-2">
                 <ShoppingBag className="w-4 h-4 text-accent" />
                 Order History
               </h3>
               <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{orders.length} Records found</span>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-100 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Amount</th>
                    <th className="px-6 py-4">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">No orders yet for this shop.</td>
                    </tr>
                  ) : orders.map(order => (
                    <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          order.status === 'approved' ? "text-emerald-700 bg-emerald-50" : 
                          order.status === 'pending' ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
                        )}>
                          {order.status}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-900">₹{order.orderTotal?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs text-zinc-500">
                        {order.timestamp ? format(order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp), 'MMM d, yyyy') : 'Recently'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Sidebar Assets */}
        <div className="w-full md:w-80 space-y-6">
          <div className="card overflow-hidden">
             <div className="p-4 bg-zinc-50 border-b border-zinc-100 font-bold text-xs uppercase tracking-widest text-zinc-500">
               Shop Verification
             </div>
             <div className="aspect-[4/5] overflow-hidden">
               <img 
                 src={shop.selfieWithShopImage} 
                 className="w-full h-full object-cover" 
                 alt="Verification" 
               />
             </div>
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-zinc-100 font-bold text-xs uppercase tracking-widest text-zinc-500">
               Geographic Location
             </div>
             <div className="h-64">
               <MapView 
                 center={{ lat: shop.latitude, lng: shop.longitude }}
                 markerPosition={{ lat: shop.latitude, lng: shop.longitude }}
                 markerLabel={shop.shopName}
                 zoom={16}
               />
             </div>
             <div className="p-4">
                <p className="text-[10px] text-zinc-400 font-bold uppercase mb-1">Coordinates</p>
                <p className="text-xs font-mono text-zinc-600">{shop.latitude.toFixed(6)}, {shop.longitude.toFixed(6)}</p>
                <a 
                  href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-3 block text-center py-2 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors"
                >
                  Open in Google Maps
                </a>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
