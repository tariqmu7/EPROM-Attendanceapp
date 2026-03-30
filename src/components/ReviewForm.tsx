import React, { useState } from 'react';
import { ExtractedData, analyzeBusinessCard } from '../services/gemini';
import { fetchImageBase64FromDrive } from '../services/googleScript';
import { motion } from 'motion/react';
import { Save, X, Camera, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface ReviewFormProps {
  initialData: ExtractedData;
  onSave: (data: ExtractedData) => void;
  onCancel: () => void;
  onRetake?: () => void;
  isEdit?: boolean;
}

export default function ReviewForm({ initialData, onSave, onCancel, onRetake, isEdit }: ReviewFormProps) {
  const [formData, setFormData] = useState<ExtractedData>(initialData);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleReanalyze = async () => {
    if (!formData.cardImageUrl) return;
    if (!navigator.onLine) {
      toast.error("You must be online to re-analyze from Drive.");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const { base64, mimeType } = await fetchImageBase64FromDrive(formData.cardImageUrl);
      const extracted = await analyzeBusinessCard(base64, mimeType);
      
      setFormData(prev => ({
        ...prev,
        name: extracted.name || prev.name,
        phone: extracted.phone || prev.phone,
        company: extracted.company || prev.company,
        title: extracted.title || prev.title,
        cardImageBase64: extracted.cardImageBase64,
        cardImageMimeType: extracted.cardImageMimeType,
      }));
      toast.success("Card re-analyzed successfully!");
    } catch (error) {
      console.error("Re-analyze error:", error);
      const msg = error instanceof Error ? error.message : "Failed to re-analyze card.";
      if (msg.includes("Unknown action")) {
        toast.error("Please update your Google Apps Script deployment to use this feature.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleCancelClick = () => {
    setShowConfirm(true);
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
            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{isEdit ? 'Edit Log' : 'Review Details'}</h2>
            <p className="text-slate-500 mt-1">{isEdit ? 'Update the information below.' : 'Please verify the extracted information.'}</p>
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
            value={formData.reason} 
            onChange={handleChange}
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all text-lg font-medium resize-none"
          />
        </div>

        {formData.cardImageBase64 ? (
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Scanned Card</label>
            <img 
              src={`data:${formData.cardImageMimeType || 'image/jpeg'};base64,${formData.cardImageBase64}`} 
              alt="Scanned Card" 
              className="w-full max-h-64 object-contain rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        ) : formData.cardImageUrl ? (
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Card Image</label>
            <div className="flex flex-wrap items-center gap-3">
              <a 
                href={formData.cardImageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-3 bg-slate-50 border border-slate-200 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50 hover:border-indigo-200 transition-all"
              >
                <ExternalLink className="w-5 h-5" />
                View Scanned Card
              </a>
              <button
                type="button"
                onClick={handleReanalyze}
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                {isAnalyzing ? 'Analyzing...' : 'Re-analyze Card'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="pt-6 flex flex-col sm:flex-row gap-4">
          <button 
            type="button"
            onClick={handleCancelClick}
            className="flex-1 px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all active:scale-95"
          >
            Discard
          </button>
          {onRetake && (
            <button 
              type="button"
              onClick={onRetake}
              className="flex-1 px-6 py-4 border-2 border-indigo-200 text-indigo-600 bg-indigo-50 rounded-2xl font-bold text-lg hover:bg-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Retake
            </button>
          )}
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
          <p className="text-slate-600 mb-6">Are you sure you want to discard this entry? All extracted data will be lost.</p>
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
