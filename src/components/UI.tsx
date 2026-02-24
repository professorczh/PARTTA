import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { clsx } from 'clsx';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger'
}: ConfirmDialogProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  "p-2 rounded-lg",
                  variant === 'danger' ? "bg-red-500/20 text-red-400" :
                  variant === 'warning' ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-blue-500/20 text-blue-400"
                )}>
                  <AlertCircle size={20} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {message}
              </p>
            </div>
            <div className="flex items-center gap-2 p-4 bg-white/5 border-t border-white/5">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={clsx(
                  "flex-1 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white transition-all",
                  variant === 'danger' ? "bg-red-500 hover:bg-red-600" :
                  variant === 'warning' ? "bg-yellow-600 hover:bg-yellow-700" :
                  "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'success' | 'error' | 'info';
}

export const Toast = ({ message, isVisible, onClose, type = 'success' }: ToastProps) => {
  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 px-6 py-3 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl"
        >
          {type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-500" />
          ) : (
            <AlertCircle size={18} className="text-red-500" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-widest text-white">{message}</span>
          <button onClick={onClose} className="ml-2 p-1 hover:bg-white/5 rounded-full transition-colors">
            <X size={14} className="text-zinc-500" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
