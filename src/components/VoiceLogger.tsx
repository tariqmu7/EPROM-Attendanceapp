import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { transcribeAndExtract, ExtractedData } from '../services/gemini';
import { motion } from 'motion/react';

interface VoiceLoggerProps {
  onExtracted: (data: ExtractedData) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 'name', label: 'Name', prompt: "What is your Name?" },
  { id: 'phone', label: 'Phone', prompt: "What is your Phone number?" },
  { id: 'company', label: 'Company', prompt: "What is your Company?" },
  { id: 'title', label: 'Title', prompt: "What is your Title?" },
  { id: 'reason', label: 'Reason', prompt: "What is your Reason for meeting?" }
];

export default function VoiceLogger({ onExtracted, onCancel }: VoiceLoggerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [noiseThreshold, setNoiseThreshold] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [statusText, setStatusText] = useState("Waiting for prompt to finish...");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedAudioRef = useRef<{ base64: string, mimeType: string }[]>([]);

  // Silence detection & noise gate refs
  const isRecordingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSpokenTimeRef = useRef<number>(0);
  const hasSpokenRef = useRef<boolean>(false);
  const noiseFloorRef = useRef<number>(10);
  const calibrationSamplesRef = useRef<number[]>([]);
  
  const startRecordingRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playAudioFeedback = (type: 'start' | 'stop') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === 'start') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.error("Audio feedback failed", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      isRecordingRef.current = false;
      setVolumeLevel(0);
      setIsSpeaking(false);
      setStatusText("Processing step...");
      playAudioFeedback('stop');

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          const base64String = base64data.split(',')[1];
          
          recordedAudioRef.current.push({
            base64: base64String,
            mimeType: audioBlob.type || 'audio/webm'
          });

          if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
          } else {
            await processAllAudio();
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      setStatusText("Listening... Speak now");
      setError(null);
      playAudioFeedback('start');

      // Set up silence detection & noise gate
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        hasSpokenRef.current = false;
        lastSpokenTimeRef.current = Date.now();
        calibrationSamplesRef.current = [];

        const checkAudioLevel = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length;
          
          // Update visualizer state (scale 0-100)
          const currentVolume = Math.min(100, (average / 128) * 100);
          setVolumeLevel(currentVolume);

          // Calibrate noise floor for the first 500ms
          if (Date.now() - lastSpokenTimeRef.current < 500 && !hasSpokenRef.current) {
             calibrationSamplesRef.current.push(average);
             const avgNoise = calibrationSamplesRef.current.reduce((a,b) => a+b, 0) / calibrationSamplesRef.current.length;
             noiseFloorRef.current = Math.max(10, avgNoise + 5); 
          }

          // Speech detection threshold (dynamic based on noise floor)
          const threshold = Math.max(15, noiseFloorRef.current + 10);
          setNoiseThreshold(Math.min(100, (threshold / 128) * 100));

          const currentlySpeaking = average > threshold;
          setIsSpeaking(currentlySpeaking);

          if (currentlySpeaking) { 
            if (!hasSpokenRef.current) {
              setStatusText("Recording your response...");
            }
            hasSpokenRef.current = true;
            lastSpokenTimeRef.current = Date.now();
          } else {
            if (hasSpokenRef.current && Date.now() - lastSpokenTimeRef.current > 1500) {
              // 1.5 seconds of silence after speaking
              stopRecording();
              return;
            }
          }
          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
      }

    } catch (err) {
      setError("Microphone access denied or unavailable.");
      console.error(err);
    }
  };

  const processAllAudio = async () => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setStatusText("Extracting information...");
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const extracted = await transcribeAndExtract(recordedAudioRef.current);
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setTimeout(() => onExtracted(extracted), 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error("Audio processing error:", err);
      
      let errorMessage = "Failed to process audio. Please try again.";
      
      if (err instanceof SyntaxError) {
        errorMessage = "We couldn't extract the details clearly. Please try speaking more clearly.";
      } else if (err?.message) {
        const msg = err.message.toLowerCase();
        if (msg.includes("quota") || msg.includes("429")) {
          errorMessage = "The AI service is currently busy or out of quota. Please try again later.";
        } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
          errorMessage = "Network error. Please check your internet connection and try again.";
        } else if (msg.includes("no response")) {
          errorMessage = "The AI didn't return any data. Please try recording again.";
        } else {
          errorMessage = `Processing failed: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setIsProcessing(false);
      setStatusText("Error occurred");
    }
  };

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  useEffect(() => {
    if (currentStepIndex >= STEPS.length) return;

    setStatusText("Waiting for prompt to finish...");
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(STEPS[currentStepIndex].prompt);
    msg.rate = 0.9;
    
    msg.onend = () => {
      if (!isRecordingRef.current) {
        startRecordingRef.current();
      }
    };

    window.speechSynthesis.speak(msg);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [currentStepIndex]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full mx-auto text-center"
    >
      <h2 className="text-2xl font-semibold mb-6 text-slate-800">Voice Attendance</h2>
      <div className="text-slate-600 mb-8 space-y-4">
        <p className="font-medium text-lg text-indigo-600 h-8 flex items-center justify-center">
          {currentStepIndex < STEPS.length ? STEPS[currentStepIndex].prompt : "Processing..."}
        </p>
        <div className="flex flex-wrap justify-center items-center gap-2 text-sm font-medium text-slate-700">
          {STEPS.map((step, idx) => (
            <React.Fragment key={step.id}>
              <span className={idx === currentStepIndex ? "text-indigo-600 font-bold" : (idx < currentStepIndex ? "text-emerald-600" : "text-slate-400")}>
                {step.label}
              </span>
              {idx < STEPS.length - 1 && <span className="text-slate-300">&rarr;</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-center mb-8 min-h-[240px] items-center">
        {isProcessing ? (
          <div className="flex flex-col items-center w-full">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-700 font-medium mb-4">{statusText}</p>
            <div className="w-full max-w-xs mx-auto">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${processingProgress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2 text-right">{Math.round(processingProgress)}%</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="relative flex items-center justify-center">
              {isRecording && (
                <motion.div
                  className={`absolute inset-0 rounded-full blur-xl transition-colors duration-300 ${isSpeaking ? 'bg-indigo-500/30' : 'bg-slate-400/20'}`}
                  animate={{
                    scale: 1 + (volumeLevel / 100) * 1.5,
                    opacity: 0.3 + (volumeLevel / 100) * 0.7,
                  }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 shadow-sm ${
                  isRecording 
                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                    : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                }`}
              >
                {isRecording ? <Square className="w-8 h-8" fill="currentColor" /> : <Mic className="w-10 h-10" />}
              </button>
            </div>
            
            <div className="flex flex-col items-center justify-center w-full">
              <p className="text-sm font-medium text-slate-700 mb-4">
                {statusText}
              </p>
              
              {isRecording && (
                <div className="flex flex-col items-center w-full">
                  <div className="relative flex items-end justify-center gap-1 h-16 w-full max-w-[200px] bg-slate-50 rounded-xl p-2 border border-slate-200 overflow-hidden">
                    {/* Noise Gate Threshold Line */}
                    <motion.div 
                      className="absolute left-0 right-0 border-t border-dashed border-red-300 z-0"
                      animate={{ bottom: `${Math.min(90, noiseThreshold)}%` }}
                      transition={{ type: 'spring', bounce: 0 }}
                    />
                    <motion.span 
                      className="absolute left-2 text-[9px] text-red-400 font-bold tracking-wider uppercase z-0" 
                      animate={{ bottom: `calc(${Math.min(90, noiseThreshold)}% + 2px)` }}
                    >
                      Gate
                    </motion.span>
                    
                    {[...Array(15)].map((_, i) => {
                      const centerDiff = Math.abs(i - 7);
                      const scale = 1 - (centerDiff * 0.08);
                      return (
                        <motion.div
                          key={i}
                          className={`w-1.5 rounded-full z-10 transition-colors duration-200 ${isSpeaking ? 'bg-indigo-500' : 'bg-slate-300'}`}
                          animate={{
                            height: Math.max(4, (volumeLevel / 100) * 48 * scale * (Math.random() * 0.4 + 0.6)) + 'px'
                          }}
                          transition={{ type: 'spring', bounce: 0, duration: 0.05 }}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-3 text-xs font-semibold uppercase tracking-wider h-4">
                    {isSpeaking ? (
                      <motion.span 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                        className="text-indigo-600 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Speech Detected
                      </motion.span>
                    ) : (
                      <motion.span 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
                        className="text-slate-400 flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        Gating Noise
                      </motion.span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
