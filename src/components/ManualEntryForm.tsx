import React, { useState } from 'react';
import { ExtractedData } from '../services/gemini';
import { motion } from 'motion/react';
import { Save, X } from 'lucide-react';

interface ManualEntryFormProps {
  onSave: (data: ExtractedData) => void;
  onCancel: () => void;
}

export default function ManualEntryForm({ onSave, onCancel }: ManualEntryFormProps) {
  const [formData, setFormData] = useState<ExtractedData>({
    name: '',
    phone: '',
    company: '',
    title: '',
    reason: ''
  });
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCancelClick = () => {
    // Only show confirm if there is some data entered
    const hasData = Object.values(formData).some(val => typeof val === 'string' && val.trim() !== '');
    if (hasData) {
      setShowConfirm(true);
    } else {
      onCancel();
    }
  };

  const confirmDiscard = () => {
    setShowConfirm(false);
    onCancel();
  };

  const cancelDiscard = () => {
    setShowConfirm(false);
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[2rem] shadow-2xl max-w-xl w-full mx-auto border border-slate-100"
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Manual Entry</h2>
            <p className="text-slate-500 mt-1">Enter visitor details below</p>
          </div>
          <button onClick={handleCancelClick} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
            <X className="w-7 h-7" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Full Name *</label>
            <input 
              type="text" 
              name="name" 
              required
              placeholder="John Doe"
              value={formData.name} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Phone Number</label>
              <input 
                type="tel" 
                name="phone" 
                placeholder="+20 ..."
                value={formData.phone} 
                onChange={handleChange}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Company</label>
              <input 
                type="text" 
                name="company" 
                placeholder="Organization Name"
                value={formData.company} 
                onChange={handleChange}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Job Title</label>
            <input 
              type="text" 
              name="title" 
              placeholder="Manager, Engineer, etc."
              value={formData.title} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Reason for Visit</label>
            <textarea 
              name="reason" 
              rows={3}
              placeholder="What brings you to our booth today?"
              value={formData.reason} 
              onChange={handleChange}
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium resize-none"
            />
          </div>

          <div className="pt-6 flex gap-4">
            <button 
              type="button"
              onClick={handleCancelClick}
              className="flex-1 px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all active:scale-95"
            >
              Discard
            </button>
            <button 
              type="submit"
              className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95"
            >
              <Save className="w-6 h-6" />
              Complete Log
            </button>
          </div>
        </form>
      </motion.div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Discard Entry?</h3>
            <p className="text-slate-600 mb-6">Are you sure you want to discard this entry? All entered data will be lost.</p>
            <div className="flex gap-3">
              <button 
                onClick={cancelDiscard}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
              >
                Keep Editing
              </button>
              <button 
                onClick={confirmDiscard}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
