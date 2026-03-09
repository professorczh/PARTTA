import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Cpu, Zap, Info, ShieldCheck, Monitor, BrainCircuit } from 'lucide-react';
import { useTapStore } from '../store';
import { cn } from '../lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { 
    isDemoMode, 
    setDemoMode, 
    isRecognitionMode, 
    setRecognitionMode 
  } = useTapStore();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl shadow-2xl overflow-hidden hud-border"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--app-border)] bg-white/5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Cpu size={18} className="text-white/60" />
                </div>
                <h2 className="font-display text-lg font-bold tracking-tight uppercase">Settings</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* AI Capabilities Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">
                  <BrainCircuit size={12} />
                  <span>AI Capabilities</span>
                </div>
                
                <div className="space-y-3">
                  <div 
                    onClick={() => setRecognitionMode(!isRecognitionMode)}
                    className={cn(
                      "group p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between",
                      isRecognitionMode 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                        isRecognitionMode ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
                      )}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold">Recognition Mode (SAM)</div>
                        <div className="text-[10px] text-[var(--app-text-muted)]">Auto-detect objects on click. High precision.</div>
                      </div>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative transition-all duration-300 border",
                      isRecognitionMode ? "bg-emerald-500/20 border-emerald-500/50" : "bg-white/5 border-white/10"
                    )}>
                      <motion.div 
                        animate={{ x: isRecognitionMode ? 20 : 2 }}
                        className={cn(
                          "absolute top-1 w-3 h-3 rounded-full shadow-sm",
                          isRecognitionMode ? "bg-emerald-400" : "bg-white/20"
                        )}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Runtime Environment Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">
                  <Monitor size={12} />
                  <span>Runtime Environment</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDemoMode(true)}
                    className={cn(
                      "p-4 rounded-xl border transition-all text-left space-y-2",
                      isDemoMode 
                        ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/30" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      isDemoMode ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-white/40"
                    )}>
                      <Info size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Demo Mode</div>
                      <div className="text-[9px] text-[var(--app-text-muted)] leading-tight">Simulated responses for testing.</div>
                    </div>
                  </button>

                  <button
                    onClick={() => setDemoMode(false)}
                    className={cn(
                      "p-4 rounded-xl border transition-all text-left space-y-2",
                      !isDemoMode 
                        ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/30" 
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      !isDemoMode ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
                    )}>
                      <ShieldCheck size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Real Mode</div>
                      <div className="text-[9px] text-[var(--app-text-muted)] leading-tight">Connect to Gemini 3 Pro API.</div>
                    </div>
                  </button>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 bg-white/5 border-t border-[var(--app-border)] flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition-all"
              >
                Apply Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
