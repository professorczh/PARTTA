import React, { useRef, useState, useEffect, useMemo } from 'react';
import { MapPin, X, Image as ImageIcon, Hash } from 'lucide-react';
import { useTapStore, TapNode, Pin } from './store';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'motion/react';

interface PromptInputProps {
  nodeId: string;
  value: string;
  onChange: (val: string) => void;
  referencedPins: string[];
  parentNode: TapNode | null;
}

export const PromptInput = ({ nodeId, value, onChange, referencedPins, parentNode }: PromptInputProps) => {
  const nodes = useTapStore(state => state.nodes);
  const removeReferencedPin = useTapStore(state => state.removeReferencedPin);
  
  const [hoveredPin, setHoveredPin] = useState<{ id: string; nodeId: string; index: number } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

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
      list.push({
        type: 'node',
        id: n.id,
        label: `@${n.data.shortId}`,
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
      // Regex to find tags: @IMG_n_PIN_m or @IMG_n
      const tagRegex = /@IMG_\d+(?:_PIN_\d+)?/g;
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
    // Regex to match @IMG_n_PIN_m or @IMG_n
    const parts = value.split(/(@IMG_\d+(?:_PIN_\d+)?)/g);
    
    return parts.map((part, i) => {
      const pinMatch = part.match(/@IMG_(\d+)_PIN_(\d+)/);
      const nodeMatch = part.match(/@IMG_(\d+)$/);
      
      if (pinMatch || nodeMatch) {
        let isInvalid = false;
        let type: 'pin' | 'node' = 'node';
        let label = part;
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
          targetNode = nodes.find(n => n.data.shortId === `IMG_${imgNum}`);
          isInvalid = !targetNode;
        }

        return (
          <span
            key={i}
            className="relative inline text-transparent select-none"
          >
            {part}
            <span
              className={clsx(
                "absolute inset-y-[-2px] left-1/2 -translate-x-1/2 px-1.5 rounded flex items-center gap-1 whitespace-nowrap pointer-events-auto cursor-pointer transition-all hover:brightness-110 z-20",
                type === 'pin' 
                  ? (isInvalid ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-blue-500/20 border border-blue-500/40 text-blue-400")
                  : (isInvalid ? "bg-red-500/20 border border-red-500/40 text-red-400" : "bg-purple-500/20 border border-purple-500/40 text-purple-400")
              )}
              style={{ 
                fontSize: '9px', 
                fontWeight: 'bold',
                // Ensure the chip is at least as wide as the text but can be slightly wider
                minWidth: '100%' 
              }}
              onClick={(e) => {
                e.stopPropagation();
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
              {type === 'pin' ? <MapPin size={10} fill="currentColor" /> : <ImageIcon size={10} />}
              {part}
            </span>
          </span>
        );
      }
      return <span key={i} className="text-white">{part}</span>;
    });
  };

  return (
    <div 
      className="relative w-full bg-[#050505] border border-[var(--app-border)] rounded-xl p-3 focus-within:border-[var(--brand-red)] transition-all min-h-[120px] flex flex-col gap-2 cursor-text nodrag nopan"
      onMouseMove={handleMouseMove}
      onClick={() => textareaRef.current?.focus()}
    >
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
                  {s.type === 'pin' ? <MapPin size={12} className="text-blue-400" /> : <ImageIcon size={12} className="text-purple-400" />}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white">{s.label}</span>
                    <span className="text-[8px] text-[var(--app-text-muted)] group-hover:text-white/60">
                      {s.type === 'pin' ? `Pin from ${s.shortId}` : `Output from ${s.shortId}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
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
              if (!targetNode?.data.output) return null;
              return (
                <div className="w-48 aspect-video bg-black rounded-lg overflow-hidden border border-white/20 shadow-2xl ring-1 ring-black">
                  <img 
                    src={targetNode.data.output} 
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
