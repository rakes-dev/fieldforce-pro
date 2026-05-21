import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { 
  Users, 
  ShoppingBag, 
  MapPin, 
  Activity,
  ArrowUpRight,
  TrendingUp,
  FileText,
  Navigation,
  Trophy,
  Store
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
import { ReportExport } from '../../components/ReportExport';
import { format, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeToday: 0,
    totalShops: 0,
    todayOrders: 0,
    totalSales: 0
  });
  const [activeLocations, setActiveLocations] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, any>>({});
  const [weeklySales, setWeeklySales] = useState<any[]>([]);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);

  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
        const empMap: Record<string, any> = {};
        usersSnap.forEach(d => {
          empMap[d.id] = { id: d.id, ...d.data() };
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

        const shopsSnap = await getDocs(collection(db, 'shops'));
        
        // Fetch Today's Orders & Revenue
        const ordersSnap = await getDocs(query(collection(db, 'orders'), where('timestamp', '>=', today)));
        
        let totalSalesToday = 0;
        ordersSnap.forEach(d => totalSalesToday += (d.data().orderTotal || 0));

        // Fetch Weekly Sales Data for Chart
        const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
        const last7DaysOrdersSnap = await getDocs(query(
          collection(db, 'orders'),
          where('timestamp', '>=', Timestamp.fromDate(sevenDaysAgo)),
          orderBy('timestamp', 'asc')
        ));

        const dailyMap: Record<string, number> = {};
        // Initialize last 7 days
        for (let i = 0; i < 7; i++) {
          const date = subDays(new Date(), i);
          dailyMap[format(date, 'EEE')] = 0;
        }

        const employeeAggs: Record<string, { id: string, sales: number, visits: number }> = {};

        last7DaysOrdersSnap.forEach(d => {
          const data = d.data();
          const date = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
          const dayName = format(date, 'EEE');
          
          // Chart aggregation
          dailyMap[dayName] = (dailyMap[dayName] || 0) + (data.orderTotal || 0);

          // Top performers aggregation (for today specifically requested? User said "dashboard elements data from directly from database")
          // Let's do it for today's data for performers
          if (isSameDay(date, new Date())) {
            const empId = data.employeeId;
            if (!employeeAggs[empId]) employeeAggs[empId] = { id: empId, sales: 0, visits: 0 };
            employeeAggs[empId].sales += (data.orderTotal || 0);
            employeeAggs[empId].visits += 1;
          }
        });

        // Format weekly sales for AreaChart
        const chartData = Object.entries(dailyMap)
          .map(([name, sales]) => ({ name, sales }))
          .reverse(); // Ensure chronological order if we reverse or sort

        setWeeklySales(chartData);

        // Map and sort top performers
        const sortedPerformers = Object.values(employeeAggs)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5)
          .map(agg => ({
            ...empMap[agg.id],
            sales: agg.sales,
            visits: agg.visits
          }));
        
        setTopPerformers(sortedPerformers);

        setStats(prev => ({
          ...prev,
          totalEmployees: usersSnap.size,
          activeToday: activeUserIds.size,
          totalShops: shopsSnap.size,
          todayOrders: ordersSnap.size,
          totalSales: totalSalesToday
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
    const shopsQ = query(collection(db, 'shops'));
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

  const shopMarkers = useMemo(() => shops.map(s => ({
    id: s.id,
    lat: s.latitude,
    lng: s.longitude,
    label: s.shopName,
    type: 'shop' as const
  })), [shops]);

  const allMarkers = useMemo(() => [...activeLocations, ...shopMarkers], [activeLocations, shopMarkers]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Admin Executive Command</h2>
          <p className="text-slate-500 font-medium">Strategic overview of your regional force performance.</p>
        </div>
        <ReportExport />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Force" 
          value={stats.totalEmployees} 
          trend="Operative Base" 
          icon={Users} 
          color="blue" 
        />
        <KPICard 
          title="Field Deployment" 
          value={activeLocations.length} 
          trend="Currently Live" 
          icon={Activity} 
          color="emerald" 
        />
        <KPICard 
          title="Registered Shops" 
          value={stats.totalShops} 
          trend="Approved Outlets" 
          icon={Store} 
          color="amber" 
        />
        <KPICard 
          title="Alpha Revenue" 
          value={`₹${stats.totalSales.toLocaleString()}`} 
          trend="Daily Intake" 
          icon={TrendingUp} 
          color="indigo" 
        />
      </div>

      {/* Live Operation Map */}
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="p-4 bg-zinc-50 border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2 font-black text-[10px] text-slate-400 uppercase tracking-widest">
             <Navigation className="w-4 h-4 text-accent" />
             <span>Regional Force Deployment Matrix</span>
           </div>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Agents</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Establisments</span>
              </div>
           </div>
        </div>
        <div className="h-[450px]">
          <MapView 
            center={(allMarkers.length > 0 && typeof allMarkers[0].lat === 'number') ? { lat: allMarkers[0].lat, lng: allMarkers[0].lng } : { lat: 21.1458, lng: 79.0882 }}
            zoom={allMarkers.length > 0 ? 12 : 5}
            extraMarkers={allMarkers}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/40">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Revenue Cycle</h3>
              <p className="text-slate-400 text-[10px] font-bold mt-1">Last 7 days fiscal momentum</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklySales}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-xl shadow-slate-200/40">
          <div className="flex items-center gap-2 mb-8">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Elite Performers</h3>
          </div>
          
          <div className="space-y-6">
            {topPerformers.length > 0 ? topPerformers.map((emp, i) => (
              <div key={emp.id} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center font-black text-white text-xs shadow-lg group-hover:scale-110 transition-transform">
                    {emp.name?.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{emp.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{emp.visits} Deployments</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-xs text-emerald-600">₹{emp.sales?.toLocaleString()}</p>
                </div>
              </div>
            )) : (
              <div className="py-20 text-center space-y-3">
                <Activity className="w-8 h-8 text-slate-100 mx-auto" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Daily Data Found</p>
              </div>
            )}
          </div>
          <button className="w-full mt-8 py-4 bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100 hover:border-slate-200">
            Audit Full Force
          </button>
        </div>
      </div>
    </div>
  );
}

const KPICard = ({ title, value, trend, icon: Icon, color }: any) => {
  const bgColors: any = {
    blue: 'bg-blue-600 text-white shadow-blue-200',
    emerald: 'bg-emerald-600 text-white shadow-emerald-200',
    amber: 'bg-amber-500 text-white shadow-amber-200',
    indigo: 'bg-indigo-600 text-white shadow-indigo-200',
  };

  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="bg-white border border-slate-200 p-8 rounded-[32px] shadow-xl shadow-slate-200/40 relative overflow-hidden group"
    >
      <div className="relative z-10">
        <div className="text-slate-400 text-[10px] font-black uppercase mb-4 tracking-widest">{title}</div>
        <div className="flex items-center justify-between">
          <div className="text-4xl font-black tracking-tighter text-slate-900">{value}</div>
          <div className={cn("p-3 rounded-2xl shadow-lg transition-transform group-hover:rotate-12", bgColors[color])}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-4">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {trend}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
