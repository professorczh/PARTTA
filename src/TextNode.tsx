import React, { useState, useEffect, memo, useMemo } from 'react';
import { NodeProps, useConnection } from '@xyflow/react';
import { useTapStore, TapNode } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Type, Eye, Edit3, Terminal, Check } from 'lucide-react';
import { NodePromptInput } from './NodePromptInput';
import { EditableTitle } from './components/EditableTitle';
import { resolvePrompt } from './utils/promptResolver';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MagneticPort, MagneticInput } from './components/MagneticPorts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ViewMode = 'edit' | 'prev' | 'raw';

export const TextNode = memo((props: NodeProps<TapNode>) => {
  const { id, data, selected, dragging } = props;
  const connection = useConnection();
  const isTargetOfConnection = connection.inProgress && connection.toNode?.id === id;
  
  const { updateNodeData, nodes } = useTapStore(useShallow((state) => ({
    updateNodeData: state.updateNodeData,
    nodes: state.nodes
  })));

  const viewMode = data.viewMode || 'edit';
  const setViewMode = (mode: ViewMode) => updateNodeData(id, { viewMode: mode });

  // Calculate the fully resolved output for this node
  const resolvedData = useMemo(() => {
    // 1. Resolve internal mentions and segments (recursive)
    const resolved = resolvePrompt(data.prompt || '', nodes, id);
    
    // 2. Wrap in title if needed
    if (data.includeTitleInOutput) {
      const titlePrefix = `${data.label || 'Text'}:\n`;
      return {
        ...resolved,
        fullRaw: titlePrefix + resolved.prompt,
        displaySegments: [
          { type: 'text' as const, content: titlePrefix },
          ...resolved.segments
        ]
      };
    }
    return {
      ...resolved,
      fullRaw: resolved.prompt,
      displaySegments: resolved.segments
    };
  }, [data.prompt, data.label, data.includeTitleInOutput, nodes, id]);

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}
      className={cn(
        "w-[360px] flex flex-col glass-panel rounded-2xl relative transition-all duration-300",
        selected && "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl shadow-red-900/20 scale-[1.02]"
      )}
    >
      {/* Header */}
      <div className="bg-[var(--app-panel)] px-4 py-2 flex items-center justify-between border-b border-[var(--app-border)] rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Type size={14} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2.5">
              <label className="relative flex items-center cursor-pointer group" title="Include title in output (Title:\nContent)">
                <input 
                  type="checkbox" 
                  checked={!!data.includeTitleInOutput}
                  onChange={(e) => updateNodeData(id, { includeTitleInOutput: e.target.checked })}
                  className="sr-only"
                />
                <div className={cn(
                  "w-3.5 h-3.5 rounded border transition-all flex items-center justify-center",
                  data.includeTitleInOutput 
                    ? "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                    : "bg-white/5 border-white/10 group-hover:border-white/30"
                )}>
                  {data.includeTitleInOutput && <Check size={10} className="text-white" strokeWidth={4} />}
                </div>
              </label>
              <EditableTitle 
                value={data.label || 'Text'} 
                onSave={(val) => updateNodeData(id, { label: val })} 
              />
            </div>
            <span className="text-[8px] font-mono text-[var(--app-text-muted)] ml-6">{data.shortId}</span>
          </div>
        </div>

        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
          <button
            onClick={() => setViewMode('edit')}
            className={cn(
              "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
              viewMode === 'edit' 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-white/30 hover:text-white/50"
            )}
          >
            <Edit3 size={10} />
            <span>Edit</span>
          </button>
          <button
            onClick={() => setViewMode('prev')}
            className={cn(
              "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
              viewMode === 'prev' 
                ? "bg-emerald-500/20 text-emerald-400 shadow-sm" 
                : "text-white/30 hover:text-white/50"
            )}
          >
            <Eye size={10} />
            <span>Prev</span>
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={cn(
              "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
              viewMode === 'raw' 
                ? "bg-blue-500/20 text-blue-400 shadow-sm" 
                : "text-white/30 hover:text-white/50"
            )}
          >
            <Terminal size={10} />
            <span>Raw</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 min-h-[120px] flex flex-col">
        <div className={cn(
          "nodrag flex-1 w-full rounded-xl p-3 border flex flex-col overflow-hidden transition-colors duration-200",
          viewMode === 'raw' ? "bg-blue-500/[0.03] border-blue-500/10" : "bg-white/[0.02] border-white/5"
        )}>
          {viewMode === 'edit' ? (
            <div className="flex-1 flex flex-col">
              {data.includeTitleInOutput && (
                <div className="text-white/30 font-mono text-sm mb-1 select-none">
                  {data.label || 'Text'}:
                </div>
              )}
              <textarea
                value={data.prompt}
                onChange={(e) => {
                  updateNodeData(id, { prompt: e.target.value });
                  // Lock the node type after first text entry
                  if (!data.isLocked && e.target.value.length > 0) {
                    updateNodeData(id, { isLocked: true });
                  }
                }}
                placeholder="Enter text..."
                className="w-full flex-1 bg-transparent border-none focus:outline-none text-sm font-mono text-white/90 resize-none min-h-[100px] leading-relaxed"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          ) : viewMode === 'prev' ? (
            <div className="flex-1 text-sm font-mono text-white/60 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text">
              {resolvedData.displaySegments.length > 0 ? (
                resolvedData.displaySegments.map((seg, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      seg.type === 'reference' && "text-white/40 underline decoration-white/20 underline-offset-4 decoration-dashed"
                    )}
                  >
                    {seg.content}
                  </span>
                ))
              ) : (
                <span className="opacity-30 italic">No content to preview</span>
              )}
            </div>
          ) : (
            <div className="flex-1 text-sm font-mono text-white/50 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text">
              {resolvedData.fullRaw || <span className="opacity-30 italic">No content to output</span>}
            </div>
          )}
        </div>
      </div>

      {/* Ports */}
      <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-50 pointer-events-auto">
        <MagneticPort 
          type="text" 
          id="output-text" 
          isSource={true} 
          status={data.outputs?.text ? 'green' : 'gray'}
          dragging={dragging}
        />
      </div>
      
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-50 pointer-events-auto">
        <MagneticInput isTargetOfConnection={isTargetOfConnection} dragging={dragging} />
      </div>

      {/* Floating Control Panel */}
      <NodePromptInput node={props as any} selected={selected} />
    </motion.div>
  );
});
