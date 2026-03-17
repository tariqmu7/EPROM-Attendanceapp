import React, { useState, useEffect } from 'react';
import { ExtractedData } from './services/gemini';
import { fetchAllData, addLog, updateLog, getUnsyncedCount, syncQueue } from './services/googleScript';
import VoiceLogger from './components/VoiceLogger';
import CardScanner from './components/CardScanner';
import ReviewForm from './components/ReviewForm';
import ManualEntryForm from './components/ManualEntryForm';
import Dashboard from './components/Dashboard';
import ScheduleManager from './components/ScheduleManager';
import { Mic, Camera, Building2, FileText, Calendar, WifiOff, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export interface AttendanceRecord {
  id?: string;
  name: string;
  phone: string;
  company: string;
  title: string;
  reason: string;
  timestamp: number;
  authorUid: string;
  synced?: number;
  cardImageBase64?: string;
  cardImageMimeType?: string;
}

type AppState = 'dashboard' | 'voice' | 'scan' | 'review' | 'manual' | 'schedule';

export default function App() {
  const [appState, setAppState] = useState<AppState>('dashboard');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [cardImage, setCardImage] = useState<{ base64: string; mimeType: string } | null>(null);
  const [editingLog, setEditingLog] = useState<AttendanceRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [prevUnsyncedCount, setPrevUnsyncedCount] = useState(0);

  useEffect(() => {
    if (prevUnsyncedCount > 0 && unsyncedCount === 0 && isOnline) {
      toast.success('All offline logs synced successfully');
    }
    setPrevUnsyncedCount(unsyncedCount);
  }, [unsyncedCount, isOnline, prevUnsyncedCount]);

  useEffect(() => {
    const handleQueueChange = () => {
      setUnsyncedCount(getUnsyncedCount());
    };
    window.addEventListener('queueChanged', handleQueueChange);
    
    // Initial fetch
    if (isOnline) {
      fetchAllData();
      syncQueue();
    }
    
    return () => {
      window.removeEventListener('queueChanged', handleQueueChange);
    };
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.info('You are back online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will be saved locally.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleExtracted = (data: ExtractedData, image?: { base64: string; mimeType: string }) => {
    setExtractedData(data);
    if (image) setCardImage(image);
    setEditingLog(null);
    setAppState('review');
  };

  const handleEdit = (log: AttendanceRecord) => {
    setEditingLog(log);
    setExtractedData({
      name: log.name,
      phone: log.phone,
      company: log.company,
      title: log.title,
      reason: log.reason
    });
    setAppState('review');
  };

  const handleSave = async (data: ExtractedData) => {
    const logData: AttendanceRecord = {
      ...data,
      timestamp: editingLog ? editingLog.timestamp : Date.now(),
      authorUid: 'local-user',
      cardImageBase64: cardImage?.base64,
      cardImageMimeType: cardImage?.mimeType,
    };

    try {
      if (editingLog && editingLog.id) {
        updateLog(editingLog.id, logData);
        toast.success(isOnline ? 'Log updated successfully' : 'Log updated locally. Will sync when online.');
      } else {
        addLog(logData);
        toast.success(isOnline ? 'Log saved successfully' : 'Log saved locally. Will sync when online.');
      }
      
      setAppState('dashboard');
      setExtractedData(null);
      setCardImage(null);
      setEditingLog(null);
    } catch (error) {
      console.error("Error initiating save:", error);
      toast.error("Failed to initiate save. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <ToastContainer position="bottom-left" aria-label="Notifications" />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 md:px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-6">
            <img 
              src="https://eprom.com.eg/wp-content/uploads/2024/07/epromlogo-scaled.gif" 
              alt="EPROM Logo" 
              className="h-14 object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight hidden sm:block">Attendance System</h1>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={() => setAppState('schedule')}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all text-sm sm:text-base ${
                appState === 'schedule' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-6 h-6" />
              <span className="hidden md:block">Booth Schedule</span>
            </button>
            <div className="h-10 w-px bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <motion.div 
                layout
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm border transition-all ${
                  unsyncedCount > 0 
                    ? 'bg-amber-100/90 text-amber-800 border-amber-200 cursor-pointer hover:bg-amber-200' 
                    : 'bg-slate-50/90 text-slate-600 border-slate-200'
                }`}
                onClick={() => {
                  if (unsyncedCount > 0 && isOnline) {
                    syncQueue().then(count => {
                      if (count > 0) {
                        toast.success(`Synced ${count} items`);
                      } else if (unsyncedCount > 0) {
                        toast.error("Sync failed. Check your connection and Script URL.");
                      }
                    });
                  }
                }}
              >
                {unsyncedCount > 0 ? (
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="hidden lg:inline">
                  {unsyncedCount > 0 ? `Sync ${unsyncedCount} items` : 'All synced'}
                </span>
                <span className="lg:hidden">{unsyncedCount}</span>
              </motion.div>
              <motion.div 
                layout
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm border ${
                  isOnline 
                    ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200' 
                    : 'bg-slate-800/90 text-white border-slate-700'
                }`}
              >
                {isOnline ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <WifiOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                <span className="hidden lg:inline">{isOnline ? 'Online' : 'Offline'}</span>
              </motion.div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-8 py-8 md:py-10">
        <AnimatePresence mode="wait">
          {appState === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                <button
                  onClick={() => {
                    if (!isOnline) return;
                    setEditingLog(null);
                    setAppState('voice');
                  }}
                  disabled={!isOnline}
                  className={`group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 transition-all text-left flex flex-col gap-6 ${
                    isOnline ? 'hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    isOnline ? 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Mic className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Voice Log</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {isOnline ? 'Speak naturally to record visitor details instantly.' : 'Voice logging requires an active internet connection.'}
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Mic className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!isOnline) return;
                    setEditingLog(null);
                    setAppState('scan');
                  }}
                  disabled={!isOnline}
                  className={`group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 transition-all text-left flex flex-col gap-6 ${
                    isOnline ? 'hover:border-emerald-400 hover:shadow-xl hover:-translate-y-1 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                    isOnline ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Camera className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Scan Card</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {isOnline ? 'Take a photo of a business card to extract data.' : 'Card scanning requires an active internet connection.'}
                    </p>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Camera className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                </button>

                <button
                  onClick={() => {
                    setEditingLog(null);
                    setAppState('manual');
                  }}
                  className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-amber-400 hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-6"
                >
                  <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Manual Entry</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">Enter visitor information manually. Works perfectly offline.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <FileText className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                </button>

                <button
                  onClick={() => setAppState('schedule')}
                  className="group relative overflow-hidden bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-6"
                >
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Booth Schedule</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">View and manage the 3-day session schedule for the booth.</p>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Calendar className="w-24 h-24 -mr-8 -mt-8" />
                  </div>
                </button>
              </div>

              <Dashboard onEdit={handleEdit} />
            </motion.div>
          )}

          {appState === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <VoiceLogger 
                onExtracted={handleExtracted} 
                onCancel={() => setAppState('dashboard')} 
              />
            </motion.div>
          )}

          {appState === 'scan' && (
            <motion.div key="scan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CardScanner 
                onExtracted={handleExtracted} 
                onCancel={() => setAppState('dashboard')} 
              />
            </motion.div>
          )}

          {appState === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ManualEntryForm 
                onSave={handleSave} 
                onCancel={() => setAppState('dashboard')} 
              />
            </motion.div>
          )}

          {appState === 'review' && extractedData && (
            <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ReviewForm 
                initialData={extractedData} 
                onSave={handleSave} 
                onCancel={() => setAppState('dashboard')} 
                isEdit={!!editingLog}
              />
            </motion.div>
          )}

          {appState === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ScheduleManager onBack={() => setAppState('dashboard')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
