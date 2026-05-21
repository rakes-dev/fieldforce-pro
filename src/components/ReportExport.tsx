import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, getDocs, where, Timestamp, orderBy } from 'firebase/firestore';
import { FileText, Download, ChevronDown, Calendar, Loader2, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns';
import { cn } from '../lib/utils';

type ExportPeriod = 'daily' | 'monthly' | 'quarterly' | 'annually';

export function ReportExport() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  const exportData = async (period: ExportPeriod) => {
    setLoading(true);
    setStatus('idle');
    try {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);

      switch (period) {
        case 'daily':
          start = startOfDay(now);
          break;
        case 'monthly':
          start = startOfMonth(now);
          break;
        case 'quarterly':
          start = startOfQuarter(now);
          break;
        case 'annually':
          start = startOfYear(now);
          break;
        default:
          start = startOfDay(now);
      }

      // Fetch Orders
      const ordersQ = query(
        collection(db, 'orders'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'desc')
      );
      const ordersSnap = await getDocs(ordersQ);
      
      // Fetch Attendance for the same period
      const attendanceQ = query(
        collection(db, 'attendance'),
        where('checkInTime', '>=', Timestamp.fromDate(start)),
        where('checkInTime', '<=', Timestamp.fromDate(end)),
        orderBy('checkInTime', 'desc')
      );
      const attendanceSnap = await getDocs(attendanceQ);

      // Fetch User names to map IDs
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap: Record<string, string> = {};
      usersSnap.forEach(d => {
        userMap[d.id] = d.data().name || 'Unknown';
      });

      // Prepare Orders Data
      const ordersData = ordersSnap.docs.map(doc => {
        const data = doc.data();
        return {
          'Order ID': doc.id,
          'Date': data.timestamp?.toDate ? format(data.timestamp.toDate(), 'yyyy-MM-dd HH:mm') : 'N/A',
          'Agent Name': userMap[data.employeeId] || data.employeeId,
          'Shop Name': data.shopName || 'N/A',
          'Total Items': data.items?.length || 0,
          'Amount': data.orderTotal || 0,
          'Status': data.status || 'Pending'
        };
      });

      // Prepare Attendance Data
      const attendanceData = attendanceSnap.docs.map(doc => {
        const data = doc.data();
        const checkIn = data.checkInTime?.toDate?.() || new Date();
        const checkOut = data.checkOutTime?.toDate?.();
        
        return {
          'Record ID': doc.id,
          'Agent Name': userMap[data.employeeId] || data.employeeId,
          'Check In': format(checkIn, 'yyyy-MM-dd HH:mm'),
          'Check Out': checkOut ? format(checkOut, 'yyyy-MM-dd HH:mm') : 'Ongoing',
          'Status': data.checkOutTime ? 'Completed' : 'Active',
          'Check-in Location': `${data.checkInLat}, ${data.checkInLng}`
        };
      });

      // Create Workbook
      const wb = XLSX.utils.book_new();
      
      const wsOrders = XLSX.utils.json_to_sheet(ordersData);
      XLSX.utils.book_append_sheet(wb, wsOrders, "Orders Report");

      const wsAttendance = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, wsAttendance, "Attendance Report");

      // Generate Buffer
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      
      saveAs(dataBlob, `ForceReport_${period}_${format(now, 'yyyyMMdd')}.xlsx`);
      
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to generate report. Please check your data permissions.");
    } finally {
      setLoading(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all group"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : (
          <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
        )}
        <span>{loading ? 'Processing...' : 'Export Intelligence'}</span>
        <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-100 rounded-[24px] shadow-2xl p-2 z-[100] animate-in fade-in slide-in-from-top-2">
          <div className="px-4 py-3 border-b border-slate-50">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Cycle</p>
          </div>
          <div className="p-1 space-y-1">
            {[
              { id: 'daily', label: 'Daily Operations', desc: 'Today\'s real-time logs' },
              { id: 'monthly', label: 'Monthly Summary', desc: 'Current calendar month' },
              { id: 'quarterly', label: 'Quarterly Audit', desc: 'Current business quarter' },
              { id: 'annually', label: 'Annual Force Report', desc: 'Full fiscal year data' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => exportData(item.id as ExportPeriod)}
                className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 transition-colors group flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-slate-900 transition-colors">
                  <Calendar className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900">{item.label}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
