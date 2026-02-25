import React, { useRef, useState, useEffect, useMemo } from 'react';
import { MapPin, X, Image as ImageIcon, Hash, ChevronUp, Check } from 'lucide-react';
import { useTapStore, TapNode, Pin, NodeType, ProviderConfig, ModelConfig } from './store';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface PromptInputProps {
  nodeId: string;
  value: string;
  onChange: (val: string) => void;
  referencedPins: string[];
  parentNode: TapNode | null;
  nodeType: NodeType;
  config: any;
  availableModels: { provider: ProviderConfig; model: ModelConfig }[];
  currentModel: { provider: ProviderConfig; model: ModelConfig } | null;
}

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9', group: 'Landscape', icon: (props: any) => <rect x="2" y="6" width="20" height="12" rx="2" {...props} /> },
  { label: '21:9', value: '21:9', group: 'Landscape', icon: (props: any) => <rect x="1" y="8" width="22" height="8" rx="1.5" {...props} /> },
  { label: '4:3', value: '4:3', group: 'Standard', icon: (props: any) => <rect x="3" y="5" width="18" height="14" rx="2" {...props} /> },
  { label: '3:2', value: '3:2', group: 'Standard', icon: (props: any) => <rect x="2" y="5" width="20" height="14" rx="2" {...props} /> },
  { label: '1:1', value: '1:1', group: 'Square', icon: (props: any) => <rect x="4" y="4" width="16" height="16" rx="2" {...props} /> },
  { label: '9:16', value: '9:16', group: 'Portrait', icon: (props: any) => <rect x="6" y="2" width="12" height="20" rx="2" {...props} /> },
  { label: '3:4', value: '3:4', group: 'Portrait', icon: (props: any) => <rect x="5" y="3" width="14" height="18" rx="2" {...props} /> },
  { label: '2:3', value: '2:3', group: 'Portrait', icon: (props: any) => <rect x="5" y="2" width="14" height="20" rx="2" {...props} /> },
  { label: '5:4', value: '5:4', group: 'Portrait', icon: (props: any) => <rect x="4" y="5" width="16" height="14" rx="2" {...props} /> },
  { label: '4:5', value: '4:5', group: 'Portrait', icon: (props: any) => <rect x="5" y="4" width="14" height="16" rx="2" {...props} /> },
];

export const PromptInput = ({ 
  nodeId, 
  value, 
  onChange, 
  referencedPins, 
  parentNode,
  nodeType,
  config,
  availableModels,
  currentModel
}: PromptInputProps) => {
  const nodes = useTapStore(state => state.nodes);
  const edges = useTapStore(state => state.edges);
  const updateNodeData = useTapStore(state => state.updateNodeData);
  const restorePin = useTapStore(state => state.restorePin);
  const setEdges = useTapStore(state => state.setEdges);
  
  const [hoveredPin, setHoveredPin] = useState<{ id: string; nodeId: string; index: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [recoveryPin, setRecoveryPin] = useState<{ nodeId: string; pinId: string; label: string } | null>(null);

  const [activeDropdown, setActiveDropdown] = useState<'model' | 'resolution' | 'ratio' | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  // Referenced nodes (parents)
  const referencedNodes = useMemo(() => {
    const parentIds = edges.filter(e => e.target === nodeId).map(e => e.source);
    return nodes.filter(n => parentIds.includes(n.id));
  }, [edges, nodes, nodeId]);

  const handleRemoveReference = (e: React.MouseEvent, parentId: string) => {
    e.stopPropagation();
    setEdges(edges.filter(e => !(e.source === parentId && e.target === nodeId)));
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const currentAspectRatio = config.aspectRatio || '1:1';
  const currentResolution = config.resolution || (nodeType === 'video' ? '720p' : '1K');

  const supportedRatios = useMemo(() => {
    if (!currentModel?.model.supportedRatios) return ASPECT_RATIOS;
    return ASPECT_RATIOS.filter(r => currentModel.model.supportedRatios?.includes(r.value));
  }, [currentModel]);

  const supportedResolutions = useMemo(() => {
    return currentModel?.model.supportedResolutions || (nodeType === 'video' ? ['720p', '1080p'] : ['1K', '2K', '4K']);
  }, [currentModel, nodeType]);

  const handleModelSelect = (pId: string, mId: string) => {
    updateNodeData(nodeId, { config: { ...config, model: `${pId}:${mId}` } });
    setActiveDropdown(null);
  };

  const handleRatioSelect = (ratio: string) => {
    updateNodeData(nodeId, { config: { ...config, aspectRatio: ratio } });
    setActiveDropdown(null);
  };

  const handleResolutionSelect = (res: string) => {
    updateNodeData(nodeId, { config: { ...config, resolution: res } });
    setActiveDropdown(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Suggestions logic
  const suggestions = useMemo(() => {
    const list: any[] = [];
    
    // 1. Current parent's pins
    if (parentNode?.data.pins) {
      parentNode.data.pins.forEach((pin, idx) => {
        list.push({
          type: 'pin',
          id: pin.id,
          nodeId: parentNode.id,
          label: `@${parentNode.data.shortId}_PIN_${idx + 1}`,
          shortId: parentNode.data.shortId,
          index: idx + 1
        });
      });
    }
    
    // 2. Other nodes' outputs
    nodes.filter(n => n.id !== nodeId && n.id !== parentNode?.id).forEach(n => {
      // Add variants for each output port
      list.push({
        type: 'node',
        id: n.id,
        port: 'PROMPT',
        label: `@${n.data.shortId}_PROMPT`,
        shortId: n.data.shortId
      });
      list.push({
        type: 'node',
        id: n.id,
        port: 'TEXT',
        label: `@${n.data.shortId}_TEXT`,
        shortId: n.data.shortId
      });
      list.push({
        type: 'node',
        id: n.id,
        port: 'IMAGE',
        label: `@${n.data.shortId}_IMAGE`,
        shortId: n.data.shortId
      });
    });

    const filtered = list.filter(s => s.label.toLowerCase().includes(suggestionQuery.toLowerCase()));
    return filtered;
  }, [nodes, parentNode, nodeId, suggestionQuery]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Calculate cursor position for suggestions
  const updateSuggestionPosition = () => {
    if (!textareaRef.current || !mirrorRef.current) return;
    const textBeforeCursor = value.substring(0, cursorPos);
    
    // Create a temporary span to measure text
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre-wrap';
    span.style.font = window.getComputedStyle(textareaRef.current).font;
    span.textContent = textBeforeCursor;
    document.body.appendChild(span);
    
    const rect = textareaRef.current.getBoundingClientRect();
    const { width, height } = span.getBoundingClientRect();
    
    // Simple estimation for multi-line
    const lineHeight = parseInt(window.getComputedStyle(textareaRef.current).lineHeight);
    const lines = Math.floor(width / rect.width);
    
    setSuggestionPos({
      top: Math.min(height + lineHeight, 150), // Cap it
      left: Math.min(width % rect.width, rect.width - 200)
    });
    
    document.body.removeChild(span);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setCursorPos(pos);
    onChange(val);

    // Check for @ trigger
    const lastAtPos = val.lastIndexOf('@', pos - 1);
    if (lastAtPos !== -1) {
      const query = val.substring(lastAtPos + 1, pos);
      if (!query.includes(' ') && !query.includes('\n')) {
        setSuggestionQuery(query);
        setShowSuggestions(true);
        updateSuggestionPosition();
        return;
      }
    }
    setShowSuggestions(false);
  };

  const handleSelectionChange = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Only snap if it's a single cursor (not a range selection)
    if (start === end) {
      // Regex to find tags: @IMG_n_PIN_m or @IMG_n_SUFFIX
      const tagRegex = /@IMG_\d+(?:_PIN_\d+|_TEXT|_IMAGE|_PROMPT)?/g;
      let match;
      while ((match = tagRegex.exec(value)) !== null) {
        const tagStart = match.index;
        const tagEnd = tagStart + match[0].length;

        // If cursor is inside the tag (but not at the very edges)
        if (start > tagStart && start < tagEnd) {
          // Snap to the nearest edge
          const newPos = (start - tagStart < tagEnd - start) ? tagStart : tagEnd;
          textarea.setSelectionRange(newPos, newPos);
          setCursorPos(newPos);
          break;
        }
      }
    }
  };

  const insertSuggestion = (suggestion: any) => {
    // Find the start of the current @ query
    const lastAtPos = value.lastIndexOf('@', cursorPos - 1);
    if (lastAtPos === -1) return;

    const newValue = value.substring(0, lastAtPos) + suggestion.label + ' ' + value.substring(cursorPos);
    onChange(newValue);
    setShowSuggestions(false);
    
    // Set cursor to end of inserted label
    const newPos = lastAtPos + suggestion.label.length + 1;
    setCursorPos(newPos);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const renderContent = () => {
    // Regex to match @IMG_n_PIN_m or @IMG_n_SUFFIX
    const parts = value.split(/(@IMG_\d+(?:_PIN_\d+|_TEXT|_IMAGE|_PROMPT)?)/g);
    
    return parts.map((part, i) => {
      const pinMatch = part.match(/@IMG_(\d+)_PIN_(\d+)/);
      const nodeMatch = part.match(/@IMG_(\d+)(?:_(TEXT|IMAGE|PROMPT))?/);
      
      if (pinMatch || nodeMatch) {
        let isInvalid = false;
        let type: 'pin' | 'node' = 'node';
        let port: string = 'IMAGE';
        let targetNode: any = null;
        let pinIdx = 0;

        if (pinMatch) {
          type = 'pin';
          const imgNum = pinMatch[1];
          pinIdx = parseInt(pinMatch[2]);
          targetNode = nodes.find(n => n.data.shortId === `IMG_${imgNum}`);
          const pin = targetNode?.data.pins?.[pinIdx - 1];
          isInvalid = !pin;
        } else if (nodeMatch) {
          type = 'node';
          const imgNum = nodeMatch[1];
          port = nodeMatch[2] || 'IMAGE';
          targetNode = nodes.find(n => n.data.shortId === `IMG_${imgNum}`);
          isInvalid = !targetNode || !targetNode.data.outputs?.[port.toLowerCase()];
          
          // Special case for PROMPT: it's always valid if node exists
          if (port === 'PROMPT' && targetNode) isInvalid = false;
        }

        const getTagColor = () => {
          if (isInvalid) return "text-red-400 bg-red-500/10 border-red-500/20";
          if (type === 'pin') return "text-blue-400 bg-blue-500/10 border-blue-500/20";
          if (port === 'TEXT') return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
          if (port === 'IMAGE') return "text-red-400 bg-red-500/10 border-red-500/20";
          if (port === 'PROMPT') return "text-blue-400 bg-blue-500/10 border-blue-500/20";
          return "text-purple-400 bg-purple-500/10 border-purple-500/20";
        };

        return (
          <span
            key={i}
            className="relative inline text-transparent select-none"
          >
            {part}
            <span
              className={clsx(
                "absolute inset-y-[1px] left-0 right-0 px-1 rounded flex items-center gap-1 whitespace-nowrap pointer-events-auto cursor-pointer transition-all hover:brightness-125 z-20 border",
                getTagColor()
              )}
              style={{ 
                fontSize: '11px', 
                fontWeight: '600',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isInvalid && type === 'pin') {
                  setRecoveryPin({ nodeId: targetNode?.id || '', pinId: pinMatch?.[2] || '', label: part });
                  return;
                }
                const index = value.indexOf(part);
                if (textareaRef.current) {
                  textareaRef.current.setSelectionRange(index + part.length, index + part.length);
                  textareaRef.current.focus();
                }
              }}
              onMouseEnter={() => {
                if (type === 'pin' && !isInvalid) {
                  const pin = targetNode.data.pins[pinIdx - 1];
                  setHoveredPin({ id: pin.id, nodeId: targetNode.id, index: pinIdx });
                }
              }}
              onMouseLeave={() => setHoveredPin(null)}
            >
              {type === 'pin' ? <MapPin size={10} fill="currentColor" /> : (
                port === 'IMAGE' ? <ImageIcon size={10} /> : <Hash size={10} />
              )}
              {part}
            </span>
          </span>
        );
      }
      return <span key={i} className="text-white/90">{part}</span>;
    });
  };

  const node = nodes.find(n => n.id === nodeId) as TapNode | undefined;

  return (
    <div 
      className="relative w-full bg-[#050505] border border-[var(--app-border)] rounded-xl p-3 focus-within:border-[var(--brand-red)] transition-all min-h-[120px] flex flex-col gap-2 cursor-text nodrag nopan"
      onMouseMove={handleMouseMove}
      onClick={() => textareaRef.current?.focus()}
    >
      {/* Thumbnail Reference Bar */}
      {(referencedNodes.length > 0 || ((node?.data.inputs as any)?.image)) && (
        <div className="flex items-center gap-2 pb-2 border-b border-white/5 overflow-x-auto no-scrollbar">
          {/* Uploaded Image */}
          {(node?.data.inputs as any)?.image && (
            <div className="relative group/thumb flex-shrink-0">
              <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-white/20 bg-black shadow-lg transition-all group-hover/thumb:border-white/40">
                <img src={(node?.data.inputs as any)?.image as string} className="w-full h-full object-cover" alt="Upload" referrerPolicy="no-referrer" />
                <div className="absolute top-0 left-0 bg-black/60 p-0.5 rounded-br">
                  <ImageIcon size={8} className="text-white" />
                </div>
              </div>
            </div>
          )}

          {/* Referenced Nodes */}
          {referencedNodes.map((node, idx) => (
            <div key={node.id} className="relative group/thumb flex-shrink-0">
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-dashed border-white/20 bg-black shadow-lg transition-all group-hover/thumb:border-[var(--brand-red)] group-hover/thumb:scale-105">
                {node.data.outputs?.image ? (
                  <img src={node.data.outputs.image as string} className="w-full h-full object-cover opacity-80 group-hover/thumb:opacity-100" alt="Ref" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--app-text-muted)]">
                    <Hash size={16} />
                  </div>
                )}
                <div className="absolute top-0 right-0 bg-black/80 text-white text-[8px] font-bold px-1 rounded-bl-lg border-l border-b border-white/10">
                  {idx + 1}
                </div>
              </div>
              <button 
                onClick={(e) => handleRemoveReference(e, node.id)}
                className="absolute -top-1.5 -right-1.5 bg-black border border-white/20 rounded-full p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-600 z-10"
              >
                <X size={8} className="text-white" />
              </button>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-white/10 rounded text-[7px] text-white font-bold uppercase tracking-widest opacity-0 group-hover/thumb:opacity-100 pointer-events-none whitespace-nowrap z-50">
                {node.data.shortId}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1 flex-1">
        <label className="text-[9px] font-display uppercase tracking-widest text-[var(--app-text-muted)]">Prompt</label>
        
        <div className="relative w-full min-h-[80px] text-[13px] font-mono leading-[20px] tracking-normal">
          <style>
            {`
              .prompt-textarea::selection {
                background: rgba(59, 130, 246, 0.3);
                color: transparent;
              }
              .prompt-textarea {
                caret-color: white;
                -webkit-text-fill-color: transparent;
              }
            `}
          </style>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextChange}
            onSelect={handleSelectionChange}
            spellCheck={false}
            onKeyDown={(e) => {
              if (showSuggestions && suggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev + 1) % suggestions.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
                } else if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  insertSuggestion(suggestions[selectedIndex]);
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                }
              }
            }}
            className="prompt-textarea absolute inset-0 w-full h-full bg-transparent resize-none focus:outline-none z-10 p-0 m-0 border-none overflow-hidden"
            style={{ 
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit',
              padding: '0',
              margin: '0',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
            placeholder="Describe your creation... Use @ to reference pins or nodes."
          />
          <div 
            ref={mirrorRef} 
            className="whitespace-pre-wrap break-words pointer-events-none p-0 m-0 border-none min-h-[80px]"
            style={{ 
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit',
              letterSpacing: 'inherit',
              padding: '0',
              margin: '0',
              wordBreak: 'break-word'
            }}
          >
            {renderContent()}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'model' ? null : 'model'); }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10"
            >
              <Hash size={12} className="text-[var(--brand-red)]" />
              {currentModel ? currentModel.model.name : 'Select Model'}
              <ChevronUp size={10} className={clsx("transition-transform", activeDropdown === 'model' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'model' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl z-[110] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)]">Available Models</div>
                  <div className="max-h-48 overflow-y-auto">
                    {availableModels.map(({ provider, model }) => (
                      <button
                        key={`${provider.id}-${model.id}`}
                        onClick={() => handleModelSelect(provider.id, model.id)}
                        className={clsx(
                          "w-full px-3 py-2 text-left text-[10px] hover:bg-white/5 flex flex-col gap-0.5 transition-colors",
                          currentModel?.model.id === model.id ? "bg-[var(--brand-red)]/20 text-[var(--brand-red)]" : "text-white"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{model.name}</span>
                          {currentModel?.model.id === model.id && <Check size={10} />}
                        </div>
                        <span className="text-[8px] opacity-60 uppercase">{provider.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {(nodeType === 'image' || nodeType === 'video') && (
            <>
              {/* Resolution Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'resolution' ? null : 'resolution'); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10"
                >
                  {currentResolution}
                  <ChevronUp size={10} className={clsx("transition-transform", activeDropdown === 'resolution' && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {activeDropdown === 'resolution' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-32 bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl z-[110] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)]">
                        {nodeType === 'video' ? 'Resolution' : 'Quality'}
                      </div>
                      <div className="p-1">
                        {supportedResolutions.map((res) => (
                          <button
                            key={res}
                            onClick={() => handleResolutionSelect(res)}
                            className={clsx(
                              "w-full px-3 py-1.5 text-left text-[10px] rounded-lg hover:bg-white/5 flex items-center justify-between transition-colors",
                              currentResolution === res ? "bg-[var(--brand-red)]/20 text-[var(--brand-red)]" : "text-white"
                            )}
                          >
                            <span>{res}</span>
                            {currentResolution === res && <Check size={10} />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Aspect Ratio Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'ratio' ? null : 'ratio'); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10"
                >
                  {(() => {
                    const ratio = ASPECT_RATIOS.find(r => r.value === currentAspectRatio);
                    return ratio ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                          {ratio.icon({})}
                        </svg>
                        {ratio.label}
                      </>
                    ) : currentAspectRatio;
                  })()}
                  <ChevronUp size={10} className={clsx("transition-transform", activeDropdown === 'ratio' && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {activeDropdown === 'ratio' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl z-[110] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)] flex justify-between items-center">
                        <span>Aspect Ratio</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        {['Landscape', 'Standard', 'Square', 'Portrait'].map(group => {
                          const groupRatios = supportedRatios.filter(r => r.group === group);
                          if (groupRatios.length === 0) return null;
                          return (
                            <div key={group} className="mb-2 last:mb-0">
                              <div className="px-2 py-1 text-[7px] uppercase tracking-tighter text-[var(--app-text-muted)] font-bold">{group}</div>
                              {groupRatios.map((ratio) => (
                                <button
                                  key={ratio.value}
                                  onClick={() => handleRatioSelect(ratio.value)}
                                  className={clsx(
                                    "w-full px-2 py-1.5 text-left text-[10px] rounded-lg hover:bg-white/5 flex items-center justify-between transition-colors",
                                    currentAspectRatio === ratio.value ? "bg-[var(--brand-red)]/20 text-[var(--brand-red)]" : "text-white"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                                      {ratio.icon({})}
                                    </svg>
                                    <span>{ratio.label}</span>
                                  </div>
                                  {currentAspectRatio === ratio.value && <Check size={10} />}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Suggestions Popover */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl overflow-hidden z-[100] w-64"
            style={{ 
              top: suggestionPos.top + 20, 
              left: suggestionPos.left 
            }}
          >
            <div className="p-2 border-b border-[var(--app-border)] bg-black/20 text-[8px] uppercase tracking-widest font-bold text-[var(--app-text-muted)]">
              Suggestions
            </div>
            <div className="max-h-48 overflow-y-auto">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s.type}-${s.id}-${idx}`}
                  onClick={() => insertSuggestion(s)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={clsx(
                    "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors group",
                    idx === selectedIndex ? "bg-[var(--brand-red)]/40" : "hover:bg-[var(--brand-red)]/20"
                  )}
                >
                  {s.type === 'pin' ? <MapPin size={12} className="text-blue-400" /> : (
                    s.port === 'IMAGE' ? <ImageIcon size={12} className="text-red-400" /> : <Hash size={12} className="text-emerald-400" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white">{s.label}</span>
                    <span className="text-[8px] text-[var(--app-text-muted)] group-hover:text-white/60">
                      {s.type === 'pin' ? `Pin from ${s.shortId}` : `${s.port} output from ${s.shortId}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recovery Dialog */}
      <AnimatePresence>
        {recoveryPin && (
          <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[var(--app-panel)] border border-[var(--app-border)] rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4"
            >
              <h3 className="text-lg font-display font-bold text-white mb-2">Restore PIN?</h3>
              <p className="text-sm text-[var(--app-text-muted)] mb-6">
                The reference <span className="text-red-400 font-mono">{recoveryPin.label}</span> is invalid because the source PIN was deleted. Would you like to restore it?
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    restorePin(recoveryPin.nodeId, recoveryPin.pinId);
                    setRecoveryPin(null);
                  }}
                  className="w-full py-2 bg-[var(--brand-red)] text-white rounded-xl font-bold hover:brightness-110 transition-all"
                >
                  Restore PIN
                </button>
                <button 
                  onClick={() => {
                    // Logic to remove the tag from prompt could go here
                    setRecoveryPin(null);
                  }}
                  className="w-full py-2 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all"
                >
                  Keep as Invalid
                </button>
                <button 
                  onClick={() => setRecoveryPin(null)}
                  className="w-full py-2 text-[var(--app-text-muted)] hover:text-white transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hover Preview */}
      <AnimatePresence>
        {hoveredPin && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-[9999] pointer-events-none"
            style={{ 
              left: mousePos.x + 20, 
              top: mousePos.y - 120 
            }}
          >
            {(() => {
              const targetNode = nodes.find(n => n.id === hoveredPin.nodeId);
              if (!targetNode?.data.outputs?.image) return null;
              return (
                <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden border border-white/20 shadow-2xl ring-1 ring-black">
                  <img 
                    src={targetNode.data.outputs?.image} 
                    className="w-full h-full object-cover opacity-60" 
                    alt="Preview"
                    referrerPolicy="no-referrer"
                  />
                  {(() => {
                    const pin = targetNode.data.pins?.find(p => p.id === hoveredPin.id);
                    if (!pin) return null;
                    return (
                      <div 
                        className="absolute w-4 h-4 -ml-2 -mt-2 flex items-center justify-center"
                        style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                      >
                        <div className="relative">
                          <MapPin size={24} className="text-[var(--brand-red)] drop-shadow-[0_0_10px_rgba(153,27,27,1)]" fill="currentColor" />
                          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold pb-1">
                            {hoveredPin.index}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[8px] text-white font-bold uppercase tracking-widest">
                    Source: {targetNode.data.label} ({targetNode.data.shortId})
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
