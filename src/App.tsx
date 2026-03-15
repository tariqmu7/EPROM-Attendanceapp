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
import { Mic, Camera, LogOut, Building2, FileText } from 'lucide-react';
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

type AppState = 'dashboard' | 'voice' | 'scan' | 'review' | 'manual';

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">EPROM</h1>
          <p className="text-slate-500 mb-8">Smart Attendance Logging System</p>
          <button
            onClick={login}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-sm"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <ToastContainer position="bottom-left" />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">EPROM Attendance</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 hidden sm:block">{user.displayName}</span>
            <button 
              onClick={logout}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    if (!isOnline) return;
                    setEditingLog(null);
                    setAppState('voice');
                  }}
                  disabled={!isOnline}
                  className={`group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all text-left flex items-center gap-6 ${
                    isOnline ? 'hover:border-indigo-300 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform ${
                    isOnline ? 'bg-indigo-50 text-indigo-600 group-hover:scale-110' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Mic className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">Voice Log</h3>
                    <p className="text-sm text-slate-500">
                      {isOnline ? 'Record attendance via voice' : 'Requires internet'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    if (!isOnline) return;
                    setEditingLog(null);
                    setAppState('scan');
                  }}
                  disabled={!isOnline}
                  className={`group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-all text-left flex items-center gap-6 ${
                    isOnline ? 'hover:border-emerald-300 hover:shadow-md cursor-pointer' : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform ${
                    isOnline ? 'bg-emerald-50 text-emerald-600 group-hover:scale-110' : 'bg-slate-100 text-slate-400'
                  }`}>
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">Scan Card</h3>
                    <p className="text-sm text-slate-500">
                      {isOnline ? 'Extract from business card' : 'Requires internet'}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setEditingLog(null);
                    setAppState('manual');
                  }}
                  className="group relative overflow-hidden bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all text-left flex items-center gap-6"
                >
                  <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">Manual Entry</h3>
                    <p className="text-sm text-slate-500">Type data manually (offline)</p>
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
        </AnimatePresence>
      </main>
    </div>
  );
}
