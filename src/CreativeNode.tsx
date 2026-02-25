import React, { useState, useRef, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData, useTapStore, Pin, NodeType, TapNode, ProviderConfig, ModelConfig } from './store';
import { Play, Image as ImageIcon, Video, Type, MapPin, Loader2, Scissors, X, ChevronDown, Pin as PinIcon, Hash } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useEffect } from 'react';
import { MaskModal } from './MaskModal';
import { PromptInput } from './PromptInput';
import { aiService } from './services/aiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CreativeNode = ({ id, data, selected }: NodeProps<TapNode>) => {
  const [isMaskModalOpen, setIsMaskModalOpen] = useState(false);
  const updateNodeData = useTapStore((state) => state.updateNodeData);
  const addPin = useTapStore((state) => state.addPin);
  const removePin = useTapStore((state) => state.removePin);
  const addNode = useTapStore((state) => state.addNode);
  const addReferencedPin = useTapStore((state) => state.addReferencedPin);
  const setEdges = useTapStore((state) => state.setEdges);
  const edges = useTapStore((state) => state.edges);
  const nodes = useTapStore((state) => state.nodes);
  const providers = useTapStore((state) => state.providers);
  const globalDefaults = useTapStore((state) => state.globalDefaults);
  
  const isPinMode = useTapStore((state) => state.isPinMode);
  const setPinMode = useTapStore((state) => state.setPinMode);
  
  const [hoveredPort, setHoveredPort] = useState<string | null>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  const activeOutputMode = data.activeOutputMode || 'text';
  const currentOutput = data.outputs?.[activeOutputMode];

  // Port Status Logic
  const getPortStatus = (portType: 'text' | 'image' | 'video' | 'prompt') => {
    const hasContent = !!data.outputs?.[portType];
    if (!hasContent) return 'gray';

    // If a child node is selected, check if it's stale relative to this port
    if (selectedNode) {
      const lastUsedVersion = selectedNode.data.lastRunVersions?.[id]?.[portType];
      const currentVersion = data.outputVersions?.[portType] || 0;
      if (lastUsedVersion !== undefined && currentVersion > lastUsedVersion) {
        return 'orange';
      }
    }
    
    return 'green';
  };

  // CTRL key listener for PIN mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setPinMode(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') setPinMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setPinMode]);

  // Find parent node
  const parentNode = data.parentId ? nodes.find(n => n.id === data.parentId) : null;

  // Find if any child of this node is selected
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const isSingleSelected = selectedNodes.length === 1;
  const selectedNode = isSingleSelected ? selectedNodes[0] : null;
  
  // Semi-selected state: if a child is selected
  const isSemiSelected = selectedNode && selectedNode.data.parentId === id;

  // Which pins to show on THIS node?
  const pinsData = useMemo(() => {
    const allPins = data.pins || [];
    const prompt = selectedNode?.data.prompt || '';
    const matches = Array.from(prompt.matchAll(/@IMG_\d+_PIN_(\d+)/g));
    const referencedIndices = matches.map(m => parseInt(m[1]) - 1);

    return allPins.map((pin, idx) => {
      const isReferenced = referencedIndices.includes(idx);
      let isGhost = false;
      
      if (selected) {
        isGhost = false; // Full selection: all 100%
      } else if (isSemiSelected) {
        isGhost = !isReferenced; // Semi selection: only referenced are 100%
      } else {
        isGhost = true; // Unselected: all 30% (ghost)
      }

      return {
        ...pin,
        index: idx,
        isReferenced,
        isGhost
      };
    });
  }, [isSemiSelected, selectedNode, data.pins, selected]);

  // Available models for this node type
  const availableModels = useMemo(() => {
    const list: { provider: ProviderConfig; model: ModelConfig }[] = [];
    providers.filter(p => p.enabled).forEach(p => {
      p.models.forEach(m => {
        // Filter based on node type
        if (data.type === 'text' && m.capabilities.text) list.push({ provider: p, model: m });
        if (data.type === 'image' && (m.capabilities.image || m.capabilities.vision)) list.push({ provider: p, model: m });
        if (data.type === 'video' && m.capabilities.video) list.push({ provider: p, model: m });
      });
    });
    return list;
  }, [providers, data.type]);

  // Current selected model
  const currentModel = useMemo(() => {
    const modelKey = data.config?.model || (globalDefaults[data.type as keyof typeof globalDefaults] as string);
    if (modelKey && typeof modelKey === 'string') {
      const [pId, mId] = modelKey.split(':');
      const p = providers.find(p => p.id === pId);
      const m = p?.models.find(m => m.id === mId);
      if (p && m) return { provider: p, model: m };
    }
    return availableModels[0] || null;
  }, [data.config?.model, data.type, globalDefaults, availableModels, providers]);

  const isUsingDefault = !data.config?.model;

  const handleRun = async () => {
    if (!currentModel) {
      alert("No model selected or available for this type.");
      return;
    }

    updateNodeData(id, { isLoading: true });

    try {
      // 1. Resolve references (Pins/Nodes/Ports)
      const images: { data: string; mimeType: string }[] = [];
      
      // Track versions used for this run
      const runVersions: NonNullable<NodeData['lastRunVersions']> = {
        '__self__': { prompt: data.outputVersions?.prompt || 0 }
      };

      // Find all @IMG_n references in prompt
      const matches = data.prompt.matchAll(/@IMG_(\d+)(?:_(TEXT|IMAGE|PROMPT))?/g);
      for (const match of matches) {
        const shortId = `IMG_${match[1]}`;
        const portType = (match[2] || 'IMAGE').toLowerCase() as 'text' | 'image' | 'prompt';
        const targetNode = nodes.find(n => n.data.shortId === shortId);
        
        if (targetNode) {
          // Store version used
          if (!runVersions[targetNode.id]) runVersions[targetNode.id] = {};
          runVersions[targetNode.id][portType] = targetNode.data.outputVersions?.[portType] || 0;

          const content = targetNode.data.outputs?.[portType];
          if (content && portType === 'image') {
            images.push({ data: content, mimeType: 'image/png' });
          }
        }
      }

      // 2. Call AI Service
      const response = await aiService.generate({
        prompt: data.prompt,
        images,
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isGlobalMock: globalDefaults.isGlobalMock
      });

      if (response.error) {
        alert(`Error: ${response.error}`);
        updateNodeData(id, { isLoading: false });
        return;
      }

      // 3. Update specific output slot and version
      const newOutputs = { ...(data.outputs || {}) };
      const newVersions = { 
        text: 0, image: 0, video: 0, prompt: 0,
        ...(data.outputVersions || {}) 
      };
      
      if (activeOutputMode === 'image') {
        newOutputs.image = response.imageUrl;
        newVersions.image++;
      } else if (activeOutputMode === 'video') {
        newOutputs.video = response.imageUrl; // Mock video
        newVersions.video++;
      } else {
        newOutputs.text = response.text;
        newVersions.text++;
      }

      updateNodeData(id, { 
        isLoading: false, 
        outputs: newOutputs,
        outputVersions: newVersions,
        lastRunVersions: runVersions
      });
    } catch (err: any) {
      console.error(err);
      alert(`Unexpected Error: ${err.message}`);
      updateNodeData(id, { isLoading: false });
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    // Prohibit marking PINs when multiple nodes are selected
    if (selectedNodes.length > 1) return;

    if ((isPinMode || e.ctrlKey) && imageRef.current && data.output && data.type === 'image') {
      e.stopPropagation(); // Prevent de-selection in PIN mode
      const rect = imageRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const newPinId = `pin-${Date.now()}`;
      const newPin: Pin = { id: newPinId, x, y };
      addPin(id, newPin);

      // Smart Creation Logic:
      // If a child node of this node is currently selected, append PIN to it.
      if (isSemiSelected) {
        addReferencedPin(selectedNode.id, newPinId);
        
        // Append tag to prompt
        const pinIdx = (data.pins?.length || 0); // New pin is already added
        const tagText = `@${data.shortId}_PIN_${pinIdx + 1} `;
        updateNodeData(selectedNode.id, { 
          prompt: (selectedNode.data.prompt || '') + tagText 
        });
      } else {
        // Create new node
        const newNodeId = `node-${Date.now()}`;
        addNode({
          id: newNodeId,
          type: 'creative',
          position: { x: (nodes.find(n => n.id === id)?.position.x || 0) + 350, y: (nodes.find(n => n.id === id)?.position.y || 0) },
          data: {
            label: `Edit from PIN`,
            type: 'image',
            prompt: `@${data.shortId}_PIN_1 `,
            parentId: id,
            pins: [],
            referencedPins: [newPinId],
            outputs: { text: '', image: '', video: '', prompt: '' },
            outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
            activeOutputMode: 'image'
          }
        });

        // Add edge with emphasized style
        setEdges([...edges, {
          id: `edge-${id}-${newNodeId}`,
          source: id,
          target: newNodeId,
          animated: true,
          className: 'edge-emphasized'
        }]);

        // Select both parent and new child
        setTimeout(() => {
          useTapStore.getState().onNodesChange([
            { id: id, type: 'select', selected: true },
            { id: newNodeId, type: 'select', selected: true }
          ]);
        }, 50);
      }
    }
  };

  const handlePinClick = (e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    if (selectedNodes.length > 1) return;

    if (isSemiSelected) {
      addReferencedPin(selectedNode.id, pinId);
      const pinIdx = data.pins?.findIndex(p => p.id === pinId);
      const tagText = `@${data.shortId}_PIN_${(pinIdx !== undefined ? pinIdx + 1 : '?')} `;
      updateNodeData(selectedNode.id, { 
        prompt: (selectedNode.data.prompt || '') + tagText 
      });
    }
  };

  const handleRemovePin = (e: React.MouseEvent, pinId: string) => {
    e.stopPropagation();
    removePin(id, pinId);
  };

  const handleMaskSave = (maskBase64: string) => {
    const newNodeId = `node-${Date.now()}`;
    addNode({
      id: newNodeId,
      type: 'creative',
      position: { x: (nodes.find(n => n.id === id)?.position.x || 0) + 350, y: (nodes.find(n => n.id === id)?.position.y || 0) + 150 },
      data: {
        label: `Inpaint Mask`,
        type: 'image',
        prompt: ``,
        parentId: id,
        pins: [],
        config: { mask: maskBase64 },
        outputs: { text: '', image: '', video: '', prompt: '' },
        outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
        activeOutputMode: 'image'
      }
    });

    setEdges([...edges, {
      id: `edge-${id}-${newNodeId}`,
      source: id,
      target: newNodeId,
      animated: true,
    }]);
  };

  return (
    <div className={cn(
      "w-80 flex flex-col glass-panel rounded-2xl transition-all duration-500 relative",
      selected && "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl shadow-red-900/20 scale-[1.02]",
      isSemiSelected && "node-semi-selected"
    )}>
      {/* Side Ports System */}
      <div className="absolute -right-12 top-0 bottom-0 w-10 flex flex-col z-50 pointer-events-auto">
        {/* Output Ports (Aligned with Preview) */}
        <div className="absolute top-24 flex flex-col gap-4">
          {(['text', 'image', 'video'] as const).map((type) => {
            const status = getPortStatus(type);
            const Icon = type === 'text' ? Type : type === 'image' ? ImageIcon : Video;
            return (
              <div key={`out-${type}`} className="relative group/port nodrag nopan">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 bg-black/80 backdrop-blur-sm",
                  status === 'green' ? "border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]" :
                  status === 'orange' ? "border-orange-500/50 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.3)]" :
                  "border-white/10 text-white/40 hover:text-white hover:border-white/20"
                )}>
                  <Icon size={14} />
                </div>
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={`output-${type}`}
                  className="!w-full !h-full !absolute !inset-0 !bg-transparent !border-none !opacity-0 z-10 cursor-crosshair pointer-events-auto" 
                />
              </div>
            );
          })}
        </div>

        {/* Input Ports (Aligned with Prompt Area) */}
        <div className="absolute bottom-12 flex flex-col gap-4">
          {(['prompt', 'image', 'video'] as const).map((type) => {
            const hasContent = type === 'prompt' ? !!data.prompt : !!data.inputs?.[type];
            const Icon = type === 'prompt' ? Hash : type === 'image' ? ImageIcon : Video;
            return (
              <div key={`in-${type}`} className="relative group/port nodrag nopan">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 bg-black/80 backdrop-blur-sm",
                  hasContent ? "border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]" :
                  "border-white/10 text-white/40 hover:text-white hover:border-white/20"
                )}>
                  <Icon size={14} />
                </div>
                <Handle 
                  type="target" 
                  position={Position.Right} 
                  id={`input-${type}`}
                  className="!w-full !h-full !absolute !inset-0 !bg-transparent !border-none !opacity-0 z-10 cursor-crosshair pointer-events-auto" 
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="bg-[var(--app-panel)] px-4 py-3 flex items-center justify-between border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            activeOutputMode === 'image' ? "bg-blue-500/20 text-blue-400" :
            activeOutputMode === 'video' ? "bg-purple-500/20 text-purple-400" :
            "bg-emerald-500/20 text-emerald-400"
          )}>
            {activeOutputMode === 'text' && <Type size={14} />}
            {activeOutputMode === 'image' && <ImageIcon size={14} />}
            {activeOutputMode === 'video' && <Video size={14} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-display uppercase tracking-widest font-bold">{data.label}</span>
            <span className="text-[8px] font-mono text-[var(--app-text-muted)]">{data.shortId}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mr-8">
          {activeOutputMode === 'image' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setPinMode(!isPinMode); }}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                isPinMode ? "bg-[var(--brand-red)] text-white" : "hover:bg-white/5 text-[var(--app-text-muted)] hover:text-white"
              )}
              title="PIN Mode (Hold CTRL)"
            >
              <PinIcon size={14} />
            </button>
          )}
          {currentOutput && activeOutputMode === 'image' && (
            <button 
              onClick={() => setIsMaskModalOpen(true)}
              className="p-1.5 hover:bg-[var(--app-border)] rounded-lg transition-all text-[var(--app-text-muted)] hover:text-white"
              title="Inpaint Mask"
            >
              <Scissors size={14} />
            </button>
          )}
          <button 
            onClick={handleRun}
            disabled={data.isLoading}
            className="p-1.5 hover:bg-[var(--brand-red)] rounded-lg transition-all disabled:opacity-50 group"
          >
            {data.isLoading ? (
              <Loader2 size={14} className="animate-spin text-[var(--brand-red)]" />
            ) : (
              <Play size={14} className="group-hover:fill-white" fill="currentColor" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col">
        {/* Output Area (Top) */}
        <div className="p-4 border-b border-[var(--app-border)] relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {(['text', 'image', 'video'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => updateNodeData(id, { activeOutputMode: mode })}
                  className={cn(
                    "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-tighter transition-all",
                    activeOutputMode === mode 
                      ? "bg-white/10 text-white" 
                      : "text-[var(--app-text-muted)] hover:text-white"
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {currentOutput ? (
            <div 
              ref={imageRef}
              className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group cursor-crosshair shadow-inner"
              onClick={handleImageClick}
            >
              {activeOutputMode === 'image' ? (
                <img 
                  src={currentOutput} 
                  alt="Output" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : activeOutputMode === 'video' ? (
                <video src={currentOutput} className="w-full h-full object-cover" autoPlay loop muted />
              ) : (
                <div className="p-3 text-xs font-mono overflow-auto h-full bg-[#050505]">{currentOutput}</div>
              )}

              {/* Pins Logic */}
              {activeOutputMode === 'image' && pinsData.map((pin) => (
                <div 
                  key={pin.id}
                  className={cn(
                    "absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center transition-all hover:scale-125 group/pin cursor-pointer z-20",
                    pin.isGhost ? "opacity-30 grayscale-[0.5] hover:opacity-100 hover:grayscale-0" : "opacity-100"
                  )}
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  onClick={(e) => handlePinClick(e, pin.id)}
                >
                  <div className="relative">
                    <MapPin 
                      size={24} 
                      className={cn(
                        "drop-shadow-[0_0_8px_rgba(153,27,27,0.8)]",
                        pin.isReferenced ? "text-[var(--brand-red)]" : "text-white/40"
                      )} 
                      fill="currentColor" 
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold pb-1">
                      {pin.index + 1}
                    </span>
                    {(selected || isPinMode) && (
                      <button
                        onClick={(e) => handleRemovePin(e, pin.id)}
                        className="absolute -top-2 -right-2 bg-black border border-white/20 rounded-full p-0.5 opacity-0 group-hover/pin:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <X size={8} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full aspect-video bg-[#050505] rounded-xl flex items-center justify-center border border-dashed border-[var(--app-border)] group">
              <div className="flex flex-col items-center gap-2 opacity-30 group-hover:opacity-50 transition-opacity">
                <Loader2 size={24} className={cn(data.isLoading && "animate-spin")} />
                <span className="text-[10px] font-display uppercase tracking-widest">
                  {data.isLoading ? "Generating..." : "No Output"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area (Bottom) */}
        <div className="p-4">
          <PromptInput 
            nodeId={id}
            value={data.prompt}
            onChange={(val) => updateNodeData(id, { prompt: val })}
            referencedPins={data.referencedPins || []}
            parentNode={data.parentId ? nodes.find(n => n.id === data.parentId) || null : null}
            nodeType={data.type}
            config={data.config || {}}
            availableModels={availableModels}
            currentModel={currentModel}
          />
        </div>
      </div>

      {/* Main Input Handle */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="input-main"
        className="w-3 h-3 bg-[var(--app-border)] border-2 border-[var(--app-panel)] hover:w-5 hover:h-5 hover:bg-[var(--brand-red)] hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all duration-300" 
      />

      <MaskModal 
        isOpen={isMaskModalOpen}
        onClose={() => setIsMaskModalOpen(false)}
        imageUrl={currentOutput || ''}
        onSave={handleMaskSave}
      />
    </div>
  );
};
