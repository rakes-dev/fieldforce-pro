import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTracking } from '../../context/TrackingContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, onSnapshot } from 'firebase/firestore';
import { 
  CheckCircle2, 
  MapPin, 
  Clock, 
  ShoppingBag, 
  TrendingUp,
  AlertCircle,
  PlusSquare,
  History,
  Navigation,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const { currentPosition, isCheckedIn, refreshLocation, checkOut } = useTracking();
  const [attendance, setAttendance] = useState<any>(null);
  const [stats, setStats] = useState({ visits: 0, orders: 0, totalAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [isEndingSession, setIsEndingSession] = useState(false);

  const handleEndSession = async () => {
    if (!attendance?.id) {
      console.warn("Dashboard: Cannot end session, attendance.id is missing");
      return;
    }
    
    console.log("Dashboard: Triggering end session for ID:", attendance.id);
    setIsEndingSession(true);
    try {
      await checkOut(attendance.id);
      console.log("Dashboard: Session ended successfully");
    } catch (error: any) {
      console.error("Dashboard: End session failed:", error);
      alert("Failed to end session: " + (error.message || "Unknown error"));
    } finally {
      setIsEndingSession(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Real-time attendance
    const attendanceQ = query(
      collection(db, 'attendance'),
      where('employeeId', '==', user.uid),
      where('checkInTime', '>=', today),
      orderBy('checkInTime', 'desc'),
      limit(1)
    );

    const unsubscribeAttendance = onSnapshot(attendanceQ, (snap) => {
      if (!snap.empty) {
        setAttendance({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setAttendance(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance_realtime');
    });

    const fetchData = async () => {
      setLoading(true);
      try {
        // Get visits & orders for today
        const visitsQ = query(
          collection(db, 'shops'), 
          where('employeeId', '==', user.uid),
          where('createdAt', '>=', today),
          orderBy('createdAt', 'desc')
        );
        const visitsSnap = await getDocs(visitsQ);
        
        const ordersQ = query(
          collection(db, 'orders'),
          where('employeeId', '==', user.uid),
          where('timestamp', '>=', today),
          orderBy('timestamp', 'desc')
        );
        const ordersSnap = await getDocs(ordersQ);
        
        let total = 0;
        ordersSnap.forEach(d => total += d.data().orderTotal || 0);

        setStats({
          visits: visitsSnap.size,
          orders: ordersSnap.size,
          totalAmount: total
        });

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    return () => unsubscribeAttendance();
  }, [user]);

  const cards = [
    { title: 'Today\'s Visits', value: stats.visits, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Orders Taken', value: stats.orders, icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Sales Amount', value: `₹${stats.totalAmount.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium font-sans">Syncing workforce data...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome, {user?.displayName}</h2>
          <p className="text-slate-500 font-medium">Here's your summary for today.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm">
          <div className={cn("w-2 h-2 rounded-full", currentPosition ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            {currentPosition ? "GPS Active" : "GPS Locating"}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn("p-3 rounded-xl", card.bg)}>
                <card.icon className={cn("w-6 h-6", card.color)} />
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium tracking-tight">{card.title}</p>
            <h4 className="text-2xl font-bold mt-1 text-slate-900">{card.value}</h4>
          </motion.div>
        ))}
      </div>

      {/* Live Map Widget */}
      <div className="card overflow-hidden shadow-md">
        <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Navigation className="w-5 h-5 text-accent" />
            <span>Live Field Monitoring</span>
          </div>
          <button 
            onClick={refreshLocation}
            className="p-2 hover:bg-slate-50 rounded-full transition-colors group"
          >
            <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-accent transition-colors" />
          </button>
        </div>
        <div className="h-[280px]">
          {currentPosition ? (
            <MapView center={currentPosition} markerPosition={currentPosition} />
          ) : (
            <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-8">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin mb-2" />
              <p className="text-sm text-slate-500 font-medium font-sans">Acquiring current position...</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg tracking-tight px-1">Quick Tasks</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <ActionBtn to="/employee/new-shop" icon={PlusSquare} label="New Shop" />
          <ActionBtn to="/employee/visits" icon={History} label="History" />
          <ActionBtn to="/employee/orders" icon={ShoppingBag} label="Orders" />
        </div>
      </div>
    </div>
  );
}

const Loader2 = ({ className }: any) => (
  <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const ActionBtn = ({ to, icon: Icon, label }: any) => (
  <Link to={to} className="flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl hover:border-accent hover:text-accent transition-all group shadow-sm">
    <Icon className="w-6 h-6 text-slate-400 group-hover:text-accent transition-colors" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600 group-hover:text-accent">{label}</span>
  </Link>
);


