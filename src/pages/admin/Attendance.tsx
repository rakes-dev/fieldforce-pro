import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit, Timestamp, onSnapshot } from 'firebase/firestore';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  User,
  ArrowRight,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('all');

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'employee'));
        const snap = await getDocs(q);
        const empMap: Record<string, any> = {};
        snap.docs.forEach(d => {
          empMap[d.id] = { id: d.id, ...d.data() };
        });
        setEmployees(empMap);
      } catch (error) {
        console.error("Failed to fetch employees:", error);
      }
    };
    fetchEmployees();
  }, [refreshKey]);

  useEffect(() => {
    setLoading(true);
    const date = parseISO(`${selectedMonth}-01`);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const q = query(
      collection(db, 'attendance'),
      where('checkInTime', '>=', Timestamp.fromDate(start)),
      where('checkInTime', '<=', Timestamp.fromDate(end)),
      orderBy('checkInTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAttendance(records);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedMonth, refreshKey]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(parseISO(`${selectedMonth}-01`)),
    end: endOfMonth(parseISO(`${selectedMonth}-01`))
  });

  const attendanceMap = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    attendance.forEach(record => {
      const empId = record.employeeId;
      const date = record.checkInTime?.toDate ? record.checkInTime.toDate() : new Date(record.checkInTime);
      const dateKey = format(date, 'yyyy-MM-dd');
      if (!map[empId]) map[empId] = new Set();
      map[empId].add(dateKey);
    });
    return map;
  }, [attendance]);

  const getDayStatus = (empId: string, day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return attendanceMap[empId]?.has(dateKey) || false;
  };

  const filteredEmployees = Object.values(employees).filter((emp: any) => {
    const matchesSearch = !searchQuery || 
      (emp.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.territory?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterEmployeeId === 'all' || emp.id === filterEmployeeId;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-accent" />
            Monthly Attendance Intelligence
          </h2>
          <p className="text-slate-500 font-medium mt-1">Personnel performance and consistency logs for {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-accent transition-colors" />
            <input 
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-accent/10 outline-none transition-all cursor-pointer"
            />
          </div>
          <button 
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            placeholder="Search by operative name or territory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium shadow-sm focus:ring-2 focus:ring-accent/10 outline-none transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            value={filterEmployeeId}
            onChange={(e) => setFilterEmployeeId(e.target.value)}
            className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-accent/10 outline-none transition-all appearance-none cursor-pointer"
          >
            <option value="all">Every Operative</option>
            {Object.values(employees).map((emp: any) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly Grid View */}
      <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="sticky left-0 bg-slate-50 px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest z-10 border-r border-slate-100 min-w-[200px]">Operative Info</th>
                <th className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Summary</th>
                {daysInMonth.map((day) => (
                  <th key={day.toISOString()} className={cn(
                    "px-2 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center min-w-[30px]",
                    format(day, 'i') === '7' && "bg-red-50/30 text-red-300"
                  )}>
                    {format(day, 'd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={daysInMonth.length + 2} className="px-8 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest animate-pulse">Scanning Lunar Cycles...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredEmployees.length > 0 ? (
                filteredEmployees.map((emp: any) => {
                  const presentDays = daysInMonth.filter(day => getDayStatus(emp.id, day)).length;
                  
                  return (
                    <tr key={emp.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 bg-white group-hover:bg-slate-50 px-8 py-6 z-10 border-r border-slate-100 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center gap-4">
                          <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center font-bold text-white text-[10px] shadow-lg transition-transform group-hover:scale-110">
                            {emp?.name?.[0] || '?'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 text-sm truncate">{emp?.name || 'Unknown'}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{emp?.territory || 'No Base'}</p>
                          </div>
                          <button 
                            onClick={() => navigate(`/admin/tracking?userId=${emp.id}`)}
                            className="hidden group-hover:flex p-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-accent"
                            title="View tracking intel"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-6 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">{presentDays}/{daysInMonth.length}</span>
                          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Present</span>
                        </div>
                      </td>
                      {daysInMonth.map((day) => {
                        const isPresent = getDayStatus(emp.id, day);
                        const isSunday = format(day, 'i') === '7';
                        
                        return (
                          <td key={day.toISOString()} className={cn(
                            "px-1 py-6 text-center",
                            isSunday && "bg-slate-50/30"
                          )}>
                            <div className={cn(
                              "w-2.5 h-2.5 rounded-full mx-auto transition-all",
                              isPresent 
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)] scale-110" 
                                : isSunday 
                                  ? "bg-slate-200/50" 
                                  : "bg-slate-100 hover:bg-slate-200"
                            )} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={daysInMonth.length + 2} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                        <ClipboardCheck className="w-8 h-8 text-slate-200" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-900 font-black uppercase tracking-widest">No Operatives Found</p>
                        <p className="text-slate-400 text-sm">Adjustment search parameters or cycle selection.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Summary Footer */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Present Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-100" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Absent Day</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200/50" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sunday/Holiday</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
            onClick={() => {
              const d = parseISO(`${selectedMonth}-01`);
              d.setMonth(d.getMonth() - 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"
           >
             <ChevronLeft className="w-3 h-3" />
             Prior Cycle
           </button>
           <button 
             onClick={() => {
              const d = parseISO(`${selectedMonth}-01`);
              d.setMonth(d.getMonth() + 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors shadow-sm"
           >
             Next Cycle
             <ChevronRight className="w-3 h-3" />
           </button>
        </div>
      </div>
    </div>
  );
}
