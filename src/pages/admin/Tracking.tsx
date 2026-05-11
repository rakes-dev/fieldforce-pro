import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { 
  Users, 
  MapPin, 
  Navigation, 
  Calendar,
  Clock,
  User,
  ChevronRight,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { MapView } from '../../components/MapView';
import { format } from 'date-fns';

export default function AdminTracking() {
  const [searchParams] = useSearchParams();
  const userIdFromUrl = searchParams.get('userId');
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'employee'));
        const snap = await getDocs(q);
        const fetchedEmployees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setEmployees(fetchedEmployees);

        if (userIdFromUrl) {
          const emp = fetchedEmployees.find(e => e.id === userIdFromUrl);
          if (emp) setSelectedEmployee(emp);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    };
    fetchEmployees();
  }, [userIdFromUrl]);

  useEffect(() => {
    if (!selectedEmployee) return;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
          collection(db, 'attendance'),
          where('employeeId', '==', selectedEmployee.id),
          where('checkInTime', '>=', startOfDay),
          where('checkInTime', '<=', endOfDay),
          orderBy('checkInTime', 'desc')
        );

        const snap = await getDocs(q);
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAttendanceLogs(logs);
        if (logs.length > 0) {
          setSelectedLog(logs[0]);
        } else {
          setSelectedLog(null);
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [selectedEmployee, selectedDate]);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.territory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoutePath = () => {
    if (!selectedLog?.routeData) return [];
    return selectedLog.routeData.map((p: any) => ({
      lat: p.lat,
      lng: p.lng
    }));
  };

  const calculateDuration = (start: any, end: any) => {
    if (!start || !end) return 'Ongoing...';
    try {
      const s = start.toDate ? start.toDate() : new Date(start);
      const e = end.toDate ? end.toDate() : new Date(end);
      const diff = Math.floor((e.getTime() - s.getTime()) / 1000 / 60); // minutes
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      return `${hours}h ${mins}m`;
    } catch (err) {
      return 'N/A';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight text-stroke-thin">Operational Intel & Movement logs</h2>
          <p className="text-slate-500 font-medium italic">High-precision tracking records for the field force.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
             <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-xl bg-white text-sm font-bold border-slate-200 outline-none focus:ring-2 focus:ring-accent/20 transition-all cursor-pointer"
             />
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Employee List */}
        <div className="w-80 flex flex-col gap-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              placeholder="Search operative..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto shadow-sm">
            {filteredEmployees.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelectedEmployee(emp)}
                className={cn(
                  "w-full p-4 flex items-center gap-4 text-left transition-all border-b border-slate-50 last:border-0 hover:bg-slate-50",
                  selectedEmployee?.id === emp.id ? "bg-accent/5 ring-1 ring-accent/10 border-accent/20" : ""
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                  selectedEmployee?.id === emp.id ? "bg-accent text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {emp.name[0]}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className={cn("font-bold truncate text-sm", selectedEmployee?.id === emp.id ? "text-accent" : "text-slate-800")}>{emp.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{emp.territory || 'Unassigned'}</p>
                </div>
                {selectedEmployee?.id === emp.id && <ChevronRight className="w-4 h-4 text-accent" />}
              </button>
            ))}
            {filteredEmployees.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm italic">
                No operatives found.
              </div>
            )}
          </div>
        </div>

        {/* Main View */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {!selectedEmployee ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-white border border-dashed border-slate-300 rounded-3xl opacity-60">
                <Navigation className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Awaiting Operative Selection</p>
                <p className="text-slate-400 text-xs mt-2 italic">Select an employee from the left panel to begin monitoring.</p>
            </div>
          ) : (
            <>
              {/* Stats Bar */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                   <div className="text-slate-400 text-[10px] font-black uppercase tracking-tighter mb-1">Operative</div>
                   <div className="text-sm font-black text-slate-900 truncate">{selectedEmployee.name}</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                   <div>
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-tighter mb-1">Sessions Found</div>
                    <div className="text-sm font-black text-slate-900">{attendanceLogs.length}</div>
                   </div>
                   <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold italic">S</div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-tighter mb-1">Selected Session</div>
                    <div className="text-sm font-black text-slate-900 truncate">
                      {selectedLog ? format(selectedLog.checkInTime?.toDate ? selectedLog.checkInTime.toDate() : new Date(selectedLog.checkInTime), 'HH:mm') : '--:--'} Start
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-tighter mb-1">Duration</div>
                    <div className="text-sm font-black text-emerald-600">
                       {selectedLog ? calculateDuration(selectedLog.checkInTime, selectedLog.checkOutTime) : '--'}
                    </div>
                </div>
              </div>

              {/* Map & Session Info */}
              <div className="flex-1 flex gap-6 overflow-hidden">
                <div className="flex-1 bg-white border border-slate-200 rounded-3xl overflow-hidden relative shadow-md">
                   <MapView 
                    center={getRoutePath().length > 0 ? getRoutePath()[0] : { lat: 20.5937, lng: 78.9629 }}
                    zoom={15}
                    routePath={getRoutePath()}
                    extraMarkers={selectedLog ? [
                      { id: 'start', lat: selectedLog.checkInLat, lng: selectedLog.checkInLng, label: 'Session Start', type: 'user' },
                      ...(selectedLog.routeData ? [{ 
                        id: 'end', 
                        lat: selectedLog.routeData[selectedLog.routeData.length-1].lat, 
                        lng: selectedLog.routeData[selectedLog.routeData.length-1].lng, 
                        label: 'Last Known Position', 
                        type: 'user' 
                      }] : [])
                    ] : []}
                   />
                   <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-xl p-3 shadow-lg flex flex-col gap-2 z-[1000]">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Movement Route</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-white" />
                         <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Start / End Points</span>
                      </div>
                   </div>
                </div>

                <div className="w-64 flex flex-col gap-4 overflow-hidden">
                   <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-xl">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">System Status</p>
                      <h4 className="font-bold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                        Live Logic Active
                      </h4>
                   </div>
                   
                   <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto p-4 shadow-sm">
                      <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Day Sessions</h5>
                      <div className="space-y-3">
                        {attendanceLogs.map((log) => (
                           <button
                             key={log.id}
                             onClick={() => setSelectedLog(log)}
                             className={cn(
                               "w-full p-3 rounded-xl border text-left transition-all",
                               selectedLog?.id === log.id 
                                ? "bg-slate-50 border-accent/20 ring-1 ring-accent/10" 
                                : "border-slate-100 hover:bg-slate-50"
                             )}
                           >
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span className="text-xs font-black text-slate-800">
                                  {format(log.checkInTime?.toDate ? log.checkInTime.toDate() : new Date(log.checkInTime), 'HH:mm')} - {log.checkOutTime ? format(log.checkOutTime.toDate ? log.checkOutTime.toDate() : new Date(log.checkOutTime), 'HH:mm') : 'Active'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{calculateDuration(log.checkInTime, log.checkOutTime)}</span>
                                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold">{log.routeData?.length || 0} Points</span>
                              </div>
                           </button>
                        ))}
                        {attendanceLogs.length === 0 && (
                          <div className="py-8 text-center text-slate-400 italic text-xs">
                             No data for this date.
                          </div>
                        )}
                      </div>
                   </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
