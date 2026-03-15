import React, { useState } from 'react';
import { Camera, Upload, Loader2 } from 'lucide-react';
import { analyzeBusinessCard, ExtractedData } from '../services/gemini';
import { motion } from 'motion/react';

interface CardScannerProps {
  onExtracted: (data: ExtractedData) => void;
  onCancel: () => void;
}

export default function CardScanner({ onExtracted, onCancel }: CardScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64String = base64data.split(',')[1];
        
        const extracted = await analyzeBusinessCard(base64String, file.type);
        onExtracted(extracted);
      };
    } catch (err) {
      setError("Failed to analyze image. Please try again.");
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-auto text-center"
    >
      <h2 className="text-2xl font-semibold mb-6 text-slate-800">Scan Business Card</h2>
      <p className="text-slate-600 mb-8">
        Upload a photo of a business card to automatically extract details.
      </p>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-center mb-8">
        {isProcessing ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Analyzing card...</p>
          </div>
        ) : (
          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-xl hover:bg-slate-50 hover:border-indigo-400 transition-colors">
            <Camera className="w-12 h-12 text-slate-400 mb-4" />
            <span className="text-slate-600 font-medium">Tap to upload or take photo</span>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        )}
      </div>

      {!isProcessing && (
        <button 
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-700 font-medium transition-colors"
        >
          Cancel
        </button>
      )}
    </motion.div>
  );
}
