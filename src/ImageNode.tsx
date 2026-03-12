import React, { useRef, useEffect, memo, useState, useMemo } from 'react';
import { NodeProps, useConnection, NodeResizer, useReactFlow } from '@xyflow/react';
import { useTapStore, TapNode, UploadedImage, Pin } from './store';
import { useShallow } from 'zustand/react/shallow';
import { ImageIcon, ArrowUp, X, Play, Loader2, Eye, Edit3, Terminal, Check, Trash2, Plus, Link as LinkIcon, CornerDownRight } from 'lucide-react';
import { NodePromptInput } from './NodePromptInput';
import { NodeMetadata } from './components/NodeMetadata';
import { EditableTitle } from './components/EditableTitle';
import { aiService } from './services/aiService';
import { resolvePrompt } from './utils/promptResolver';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MagneticPort, MagneticInput } from './components/MagneticPorts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ImageNode = memo((props: NodeProps<TapNode>) => {
  const { id, data, selected, dragging } = props;
  const connection = useConnection();
  const isTargetOfConnection = connection.inProgress && connection.toNode?.id === id;
  
  const { updateNodeData, addUploadedImage, removeUploadedImage, nodes, removeHistoryItem, selectHistoryItem, isCtrlPressed, addPin, updatePin, removePin, rememberPinTargetChoice, addNode, onConnect, setEdges, edges, isRecognitionMode, pinTargetNodeId, addPinWithTarget, providers, globalDefaults, isDemoMode, addHistoryItem } = useTapStore(useShallow((state) => ({
    updateNodeData: state.updateNodeData,
    addUploadedImage: state.addUploadedImage,
    removeUploadedImage: state.removeUploadedImage,
    removeHistoryItem: state.removeHistoryItem,
    selectHistoryItem: state.selectHistoryItem,
    isCtrlPressed: state.isCtrlPressed,
    addPin: state.addPin,
    updatePin: state.updatePin,
    removePin: state.removePin,
    rememberPinTargetChoice: state.rememberPinTargetChoice,
    addNode: state.addNode,
    onConnect: state.onConnect,
    setEdges: state.setEdges,
    edges: state.edges,
    nodes: state.nodes,
    isRecognitionMode: state.isRecognitionMode,
    pinTargetNodeId: state.pinTargetNodeId,
    addPinWithTarget: state.addPinWithTarget,
    providers: state.providers,
    globalDefaults: state.globalDefaults,
    isDemoMode: state.isDemoMode,
    addHistoryItem: state.addHistoryItem
  })));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const { updateNode, setNodes } = useReactFlow();
  const lastAdjustedUrl = useRef<string | null>(null);

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [draggingPinId, setDraggingPinId] = useState<string | null>(null);

  // Global listeners for dragging and deletion
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingPinId || !imageContainerRef.current) return;
      
      const rect = imageContainerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      
      updatePin(id, draggingPinId, { x, y });
    };

    const handleGlobalMouseUp = () => {
      setDraggingPinId(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only delete if this node is selected or the PIN itself is considered "active"
      if (selectedPinId && (e.key === 'Delete' || e.key === 'Backspace')) {
        removePin(id, selectedPinId);
        setSelectedPinId(null);
      }

      if (e.key === 'Escape') {
        const virtualPin = data.pins?.find(p => p.isVirtual);
        if (virtualPin) {
          removePin(id, virtualPin.id);
        }
      }
    };

    if (draggingPinId) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    };
  }, [draggingPinId, selectedPinId, id, removePin, updatePin]);

  const [isHovered, setIsHovered] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPromptActive, setIsPromptActive] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const historyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const history = data.history || [];
  const selectedHistoryId = data.selectedHistoryId;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const imageUrl = img.src;
    
    // Detect resolution and update metadata if it's the main output
    if (img.naturalWidth && img.naturalHeight && !previewImageUrl) {
      const realRes = `${img.naturalWidth} x ${img.naturalHeight}`;
      const endTime = Date.now();
      const startTime = data.metadata?.startTime;
      const duration = startTime ? (endTime - startTime) / 1000 : undefined;

      updateNodeData(id, { 
        isLoading: false,
        metadata: { 
          ...data.metadata, 
          resolution: realRes,
          duration,
          startTime: undefined
        } 
      });
    }

    // CRITICAL: If we are just previewing a thumbnail, DON'T adjust the node height.
    // This prevents the "jittering/stretching" when moving mouse between thumbnails.
    if (previewImageUrl && imageUrl === previewImageUrl) return;
    
    if (!img.naturalWidth || !img.naturalHeight || lastAdjustedUrl.current === imageUrl) return;
    lastAdjustedUrl.current = imageUrl;

    const ratio = img.naturalHeight / img.naturalWidth;

    setTimeout(() => {
      const nodeElement = document.querySelector(`[data-id="${id}"]`) as HTMLElement;
      const currentWidth = nodeElement?.offsetWidth || 360;
      
      setNodes((nds) => nds.map((node) => {
        if (node.id === id) {
          const headerHeight = 40;
          const verticalPadding = 24; // p-3 top and bottom
          const horizontalPadding = 24; // p-3 left and right
          const borderWeight = 2; // 1px border on each side
          const historyHeight = history.length > 0 ? 62 : 0; // 50px thumb + 12px gap
          
          // Calculate the height of the image based on the actual inner width (subtracting padding AND borders)
          const innerWidth = currentWidth - horizontalPadding - borderWeight;
          const imageHeight = Math.ceil(innerWidth * ratio);
          
          const newHeight = imageHeight + headerHeight + verticalPadding + borderWeight + historyHeight;
          
          if (node.style?.height === newHeight && node.style?.width === currentWidth) return node;

          return {
            ...node,
            style: { ...node.style, width: currentWidth, height: newHeight }
          };
        }
        return node;
      }));
    }, 50);
  };

  const onLocalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const items = Array.from(e.dataTransfer.items);
    const hasImage = items.some(item => item.type.startsWith('image/'));
    if (hasImage) {
      setIsDraggingOver(true);
    }
  };

  const onLocalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const onLocalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        updateNodeData(id, { 
          outputs: { ...data.outputs, image: base64 },
          outputVersions: { ...data.outputVersions, image: (data.outputVersions?.image || 0) + 1 }
        });
      };
      reader.readAsDataURL(imageFile);
    }
  };

  const uploadedImages = data.uploadedImages || [];
  const currentOutput = previewImageUrl || data.outputs?.image;
  const hasContent = currentOutput || uploadedImages.length > 0;

  const handleImageMouseDown = (e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;

    const isCtrl = e.ctrlKey || e.metaKey || isCtrlPressed;
    if (!isCtrl) {
      if (selectedPinId) setSelectedPinId(null);
      return;
    }

    // CRITICAL: Stop propagation to prevent React Flow from starting a selection box or drag
    e.stopPropagation();
    e.preventDefault();

    // If no content, don't allow PINs
    if (!hasContent) return;

    // Only allow PINs on the main image
    const isMainImage = !previewImageUrl || (history.length > 0 && previewImageUrl === history[0].url);
    if (!isMainImage) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    const pinId = `pin-${Date.now()}`;
    const pinLabel = (data.pins?.length || 0) + 1;
    
    // Logic for target node selection:
    const targetNode = nodes.find(n => n.id === pinTargetNodeId) || nodes.find(n => n.selected && n.id !== id);
    
    const xPos = props.positionAbsoluteX;
    const yPos = props.positionAbsoluteY;

    if (targetNode) {
      // Use atomic operation
      addPinWithTarget(id, { id: pinId, x, y }, targetNode.id);
    } else if (rememberPinTargetChoice) {
      // Auto-create new node to the right
      const newNodeId = `node-${Date.now()}`;
      const spacing = 400;
      const newPos = { x: xPos + spacing, y: yPos };
      const mentionText = `[@ Pin_${pinLabel} (${data.shortId})]`;
      
      addNode({
        id: newNodeId,
        type: 'image-node',
        position: newPos,
        style: { width: 360, height: 400 },
        data: {
          type: 'image',
          label: `Image`,
          prompt: mentionText,
          outputs: {},
          outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
          activeOutputMode: 'image'
        }
      });

      // Add Pin to current node
      addPin(id, { id: pinId, x, y });

      // Create connection
      onConnect({
        source: id,
        target: newNodeId,
        sourceHandle: 'output-image',
        targetHandle: 'input-main',
        data: { pinId }
      } as any);
    } else {
      // Create VIRTUAL Pin immediately
      addPin(id, { id: pinId, x, y, isVirtual: true });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const newImage: UploadedImage = {
        id: `upload-${Date.now()}`,
        url: base64,
        name: file.name
      };
      addUploadedImage(id, newImage);
      if (!data.isLocked) {
        updateNodeData(id, { isLocked: true });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRun = async () => {
    const activeOutputMode = data.activeOutputMode || 'image';
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
    
    // Capture fixed metadata at the start
    const modelName = currentModel.model.name;
    const initialResolution = data.config?.aspectRatio && data.config?.imageSize 
      ? `${data.config.aspectRatio} • ${data.config.imageSize}`
      : '1:1 • 1K';
    
    updateNodeData(id, { 
      isLoading: true,
      metadata: {
        ...data.metadata,
        modelName,
        resolution: initialResolution,
        startTime: runStartTime,
        duration: undefined // Reset duration while loading
      }
    });

    try {
      const { prompt: resolvedPrompt, images } = resolvePrompt(data.prompt || '', nodes, edges, id);
      
      const response = await aiService.generate({
        prompt: resolvedPrompt,
        images,
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode,
        aspectRatio: data.config?.aspectRatio,
        thinkingLevel: data.config?.thinkingLevel === 'off' ? undefined : data.config?.thinkingLevel,
        thoughtSignature: data.thoughtSignature
      });

      const duration = response.metadata?.duration || (Date.now() - runStartTime) / 1000;

      if (response.error) {
        alert(`Error: ${response.error}`);
        updateNodeData(id, { 
          isLoading: false,
          metadata: {
            ...data.metadata,
            startTime: undefined
          }
        });
        return;
      }

      const newOutputs = { ...(data.outputs || {}) };
      const newVersions = { ...(data.outputVersions || { text: 0, image: 0, video: 0, prompt: 0 }) };
      
      if (response.imageUrl) {
        newOutputs.image = response.imageUrl;
        newVersions.image++;
        
        addHistoryItem(id, {
          id: `hist-${Date.now()}`,
          url: response.imageUrl,
          prompt: data.prompt || '',
          config: { ...data.config },
          timestamp: Date.now(),
          thoughtSignature: response.thoughtSignature
        });
      }

      // Update outputs but keep isLoading true until handleImageLoad
      updateNodeData(id, { 
        outputs: newOutputs,
        outputVersions: newVersions,
        thoughtSignature: response.thoughtSignature,
        metadata: {
          ...data.metadata,
          modelName: response.metadata?.modelName || modelName,
          resolution: response.metadata?.resolution || initialResolution,
          // Keep startTime for handleImageLoad to calculate final duration
        }
      });
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      updateNodeData(id, { 
        isLoading: false,
        metadata: {
          ...data.metadata,
          startTime: undefined,
          duration: undefined
        }
      });
    }
  };

  const hasPins = (data.pins?.length || 0) > 0;
  const isTargetForPin = nodes.some(n => n.id !== id && n.selected && isCtrlPressed);

  return (
    <motion.div 
      initial={data.isDraggedClone ? false : { scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      transition={{ type: 'spring', duration: 0.5, bounce: 0.4 }}
      className="relative w-full h-full group"
    >
      {/* Node Body */}
      <div className={cn(
        "w-full h-full flex flex-col glass-panel rounded-2xl relative z-10 transition-all duration-300",
        selected && "node-selected ring-2 ring-[var(--brand-red)] shadow-2xl shadow-red-900/20",
        data.isLoading && "animate-pulse ring-1 ring-blue-500/50",
        data.isCloning && "border-dashed border-2 border-[var(--brand-red)]/60"
      )}>
      <NodeResizer 
        color="transparent" 
        isVisible={selected} 
        minWidth={300} 
        minHeight={300}
        keepAspectRatio={true}
        handleClassName="!p-4 !bg-transparent !border-none group/resizer"
      />
      
      {selected && (
        <div className="absolute inset-0 pointer-events-none group/resizer-visual">
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-white rounded-tl-full -translate-x-1 -translate-y-1 opacity-100 transition-opacity" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-white rounded-tr-full translate-x-1 -translate-y-1 opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-white rounded-bl-full -translate-x-1 translate-y-1 opacity-100 transition-opacity" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-white rounded-br-full translate-x-1 translate-y-1 opacity-100 transition-opacity" />
        </div>
      )}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Header */}
      <div className="bg-[var(--app-panel)] px-4 py-2 flex items-center justify-between border-b border-[var(--app-border)] rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
            <ImageIcon size={14} />
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
                    ? "bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" 
                    : "bg-white/5 border-white/10 group-hover:border-white/30"
                )}>
                  {data.includeTitleInOutput && <Check size={10} className="text-white" strokeWidth={4} />}
                </div>
              </label>
              <EditableTitle 
                value={data.label || 'Image'} 
                onSave={(val) => updateNodeData(id, { label: val })} 
              />
            </div>
            <span className="text-[8px] font-mono text-[var(--app-text-muted)] ml-6">{data.shortId}</span>
          </div>
        </div>
      </div>

      {/* Content: Image Display */}
      <div className="p-3 flex-1 min-h-0 flex flex-col gap-3">
        <div 
          ref={imageContainerRef}
          onMouseDownCapture={handleImageMouseDown}
          onClick={(e) => {
            // CRITICAL: If Ctrl is pressed, we are in PIN mode. 
            // We MUST stop the click event from bubbling up to the node wrapper,
            // otherwise React Flow will treat this as a selection click and deselect our target node.
            if (e.ctrlKey || e.metaKey || isCtrlPressed) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          onDragOver={onLocalDragOver}
          onDragLeave={onLocalDragLeave}
          onDrop={onLocalDrop}
          className={cn(
            "relative flex-1 rounded-xl overflow-hidden border group transition-all duration-300",
            hasContent 
              ? "bg-black border-[var(--app-border)]" 
              : "bg-white/[0.03] border-dashed border-white/10 hover:border-white/20 hover:bg-white/[0.05]",
            isCtrlPressed && hasContent && "cursor-crosshair",
            isDraggingOver && "border-[var(--brand-red)] bg-[var(--brand-red)]/10 ring-2 ring-[var(--brand-red)]/20"
          )}
        >
          {isDraggingOver && (
            <div className="absolute inset-0 z-[110] bg-[var(--brand-red)]/5 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 border-2 border-[var(--brand-red)]/40 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-[var(--brand-red)] flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                <ImageIcon size={16} />
              </div>
              <span className="text-[9px] font-bold text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded border border-white/10">Drop to Replace</span>
            </div>
          )}

          {/* Pin Action HUD (Contextual Overlay) */}
          <AnimatePresence>
            {data.pins?.filter(p => p.isVirtual).map((vPin) => (
              <PinActionPanel 
                key={vPin.id}
                nodeId={id}
                pin={vPin}
                shortId={data.shortId || ''}
                xPos={props.positionAbsoluteX}
                yPos={props.positionAbsoluteY}
                pinLabel={(data.pins?.indexOf(vPin) || 0) + 1}
              />
            ))}
          </AnimatePresence>

          {isCtrlPressed && isHovered && hasContent && (!previewImageUrl || (history.length > 0 && previewImageUrl === history[0].url)) && (
            <div className="absolute inset-0 z-50 pointer-events-none">
              <div className="absolute inset-1 border-2 border-dashed border-white/40 rounded-lg" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white/70 font-mono uppercase tracking-tighter border border-white/10">
                  PIN Mode
                </div>
              </div>
            </div>
          )}

          {hasContent ? (
            <img 
              src={currentOutput || uploadedImages[0]?.url} 
              className={cn(
                "w-full h-full object-cover transition-opacity duration-500",
                data.isLoading && "opacity-20"
              )} 
              alt="Display" 
              referrerPolicy="no-referrer"
              onLoad={handleImageLoad}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={48} className="text-white/5 group-hover:text-white/10 transition-colors" />
            </div>
          )}

          {/* Render PINs - Moved after image to ensure they are on top */}
          {data.pins?.map((pin, index) => (
            <div
              key={pin.id}
              className={cn(
                "absolute z-[100] -translate-x-1/2 -translate-y-1/2 group/pin nodrag cursor-crosshair pointer-events-auto",
                pin.isVirtual && "animate-pulse"
              )}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              onMouseEnter={() => {
                const targetEdge = edges.find(e => e.source === id && e.data?.pinId === pin.id);
                if (targetEdge) {
                  setEdges(edges.map(e => e.id === targetEdge.id ? { ...e, data: { ...e.data, isHovered: true } } : e));
                }
              }}
              onMouseLeave={() => {
                setEdges(edges.map(e => ({ ...e, data: { ...e.data, isHovered: false } })));
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Prevent default to stop ghost image dragging and ensure our custom drag takes over
                e.preventDefault(); 
                setSelectedPinId(pin.id);
                setDraggingPinId(pin.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div className={cn(
                "w-6 h-6 rounded-full border-[1.5px] shadow-[0_0_4px_rgba(0,0,0,0.8)] flex items-center justify-center text-white text-[10px] font-bold select-none transition-all relative",
                pin.isVirtual 
                  ? "bg-white/20 border-white/40 scale-125 ring-4 ring-white/10"
                  : selectedPinId === pin.id 
                    ? "bg-yellow-500 border-white scale-110 ring-2 ring-yellow-500/50" 
                    : "bg-[#ef4444] border-white hover:scale-110"
              )}>
                {pin.isVirtual ? (
                  <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                ) : pin.isRecognizing ? (
                  <Loader2 size={12} className="animate-spin text-white" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Editable Label - Only shows when node is selected */}
              {selected && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 flex flex-col items-center pointer-events-auto">
                  <div className="bg-black/80 backdrop-blur-md border border-white/20 rounded-lg px-2 py-1 shadow-xl flex items-center gap-2 min-w-[60px]">
                    <span className="text-[9px] font-bold text-white/40">#{index + 1}</span>
                    <input
                      type="text"
                      value={pin.label || ''}
                      onChange={(e) => updatePin(id, pin.id, { label: e.target.value })}
                      placeholder={pin.isRecognizing ? "Recognizing..." : "Label..."}
                      className="bg-transparent border-none outline-none text-[10px] text-white font-medium p-0 w-20 placeholder:text-white/20"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Connector line to pin */}
                  <div className="w-px h-2 bg-white/20" />
                </div>
              )}

              {/* Hover Delete Icon */}
              <button
                className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white opacity-0 group-hover/pin:opacity-100 transition-opacity z-[110] hover:bg-red-600 shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  removePin(id, pin.id);
                  if (selectedPinId === pin.id) setSelectedPinId(null);
                }}
                title="Delete PIN"
              >
                <X size={10} strokeWidth={3} />
              </button>
            </div>
          ))}

          {data.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Loader2 size={32} className="text-[var(--brand-red)] animate-spin" />
                  <div className="absolute inset-0 blur-lg bg-[var(--brand-red)]/20 animate-pulse" />
                </div>
                <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest animate-pulse">Generating...</span>
              </div>
            </div>
          )}

          {/* Delete button for uploaded images */}
          {uploadedImages.length > 0 && !data.isLoading && (
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                removeUploadedImage(id, uploadedImages[0].id);
                updateNodeData(id, { isLocked: false });
              }}
              className="absolute top-2 left-2 p-1.5 bg-red-500/80 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
              title="Remove image"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* Only show upload button if no history exists */}
          {history.length === 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 z-10"
            >
              <ArrowUp size={12} />
            </button>
          )}
        </div>

        {/* History Thumbnails - Card Stack Interaction */}
        {history.length > 0 && (
          <motion.div 
            className="relative h-[50px] flex items-center bg-white/[0.001]"
            initial={false}
            animate={{ 
              width: isHistoryExpanded 
                ? `${(history.length - 1) * 48 + 60}px` 
                : `${Math.min(history.length - 1, 2) * 4 + 40}px` 
            }}
            transition={{
              type: 'spring',
              stiffness: 1000,
              damping: 55,
              mass: 0.2
            }}
            onMouseEnter={() => {
              if (historyTimeoutRef.current) {
                clearTimeout(historyTimeoutRef.current);
                historyTimeoutRef.current = null;
              }
              setIsHistoryExpanded(true);
            }}
            onMouseLeave={() => {
              historyTimeoutRef.current = setTimeout(() => {
                setIsHistoryExpanded(false);
                setPreviewImageUrl(null);
              }, 300); // 300ms delay before shrinking
            }}
          >
            <AnimatePresence mode="popLayout">
              {history.map((item, index) => {
                const isMain = index === 0;
                const isSelected = selectedHistoryId === item.id;
                
                return (
                  <motion.div 
                    key={item.id}
                    layoutId={item.id}
                    initial={false}
                    animate={{
                      x: isHistoryExpanded ? index * 48 : index * 4,
                      zIndex: history.length - index,
                      scale: isHistoryExpanded ? 1 : 1 - index * 0.05,
                      opacity: isHistoryExpanded ? 1 : (index < 3 ? 1 : 0),
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 1000,
                      damping: 55,
                      mass: 0.2,
                      restDelta: 0.01
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      selectHistoryItem(id, item.id);
                      setPreviewImageUrl(null);
                    }}
                    onMouseEnter={() => {
                      if (index > 0) setPreviewImageUrl(item.url);
                    }}
                    className={cn(
                      "absolute left-0 min-w-[40px] h-[40px] rounded-lg border overflow-hidden cursor-pointer transition-all group/thumb",
                      isSelected 
                        ? "border-[var(--brand-red)] ring-1 ring-[var(--brand-red)]" 
                        : "border-white/10 hover:border-white/30",
                      !isHistoryExpanded && !isMain && "pointer-events-none"
                    )}
                  >
                    <img src={item.url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                    
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          removeHistoryItem(id, item.id); 
                          if (previewImageUrl === item.url) setPreviewImageUrl(null);
                        }}
                        className="absolute top-0 right-0 p-1 rounded-bl-md bg-red-500 text-white hover:bg-red-600 shadow-sm transition-colors"
                      >
                        <X size={8} strokeWidth={3} />
                      </button>
                    </div>

                    {/* Badge for stacked count */}
                    {!isHistoryExpanded && isMain && history.length > 1 && (
                      <div className="absolute bottom-0 right-0 bg-[var(--brand-red)] text-white text-[7px] font-bold px-1 rounded-tl-md">
                        +{history.length - 1}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Metadata Bar - Positioned at the outer bottom-right of the content area */}
        <div className="flex justify-end mt-1 px-1">
          <NodeMetadata metadata={data.metadata} isLoading={data.isLoading} />
        </div>
      </div>
    </div>

      {/* Floating Control Panel */}
      <NodePromptInput node={props as any} selected={selected} isPinned={hasPins} onRun={handleRun} />

      {/* Ports */}
      <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-[200] pointer-events-auto">
        <MagneticPort 
          type="image" 
          id="output-image" 
          isSource={true} 
          status={data.outputs?.image ? 'green' : 'gray'}
          dragging={dragging}
        />
      </div>
      
      <div className="absolute -left-16 top-1/2 -translate-y-1/2 w-16 flex flex-col z-[200] pointer-events-auto">
        <MagneticInput isTargetOfConnection={isTargetOfConnection} dragging={dragging} />
      </div>
    </motion.div>
  );
});

// Contextual Panel Component
const PinActionPanel = ({ nodeId, pin, shortId, xPos, yPos, pinLabel }: { 
  nodeId: string, 
  pin: Pin, 
  shortId: string, 
  xPos: number, 
  yPos: number, 
  pinLabel: number 
}) => {
  const { addNode, onConnect, removePin, nodes, updatePin, addPinWithTarget, createLinkedNode } = useTapStore();
  const { setNodes } = useReactFlow();

  // Find if any other node is selected
  const selectedTargetNode = nodes.find(n => n.selected && n.id !== nodeId);

  const handleCancel = () => {
    removePin(nodeId, pin.id);
  };

  const handleCreateNew = () => {
    const spacing = 400;
    const newPos = { x: xPos + spacing, y: yPos };
    createLinkedNode(nodeId, pin, pinLabel, newPos);
  };

  const handleLinkExisting = () => {
    if (!selectedTargetNode) return;
    
    // Remove the virtual pin first (addPinWithTarget will add a real one)
    removePin(nodeId, pin.id);
    
    // Use atomic operation to add pin and link
    addPinWithTarget(nodeId, { id: pin.id, x: pin.x, y: pin.y }, selectedTargetNode.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-[200] pointer-events-auto nodrag"
    >
      {/* Label */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-r border-white/5">
        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Pin #{pinLabel}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-1">
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-all group"
          title="Create New Node"
        >
          <Plus size={12} className="text-blue-400 group-hover:text-white" />
          <span className="text-[10px] font-bold text-white/60 group-hover:text-white">New</span>
        </button>

        <button
          onClick={handleLinkExisting}
          disabled={!selectedTargetNode}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all group",
            selectedTargetNode 
              ? "hover:bg-white/10 cursor-pointer" 
              : "opacity-20 cursor-not-allowed"
          )}
          title={selectedTargetNode ? `Link to ${selectedTargetNode.data.shortId}` : "Select another node to link"}
        >
          <LinkIcon size={12} className={cn(selectedTargetNode ? "text-emerald-400 group-hover:text-white" : "text-white/40")} />
          <span className="text-[10px] font-bold text-white/60 group-hover:text-white">
            {selectedTargetNode ? `Link (${selectedTargetNode.data.shortId})` : "Link"}
          </span>
        </button>
      </div>

      {/* Close */}
      <button 
        onClick={handleCancel}
        className="ml-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};

