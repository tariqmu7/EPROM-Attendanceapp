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
        className="bg-white p-8 rounded-2xl shadow-lg max-w-lg w-full mx-auto"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-slate-800">Manual Data Entry</h2>
          <button onClick={handleCancelClick} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-slate-600 mb-8">
          Please enter the attendance details below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
            <input 
              type="text" 
              name="name" 
              required
              value={formData.name} 
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input 
                type="tel" 
                name="phone" 
                value={formData.phone} 
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input 
                type="text" 
                name="company" 
                value={formData.company} 
                onChange={handleChange}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Title</label>
            <input 
              type="text" 
              name="title" 
              value={formData.title} 
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Meeting</label>
            <textarea 
              name="reason" 
              rows={3}
              value={formData.reason} 
              onChange={handleChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow resize-none"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={handleCancelClick}
              className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Discard
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              Save Log
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
