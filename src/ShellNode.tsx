import React from 'react';
import { NodeProps, useConnection } from '@xyflow/react';
import { useTapStore, TapNode } from './store';
import { Type, ImageIcon, Video, Box, Play, Loader2 } from 'lucide-react';
import { NodePromptInput } from './NodePromptInput';
import { EditableTitle } from './components/EditableTitle';
import { aiService } from './services/aiService';
import { resolvePrompt } from './utils/promptResolver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { MagneticInput } from './components/MagneticPorts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ShellNode = (props: NodeProps<TapNode>) => {
  const { id, data, selected, dragging } = props;
  const connection = useConnection();
  const isTargetOfConnection = connection.inProgress && connection.toNode?.id === id;
  
  const updateNode = useTapStore((state) => state.updateNode);
  const updateNodeData = useTapStore((state) => state.updateNodeData);
  const providers = useTapStore((state) => state.providers);
  const globalDefaults = useTapStore((state) => state.globalDefaults);
  const isDemoMode = useTapStore((state) => state.isDemoMode);
  
  const selectType = (mode: 'text' | 'image' | 'video') => {
    updateNodeData(id, { activeOutputMode: mode });
  };

  const handleRun = async () => {
    const nodes = useTapStore.getState().nodes;
    const activeOutputMode = data.activeOutputMode || 'text';
    
    const modelKey = data.config?.model || (globalDefaults[activeOutputMode as keyof typeof globalDefaults] as string);
    let currentModel = null;
    if (modelKey) {
      const [pId, mId] = modelKey.split(':');
      const p = providers.find(p => p.id === pId);
      const m = p?.models.find(m => m.id === mId);
      if (p && m) currentModel = { provider: p, model: m };
    }

    if (!currentModel) {
      alert("No model selected.");
      return;
    }

    updateNodeData(id, { isLoading: true });

    try {
      const { prompt: resolvedPrompt, images } = resolvePrompt(data.prompt, nodes, id);
      
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
      
      if (activeOutputMode === 'image') {
        newOutputs.image = response.imageUrl;
        newVersions.image++;
      } else if (activeOutputMode === 'video') {
        newOutputs.video = response.imageUrl;
        newVersions.video++;
      } else {
        newOutputs.text = response.text;
        newVersions.text++;
      }

      // Transform node type
      const finalType = activeOutputMode === 'text' ? 'text-node' : 
                        activeOutputMode === 'image' ? 'image-node' : 
                        'video-node';

      // Update node data and type
      const prefix = activeOutputMode === 'image' ? 'IMG' : activeOutputMode === 'video' ? 'VID' : 'TXT';
      const existingNumbers = nodes
        .map(n => {
          const sId = n.data.shortId || '';
          if (sId.startsWith(`${prefix}_`)) {
            const num = parseInt(sId.split('_')[1]);
            return isNaN(num) ? 0 : num;
          }
          return 0;
        });
      const maxNum = Math.max(0, ...existingNumbers);
      const newShortId = `${prefix}_${maxNum + 1}`;

      updateNode(id, { type: finalType });
      updateNodeData(id, { 
        isLoading: false, 
        outputs: newOutputs,
        outputVersions: newVersions,
        isLocked: true,
        // Update shortId to match new type
        shortId: newShortId
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      updateNodeData(id, { isLoading: false });
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        borderColor: selected ? (
          data.activeOutputMode === 'text' ? 'rgba(52, 211, 153, 0.5)' :
          data.activeOutputMode === 'image' ? 'rgba(96, 165, 250, 0.5)' :
          data.activeOutputMode === 'video' ? 'rgba(192, 132, 252, 0.5)' :
          'rgba(255, 255, 255, 0.3)'
        ) : 'rgba(255, 255, 255, 0.1)',
        boxShadow: selected ? [
          "0 0 0px rgba(0,0,0,0)",
          data.activeOutputMode === 'text' ? "0 0 20px rgba(52, 211, 153, 0.2)" :
          data.activeOutputMode === 'image' ? "0 0 20px rgba(96, 165, 250, 0.2)" :
          data.activeOutputMode === 'video' ? "0 0 20px rgba(192, 132, 252, 0.2)" :
          "0 0 20px rgba(255,255,255,0.1)",
          "0 0 0px rgba(0,0,0,0)"
        ] : "none"
      }}
      transition={{
        boxShadow: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        },
        borderColor: { duration: 0.3 }
      }}
      className={cn(
        "w-[360px] aspect-square glass-panel rounded-2xl transition-all duration-500 relative flex flex-col border-2",
        selected && "shadow-2xl z-50"
      )}
    >
      {/* Header */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <Box size={14} className="text-white/40" />
          <EditableTitle 
            value={data.label || 'Shell'} 
            onSave={(val) => updateNodeData(id, { label: val })} 
            className="text-white/40"
          />
        </div>
        <input 
          type="checkbox" 
          checked={data.includeTitleInOutput !== false}
          onChange={(e) => updateNodeData(id, { includeTitleInOutput: e.target.checked })}
          className="w-3 h-3 rounded border-white/20 bg-white/5 checked:bg-[var(--brand-red)] transition-all cursor-pointer"
          title="Include title in output"
        />
      </div>

      {/* Type Selection Buttons */}
      <div className="p-4 grid grid-cols-3 gap-2 border-b border-white/10">
        <button 
          onClick={() => selectType('text')}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all group border",
            data.activeOutputMode === 'text' ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-lg shadow-emerald-900/20" : "hover:bg-white/5 border-transparent text-white/40"
          )}
        >
          <Type size={20} className={cn("transition-colors", data.activeOutputMode === 'text' ? "text-emerald-400" : "group-hover:text-white/60")} />
          <span className="text-[8px] uppercase font-bold tracking-widest">Text</span>
        </button>
        <button 
          onClick={() => selectType('image')}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all group border",
            data.activeOutputMode === 'image' ? "bg-blue-500/20 text-blue-400 border-blue-500/30 shadow-lg shadow-blue-900/20" : "hover:bg-white/5 border-transparent text-white/40"
          )}
        >
          <ImageIcon size={20} className={cn("transition-colors", data.activeOutputMode === 'image' ? "text-blue-400" : "group-hover:text-white/60")} />
          <span className="text-[8px] uppercase font-bold tracking-widest">Image</span>
        </button>
        <button 
          onClick={() => selectType('video')}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all group border",
            data.activeOutputMode === 'video' ? "bg-purple-500/20 text-purple-400 border-purple-500/30 shadow-lg shadow-purple-900/20" : "hover:bg-white/5 border-transparent text-white/40"
          )}
        >
          <Video size={20} className={cn("transition-colors", data.activeOutputMode === 'video' ? "text-purple-400" : "group-hover:text-white/60")} />
          <span className="text-[8px] uppercase font-bold tracking-widest">Video</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={data.activeOutputMode}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-3"
          >
            {data.activeOutputMode === 'text' && <Type size={48} className="text-emerald-500/20" />}
            {data.activeOutputMode === 'image' && <ImageIcon size={48} className="text-blue-500/20" />}
            {data.activeOutputMode === 'video' && <Video size={48} className="text-purple-500/20" />}
            <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/20">
              Ready to generate {data.activeOutputMode || 'content'}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Built-in Input (Selected Only) */}
      <NodePromptInput node={props as unknown as TapNode} selected={!!selected} onRun={handleRun} />

      {/* Ports */}
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-50 pointer-events-auto">
        <MagneticInput isTargetOfConnection={isTargetOfConnection} dragging={dragging} />
      </div>
    </motion.div>
  );
};
