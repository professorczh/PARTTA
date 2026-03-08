import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Type, Image as ImageIcon, Video } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MagneticPortProps {
  type: 'text' | 'image' | 'video' | 'prompt';
  id: string;
  isSource: boolean;
  status?: string;
  hasContent?: boolean;
  dragging?: boolean;
}

export const MagneticPort = ({ 
  type, 
  id: portId, 
  isSource, 
  status, 
  hasContent,
  dragging
}: MagneticPortProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 600, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 600, damping: 30 });

  const Icon = type === 'text' || type === 'prompt' ? Type : type === 'image' ? ImageIcon : Video;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) return; // Disable magnetic effect when dragging node
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
    
    // Magnetic range: 60px
    if (dist < 60) {
      mouseX.set((e.clientX - centerX) * 0.6);
      mouseY.set((e.clientY - centerY) * 0.6);
    } else {
      mouseX.set(0);
      mouseY.set(0);
    }
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div 
      className={cn(
        "relative group/port nodrag nopan w-16 h-16 flex items-center justify-center cursor-crosshair",
        dragging && "pointer-events-none"
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div 
        style={{ x: springX, y: springY }}
        className="relative w-10 h-10 z-20"
      >
        {/* Visual Icon - Higher z-index to stay on top of the line */}
        <div className={cn(
          "w-full h-full rounded-xl flex items-center justify-center border-2 transition-all duration-300 bg-black/40 backdrop-blur-sm pointer-events-none z-50",
          isSource ? (
            status === 'green' ? "border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]" :
            status === 'orange' ? "border-orange-500/50 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]" :
            "border-white/10 text-white/30 group-hover/port:text-white group-hover/port:border-white/30 group-hover/port:bg-white/5"
          ) : (
            hasContent ? "border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]" :
            "border-white/10 text-white/30 group-hover/port:text-white group-hover/port:border-white/30 group-hover/port:bg-white/5"
          )
        )}>
          <Icon size={18} />
        </div>

        {/* Interaction Handle - Centered exactly on the edge for perfect line alignment */}
        <Handle 
          type={isSource ? "source" : "target"} 
          position={isSource ? Position.Right : Position.Left} 
          id={portId}
          isConnectableStart={true}
          className="!bg-transparent !border-none !opacity-0 z-30 !cursor-crosshair pointer-events-auto" 
          style={{ 
            width: '100%',
            height: '100%',
            top: '50%',
            left: isSource ? '100%' : '0%',
            transform: 'translate(-50%, -50%)',
            position: 'absolute',
          }}
        />
      </motion.div>
    </div>
  );
};

interface MagneticInputProps {
  isTargetOfConnection?: boolean;
  dragging?: boolean;
}

export const MagneticInput = ({ isTargetOfConnection, dragging }: MagneticInputProps) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 600, damping: 30 });
  const springY = useSpring(mouseY, { stiffness: 600, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) return; // Disable magnetic effect when dragging node
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dist = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));
    
    if (dist < 60) {
      mouseX.set((e.clientX - centerX) * 0.6);
      mouseY.set((e.clientY - centerY) * 0.6);
    } else {
      mouseX.set(0);
      mouseY.set(0);
    }
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div 
      className={cn(
        "relative w-16 h-16 flex items-center justify-center z-50 nodrag nopan group/input cursor-crosshair",
        dragging && "pointer-events-none"
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div 
        style={{ x: springX, y: springY }}
        className="relative w-6 h-6"
      >
        {/* Visual Dot - Higher z-index to stay on top of the line */}
        <div className={cn(
          "w-full h-full rounded-full bg-black/40 border-2 transition-all duration-300 pointer-events-none z-50 backdrop-blur-sm",
          isTargetOfConnection 
            ? "border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-110" 
            : "border-white/20 group-hover/input:border-blue-400 group-hover/input:bg-blue-500/10"
        )} />
        <Handle 
          type="target" 
          position={Position.Left} 
          id="input-main"
          isConnectableStart={true}
          className="!bg-transparent !border-none !opacity-0 z-30 !cursor-crosshair pointer-events-auto" 
          style={{ 
            width: '100%',
            height: '100%',
            top: '50%',
            left: '0%',
            transform: 'translate(-50%, -50%)',
            position: 'absolute',
          }}
        />
      </motion.div>
    </div>
  );
};
