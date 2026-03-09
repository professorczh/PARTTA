import React, { memo } from 'react';
import { NodeProps, useConnection } from '@xyflow/react';
import { useTapStore, TapNode } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Video, Play, Loader2 } from 'lucide-react';
import { NodePromptInput } from './NodePromptInput';
import { EditableTitle } from './components/EditableTitle';
import { aiService } from './services/aiService';
import { resolvePrompt } from './utils/promptResolver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion } from 'motion/react';
import { MagneticPort, MagneticInput } from './components/MagneticPorts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const VideoNode = memo((props: NodeProps<TapNode>) => {
  const { id, data, selected, dragging } = props;
  const connection = useConnection();
  const isTargetOfConnection = connection.inProgress && connection.toNode?.id === id;
  
  const { updateNodeData, providers, globalDefaults, isDemoMode, edges } = useTapStore(useShallow((state) => ({
    updateNodeData: state.updateNodeData,
    providers: state.providers,
    globalDefaults: state.globalDefaults,
    isDemoMode: state.isDemoMode,
    edges: state.edges
  })));

  const handleRun = async () => {
    const nodes = useTapStore.getState().nodes;
    const edges = useTapStore.getState().edges;
    const activeOutputMode = data.activeOutputMode || 'video';
    
    const modelKey = data.config?.model || (globalDefaults[activeOutputMode as keyof typeof globalDefaults] as string);
    let currentModel = null;
    if (modelKey) {
      const [pId, mId] = modelKey.split(':');
      const p = providers.find(p => p.id === pId);
      const m = p?.models.find(m => m.id === mId);
      if (p && m && p.enabled && m.enabled) currentModel = { provider: p, model: m };
    }

    if (!currentModel) {
      alert("No model selected.");
      return;
    }

    updateNodeData(id, { isLoading: true });

    try {
      const { prompt: resolvedPrompt, images } = resolvePrompt(data.prompt, nodes, edges, id);
      
      const response = await aiService.generate({
        prompt: resolvedPrompt,
        images,
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode
      });

      if (response.error) {
        alert(`Error: ${response.error}`);
        updateNodeData(id, { isLoading: false });
        return;
      }

      const newOutputs = { ...(data.outputs || {}) };
      const newVersions = { ...(data.outputVersions || { text: 0, image: 0, video: 0, prompt: 0 }) };
      
      newOutputs.video = response.imageUrl; // Mock video
      newVersions.video++;

      updateNodeData(id, { 
        isLoading: false, 
        outputs: newOutputs,
        outputVersions: newVersions
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      updateNodeData(id, { isLoading: false });
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}
      className="relative w-[360px] aspect-square group"
    >
      {/* Node Body */}
      <div className={cn(
        "w-full h-full flex flex-col glass-panel rounded-2xl relative z-10 transition-all duration-300",
        selected && "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl",
        data.isCloning && "border-dashed border-2 border-[var(--brand-red)]/60"
      )}>
      {/* Header */}
      <div className="bg-[var(--app-panel)] px-4 py-2 flex items-center justify-between border-b border-[var(--app-border)] rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
            <Video size={14} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <EditableTitle 
                value={data.label || 'Video'} 
                onSave={(val) => updateNodeData(id, { label: val })} 
              />
              <input 
                type="checkbox" 
                checked={data.includeTitleInOutput !== false}
                onChange={(e) => updateNodeData(id, { includeTitleInOutput: e.target.checked })}
                className="w-3 h-3 rounded border-white/20 bg-white/5 checked:bg-[var(--brand-red)] transition-all cursor-pointer"
                title="Include title in output"
              />
            </div>
            <span className="text-[8px] font-mono text-[var(--app-text-muted)]">{data.shortId}</span>
          </div>
        </div>
        <button 
          onClick={handleRun}
          disabled={data.isLoading}
          className="p-1.5 hover:bg-[var(--brand-red)] rounded-lg transition-all group disabled:opacity-50"
        >
          {data.isLoading ? (
            <Loader2 size={12} className="animate-spin text-[var(--brand-red)]" />
          ) : (
            <Play size={12} className="group-hover:fill-white" fill="currentColor" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="aspect-square bg-black rounded-xl flex items-center justify-center border border-white/5">
          <Video size={48} className="text-white/10" />
        </div>
      </div>
    </div>

      {/* Built-in Input (Selected Only) */}
      <NodePromptInput node={props as unknown as TapNode} selected={!!selected} onRun={handleRun} />

      {/* Ports */}
      <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-50 pointer-events-auto">
        <MagneticPort 
          type="video" 
          id="output-video" 
          isSource={true} 
          status={data.outputs?.video ? 'green' : 'gray'}
          dragging={dragging}
        />
      </div>
      
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-50 pointer-events-auto">
        <MagneticInput isTargetOfConnection={isTargetOfConnection} dragging={dragging} />
      </div>
    </motion.div>
  );
});
