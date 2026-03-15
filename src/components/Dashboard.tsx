import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import * as XLSX from 'xlsx';
import { Download, WifiOff, CheckCircle2, Clock, Edit2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/errorHandler';
import { AttendanceRecord } from '../App';
import { toast } from 'react-toastify';

interface DashboardProps {
  onEdit: (log: AttendanceRecord) => void;
}

export default function Dashboard({ onEdit }: DashboardProps) {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [prevUnsyncedCount, setPrevUnsyncedCount] = useState(0);

  useEffect(() => {
    if (prevUnsyncedCount > 0 && unsyncedCount === 0 && isOnline) {
      toast.success('All offline logs synced successfully');
    }
    setPrevUnsyncedCount(unsyncedCount);
  }, [unsyncedCount, isOnline, prevUnsyncedCount]);

  useEffect(() => {
    // Listen for online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const user = auth.currentUser;
    if (!user) return;

    // Listen to Firebase
    const path = 'attendanceLogs';
    const q = query(collection(db, path), where('authorUid', '==', user.uid));
    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        synced: doc.metadata.hasPendingWrites ? 0 : 1
      })) as AttendanceRecord[];
      
      // Sort in memory to avoid composite index requirement
      fetchedLogs.sort((a, b) => b.timestamp - a.timestamp);
      
      setLogs(fetchedLogs);
      setUnsyncedCount(fetchedLogs.filter(log => log.synced === 0).length);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const exportToExcel = async () => {
    const worksheetData = logs.map(log => ({
      'Date & Time': new Date(log.timestamp).toLocaleString(),
      'Name': log.name,
      'Phone': log.phone,
      'Company': log.company,
      'Title': log.title,
      'Reason': log.reason,
      'Status': log.synced === 0 ? 'Pending Sync' : 'Synced'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Logs");
    XLSX.writeFile(workbook, `EPROM_Attendance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleDelete = (log: AttendanceRecord) => {
    if (!window.confirm(`Are you sure you want to delete the log for ${log.name}?`)) return;

    try {
      if (log.id) {
        deleteDoc(doc(db, 'attendanceLogs', log.id))
          .then(() => toast.success('Log deleted successfully'))
          .catch(error => {
            console.error("Failed to delete log:", error);
            toast.error('Failed to delete log');
          });
      }
    } catch (error) {
      console.error("Error initiating delete:", error);
      toast.error("Failed to initiate delete. Please try again.");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Persistent Status Indicator */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end">
        <motion.div 
          layout
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium text-sm border backdrop-blur-sm ${
            unsyncedCount > 0 
              ? 'bg-amber-100/90 text-amber-800 border-amber-200' 
              : 'bg-slate-50/90 text-slate-600 border-slate-200'
          }`}
        >
          {unsyncedCount > 0 ? (
            <Clock className="w-4 h-4 animate-pulse" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {unsyncedCount} pending sync
        </motion.div>
        <motion.div 
          layout
          className={`px-4 py-2 rounded-full shadow-lg flex items-center gap-2 font-medium text-sm border backdrop-blur-sm ${
            isOnline 
              ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200' 
              : 'bg-slate-800/90 text-white border-slate-700'
          }`}
        >
          {isOnline ? <CheckCircle2 className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {isOnline ? 'System Online' : 'System Offline'}
        </motion.div>
      </div>

      <div className="p-8 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Visitor Log</h2>
            <p className="text-sm text-slate-500 mt-0.5">Real-time attendance monitoring</p>
          </div>
        </div>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-xl font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
        >
          <Download className="w-5 h-5" />
          Export to Excel
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-xs uppercase tracking-[0.2em] font-black">
              <th className="p-5">Visitor</th>
              <th className="p-5">Affiliation</th>
              <th className="p-5">Purpose</th>
              <th className="p-5">Timestamp</th>
              <th className="p-5 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No attendance logs found.
                </td>
              </tr>
            ) : (
              logs.map((log, i) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={log.id || i} 
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold">
                        {log.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-slate-800">{log.name}</div>
                          {log.synced === 0 && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                              Offline
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500">{log.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="font-semibold text-slate-700">{log.company || '-'}</div>
                    <div className="text-sm text-slate-500">{log.title}</div>
                  </td>
                  <td className="p-5 text-slate-600 max-w-xs truncate italic">
                    "{log.reason || '-'}"
                  </td>
                  <td className="p-5 text-sm text-slate-500 whitespace-nowrap">
                    <div className="font-medium text-slate-700">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                      <button 
                        onClick={() => onEdit(log)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Edit Log"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(log)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Log"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
