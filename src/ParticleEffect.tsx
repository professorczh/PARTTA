import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ParticleEffectProps {
  position: { x: number; y: number };
  onComplete: () => void;
}

export const ParticleEffect = ({ position, onComplete }: ParticleEffectProps) => {
  React.useEffect(() => {
    const timer = setTimeout(onComplete, 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className="absolute pointer-events-none z-[200]"
      style={{ left: position.x, top: position.y }}
    >
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{ 
            x: (Math.random() - 0.5) * 200, 
            y: (Math.random() - 0.5) * 200,
            scale: 0,
            opacity: 0,
            rotate: Math.random() * 360
          }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn(
            "absolute w-2 h-2 rounded-sm",
            i % 2 === 0 ? "bg-[var(--brand-red)]" : "bg-white"
          )}
        />
      ))}
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
