import React, { useState, useRef, useMemo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeData, useTapStore, Pin, NodeType, TapNode, ProviderConfig, ModelConfig } from './store';
import { Play, Image as ImageIcon, Video, Type, MapPin, Loader2, Scissors, X, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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
  
  const imageRef = useRef<HTMLDivElement>(null);

  // Find parent node
  const parentNode = data.parentId ? nodes.find(n => n.id === data.parentId) : null;

  // Find if any child of this node is selected
  const selectedNodes = useMemo(() => nodes.filter(n => n.selected), [nodes]);
  const isSingleSelected = selectedNodes.length === 1;
  const selectedNode = isSingleSelected ? selectedNodes[0] : null;
  
  // Semi-selected state: if a child is selected
  const isSemiSelected = selectedNode && selectedNode.data.parentId === id;

  // Which pins to show on THIS node?
  const pinsToShow = useMemo(() => {
    if (isSemiSelected && selectedNode) {
      // Extract PIN indices from child's prompt
      const prompt = selectedNode.data.prompt || '';
      const matches = prompt.matchAll(/@IMG_\d+_PIN_(\d+)/g);
      const referencedIndices = Array.from(matches).map(m => parseInt(m[1]) - 1);
      return data.pins?.filter((_, idx) => referencedIndices.includes(idx)) || [];
    }
    return [];
  }, [isSemiSelected, selectedNode, data.pins]);

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
      // 1. Resolve references (Pins/Nodes)
      const images: { data: string; mimeType: string }[] = [];
      
      // Find all @IMG_n references in prompt
      const matches = data.prompt.matchAll(/@IMG_(\d+)(?:_PIN_(\d+))?/g);
      for (const match of matches) {
        const shortId = `IMG_${match[1]}`;
        const targetNode = nodes.find(n => n.data.shortId === shortId);
        if (targetNode?.data.output && targetNode.data.type === 'image') {
          // In a real app, we might crop the pin area here
          // For now, we send the whole image as context
          images.push({ 
            data: targetNode.data.output, 
            mimeType: 'image/png' // Assuming PNG for now
          });
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

      updateNodeData(id, { 
        isLoading: false, 
        output: response.imageUrl || response.text 
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

    if (e.ctrlKey && imageRef.current && data.output && data.type === 'image') {
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
            referencedPins: [newPinId]
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
        config: { mask: maskBase64 }
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
      "w-80 flex flex-col glass-panel rounded-2xl overflow-hidden transition-all duration-500",
      selected && "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl shadow-red-900/20 scale-[1.02]",
      isSemiSelected && "node-semi-selected"
    )}>
      {/* Header */}
      <div className="bg-[var(--app-panel)] px-4 py-3 flex items-center justify-between border-b border-[var(--app-border)]">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            data.type === 'image' ? "bg-blue-500/20 text-blue-400" :
            data.type === 'video' ? "bg-purple-500/20 text-purple-400" :
            "bg-emerald-500/20 text-emerald-400"
          )}>
            {data.type === 'text' && <Type size={14} />}
            {data.type === 'image' && <ImageIcon size={14} />}
            {data.type === 'video' && <Video size={14} />}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-display uppercase tracking-widest font-bold">{data.label}</span>
            <span className="text-[8px] font-mono text-[var(--app-text-muted)]">{data.shortId}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Model Selector Dropdown */}
          <div className="relative group/model">
            <button className={clsx(
              "flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 text-[9px] font-mono transition-all",
              isUsingDefault ? "text-[var(--app-text-muted)] italic" : "text-white font-bold"
            )}>
              {currentModel ? currentModel.model.name : 'Select Model'}
              {isUsingDefault && <span className="text-[7px] opacity-50 ml-1">(Auto)</span>}
              <ChevronDown size={10} />
            </button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl opacity-0 invisible group-hover/model:opacity-100 group-hover/model:visible transition-all z-50 overflow-hidden">
              <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)] flex justify-between items-center">
                <span>Available Models</span>
                {!isUsingDefault && (
                  <button 
                    onClick={() => updateNodeData(id, { config: { ...data.config, model: undefined } })}
                    className="text-[7px] text-blue-400 hover:underline"
                  >
                    Reset to Auto
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {availableModels.map(({ provider, model }) => (
                  <button
                    key={`${provider.id}-${model.id}`}
                    onClick={() => updateNodeData(id, { config: { ...data.config, model: `${provider.id}:${model.id}` } })}
                    className={clsx(
                      "w-full px-3 py-2 text-left text-[10px] hover:bg-white/5 flex flex-col gap-0.5 transition-colors",
                      currentModel?.model.id === model.id ? "bg-[var(--brand-red)]/20 text-[var(--brand-red)]" : "text-white"
                    )}
                  >
                    <span className="font-bold">{model.name}</span>
                    <span className="text-[8px] opacity-60 uppercase">{provider.name}</span>
                  </button>
                ))}
                {availableModels.length === 0 && (
                  <div className="p-4 text-[9px] text-center text-[var(--app-text-muted)] italic">No compatible models found. Check Models settings.</div>
                )}
              </div>
            </div>
          </div>

          <div className="h-4 w-px bg-[var(--app-border)] mx-1" />

          {data.output && data.type === 'image' && (
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
      <div className="p-4 flex flex-col gap-4">
        {/* Output Preview */}
        {data.output ? (
          <div 
            ref={imageRef}
            className="relative w-full aspect-video bg-black rounded-xl overflow-hidden group cursor-crosshair shadow-inner"
            onClick={handleImageClick}
          >
            {data.type === 'image' ? (
              <img 
                src={data.output} 
                alt="Output" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : data.type === 'video' ? (
              <video src={data.output} className="w-full h-full object-cover" autoPlay loop muted />
            ) : (
              <div className="p-3 text-xs font-mono overflow-auto h-full bg-[#050505]">{data.output}</div>
            )}

            {/* Pins Logic */}
            {pinsToShow?.map((pin) => {
              const pinIdx = data.pins?.findIndex(p => p.id === pin.id);
              return (
                <div 
                  key={pin.id}
                  className="absolute w-6 h-6 -ml-3 -mt-3 flex items-center justify-center transition-all hover:scale-125 group/pin cursor-pointer"
                  style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                  onClick={(e) => handlePinClick(e, pin.id)}
                >
                  <div className="relative">
                    <MapPin size={24} className="text-[var(--brand-red)] drop-shadow-[0_0_8px_rgba(153,27,27,0.8)]" fill="currentColor" />
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold pb-1">
                      {pinIdx !== undefined ? pinIdx + 1 : '?'}
                    </span>
                    {/* Delete button on hover */}
                    {selected && (
                      <button
                        onClick={(e) => handleRemovePin(e, pin.id)}
                        className="absolute -top-2 -right-2 bg-black border border-white/20 rounded-full p-0.5 opacity-0 group-hover/pin:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <X size={8} className="text-white" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <span className="text-[8px] text-white font-bold uppercase tracking-widest bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
                {isSemiSelected ? "Click Pin to Insert" : "CTRL + Click to Pin"}
              </span>
            </div>
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

        {/* Prompt Input Component */}
        <PromptInput 
          nodeId={id}
          value={data.prompt}
          onChange={(val) => updateNodeData(id, { prompt: val })}
          referencedPins={data.referencedPins || []}
          parentNode={data.parentId ? nodes.find(n => n.id === data.parentId) || null : null}
        />

        {/* Type Selector */}
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--app-border)]">
          {(['text', 'image', 'video'] as NodeType[]).map((t) => (
            <button
              key={t}
              onClick={() => updateNodeData(id, { type: t })}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-display uppercase tracking-widest transition-all font-bold",
                data.type === t 
                  ? "bg-[var(--brand-red)] text-white shadow-lg shadow-red-900/40" 
                  : "bg-[var(--app-panel)] text-[var(--app-text-muted)] hover:text-white border border-[var(--app-border)]"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} className="w-2 h-2" />
      <Handle type="source" position={Position.Right} className="w-2 h-2" />

      <MaskModal 
        isOpen={isMaskModalOpen}
        onClose={() => setIsMaskModalOpen(false)}
        imageUrl={data.output || ''}
        onSave={handleMaskSave}
      />
    </div>
  );
};
