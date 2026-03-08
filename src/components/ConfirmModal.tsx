import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (dontShowAgain: boolean) => void;
  onCancel: () => void;
}

export const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: ConfirmModalProps) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-[var(--app-panel)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden hud-border z-10"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                <AlertCircle size={20} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h3>
            </div>
            
            <p className="text-xs text-white/80 leading-relaxed mb-6">
              {message}
            </p>

            <div 
              className="flex items-center gap-2 mb-6 cursor-pointer group w-fit" 
              onClick={() => setDontShowAgain(!dontShowAgain)}
            >
              <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${dontShowAgain ? 'bg-[var(--brand-red)] border-[var(--brand-red)]' : 'border-white/20 group-hover:border-white/40'}`}>
                {dontShowAgain && <Check size={10} className="text-white" />}
              </div>
              <span className="text-[10px] text-white/60 uppercase font-bold tracking-wider group-hover:text-white/80 transition-colors">不再提示</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs font-bold uppercase tracking-widest text-white/80"
              >
                取消
              </button>
              <button
                onClick={() => onConfirm(dontShowAgain)}
                className="flex-1 px-4 py-3 rounded-xl bg-[var(--brand-red)] text-white hover:opacity-90 transition-all text-xs font-bold uppercase tracking-widest hud-border shadow-lg shadow-red-900/20"
              >
                确认删除
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
