import React, { useState, useEffect, memo, useMemo } from 'react';
import { NodeProps, useConnection } from '@xyflow/react';
import { useTapStore, TapNode } from './store';
import { useShallow } from 'zustand/react/shallow';
import { Type, Eye, Edit3, Terminal, Check, X, Loader2 } from 'lucide-react';
import { NodePromptInput } from './NodePromptInput';
import { NodeMetadata } from './components/NodeMetadata';
import { EditableTitle } from './components/EditableTitle';
import { resolvePrompt } from './utils/promptResolver';
import { aiService } from './services/aiService';
import { MentionEditor } from './components/MentionEditor';
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
  const [isPromptActive, setIsPromptActive] = useState(false);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  
  const { updateNodeData, nodes, onConnect, edges, setEdges, skipDeleteConfirm, providers, globalDefaults, isDemoMode } = useTapStore(useShallow((state) => ({
    updateNodeData: state.updateNodeData,
    nodes: state.nodes,
    onConnect: state.onConnect,
    edges: state.edges,
    setEdges: state.setEdges,
    skipDeleteConfirm: state.skipDeleteConfirm,
    providers: state.providers,
    globalDefaults: state.globalDefaults,
    isDemoMode: state.isDemoMode
  })));

  const viewMode = data.viewMode || 'edit';
  const setViewMode = (mode: ViewMode) => updateNodeData(id, { viewMode: mode });

  const isGenerated = !!data.isGenerated;

  // Calculate the fully resolved output for this node
  const resolvedData = useMemo(() => {
    // If generated, output is just the text
    if (isGenerated && data.outputs?.text) {
      let finalValue = data.outputs.text;
      if (data.includeTitleInOutput) {
        finalValue = `\n${data.label || 'Text'}:\n${finalValue}\n`;
      }
      return {
        prompt: data.outputs.text,
        segments: [{ type: 'text' as const, content: data.outputs.text }],
        images: [],
        referencedNodeIds: [],
        fullRaw: finalValue,
        displaySegments: [{ type: 'text' as const, content: finalValue }]
      };
    }

    // 1. Resolve internal mentions and segments (recursive)
    const resolved = resolvePrompt(data.prompt || '', nodes, edges, id);
    
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
  }, [data.prompt, data.label, data.includeTitleInOutput, nodes, edges, id, isGenerated, data.outputs?.text]);

  const contextSummary = useMemo(() => {
    const textCount = resolvedData.segments.filter(s => s.type === 'reference').length;
    const imageCount = resolvedData.images.length;
    if (textCount === 0 && imageCount === 0) return "No context referenced.";
    return `Context ready: ${textCount} text${textCount !== 1 ? 's' : ''}, ${imageCount} image${imageCount !== 1 ? 's' : ''}. Waiting for instructions...`;
  }, [resolvedData]);

  // Filter nodes for mentions (passed to editor)
  const mentionCandidates = useMemo(() => {
    return nodes.filter(n => n.id !== id);
  }, [nodes, id]);

  const handleEditorChange = (newPrompt: string) => {
    // Detect changes before updating state
    const mentionRegex = /\[@ .*? \((.*?)\)\]/g;
    const oldMatches = [...(data.prompt || '').matchAll(mentionRegex)];
    const newMatches = [...newPrompt.matchAll(mentionRegex)];
    
    const oldMentionIds = oldMatches.map(m => nodes.find(n => n.data.shortId === m[1])?.id).filter(Boolean) as string[];
    const newMentionIds = newMatches.map(m => nodes.find(n => n.data.shortId === m[1])?.id).filter(Boolean) as string[];

    // Update state first
    updateNodeData(id, { prompt: newPrompt });

    // Detect additions
    newMentionIds.forEach(sourceId => {
      if (!oldMentionIds.includes(sourceId)) {
        // Check if edge already exists
        const edgeExists = edges.some(e => e.source === sourceId && e.target === id);
        if (!edgeExists) {
          onConnect({
            source: sourceId,
            target: id,
            sourceHandle: null,
            targetHandle: 'input-main'
          });
        }
      }
    });

    // Detect deletions
    oldMentionIds.forEach(sourceId => {
      if (!newMentionIds.includes(sourceId)) {
        // For simplicity in the node body, we just delete the edge if skipDeleteConfirm is true
        // or if we don't want to handle the modal here (it's already handled in NodePromptInput)
        if (skipDeleteConfirm) {
          setEdges(edges.filter(e => !(e.source === sourceId && e.target === id)));
        }
      }
    });
  };

  const handleScopedSelectAll = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      e.stopPropagation();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(e.currentTarget);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  };

  const handleRun = async () => {
    const activeOutputMode = data.activeOutputMode || 'text';
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

    const runStartTime = Date.now();
    setStartTime(runStartTime);
    updateNodeData(id, { isLoading: true });

    try {
      const { prompt: resolvedPrompt, images } = resolvePrompt(data.prompt || '', nodes, edges, id);
      
      const response = await aiService.generate({
        prompt: resolvedPrompt,
        images,
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode,
        thinkingLevel: data.config?.thinkingLevel === 'off' ? undefined : data.config?.thinkingLevel,
        thoughtSignature: data.thoughtSignature
      });

      const duration = (Date.now() - runStartTime) / 1000;

      if (response.error) {
        alert(`Error: ${response.error}`);
        updateNodeData(id, { isLoading: false });
        setStartTime(undefined);
        return;
      }

      const newOutputs = { ...(data.outputs || {}) };
      const newVersions = { ...(data.outputVersions || { text: 0, image: 0, video: 0, prompt: 0 }) };
      
      newOutputs.text = response.text;
      newVersions.text++;

      updateNodeData(id, { 
        isLoading: false, 
        isGenerated: true,
        outputs: newOutputs,
        outputVersions: newVersions,
        thoughtSignature: response.thoughtSignature,
        metadata: {
          ...data.metadata,
          duration,
          modelName: currentModel.model.name
        }
      });
      setStartTime(undefined);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      updateNodeData(id, { isLoading: false });
      setStartTime(undefined);
    }
  };

  return (
    <motion.div 
      initial={data.isDraggedClone ? false : { scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}
      className="relative w-[360px] group"
    >
      {/* Node Body (Header + Content) */}
      <div className={cn(
        "flex flex-col glass-panel rounded-2xl relative z-10 transition-all duration-300 overflow-hidden",
        selected ? "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl shadow-red-900/20 scale-[1.02] bg-[#1a1a1a]" : "bg-[var(--app-panel)]",
        data.isCloning && "border-dashed border-2 border-[var(--brand-red)]/60"
      )}>
        {/* Header */}
        <div className="bg-[var(--app-panel)] px-4 py-2 flex items-center justify-between border-b border-[var(--app-border)] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              isGenerated ? "bg-blue-500/20 text-blue-400" : "bg-emerald-500/20 text-emerald-400"
            )}>
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

          <div className="flex items-center gap-2">
            {isGenerated ? (
              <div className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-bold uppercase tracking-wider border border-blue-500/20">
                Result
              </div>
            ) : isPromptActive ? (
              <div className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-[9px] font-bold uppercase tracking-wider border border-purple-500/20">
                Prompting
              </div>
            ) : (
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
            )}
          </div>
        </div>

      {/* Content */}
      <div className="p-3 flex flex-col h-[344px]">
        <div className={cn(
          "nodrag nowheel w-full h-full rounded-xl p-3 border flex flex-col overflow-hidden transition-all duration-300 relative",
          isGenerated ? "bg-blue-500/[0.03] border-blue-500/20" :
          isPromptActive ? "bg-purple-500/[0.03] border-purple-500/20" :
          viewMode === 'edit' ? "bg-white/[0.05] border-white/10" :
          viewMode === 'raw' ? "bg-blue-500/[0.03] border-blue-500/10" : 
          "bg-white/[0.03] border-white/10"
        )}>
          {isGenerated ? (
            <div 
              className="w-full h-full overflow-y-auto pr-1 custom-scrollbar relative"
              onKeyDown={handleScopedSelectAll}
              tabIndex={0}
            >
              <div className="text-sm font-mono text-white/90 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text">
                {data.outputs?.text}
              </div>
              <button
                onClick={() => updateNodeData(id, { isGenerated: false, outputs: { ...data.outputs, text: undefined } })}
                className="absolute bottom-0 right-0 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border border-red-500/20"
                title="Delete AI Result"
              >
                <X size={14} />
              </button>
            </div>
          ) : isPromptActive ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
              {data.isLoading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 size={32} className="animate-spin text-purple-400" />
                  <span className="text-xs font-mono text-white/40 animate-pulse">AI is thinking...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Terminal size={24} className="text-purple-400/40" />
                  </div>
                  <p className="text-xs font-mono text-white/40 leading-relaxed max-w-[200px]">
                    {contextSummary}
                  </p>
                </div>
              )}
            </div>
          ) : viewMode === 'edit' ? (
            <div 
              className="w-full h-full overflow-y-auto custom-scrollbar cursor-text p-0"
              onKeyDown={handleScopedSelectAll}
            >
              <MentionEditor
                initialContent={data.prompt || ''}
                onChange={handleEditorChange}
                mentions={mentionCandidates}
                currentNodeId={id}
                placeholder="Enter instructions... (Type @ to reference)"
                className="text-sm font-mono text-white/90 leading-relaxed"
              />
            </div>
          ) : (
            <div 
              className="w-full h-full overflow-y-auto custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
              onKeyDown={handleScopedSelectAll}
              tabIndex={0}
            >
              {viewMode === 'prev' ? (
                <div className="text-sm font-mono text-white/80 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text">
                  {resolvedData.displaySegments.length > 0 ? (
                    resolvedData.displaySegments.map((seg, i) => (
                      <span 
                        key={i} 
                        className={cn(
                          seg.type === 'reference' && "text-emerald-400/80 underline decoration-emerald-500/20 underline-offset-4 decoration-dashed"
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
                <div className="text-sm font-mono text-white/50 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text">
                  {resolvedData.fullRaw || <span className="opacity-30 italic">No content to output</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NodeMetadata metadata={data.metadata} isLoading={data.isLoading} startTime={startTime} />
    </div>

      {/* Floating Control Panel */}
      <NodePromptInput 
        node={props as any} 
        selected={selected} 
        onExpandChange={setIsPromptActive}
        onRun={handleRun}
      />

      {/* Ports */}
      <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-[200] pointer-events-auto">
        <MagneticPort 
          type="text" 
          id="output-text" 
          isSource={true} 
          status={data.outputs?.text ? 'green' : 'gray'}
          dragging={dragging}
        />
      </div>
      
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-[200] pointer-events-auto">
        <MagneticInput isTargetOfConnection={isTargetOfConnection} dragging={dragging} />
      </div>
    </motion.div>
  );
});
