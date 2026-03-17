import React, { useEffect, useState } from 'react';
import { getLocalLogs, deleteLog } from '../services/googleScript';
import * as XLSX from 'xlsx';
import { Download, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AttendanceRecord } from '../App';
import { toast } from 'react-toastify';
import ConfirmModal from './ConfirmModal';

interface DashboardProps {
  onEdit: (log: AttendanceRecord) => void;
}

export default function Dashboard({ onEdit }: DashboardProps) {
  const [logs, setLogs] = useState<AttendanceRecord[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const loadLogs = () => {
      const fetchedLogs = getLocalLogs();
      setLogs(fetchedLogs.sort((a, b) => b.timestamp - a.timestamp));
    };
    
    loadLogs();
    window.addEventListener('localDataChanged', loadLogs);
    
    return () => {
      window.removeEventListener('localDataChanged', loadLogs);
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
    setConfirmState({
      isOpen: true,
      title: 'Delete Log',
      message: `Are you sure you want to delete the log for ${log.name}?`,
      isDestructive: true,
      onConfirm: () => {
        try {
          if (log.id) {
            deleteLog(log.id);
            toast.success(navigator.onLine ? 'Log deleted successfully' : 'Log deleted locally. Will sync when online.');
          }
        } catch (error) {
          console.error("Error initiating delete:", error);
          toast.error("Failed to initiate delete. Please try again.");
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmState.isDestructive}
      />
      <div className="p-8 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-check-circle-2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
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
            <tr className="bg-slate-50/50 text-slate-400 text-sm uppercase tracking-[0.2em] font-black">
              <th className="p-6">Visitor</th>
              <th className="p-6">Affiliation</th>
              <th className="p-6">Purpose</th>
              <th className="p-6">Timestamp</th>
              <th className="p-6 text-right">Manage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence mode="popLayout">
              {logs.length === 0 ? (
                <motion.tr 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No attendance logs found.
                  </td>
                </motion.tr>
              ) : (
                logs.map((log, i) => (
                  <motion.tr 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                    transition={{ delay: i * 0.05 }}
                    key={`${log.id}-${i}`} 
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 font-bold text-lg">
                          {log.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-slate-800 text-lg">{log.name}</div>
                            {log.synced === 0 && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[11px] font-black rounded-full uppercase tracking-wider">
                                Offline
                              </span>
                            )}
                          </div>
                          <div className="text-base text-slate-500">{log.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="font-semibold text-slate-700 text-base">{log.company || '-'}</div>
                      <div className="text-base text-slate-500">{log.title}</div>
                    </td>
                    <td className="p-6 text-slate-600 max-w-xs truncate italic text-base">
                      "{log.reason || '-'}"
                    </td>
                    <td className="p-6 text-base text-slate-500 whitespace-nowrap">
                      <div className="font-medium text-slate-700">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="text-sm text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</div>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => onEdit(log)}
                          className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-95"
                          title="Edit Log"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(log)}
                          className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                          title="Delete Log"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
