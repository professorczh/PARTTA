import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTapStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Command, ChevronRight, ChevronLeft, GripVertical, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

export const MobileModifierPanel = () => {
  const { 
    isCtrlPressed, setCtrlPressed, 
    isShiftPressed, setShiftPressed, 
    isAltPressed, setAltPressed 
  } = useTapStore(useShallow((state) => ({
    isCtrlPressed: state.isCtrlPressed,
    setCtrlPressed: state.setCtrlPressed,
    isShiftPressed: state.isShiftPressed,
    setShiftPressed: state.setShiftPressed,
    isAltPressed: state.isAltPressed,
    setAltPressed: state.setAltPressed,
  })));

  const [isExpanded, setIsExpanded] = useState(false);
  const [positionY, setPositionY] = useState(200); // Initial Y position
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Auto-collapse logic
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent) => {
      // If any modifier is active, don't auto-collapse
      if (isCtrlPressed || isShiftPressed || isAltPressed) return;

      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, isCtrlPressed, isShiftPressed, isAltPressed]);

  // Dragging logic
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newY = Math.max(80, Math.min(window.innerHeight - 200, e.clientY));
      setPositionY(newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const hasActiveModifier = isCtrlPressed || isShiftPressed || isAltPressed;

  return (
    <div 
      ref={panelRef}
      className="fixed left-0 z-[1000] flex items-center pointer-events-none"
      style={{ top: positionY }}
    >
      {/* Trigger Button / Drag Handle */}
      <div className="flex items-center pointer-events-auto">
        <div 
          ref={dragRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "w-10 h-16 bg-black/60 backdrop-blur-xl border border-white/10 rounded-r-2xl flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing transition-all",
            isDragging && "scale-110 bg-black/80 border-white/30",
            hasActiveModifier && "border-[var(--brand-red)]/50"
          )}
        >
          <GripVertical size={14} className="text-white/20" />
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all",
              isExpanded ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
            )}
          >
            {isExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        {/* Expanded Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ x: -20, opacity: 0, scale: 0.95 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: -20, opacity: 0, scale: 0.95 }}
              className="ml-2 p-1.5 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-1.5"
            >
              <ModifierButton 
                label="CTRL" 
                active={isCtrlPressed} 
                onClick={() => setCtrlPressed(!isCtrlPressed)} 
                color="blue"
                description="PIN Mode"
              />
              <ModifierButton 
                label="SHIFT" 
                active={isShiftPressed} 
                onClick={() => setShiftPressed(!isShiftPressed)} 
                color="emerald"
                description="Multi-Select"
              />
              <ModifierButton 
                label="ALT" 
                active={isAltPressed} 
                onClick={() => setAltPressed(!isAltPressed)} 
                color="red"
                description="Clone Node"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ModifierButton = ({ label, active, onClick, color, description }: { 
  label: string, 
  active: boolean, 
  onClick: () => void,
  color: 'blue' | 'emerald' | 'red',
  description: string
}) => {
  const colorClasses = {
    blue: active ? "bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-blue-400/40 hover:text-blue-400 hover:bg-blue-500/10",
    emerald: active ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "text-emerald-400/40 hover:text-emerald-400 hover:bg-emerald-500/10",
    red: active ? "bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "text-red-400/40 hover:text-red-400 hover:bg-red-500/10",
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "w-20 h-12 rounded-xl flex flex-col items-center justify-center transition-all border border-transparent",
        colorClasses[color],
        active ? "border-white/20" : "border-white/5"
      )}
    >
      <span className="text-[10px] font-bold tracking-tighter">{label}</span>
      <span className={cn(
        "text-[7px] uppercase tracking-widest font-medium opacity-60",
        active ? "text-white" : ""
      )}>{description}</span>
    </button>
  );
};
