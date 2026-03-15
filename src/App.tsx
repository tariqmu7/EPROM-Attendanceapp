import React, { useState, useEffect } from 'react';
import { auth, login, logout, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { addDoc, collection } from 'firebase/firestore';
import { ExtractedData } from './services/gemini';
import { handleFirestoreError, OperationType } from './utils/errorHandler';
import VoiceLogger from './components/VoiceLogger';
import CardScanner from './components/CardScanner';
import ReviewForm from './components/ReviewForm';
import ManualEntryForm from './components/ManualEntryForm';
import Dashboard from './components/Dashboard';
import ScheduleManager from './components/ScheduleManager';
import { Mic, Camera, LogOut, Building2, FileText, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
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
}

type AppState = 'dashboard' | 'voice' | 'scan' | 'review' | 'manual' | 'schedule';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appState, setAppState] = useState<AppState>('dashboard');
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [editingLog, setEditingLog] = useState<AttendanceRecord | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleExtracted = (data: ExtractedData) => {
    setExtractedData(data);
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
    if (!user) return;
    
    const logData = {
      ...data,
      timestamp: editingLog ? editingLog.timestamp : Date.now(),
      authorUid: user.uid,
    };

    try {
      const path = 'attendanceLogs';
      if (editingLog && editingLog.id) {
        // Update existing Firestore doc (don't await so it works offline)
        updateDoc(doc(db, path, editingLog.id as string), logData)
          .then(() => toast.success('Log updated successfully'))
          .catch(error => {
            console.error("Failed to update log:", error);
            toast.error('Failed to update log');
          });
      } else {
        // Create new (don't await so it works offline)
        addDoc(collection(db, path), logData)
          .then(() => toast.success('Log saved successfully'))
          .catch(error => {
            console.error("Failed to add log:", error);
            toast.error('Failed to save log');
          });
      }
      
      setAppState('dashboard');
      setExtractedData(null);
      setEditingLog(null);
    } catch (error) {
      console.error("Error initiating save:", error);
      toast.error("Failed to initiate save. Please try again.");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-3xl shadow-2xl max-w-md w-full text-center relative z-10 border border-slate-100"
        >
          <div className="mb-8">
            <img 
              src="https://eprom.com.eg/wp-content/uploads/2024/07/epromlogo-scaled.gif" 
              alt="EPROM Logo" 
              className="h-24 mx-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Welcome to EPROM</h1>
          <p className="text-slate-500 mb-10 text-lg">Booth Attendance & Visitor Logging</p>
          
          <button
            onClick={login}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg hover:shadow-indigo-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            Start Visitor Log
          </button>
          
          <div className="mt-8 pt-8 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Egyptian Projects Operation & Maintenance</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <ToastContainer position="bottom-left" aria-label="Notifications" />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://eprom.com.eg/wp-content/uploads/2024/07/epromlogo-scaled.gif" 
              alt="EPROM Logo" 
              className="h-12 object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">Attendance System</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setAppState('schedule')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                appState === 'schedule' 
                  ? 'bg-indigo-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-5 h-5" />
              <span className="hidden md:block">Booth Schedule</span>
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{user.displayName}</p>
              <p className="text-xs text-slate-500">Booth Staff</p>
            </div>
            <button 
              onClick={logout}
              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {appState === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
