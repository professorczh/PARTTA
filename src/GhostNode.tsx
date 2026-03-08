import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Zap } from 'lucide-react';

interface GhostNodeProps {
  position: { x: number; y: number };
  onMerge: () => void;
}

export const GhostNode = ({ position, onMerge }: GhostNodeProps) => {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      className="absolute z-[100] pointer-events-auto"
      style={{ 
        left: position.x, 
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <div className="w-32 h-32 rounded-3xl border-2 border-dashed border-white/20 bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center gap-3 group hover:border-[var(--brand-red)]/50 transition-all">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-[var(--brand-red)]/20 transition-all">
          <Sparkles size={24} className="text-white/20 group-hover:text-[var(--brand-red)] animate-pulse" />
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onMerge();
          }}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-[10px] font-bold uppercase tracking-widest text-white/40 group-hover:bg-[var(--brand-red)] group-hover:text-white transition-all flex items-center gap-2"
        >
          <Zap size={10} />
          Merge
        </button>

        {/* Decorative particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(4)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.2, 0.5, 0.2],
                rotate: [0, 90, 0]
              }}
              transition={{ 
                duration: 2 + i, 
                repeat: Infinity,
                ease: "easeInOut" 
              }}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                top: `${20 + i * 20}%`,
                left: `${20 + (i % 2) * 60}%`
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};
