import React, { useState, useEffect } from 'react';
import { getLocalSchedule, addScheduleItem, updateScheduleItem, deleteScheduleItem, resetSchedule } from '../services/googleScript';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, User, BookOpen, Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from './ConfirmModal';

export interface ScheduleItem {
  id?: string;
  day: number;
  startTime: string;
  endTime: string;
  title: string;
  speaker: string;
  subject: string;
}

interface ScheduleManagerProps {
  onBack: () => void;
}

export default function ScheduleManager({ onBack }: ScheduleManagerProps) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [isAdding, setIsAdding] = useState(false);
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
    const loadSchedule = () => {
      const scheduleData = getLocalSchedule();
      scheduleData.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setItems(scheduleData);

      if (scheduleData.length === 0) {
        seedDefaultSchedule();
      }
    };

    loadSchedule();
    window.addEventListener('localDataChanged', loadSchedule);

    return () => {
      window.removeEventListener('localDataChanged', loadSchedule);
    };
  }, []);

  const seedDefaultSchedule = () => {
    const defaultItems: ScheduleItem[] = [];
    const subjects = ["Digital Transformation", "Asset Integrity", "Operational Excellence", "Predictive Maintenance", "Safety First"];
    
    for (let day = 1; day <= 3; day++) {
      // Day 1: 14:00 -> 19:00 (5 hours = 300 mins)
      // Day 2/3: 10:00 -> 19:00 (9 hours = 540 mins)
      const startHour = day === 1 ? 14 : 10;
      const endHour = 19;
      const totalAvailableMins = (endHour - startHour) * 60;
      const sessionDuration = 20;
      const totalSessionTime = 5 * sessionDuration;
      const totalGapTime = totalAvailableMins - totalSessionTime;
      const gapPerSession = Math.floor(totalGapTime / 4); // 4 gaps between 5 sessions

      for (let i = 0; i < 5; i++) {
        const minutesFromStart = i * (sessionDuration + gapPerSession);
        const h = Math.floor(startHour + minutesFromStart / 60);
        const m = minutesFromStart % 60;
        
        const startStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        
        const endTotalMinutes = minutesFromStart + sessionDuration;
        const endH = Math.floor(startHour + endTotalMinutes / 60);
        const endM = endTotalMinutes % 60;
        const endStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
        
        defaultItems.push({
          day,
          startTime: startStr,
          endTime: endStr,
          title: i === 0 ? `Keynote: ${subjects[i]}` : `Session ${i+1}: ${subjects[i]}`,
          speaker: `Speaker ${day}-${i+1}`,
          subject: subjects[i]
        });
      }
    }

    for (const item of defaultItems) {
      addScheduleItem(item);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    // Validate working hours (10:00 - 19:00)
    const [startH] = editingItem.startTime.split(':').map(Number);
    const [endH] = editingItem.endTime.split(':').map(Number);

    if (startH < 10 || endH > 19 || (endH === 19 && editingItem.endTime.split(':')[1] !== '00')) {
      toast.warning('Note: Session is outside standard working hours (10:00 - 19:00)');
    }

    try {
      if (editingItem.id) {
        updateScheduleItem(editingItem.id, editingItem);
        toast.success(navigator.onLine ? 'Session updated' : 'Session updated locally');
      } else {
        addScheduleItem(editingItem);
        toast.success(navigator.onLine ? 'Session added' : 'Session added locally');
      }
      setEditingItem(null);
      setIsAdding(false);
    } catch (error) {
      toast.error('Failed to save session');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Session',
      message: 'Are you sure you want to delete this session? This action cannot be undone.',
      isDestructive: true,
      onConfirm: () => {
        try {
          deleteScheduleItem(id);
          toast.success(navigator.onLine ? 'Session deleted' : 'Session deleted locally');
        } catch (error) {
          toast.error('Failed to delete session');
        }
      }
    });
  };

  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      title: 'Reset Schedule',
      message: 'This will delete all current sessions and reset to the default spread. Continue?',
      isDestructive: true,
      onConfirm: () => {
        try {
          const defaultItems: ScheduleItem[] = [];
          const subjects = ["Digital Transformation", "Asset Integrity", "Operational Excellence", "Predictive Maintenance", "Safety First"];
          
          for (let day = 1; day <= 3; day++) {
            const startHour = day === 1 ? 14 : 10;
            const endHour = 19;
            const totalAvailableMins = (endHour - startHour) * 60;
            const sessionDuration = 20;
            const totalSessionTime = 5 * sessionDuration;
            const totalGapTime = totalAvailableMins - totalSessionTime;
            const gapPerSession = Math.floor(totalGapTime / 4);

            for (let i = 0; i < 5; i++) {
              const currentMins = (startHour * 60) + (i * (sessionDuration + gapPerSession));
              const sessionStartH = Math.floor(currentMins / 60);
              const sessionStartM = currentMins % 60;
              const sessionEndMins = currentMins + sessionDuration;
              const sessionEndH = Math.floor(sessionEndMins / 60);
              const sessionEndM = sessionEndMins % 60;

              defaultItems.push({
                day,
                startTime: `${sessionStartH.toString().padStart(2, '0')}:${sessionStartM.toString().padStart(2, '0')}`,
                endTime: `${sessionEndH.toString().padStart(2, '0')}:${sessionEndM.toString().padStart(2, '0')}`,
                title: `EPROM Technical Session ${i + 1}`,
                speaker: "EPROM Expert",
                subject: subjects[i]
              });
            }
          }
          resetSchedule(defaultItems);
          toast.success(navigator.onLine ? 'Schedule reset to default spread' : 'Schedule reset locally');
        } catch (error) {
          toast.error('Failed to reset schedule');
        }
      }
    });
  };

  const filteredItems = items.filter(item => item.day === activeDay);

  return (
    <div className="max-w-4xl mx-auto">
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmState.isDestructive}
      />
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Booth Schedule</h2>
            <p className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Working Hours: 10:00 AM - 07:00 PM</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
          >
            <Trash2 className="w-5 h-5" />
            Reset
          </button>
          <button 
            onClick={() => {
              setEditingItem({ day: activeDay, startTime: activeDay === 1 ? '14:00' : '10:00', endTime: activeDay === 1 ? '14:20' : '10:20', title: '', speaker: '', subject: '' });
              setIsAdding(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Session
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        {[1, 2, 3].map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`px-8 py-3 rounded-xl font-bold transition-all ${
              activeDay === day 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Day {day}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item, index) => (
            <motion.div
              key={`${item.id}-${index}`}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center justify-center bg-indigo-50 text-indigo-600 p-4 rounded-2xl min-w-[100px]">
                    <Clock className="w-5 h-5 mb-1" />
                    <span className="text-lg font-black">{item.startTime}</span>
                    <span className="text-xs font-bold opacity-60">to {item.endTime}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">{item.title}</h3>
                    <div className="flex flex-wrap gap-4 text-sm font-medium">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="w-4 h-4 text-indigo-500" />
                        {item.speaker}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <BookOpen className="w-4 h-4 text-emerald-500" />
                        {item.subject}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingItem(item)}
                    className="p-4 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-95"
                  >
                    <Edit2 className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => item.id && handleDelete(item.id)}
                    className="p-4 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No sessions scheduled for Day {activeDay}</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-800">
                  {isAdding ? 'Add Session' : 'Edit Session'}
                </h3>
                <button onClick={() => { setEditingItem(null); setIsAdding(false); }} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Start Time</label>
                    <input 
                      type="time" 
                      required
                      value={editingItem.startTime}
                      onChange={e => setEditingItem({...editingItem, startTime: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">End Time</label>
                    <input 
                      type="time" 
                      required
                      value={editingItem.endTime}
                      onChange={e => setEditingItem({...editingItem, endTime: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Session Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Future of Maintenance"
                    value={editingItem.title}
                    onChange={e => setEditingItem({...editingItem, title: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Speaker Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="John Doe"
                    value={editingItem.speaker}
                    onChange={e => setEditingItem({...editingItem, speaker: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Digital Transformation"
                    value={editingItem.subject}
                    onChange={e => setEditingItem({...editingItem, subject: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 outline-none font-bold"
                  />
                </div>
                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
                  >
                    <Save className="w-6 h-6" />
                    {isAdding ? 'Create Session' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
