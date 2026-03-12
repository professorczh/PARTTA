import React, { useState, useEffect } from 'react';
import { useTapStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { Clock, Maximize2, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

interface NodeMetadataProps {
  metadata?: {
    duration?: number;
    resolution?: string;
    modelName?: string;
    startTime?: number;
  };
  isLoading?: boolean;
}

export const NodeMetadata: React.FC<NodeMetadataProps> = ({ metadata, isLoading }) => {
  const showMetadata = useTapStore(useShallow((state) => state.showMetadata));
  const [elapsed, setElapsed] = useState(0);
  const startTime = metadata?.startTime;

  useEffect(() => {
    let interval: number;
    if (isLoading && startTime) {
      const update = () => {
        const now = Date.now();
        setElapsed(Math.max(0, (now - startTime) / 1000));
      };
      update();
      interval = window.setInterval(update, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading, startTime]);

  if (!showMetadata) return null;
  
  // Determine what to show
  const modelName = metadata?.modelName;
  const resolution = metadata?.resolution;
  const duration = metadata?.duration;

  // If we have nothing to show, return null
  if (!isLoading && !modelName && !resolution && !duration) return null;

  const displayValue = isLoading ? elapsed : duration;
  const isLongDuration = displayValue !== undefined && displayValue >= 100;
  const formattedDuration = displayValue !== undefined 
    ? (isLongDuration ? Math.floor(displayValue).toString() : displayValue.toFixed(1))
    : '';

  return (
    <div className="flex items-center justify-end gap-3 px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 font-mono text-[9px] uppercase tracking-widest text-white/60 shadow-sm z-30">
      {/* Model Name */}
      {modelName && (
        <div className="flex items-center gap-1.5">
          <Cpu size={10} className="text-white/40" />
          <span className="truncate max-w-[120px]">{modelName}</span>
        </div>
      )}

      {/* Resolution */}
      {resolution && (
        <div className="flex items-center gap-3">
          {modelName && <div className="w-px h-2 bg-white/10" />}
          <div className="flex items-center gap-1.5">
            <Maximize2 size={10} className="text-white/40" />
            <span className="text-white/60">{resolution}</span>
          </div>
        </div>
      )}

      {/* Timer / Duration */}
      {(isLoading || duration !== undefined) && (
        <div className="flex items-center gap-3">
          {(modelName || resolution) && <div className="w-px h-2 bg-white/10" />}
          <div className={cn(
            "flex items-center gap-1.5 min-w-[48px] justify-end transition-colors duration-300",
            isLoading ? "text-red-500 animate-pulse" : "text-emerald-400"
          )}>
            <Clock size={10} className={cn(isLoading ? "text-red-500" : "text-emerald-400/60")} />
            <span className="tabular-nums font-bold">
              {formattedDuration}s
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
