import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, doc, updateDoc, orderBy, where, onSnapshot } from 'firebase/firestore';
import { ShoppingBag, Check, X, Filter, Search, Download, Calendar, User, Store, Package, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, any>>({});
  const [shops, setShops] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        // Fetch Employees
        const userSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
        const empMap: Record<string, any> = {};
        userSnap.forEach(d => {
          empMap[d.id] = d.data();
        });
        setEmployees(empMap);

        // Fetch Shops
        const shopSnap = await getDocs(collection(db, 'shops'));
        const shopMap: Record<string, any> = {};
        shopSnap.forEach(d => {
          shopMap[d.id] = d.data();
        });
        setShops(shopMap);

        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'orders_base');
        setLoading(false);
      }
    };

    fetchBaseData();

    // Real-time listener for orders
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsubscribe();
  }, []);

  const handleStatus = async (e: React.MouseEvent, id: string, status: string) => {
    e.stopPropagation(); // Prevent modal from opening
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      setOrders(orders.map(o => o.id === id ? { ...o, status } : o));
      if (selectedOrder?.id === id) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const filteredOrders = orders.filter(order => {
    const shopName = shops[order.shopId]?.shopName?.toLowerCase() || '';
    const empName = employees[order.employeeId]?.name?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return shopName.includes(search) || empName.includes(search) || order.id.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sales Orders</h2>
          <p className="text-zinc-500">Track and manage field sales orders.</p>
        </div>
        <button className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-zinc-50 transition-all">
          <Download className="w-4 h-4" />
          Export All
        </button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex bg-zinc-100 p-1 rounded-lg">
             {['All', 'Pending', 'Approved'].map(tab => (
               <button key={tab} className={cn(
                 "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
                 tab === 'All' ? "bg-white shadow-sm text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
               )}>
                 {tab}
               </button>
             ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-100 rounded-lg">
            <Search className="w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search Shop or Employee..." 
              className="text-sm bg-transparent border-none outline-none w-48 sm:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50/50 text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4">Shop</th>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-sm italic">
                    Loading telemetry data...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-400 text-sm">
                    No matching orders found.
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr 
                  key={order.id} 
                  onClick={() => setSelectedOrder(order)}
                  className="hover:bg-zinc-50/50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-zinc-900 text-sm">{shops[order.shopId]?.shopName || 'Unknown Shop'}</span>
                      <span className="text-[10px] text-zinc-400 font-mono uppercase truncate w-24">{order.id.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-600">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-500">
                         {employees[order.employeeId]?.name?.charAt(0) || '?'}
                       </div>
                       {employees[order.employeeId]?.name || 'Unknown'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-emerald-600">₹{order.orderTotal?.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      order.status === 'approved' ? "text-emerald-600 bg-emerald-50" : 
                      order.status === 'pending' ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50"
                    )}>
                      {order.status}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {order.status === 'pending' ? (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={(e) => handleStatus(e, order.id, 'rejected')}
                          className="p-1.5 hover:bg-red-50 text-red-400 rounded-md transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleStatus(e, order.id, 'approved')}
                          className="p-1.5 hover:bg-emerald-50 text-emerald-400 rounded-md transition-all"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-bold uppercase">Processed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-zinc-900 capitalize">Order Details</h3>
                  <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-tighter">Reference: {selectedOrder.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-40">
              <div className="p-8">
                {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                    <Store className="w-3 h-3 text-accent" />
                    Customer / Shop
                  </div>
                  <p className="font-bold text-zinc-900">{shops[selectedOrder.shopId]?.shopName || 'Unknown Shop'}</p>
                  <p className="text-xs text-zinc-500 mt-1">{shops[selectedOrder.shopId]?.address || 'No address provided'}</p>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">
                    <User className="w-3 h-3 text-accent" />
                    Captured By
                  </div>
                  <p className="font-bold text-zinc-900">{employees[selectedOrder.employeeId]?.name || 'Unknown Employee'}</p>
                  <p className="text-xs text-zinc-500 mt-1">{employees[selectedOrder.employeeId]?.territory || 'Field Sales'}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" />
                  Line Items
                </h4>
                <div className="border border-zinc-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 text-[10px] text-zinc-400 font-bold uppercase tracking-widest border-b border-zinc-100">
                      <tr>
                        <th className="px-4 py-3">Product Name</th>
                        <th className="px-4 py-3 text-center">Qty</th>
                        <th className="px-4 py-3 text-right">Price</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {selectedOrder.items && selectedOrder.items.length > 0 ? (
                        selectedOrder.items.map((item: any, idx: number) => (
                          <tr key={idx} className="text-sm">
                            <td className="px-4 py-3 font-medium text-zinc-900">{item.productName}</td>
                            <td className="px-4 py-3 text-center text-zinc-600">{item.quantity}</td>
                            <td className="px-4 py-3 text-right text-zinc-600">₹{item.price?.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right font-bold text-zinc-900">₹{(item.price * item.quantity).toLocaleString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-zinc-500 italic">
                             Legacy order structure: No itemized breakout available.
                          </td>
                          <td className="px-4 py-8 text-right font-bold text-zinc-900">₹{selectedOrder.orderTotal?.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-zinc-50/50">
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-sm font-bold text-zinc-900">Grand Total</td>
                        <td className="px-4 py-4 text-right text-lg font-black text-emerald-600">₹{selectedOrder.orderTotal?.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Auxiliary Data */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-100">
                <div className="space-y-4">
                  <div>
                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Session Data</h5>
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {selectedOrder.timestamp ? format(selectedOrder.timestamp.toDate ? selectedOrder.timestamp.toDate() : new Date(selectedOrder.timestamp), 'MMMM do, yyyy h:mm a') : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Approval Log</h5>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      selectedOrder.status === 'approved' ? "text-emerald-700 bg-emerald-50" : 
                      selectedOrder.status === 'pending' ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50"
                    )}>
                      {selectedOrder.status}
                    </div>
                  </div>
                </div>
                
                {selectedOrder.visitSelfieUrl && (
                  <div className="text-right">
                    <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Visit Authentication</h5>
                    <div className="inline-block rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
                      <img 
                        src={selectedOrder.visitSelfieUrl} 
                        alt="Visit Verification" 
                        className="w-32 h-32 object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase">
                <Info className="w-3.5 h-3.5" />
                Actions are immutable after processing
              </div>
              {selectedOrder.status === 'pending' && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={(e) => handleStatus(e, selectedOrder.id, 'rejected')}
                    className="px-6 py-2 bg-white border border-zinc-200 text-red-500 font-bold rounded-xl text-sm hover:bg-red-50 transition-all"
                  >
                    Reject Order
                  </button>
                  <button 
                    onClick={(e) => handleStatus(e, selectedOrder.id, 'approved')}
                    className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
                  >
                    Approve Order
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
