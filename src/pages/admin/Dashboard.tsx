import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
  Users, 
  ShoppingBag, 
  MapPin, 
  Activity,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Navigation
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';

const data = [
  { name: 'Mon', sales: 4000, visits: 24 },
  { name: 'Tue', sales: 3000, visits: 18 },
  { name: 'Wed', sales: 5000, visits: 32 },
  { name: 'Thu', sales: 2780, visits: 21 },
  { name: 'Fri', sales: 1890, visits: 15 },
  { name: 'Sat', sales: 2390, visits: 20 },
  { name: 'Sun', sales: 3490, visits: 28 },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeToday: 0,
    pendingShops: 0,
    todayOrders: 0,
    totalSales: 0
  });
  const [activeLocations, setActiveLocations] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
        const empMap: Record<string, any> = {};
        usersSnap.forEach(d => {
          empMap[d.id] = d.data();
        });
        setEmployees(empMap);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch active attendance sessions for today
        const activeAttSnap = await getDocs(query(
          collection(db, 'attendance'), 
          where('checkInTime', '>=', today),
          orderBy('checkInTime', 'desc')
        ));
        
        const activeUserIds = new Set();
        const seenInBase = new Set();
        
        activeAttSnap.forEach(d => {
          const data = d.data();
          const empId = data.employeeId;
          
          if (seenInBase.has(empId)) return;
          seenInBase.add(empId);
          
          const emp = empMap[empId];
          if (!data.checkOutTime && emp && emp.status === 'active') {
            activeUserIds.add(empId);
          }
        });

        const shopsPendingSnap = await getDocs(query(collection(db, 'shops'), where('status', '==', 'pending')));
        
        // Fetch Today's Orders & Revenue
        const ordersSnap = await getDocs(query(collection(db, 'orders'), where('timestamp', '>=', today)));
        
        let totalSales = 0;
        ordersSnap.forEach(d => totalSales += (d.data().orderTotal || 0));

        setStats(prev => ({
          ...prev,
          totalEmployees: usersSnap.size,
          activeToday: activeUserIds.size,
          pendingShops: shopsPendingSnap.size,
          todayOrders: ordersSnap.size,
          totalSales: totalSales
        }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'admin_dashboard_base');
      }
    };
    fetchBaseData();
  }, []);

  useEffect(() => {
    // Live attendance tracking
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceQ = query(
      collection(db, 'attendance'),
      where('checkInTime', '>=', today),
      orderBy('checkInTime', 'desc')
    );

    const unsubscribe = onSnapshot(attendanceQ, (snap) => {
      const locations: any[] = [];
      const seenEmployees = new Set();

      snap.forEach(doc => {
        const data = doc.data();
        const empId = data.employeeId;

        // Only consider the most recent session for each employee
        if (seenEmployees.has(empId)) return;
        seenEmployees.add(empId);

        const emp = employees[empId];
        
        if (emp && emp.status === 'active' && !data.checkOutTime && data.routeData && data.routeData.length > 0) {
          const lastPos = data.routeData[data.routeData.length - 1];
          
          locations.push({
            id: doc.id,
            lat: lastPos.lat,
            lng: lastPos.lng,
            label: `Live: ${emp.name}`,
            type: 'user'
          });
        }
      });
      setActiveLocations(locations);
    }, (error) => {
      console.error("Live attendance sync failed:", error);
    });

    // Registered shops tracking
    const shopsQ = query(collection(db, 'shops'), where('status', '==', 'approved'));
    const unsubscribeShops = onSnapshot(shopsQ, (snap) => {
      setShops(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error("Shops sync failed:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeShops();
    };
  }, [employees]); 

  const shopMarkers = shops.map(s => ({
    id: s.id,
    lat: s.latitude,
    lng: s.longitude,
    label: s.shopName,
    type: 'shop' as const
  }));

  const allMarkers = [...activeLocations, ...shopMarkers];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Admin Command Center</h2>
          <p className="text-slate-500 font-medium">Real-time overview of your field operations.</p>
        </div>
        <button className="btn-primary flex items-center gap-2 shadow-lg shadow-blue-100">
          <FileText className="w-4 h-4" />
          Export Daily Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Force" 
          value={stats.totalEmployees} 
          trend="+2 New" 
          icon={Users} 
          color="blue" 
        />
        <KPICard 
          title="Active Now" 
          value={activeLocations.length} 
          trend="Real-time Tracking" 
          icon={Activity} 
          color="emerald" 
        />
        <KPICard 
          title="Pending Approvals" 
          value={stats.pendingShops} 
          trend="Needs Attention" 
          icon={MapPin} 
          color="amber" 
        />
        <KPICard 
          title="Total Revenue" 
          value={`₹${stats.totalSales.toLocaleString()}`} 
          trend="+12% vs LW" 
          icon={TrendingUp} 
          color="indigo" 
        />
      </div>

      {/* Live Operation Map */}
      <div className="card overflow-hidden shadow-md">
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2 font-bold text-slate-800">
             <Navigation className="w-5 h-5 text-accent" />
             <span>Active Force Deployment Map</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Force</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Registered Shops</span>
              </div>
           </div>
        </div>
        <div className="h-[400px]">
          <MapView 
            center={(allMarkers.length > 0 && typeof allMarkers[0].lat === 'number') ? { lat: allMarkers[0].lat, lng: allMarkers[0].lng } : { lat: 20.5937, lng: 78.9629 }}
            zoom={allMarkers.length > 0 ? 12 : 5}
            extraMarkers={allMarkers}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-bold text-lg">Sales Performance</h3>
            <select className="text-sm border-none bg-zinc-100 rounded-md px-2 py-1 outline-none">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#71717a', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performers */}
        <div className="card p-6">
          <h3 className="font-bold text-lg mb-6">Top Employees</h3>
          <div className="space-y-6">
            {[
              { name: 'Rohan Sharma', sales: '₹42,000', visits: 12 },
              { name: 'Anita Verma', sales: '₹38,500', visits: 15 },
              { name: 'Suresh Kumar', sales: '₹31,200', visits: 10 },
              { name: 'Priya Das', sales: '₹28,900', visits: 18 },
            ].map((emp, i) => (
              <div key={emp.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center font-bold text-zinc-600">
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{emp.name}</p>
                    <p className="text-xs text-zinc-500">{emp.visits} Visits today</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-emerald-600">{emp.sales}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 rounded-xl transition-all border border-transparent hover:border-zinc-200">
            View All Employees
          </button>
        </div>
      </div>
    </div>
  );
}

const KPICard = ({ title, value, trend, icon: Icon, color }: any) => {
  const bgColors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="card p-6"
    >
      <div className="text-slate-400 text-[10px] font-bold uppercase mb-2 tracking-widest">{title}</div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-light tracking-tighter text-slate-900">{value}</div>
        <div className={cn("p-2 rounded-lg", bgColors[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className={cn(
        "text-[10px] font-bold mt-2",
        trend.includes('+') ? "text-emerald-500" : "text-blue-500"
      )}>
        {trend}
      </div>
    </motion.div>
  );
};
