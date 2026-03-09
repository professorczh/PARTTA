import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTapStore, TapNode, ProviderConfig, ModelConfig, HistoryItem } from './store';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Settings2, Image as ImageIcon, Type, ChevronUp, Check, Hash, Play, Video, X, Eye, Edit3, Terminal, Loader2, Lock } from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { MentionEditor } from './components/MentionEditor';
import { cn } from './lib/utils';
import { resolvePrompt } from './utils/promptResolver';
import { useReactFlow } from '@xyflow/react';
import { aiService } from './services/aiService';

import { RatioIcon } from './components/RatioIcon';
import { Maximize, Minimize } from 'lucide-react';

interface NodePromptInputProps {
  node: TapNode;
  selected: boolean;
  isPinned?: boolean;
  onRun?: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

type ViewMode = 'edit' | 'prev' | 'raw';

const RATIOS = [
  { label: '1:1', value: '1:1' },
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '3:4', value: '3:4' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '2:3', value: '2:3' },
  { label: '5:4', value: '5:4' },
  { label: '4:5', value: '4:5' },
  { label: '21:9', value: '21:9' },
];

const SIZES = [
  { label: '512P', value: '512px' },
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
];

export const NodePromptInput = ({ node, selected, isPinned, onRun, onExpandChange }: NodePromptInputProps) => {
  const [prompt, setPrompt] = useState(node.data.prompt || '');
  const promptViewMode = node.data.promptViewMode || 'edit';
  const setPromptViewMode = (mode: ViewMode) => updateNodeData(node.id, { promptViewMode: mode });
  const updateNodeData = useTapStore((state) => state.updateNodeData);
  const addNode = useTapStore((state) => state.addNode);
  const addHistoryItem = useTapStore((state) => state.addHistoryItem);
  const isDemoMode = useTapStore((state) => state.isDemoMode);
  const nodes = useTapStore((state) => state.nodes);
  const edges = useTapStore((state) => state.edges);
  const providers = useTapStore((state) => state.providers);
  const globalDefaults = useTapStore((state) => state.globalDefaults);
  const onConnect = useTapStore((state) => state.onConnect);
  const setEdges = useTapStore((state) => state.setEdges);
  const skipDeleteConfirm = useTapStore((state) => state.skipDeleteConfirm);
  const setSkipDeleteConfirm = useTapStore((state) => state.setSkipDeleteConfirm);
  const skipOverwriteConfirm = useTapStore((state) => state.skipOverwriteConfirm);
  const setSkipOverwriteConfirm = useTapStore((state) => state.setSkipOverwriteConfirm);

  const { screenToFlowPosition, flowToScreenPosition, getNodes, getEdges } = useReactFlow();
  const [isGenerating, setIsGenerating] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{ nodeId: string, mentionText: string } | null>(null);

  // Sync internal state with node data
  useEffect(() => {
    setPrompt(node.data.prompt || '');
  }, [node.data.prompt]);

  // Calculate the fully resolved output for this node
  const resolvedData = useMemo(() => {
    const resolved = resolvePrompt(node.data.prompt || '', nodes, edges, node.id);
    if (node.data.includeTitleInOutput) {
      const titlePrefix = `${node.data.label || 'Text'}:\n`;
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
  }, [node.data.prompt, node.data.label, node.data.includeTitleInOutput, nodes, node.id]);

  // Find parent nodes
  const parentNodes = useMemo(() => {
    const parentIds = edges
      .filter(e => e.target === node.id)
      .map(e => e.source);
    return nodes.filter(n => parentIds.includes(n.id));
  }, [node.id, nodes, edges]);

  // Filter image parents for thumbnails
  const referencedNodes = useMemo(() => {
    // Fix: Use [^\]]*? instead of .*? to prevent greedy matching
    const mentionRegex = /\[@ [^\]]*? \((.*?)\)\]/g;
    const matches = [...prompt.matchAll(mentionRegex)];
    const shortIds = matches.map(m => m[1]);
    return nodes.filter(n => shortIds.includes(n.data.shortId));
  }, [prompt, nodes]);

  const [activeDropdown, setActiveDropdown] = useState<'model' | 'mention' | 'settings' | 'thinking' | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');

  const setExpanded = (expanded: boolean) => {
    setIsExpanded(expanded);
    onExpandChange?.(expanded);
  };

  // Reset expansion and dropdowns when node is deselected
  useEffect(() => {
    if (!selected) {
      setExpanded(false);
      setActiveDropdown(null);
    }
  }, [selected]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // If no dropdown is active, do nothing
      if (!activeDropdown) return;

      // Check if click is inside the dropdown or the trigger buttons
      const target = e.target as HTMLElement;
      const isDropdownClick = target.closest('.dropdown-container');
      const isTriggerClick = target.closest('.dropdown-trigger');

      if (!isDropdownClick && !isTriggerClick) {
        setActiveDropdown(null);
      }
    };

    if (activeDropdown) {
      window.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    const handleGlobalUp = (e: Event) => {
      if (isSelectingRef.current) {
        // Stop propagation for pointerup/mouseup
        e.stopPropagation();
        
        // Immediately remove the visual lock to prevent "stuck" cursor
        const styleEl = document.getElementById('global-cursor-lock');
        if (styleEl) {
          styleEl.remove();
        }

        // Delay resetting the flag slightly to ensure we also catch the subsequent 'click' event
        // which fires immediately after mouseup/pointerup
        setTimeout(() => {
          isSelectingRef.current = false;
        }, 10);
      }
    };

    const handleGlobalClick = (e: Event) => {
      if (isSelectingRef.current) {
        // Allow interaction with the textarea itself
        if (e.target instanceof Node && textareaRef.current?.contains(e.target)) {
          return;
        }

        // Stop the click event from reaching React Flow
        e.stopPropagation();
        e.preventDefault();
      }
    };

    // Capture ALL relevant events
    window.addEventListener('pointerup', handleGlobalUp, { capture: true });
    window.addEventListener('mouseup', handleGlobalUp, { capture: true });
    window.addEventListener('click', handleGlobalClick, { capture: true });

    return () => {
      window.removeEventListener('pointerup', handleGlobalUp, { capture: true });
      window.removeEventListener('mouseup', handleGlobalUp, { capture: true });
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  // Filter nodes for mentions (passed to editor)
  const mentionCandidates = useMemo(() => {
    return nodes.filter(n => n.id !== node.id);
  }, [nodes, node.id]);

  const handleEditorChange = (newPrompt: string) => {
    // Detect changes before updating state
    const mentionRegex = /\[@ .*? \((.*?)\)\]/g;
    const oldMatches = [...prompt.matchAll(mentionRegex)];
    const newMatches = [...newPrompt.matchAll(mentionRegex)];
    
    const oldMentionIds = oldMatches.map(m => nodes.find(n => n.data.shortId === m[1])?.id).filter(Boolean) as string[];
    const newMentionIds = newMatches.map(m => nodes.find(n => n.data.shortId === m[1])?.id).filter(Boolean) as string[];

    // Update state first
    setPrompt(newPrompt);
    updateNodeData(node.id, { prompt: newPrompt });

    // Detect additions
    newMentionIds.forEach(sourceId => {
      if (!oldMentionIds.includes(sourceId)) {
        // Check if edge already exists
        const edgeExists = edges.some(e => e.source === sourceId && e.target === node.id);
        if (!edgeExists) {
          onConnect({
            source: sourceId,
            target: node.id,
            sourceHandle: null,
            targetHandle: 'input-main'
          });
        }
      }
    });

    // Detect deletions
    oldMentionIds.forEach(sourceId => {
      if (!newMentionIds.includes(sourceId)) {
        if (skipDeleteConfirm) {
          setEdges(edges.filter(e => !(e.source === sourceId && e.target === node.id)));
        } else {
          const targetNode = nodes.find(n => n.id === sourceId);
          setPendingDeletion({ 
            nodeId: sourceId, 
            mentionText: targetNode ? `[@ ${targetNode.data.label} (${targetNode.data.shortId})]` : 'reference' 
          });
          setShowConfirmModal(true);
        }
      }
    });
  };

  const handleConfirmDelete = () => {
    if (pendingDeletion) {
      setEdges(edges.filter(e => !(e.source === pendingDeletion.nodeId && e.target === node.id)));
      setPendingDeletion(null);
      setShowConfirmModal(false);
    }
  };

  const handleCancelDelete = () => {
    setPendingDeletion(null);
    setShowConfirmModal(false);
  };

  const handleSend = async () => {
    if (isGenerating) return;
    
    if (node.type === 'image-node') {
      const uploadedImages = node.data.uploadedImages || [];
      if (uploadedImages.length > 0) {
        await handleBranch();
      } else {
        await handleIterate();
      }
    } else if (node.type === 'text-node' || node.type === 'none') {
      const currentContent = node.data.outputs?.text || '';
      if (currentContent.trim() && !skipOverwriteConfirm) {
        setShowOverwriteModal(true);
      } else {
        await handleGenerateText();
      }
    } else {
      if (onRun) {
        onRun();
      } else {
        console.log('Generating from:', node.id, 'with prompt:', prompt);
        if (!node.data.isLocked) {
          updateNodeData(node.id, { isLocked: true });
        }
      }
    }
  };

  const handleGenerateText = async () => {
    if (!currentModel) return;
    setIsGenerating(true);
    updateNodeData(node.id, { isLoading: true });

    try {
      const resolved = resolvePrompt(prompt, nodes, edges, node.id);
      const request = {
        prompt: resolved.prompt,
        images: resolved.images,
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode,
        thinkingLevel: node.data.config?.thinkingLevel,
        thoughtSignature: node.data.thoughtSignature
      };

      const response = await aiService.generate(request);
      
      if (response.text) {
        const historyItem: HistoryItem = {
          id: `hist-${Date.now()}`,
          text: response.text,
          prompt: prompt,
          config: node.data.config || {},
          timestamp: Date.now(),
          thoughtSignature: response.thoughtSignature
        };
        
        updateNodeData(node.id, { 
          outputs: { ...node.data.outputs, text: response.text },
          thoughtSignature: response.thoughtSignature,
          history: [...(node.data.history || []), historyItem],
          selectedHistoryId: historyItem.id,
          isLoading: false,
          isGenerated: true, // Mark as generated to intercept pass-through
          viewMode: 'prev' // Automatically switch node body to preview
        });
      } else {
        const errorMsg = response.error || 'Unknown error occurred';
        console.error('Text generation failed:', errorMsg);
        alert(`Generation failed: ${errorMsg}`);
        updateNodeData(node.id, { isLoading: false });
      }
    } catch (error) {
      console.error('Text generation failed:', error);
      updateNodeData(node.id, { isLoading: false });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBranch = async () => {
    if (!currentModel) return;
    setIsGenerating(true);
    
    try {
      // 1. Create new node to the right
      const newNodeId = `node-${Date.now()}`;
      const nodeWidth = 360;
      const spacing = 80;
      const newPos = {
        x: node.position.x + nodeWidth + spacing,
        y: node.position.y
      };

      // 2. Prepare generation request
      const resolved = resolvePrompt(prompt, nodes, edges, node.id);
      const uploadedImage = node.data.uploadedImages?.[0];
      
      const request = {
        prompt: resolved.prompt,
        images: [
          ...(uploadedImage ? [{ data: uploadedImage.url, mimeType: 'image/png' }] : []),
          ...resolved.images
        ],
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode,
        aspectRatio: currentRatio,
        imageSize: currentSize,
        thinkingLevel: node.data.config?.thinkingLevel,
        thoughtSignature: node.data.thoughtSignature
      };

      // 3. Add the new node in loading state
      addNode({
        id: newNodeId,
        type: 'image-node',
        position: newPos,
        style: { width: nodeWidth, height: 400 },
        data: {
          type: 'image',
          label: `${node.data.label} (Gen)`,
          prompt: prompt, // Inherit prompt
          isLoading: true,
          outputs: { image: '' },
          outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
          activeOutputMode: 'image',
          parentId: node.id,
          config: {
            ...node.data.config
          }
        }
      });

      // 4. Create edge from source to new node (Evolution link)
      onConnect({
        source: node.id,
        target: newNodeId,
        sourceHandle: 'output-image',
        targetHandle: 'input-main'
      });

      // 5. Generate
      const response = await aiService.generate(request);
      
      if (response.imageUrl) {
        const historyItem: HistoryItem = {
          id: `hist-${Date.now()}`,
          url: response.imageUrl,
          prompt: prompt,
          config: node.data.config || {},
          timestamp: Date.now(),
          thoughtSignature: response.thoughtSignature
        };
        
        updateNodeData(newNodeId, { 
          isLoading: false, 
          outputs: { ...node.data.outputs, image: response.imageUrl },
          history: [historyItem],
          selectedHistoryId: historyItem.id,
          thoughtSignature: response.thoughtSignature
        });
      } else {
        updateNodeData(newNodeId, { isLoading: false });
        const errorMsg = response.error || 'Unknown error occurred';
        console.error('Generation failed:', errorMsg);
        alert(`Generation failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Branching failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIterate = async () => {
    if (!currentModel) return;
    setIsGenerating(true);
    updateNodeData(node.id, { isLoading: true });

    try {
      const resolved = resolvePrompt(prompt, nodes, edges, node.id);
      const uploadedImage = node.data.uploadedImages?.[0];

      const request = {
        prompt: resolved.prompt,
        images: [
          ...(uploadedImage ? [{ data: uploadedImage.url, mimeType: 'image/png' }] : []),
          ...resolved.images
        ],
        modelId: currentModel.model.id,
        provider: currentModel.provider,
        isDemoMode,
        aspectRatio: currentRatio,
        imageSize: currentSize,
        thinkingLevel: node.data.config?.thinkingLevel,
        thoughtSignature: node.data.thoughtSignature
      };

      const response = await aiService.generate(request);
      
      if (response.imageUrl) {
        const historyItem: HistoryItem = {
          id: `hist-${Date.now()}`,
          url: response.imageUrl,
          prompt: prompt,
          config: node.data.config || {},
          timestamp: Date.now(),
          thoughtSignature: response.thoughtSignature
        };
        addHistoryItem(node.id, historyItem);
        updateNodeData(node.id, { thoughtSignature: response.thoughtSignature });
      } else {
        const errorMsg = response.error || 'Unknown error occurred';
        console.error('Iteration failed:', errorMsg);
        alert(`Generation failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Iteration failed:', error);
    } finally {
      setIsGenerating(false);
      updateNodeData(node.id, { isLoading: false });
    }
  };

  // Available models for this output mode
  const availableModels = useMemo(() => {
    const list: { provider: ProviderConfig; model: ModelConfig }[] = [];
    providers.filter(p => p.enabled).forEach(p => {
      p.models.filter(m => m.enabled).forEach(m => {
        if (node.data.activeOutputMode === 'text' && m.capabilities.text) list.push({ provider: p, model: m });
        if (node.data.activeOutputMode === 'image' && m.capabilities.image) list.push({ provider: p, model: m });
        if (node.data.activeOutputMode === 'video' && m.capabilities.video) list.push({ provider: p, model: m });
      });
    });
    return list;
  }, [providers, node.data.activeOutputMode]);

  const currentModel = useMemo(() => {
    const modelKey = node.data.config?.model || (globalDefaults[node.data.activeOutputMode as keyof typeof globalDefaults] as string);
    if (modelKey && typeof modelKey === 'string') {
      const [pId, mId] = modelKey.split(':');
      const p = providers.find(p => p.id === pId);
      const m = p?.models.find(m => m.id === mId);
      if (p && m && p.enabled && m.enabled) return { provider: p, model: m };
    }
    return availableModels[0] || null;
  }, [node.data.config?.model, node.data.activeOutputMode, globalDefaults, availableModels, providers]);

  const performDeletion = (nodeId: string, mentionText: string) => {
    // Remove mention from prompt
    const newPrompt = prompt.replace(mentionText, '').trim();
    setPrompt(newPrompt);
    updateNodeData(node.id, { prompt: newPrompt });

    // Remove the edge connecting the nodes
    const edgeToRemove = edges.find(e => e.source === nodeId && e.target === node.id);
    if (edgeToRemove) {
      setEdges(edges.filter(e => e.id !== edgeToRemove.id));
    }
    
    setShowConfirmModal(false);
    setPendingDeletion(null);
  };

  const handleRemoveMention = (refNode: TapNode) => {
    const mentionText = `[@ ${refNode.data.label} (${refNode.data.shortId})]`;
    
    if (skipDeleteConfirm) {
      performDeletion(refNode.id, mentionText);
    } else {
      setPendingDeletion({ nodeId: refNode.id, mentionText });
      setShowConfirmModal(true);
    }
  };

  const handleModelSelect = (pId: string, mId: string) => {
    updateNodeData(node.id, { config: { ...node.data.config, model: `${pId}:${mId}` } });
    setActiveDropdown(null);
  };

  const currentRatio = node.data.config?.aspectRatio || '1:1';
  const currentSize = node.data.config?.imageSize || '1K';

  const handleRatioSelect = (ratio: string) => {
    updateNodeData(node.id, { config: { ...node.data.config, aspectRatio: ratio } });
  };

  const handleSizeSelect = (size: string) => {
    updateNodeData(node.id, { config: { ...node.data.config, imageSize: size } });
  };

  const handleTypeSelect = (mode: 'text' | 'image' | 'video') => {
    updateNodeData(node.id, { activeOutputMode: mode });
  };

  const isShiftPressed = useTapStore((state) => state.isShiftPressed);
  const isTextNode = node.type === 'text-node';
  const isImageNode = node.type === 'image-node';
  const isVideoNode = node.type === 'video-node';
  
  // All nodes now use the "Drawer" mode (hiding behind the node)
  const isDrawerMode = isTextNode || isImageNode || isVideoNode;
  
  // TextNode collapses on hover-out, Image/Video nodes collapse on Shift
  const isCollapsed = isTextNode ? !isExpanded : isShiftPressed;

  if (!selected) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: isDrawerMode ? -340 : 20 }}
      animate={{ 
        opacity: 1, 
        y: isDrawerMode 
          ? (isCollapsed ? -284 : (isPinned ? -15 : 0))
          : (isPinned ? -15 : 0),
        zIndex: isDrawerMode ? 0 : 110 // Always stay behind the body (z-10) in drawer mode, but above ports (z-100) in floating mode
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
      onMouseEnter={() => setExpanded(true)}
      exit={{ opacity: 0, y: isDrawerMode ? -340 : 20 }}
      className={cn(
        "absolute left-0 w-full pointer-events-auto transition-all duration-300",
        (isCollapsed || isPinned) ? "top-full" : "top-[calc(100%+8px)]"
      )}
    >
      <div className={cn(
        "bg-[var(--app-panel)] border border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl transition-all duration-300 relative flex flex-col",
        isDrawerMode ? "h-[320px]" : "h-[320px]", // Force consistent height for all modes
        isCollapsed ? "blur-[1px] opacity-60 border-white/10 cursor-pointer" : (isPinned ? "h-[75px] border-white/10" : "")
      )}>
        {/* The Drawer Content Wrapper */}
        <div className={cn(
          "transition-all duration-300 h-full flex flex-col p-4 pb-4",
          isCollapsed ? "opacity-0 pointer-events-none" : (isPinned ? "opacity-60 blur-[1.2px] pointer-events-none justify-end" : "opacity-100 blur-0")
        )}>
          {/* Layer 1: Image Thumbnails & Mentions (Flex Wrap) */}
        {(referencedNodes.length > 0 || (node.data.pins && node.data.pins.length > 0)) && (
          <>
            <div className="flex flex-wrap gap-2 mb-3">
              {/* Local PINs (Source Node Scope) */}
              {node.data.pins && node.data.pins.length > 0 && (
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl p-1.5 pr-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Hash size={14} />
                  </div>
                  <div className="flex items-center gap-1">
                    {node.data.pins.map((pin, idx) => (
                      <div key={pin.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10">
                        <span className="text-[9px] font-bold text-white/40">({idx + 1})</span>
                        <span className="text-[9px] font-medium text-white/80 max-w-[60px] truncate">
                          {pin.label || 'Pin'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referenced Nodes (Target Node Scope) */}
              {referencedNodes.map(refNode => {
                const imageUrl = refNode.data.outputs?.image || refNode.data.uploadedImages?.[0]?.url;
                const hasImage = !!imageUrl;
                const nodePins = refNode.data.pins || [];

                return (
                  <div key={refNode.id} className="relative group">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 pr-2.5 hover:bg-white/10 transition-all">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-black flex items-center justify-center">
                        {hasImage ? (
                          <img 
                            src={imageUrl} 
                            className="w-full h-full object-cover"
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="text-white/20">
                            {refNode.type === 'video-node' ? <Video size={14} /> : 
                             refNode.type === 'image-node' ? <ImageIcon size={14} /> :
                             <Type size={14} />}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-white/80 leading-none mb-0.5">{refNode.data.label}</span>
                        <span className="text-[7px] font-mono text-white/30 uppercase">{refNode.data.shortId}</span>
                      </div>

                      {/* PINs for this referenced node */}
                      {nodePins.length > 0 && (
                        <>
                          <div className="w-px h-4 bg-white/10 mx-1" />
                          <div className="flex items-center gap-1">
                            {nodePins.map((pin, idx) => (
                              <div key={pin.id} className="flex items-center gap-1 px-1 py-0.5 rounded bg-white/5 border border-white/5">
                                <span className="text-[8px] font-bold text-white/40">({idx + 1})</span>
                                <span className="text-[8px] text-white/60 max-w-[40px] truncate">{pin.label || 'Pin'}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <button 
                        onClick={() => handleRemoveMention(refNode)}
                        className="ml-1.5 p-1 rounded-md hover:bg-red-500/20 text-white/10 hover:text-red-400 transition-all"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Layer 2: Subtle Divider (Moved above toggle) */}
            <div className="h-px w-full bg-white/5 mb-3" />
          </>
        )}

        {/* Layer 3: View Mode Toggle (Right Aligned) */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/5">
            <button
              onClick={() => setPromptViewMode('edit')}
              className={cn(
                "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                promptViewMode === 'edit' 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-white/30 hover:text-white/50"
              )}
            >
              <Edit3 size={10} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => setPromptViewMode('prev')}
              className={cn(
                "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                promptViewMode === 'prev' 
                  ? "bg-emerald-500/20 text-emerald-400 shadow-sm" 
                  : "text-white/30 hover:text-white/50"
              )}
            >
              <Eye size={10} />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setPromptViewMode('raw')}
              className={cn(
                "px-2 py-1 rounded-md transition-all flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider",
                promptViewMode === 'raw' 
                  ? "bg-blue-500/20 text-blue-400 shadow-sm" 
                  : "text-white/30 hover:text-white/50"
              )}
            >
              <Terminal size={10} />
              <span>Raw</span>
            </button>
          </div>
        </div>

        {/* Layer 4: Input Area */}
        <div className="relative flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
          <div className={cn(
            "flex-1 rounded-xl border p-2 transition-all relative nodrag nowheel flex flex-col min-h-0 overflow-hidden",
            promptViewMode === 'edit' ? "bg-black/80 border-white/10 focus-within:border-[var(--brand-red)]/50" : 
            promptViewMode === 'prev' ? "bg-white/[0.03] border-white/10" :
            "bg-blue-500/[0.03] border-blue-500/10"
          )}>
            <div 
              className="flex-1 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar"
              onWheel={(e) => e.stopPropagation()}
            >
              {promptViewMode === 'edit' ? (
                <MentionEditor
                  initialContent={prompt}
                  onChange={handleEditorChange}
                  mentions={mentionCandidates}
                  currentNodeId={node.id}
                  placeholder="Enter instructions... (Type @ to reference)"
                  onEnter={handleSend}
                />
              ) : promptViewMode === 'prev' ? (
                <div className="text-sm font-mono text-white/80 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text p-1 w-full max-w-full overflow-hidden">
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
                <div className="text-sm font-mono text-white/50 whitespace-pre-wrap break-words leading-relaxed select-text cursor-text p-1 w-full max-w-full overflow-hidden">
                  {resolvedData.fullRaw || <span className="opacity-30 italic">No content to output</span>}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between gap-2 mt-auto pt-2">
            <div className="flex items-center gap-2">
              {/* Model Selector */}
              <div className="relative">
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'model' ? null : 'model'); }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 text-[10px] font-bold text-white transition-all bg-white/5 border border-white/10 dropdown-trigger"
                >
                  <Hash size={12} className="text-[var(--brand-red)]" />
                  <span className="max-w-[120px] truncate">{currentModel ? currentModel.model.name : 'Select Model'}</span>
                  <ChevronUp size={10} className={cn("transition-transform", activeDropdown === 'model' && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {activeDropdown === 'model' && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-black border border-white/10 rounded-xl shadow-2xl z-[120] overflow-hidden dropdown-container"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-white/10 text-[8px] uppercase tracking-widest text-white/40">Available Models</div>
                      <div className="max-h-48 overflow-y-auto">
                        {availableModels.map(({ provider, model }) => (
                          <button
                            key={`${provider.id}-${model.id}`}
                            onClick={() => handleModelSelect(provider.id, model.id)}
                            className={cn(
                              "w-full px-3 py-2 text-left text-[10px] hover:bg-white/5 flex flex-col gap-0.5 transition-colors",
                              currentModel?.model.id === model.id ? "bg-[var(--brand-red)]/20 text-[var(--brand-red)]" : "text-white/70"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{model.name}</span>
                              {currentModel?.model.id === model.id && <Check size={10} />}
                            </div>
                            <span className="text-[8px] opacity-40 uppercase">{provider.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Thinking Level Selector (Text Mode Only) */}
              {node.data.activeOutputMode === 'text' && currentModel?.provider.type === 'gemini' && (
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'thinking' ? null : 'thinking'); }}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/10 text-[10px] font-bold transition-all border dropdown-trigger",
                      (node.data.config?.thinkingLevel && node.data.config?.thinkingLevel !== 'off')
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                        : "bg-white/5 border-white/10 text-white/30 hover:text-white/50"
                    )}
                  >
                    <Settings2 size={12} className={cn((node.data.config?.thinkingLevel && node.data.config?.thinkingLevel !== 'off') ? "text-emerald-400" : "text-white/30")} />
                    <span>THK</span>
                    <ChevronUp size={10} className={cn("transition-transform", activeDropdown === 'thinking' && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {activeDropdown === 'thinking' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 w-32 bg-black border border-white/10 rounded-xl shadow-2xl z-[120] overflow-hidden dropdown-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-2 border-b border-white/10 text-[8px] uppercase tracking-widest text-white/40">Thinking Level</div>
                        <div className="p-1 flex flex-col gap-1">
                          {['high', 'medium', 'low', 'minimal', 'off'].map((level) => (
                            <button
                              key={level}
                              onClick={() => {
                                updateNodeData(node.id, { config: { ...node.data.config, thinkingLevel: level as any } });
                                setActiveDropdown(null);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-[10px] rounded-lg transition-all capitalize flex items-center justify-between",
                                (node.data.config?.thinkingLevel === level || (!node.data.config?.thinkingLevel && level === 'off'))
                                  ? "bg-emerald-500/20 text-emerald-400" 
                                  : "text-white/50 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              <span>{level}</span>
                              {(node.data.config?.thinkingLevel === level || (!node.data.config?.thinkingLevel && level === 'off')) && <Check size={10} />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {(node.type === 'none' || node.type === 'generator-node') && (
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 mr-2">
                  <button 
                    onClick={() => handleTypeSelect('text')}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      node.data.activeOutputMode === 'text' ? "bg-emerald-500/20 text-emerald-400" : "text-white/20 hover:text-white/40"
                    )}
                    title="Text Output"
                  >
                    <Type size={14} />
                  </button>
                  <button 
                    onClick={() => handleTypeSelect('image')}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      node.data.activeOutputMode === 'image' ? "bg-blue-500/20 text-blue-400" : "text-white/20 hover:text-white/40"
                    )}
                    title="Image Output"
                  >
                    <ImageIcon size={14} />
                  </button>
                  <button 
                    onClick={() => handleTypeSelect('video')}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      node.data.activeOutputMode === 'video' ? "bg-purple-500/20 text-purple-400" : "text-white/20 hover:text-white/40"
                    )}
                    title="Video Output"
                  >
                    <Video size={14} />
                  </button>
                </div>
              )}
              
              {node.data.activeOutputMode !== 'text' && (
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'settings' ? null : 'settings'); }}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-[10px] font-mono font-bold text-white transition-all bg-white/5 border border-white/10 dropdown-trigger",
                      activeDropdown === 'settings' && "bg-white/10 border-white/20"
                    )}
                  >
                    <RatioIcon ratio={currentRatio} size={14} className="text-white/70" />
                    <span>{currentRatio} · {SIZES.find(s => s.value === currentSize)?.label || currentSize}</span>
                  </button>

                  <AnimatePresence>
                    {activeDropdown === 'settings' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-[320px] bg-[#1a1a1a]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-[120] overflow-hidden p-4 dropdown-container"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="space-y-6">
                          {/* Quality Section */}
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">画质</div>
                            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                              {SIZES.map((size) => (
                                <button
                                  key={size.value}
                                  onClick={() => handleSizeSelect(size.value)}
                                  className={cn(
                                    "flex-1 py-2 text-[11px] font-bold rounded-lg transition-all",
                                    currentSize === size.value 
                                      ? "bg-white/10 text-white shadow-sm" 
                                      : "text-white/30 hover:text-white/50"
                                  )}
                                >
                                  {size.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Ratio Section */}
                          <div className="space-y-3">
                            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">比例</div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                              <div className="grid grid-cols-5 gap-y-6 gap-x-2">
                                {/* Auto Button Placeholder */}
                                <div className="col-span-1 flex flex-col items-center gap-2">
                                  <button 
                                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-white/40 transition-all"
                                    title="自适应"
                                  >
                                    <div className="relative w-5 h-5 border border-dashed border-current rounded-sm">
                                      <div className="absolute inset-1 border border-current rounded-[1px]" />
                                    </div>
                                  </button>
                                  <span className="text-[9px] text-white/20 font-medium">自适应</span>
                                </div>

                                {/* Ratio Grid */}
                                {RATIOS.map((ratio) => (
                                  <div key={ratio.value} className="flex flex-col items-center gap-2">
                                    <button
                                      onClick={() => handleRatioSelect(ratio.value)}
                                      className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                                        currentRatio === ratio.value 
                                          ? "bg-white/10 border-white/20 text-white" 
                                          : "bg-transparent border-transparent text-white/30 hover:text-white/50"
                                      )}
                                    >
                                      <RatioIcon ratio={ratio.value} size={20} />
                                    </button>
                                    <span className={cn(
                                      "text-[9px] font-medium transition-colors",
                                      currentRatio === ratio.value ? "text-white/70" : "text-white/20"
                                    )}>
                                      {ratio.label}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <button 
                onClick={handleSend}
                disabled={isGenerating}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--brand-red)] text-white hover:opacity-90 transition-all shadow-lg shadow-red-900/20 text-[10px] font-bold uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed",
                  isGenerating && "animate-pulse"
                )}
              >
                {isGenerating ? (
                  <>
                    <span>Running</span>
                    <Loader2 size={12} className="animate-spin" />
                  </>
                ) : (
                  <>
                    <span>Run</span>
                    <Play size={12} className="group-hover:fill-white" fill="currentColor" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {isPinned && (
          <div className="absolute inset-0 bg-black/5 backdrop-blur-[3px] animate-in fade-in duration-500">
            {/* Centered in the exposed 60px area (Total 75px - 15px hidden = 60px) */}
            <div className="absolute bottom-0 left-0 right-0 h-[60px] flex items-center justify-center">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/10 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
                 <Lock size={10} className="text-white/50" />
                 <span className="text-[9px] font-bold text-white/70 uppercase tracking-[0.1em] whitespace-nowrap">
                   PIN MODE: PROMPT LOCKED
                 </span>
              </div>
            </div>
          </div>
        )}

        {/* The Handle (Dynamic Disappearance) */}
        <motion.div 
          initial={false}
          animate={{ 
            opacity: (isCollapsed || isPinned) ? 1 : 0,
            pointerEvents: (isCollapsed || isPinned) ? 'auto' : 'none'
          }}
          className="absolute bottom-0 left-0 w-full h-[36px] flex items-center justify-center bg-white/5 border-t border-white/5 z-[60]"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="w-8 h-1 rounded-full bg-white/20 mb-0.5" />
            <div className="flex items-center gap-2 text-[8px] font-bold text-white/40 uppercase tracking-[0.4em]">
              <span>Prompt</span>
            </div>
          </div>
        </motion.div>
      </div>
    
    <ConfirmModal 
      isOpen={showConfirmModal}
      title="确认删除引用"
      message={`确定要删除对 ${nodes.find(n => n.id === pendingDeletion?.nodeId)?.data.label} 的引用及其连线吗？`}
      onConfirm={(dontShowAgain) => {
        if (dontShowAgain) setSkipDeleteConfirm(true);
        if (pendingDeletion) performDeletion(pendingDeletion.nodeId, pendingDeletion.mentionText);
      }}
      onCancel={() => {
        setShowConfirmModal(false);
        setPendingDeletion(null);
      }}
    />

    <ConfirmModal 
      isOpen={showOverwriteModal}
      title="确认覆盖内容"
      message="当前节点已有文字内容，生成新内容将覆盖现有文字。是否继续？"
      onConfirm={(dontShowAgain) => {
        if (dontShowAgain) setSkipOverwriteConfirm(true);
        setShowOverwriteModal(false);
        handleGenerateText();
      }}
      onCancel={() => {
        setShowOverwriteModal(false);
      }}
    />
  </motion.div>
);
};
