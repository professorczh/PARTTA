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
  };
  isLoading?: boolean;
  startTime?: number;
}

export const NodeMetadata: React.FC<NodeMetadataProps> = ({ metadata, isLoading, startTime }) => {
  const showMetadata = useTapStore(useShallow((state) => state.showMetadata));
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: number;
    if (isLoading && startTime) {
      interval = window.setInterval(() => {
        setElapsed((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, startTime]);

  if (!showMetadata) return null;
  if (!isLoading && !metadata) return null;

  const displayDuration = isLoading ? elapsed.toFixed(1) : metadata?.duration?.toFixed(1);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-black/20 backdrop-blur-sm border-t border-white/5 font-mono text-[9px] uppercase tracking-widest text-[var(--app-text-muted)]">
      {/* Timer / Duration */}
      <div className="flex items-center gap-1.5">
        <Clock size={10} className={cn("transition-colors", isLoading ? "text-emerald-400 animate-pulse" : "text-white/40")} />
        <span className={cn(isLoading ? "text-emerald-400" : "text-white/60")}>
          {isLoading ? `Generating... ${displayDuration}s` : `${displayDuration}s`}
        </span>
      </div>

      {/* Resolution */}
      {metadata?.resolution && !isLoading && (
        <>
          <div className="w-px h-2 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Maximize2 size={10} className="text-white/40" />
            <span className="text-white/60">{metadata.resolution}</span>
          </div>
        </>
      )}

      {/* Model */}
      {metadata?.modelName && !isLoading && (
        <>
          <div className="w-px h-2 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-white/40" />
            <span className="text-white/60 truncate max-w-[80px]">{metadata.modelName}</span>
          </div>
        </>
      )}
    </div>
  );
};
