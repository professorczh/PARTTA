import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Eraser, Paintbrush, Scissors } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave: (maskBase64: string) => void;
}

export const MaskModal = ({ isOpen, onClose, imageUrl, onSave }: MaskModalProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = mode === 'draw' ? 'source-over' : 'destination-out';
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSave = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-12">
      <div className="w-full h-full max-w-7xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl border-[var(--brand-red)]/30">
        {/* Header */}
        <div className="p-6 border-b border-[var(--app-border)] flex items-center justify-between bg-[var(--app-panel)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--brand-red)] rounded-lg">
              <Scissors size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-display text-xl uppercase tracking-widest font-bold">Mask Editor</h2>
              <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-widest font-mono">Paint the area you want to modify</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[var(--app-border)] rounded-full transition-all hover:rotate-90">
            <X size={24} />
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-[#050505] flex items-center justify-center overflow-hidden">
          <div className="relative w-full h-full flex items-center justify-center p-8">
            <div className="relative shadow-2xl shadow-black/50">
              <img 
                src={imageUrl} 
                alt="To Mask" 
                className="max-w-full max-h-[70vh] object-contain pointer-events-none rounded-lg"
                referrerPolicy="no-referrer"
              />
              <canvas
                ref={canvasRef}
                width={1920}
                height={1080}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-6 border-t border-[var(--app-border)] flex items-center justify-between bg-[var(--app-panel)]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-display uppercase tracking-widest text-[var(--app-text-muted)]">Tools</span>
              <div className="flex items-center gap-1 bg-[var(--app-bg)] p-1 rounded-xl border border-[var(--app-border)]">
                <button 
                  onClick={() => setMode('draw')}
                  className={cn("px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider", mode === 'draw' ? "bg-[var(--brand-red)] text-white shadow-lg shadow-red-900/40" : "text-[var(--app-text-muted)] hover:text-white")}
                >
                  <Paintbrush size={16} /> Brush
                </button>
                <button 
                  onClick={() => setMode('erase')}
                  className={cn("px-4 py-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider", mode === 'erase' ? "bg-[var(--brand-red)] text-white shadow-lg shadow-red-900/40" : "text-[var(--app-text-muted)] hover:text-white")}
                >
                  <Eraser size={16} /> Eraser
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-display uppercase tracking-widest text-[var(--app-text-muted)]">Brush Size</span>
                <span className="text-[10px] font-mono text-[var(--brand-red)]">{brushSize}px</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="150" 
                value={brushSize} 
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-48 h-1.5 bg-[var(--app-border)] rounded-lg appearance-none cursor-pointer accent-[var(--brand-red)]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-[var(--app-border)] text-[var(--app-text-muted)] font-bold uppercase tracking-widest hover:bg-[var(--app-border)] hover:text-white transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-[var(--brand-red)] text-white font-bold uppercase tracking-widest hud-border hover:scale-105 transition-all"
            >
              <Check size={20} /> Save Mask
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
