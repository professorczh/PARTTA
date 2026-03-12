import React, { useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  BackgroundVariant,
  useReactFlow,
  useStoreApi,
  ReactFlowProvider,
  ConnectionLineType,
  ConnectionLineComponentProps,
  getBezierPath,
  Position,
  SelectionMode
} from '@xyflow/react';

const ConnectionLine = ({ fromX, fromY, toX, toY, fromHandle }: ConnectionLineComponentProps) => {
  const hId = fromHandle?.id || '';
  let strokeColor = '#3b82f6'; // Default Blue
  if (hId.includes('image')) strokeColor = '#ef4444'; // Red
  if (hId.includes('video')) strokeColor = '#a855f7'; // Purple

  const [path] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left,
  });

  const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
  if (distance < 2) return null;

  return (
    <g>
      <motion.path
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeDasharray="5,5"
        animate={{
          strokeDashoffset: [0, -10],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: "linear",
        }}
        d={path}
        opacity={0.9}
        className="custom-connection-path"
      />
    </g>
  );
};
import { motion, AnimatePresence } from 'motion/react';
import '@xyflow/react/dist/style.css';

import { useTapStore, NodeType, TapNode } from './store';
import { cn } from './lib/utils';
import { TextNode } from './TextNode';
import { ImageNode } from './ImageNode';
import { VideoNode } from './VideoNode';
import { ModelsModal } from './components/ModelsModal';
import { 
  Plus, 
  Layers, 
  Settings, 
  Cpu, 
  Zap, 
  Share2, 
  Download,
  MousePointer2,
  Hand,
  Grid,
  Type,
  ImageIcon,
  Video,
  Box,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';

import { PinEdge } from './components/PinEdge';
import { MobileModifierPanel } from './components/MobileModifierPanel';

const nodeTypes = {
  'text-node': TextNode,
  'image-node': ImageNode,
  'video-node': VideoNode,
};

const edgeTypes = {
  default: PinEdge,
};

import { SettingsModal } from './components/SettingsModal';
import { Toast } from './components/UI';

function Flow() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect, 
    addNode,
    deleteNodes,
    isDemoMode,
    setDemoMode,
    isRecognitionMode,
    isSelectionBoxEnabled,
    setNodes,
    setEdges,
    undo,
    redo,
    copyNodes,
    pasteNodes,
    cutNodes,
    cloneNodes,
    pushHistory,
    interactionMode,
    setInteractionMode,
    isShiftPressed,
    setShiftPressed,
    isMultiSelectMasterEnabled,
    isBoxSelectionEnabled,
    isShiftClickSelectionEnabled,
    isSelectionHelperVisible
  } = useTapStore();

  const handleResetApp = useCallback(() => {
    if (confirm("Are you sure you want to reset the app? This will clear all nodes and settings.")) {
      localStorage.removeItem('tap-storage');
      window.location.reload();
    }
  }, []);

  const { 
    screenToFlowPosition, 
    flowToScreenPosition,
    zoomIn,
    zoomOut,
    fitView,
    zoomTo,
    setViewport,
    getViewport
  } = useReactFlow();
  const store = useStoreApi();
  const [isModelsModalOpen, setIsModelsModalOpen] = React.useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = React.useState(false);
  const [menu, setMenu] = React.useState<{ top: number; left: number; x: number; y: number; sourceHandle?: { nodeId: string; handleId: string | null; type: string } } | null>(null);
  const [isAltPressed, setIsAltPressed] = React.useState(false);
  const [isSpacePressed, setIsSpacePressed] = React.useState(false);
  const rightClickStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [pendingConnection, setPendingConnection] = React.useState<{ nodeId: string; handleId: string | null; type: string } | null>(null);
  const [isSnapToGrid, setIsSnapToGrid] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Force clear pending connection on any global mouse up
      // This is a safety net for when onConnectEnd doesn't fire
      setTimeout(() => {
        setPendingConnection(null);
      }, 100);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [setPendingConnection]);
  const [isDraggingOver, setIsDraggingOver] = React.useState(false);
  const [isInvalidFormat, setIsInvalidFormat] = React.useState(false);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const mousePositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const targetZoomRef = React.useRef<number | null>(null);
  const zoomTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!isDraggingOver) {
      setIsDraggingOver(true);
      // Check if any item is an image
      const items = Array.from(event.dataTransfer.items);
      const hasImage = items.some(item => item.type.startsWith('image/'));
      setIsInvalidFormat(!hasImage);
    }
  }, [isDraggingOver]);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Only leave if we're actually leaving the container
    const rect = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX <= rect.left ||
      event.clientX >= rect.right ||
      event.clientY <= rect.top ||
      event.clientY >= rect.bottom
    ) {
      setIsDraggingOver(false);
      setIsInvalidFormat(false);
    }
  }, []);

  const onDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    setIsInvalidFormat(false);

    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        const id = `node-${Date.now()}-${i}`;
        
        addNode({
          id,
          type: 'image-node',
          position: {
            x: position.x + (i * 40),
            y: position.y + (i * 40),
          },
          style: { width: 360, height: 400 },
          data: { 
            type: 'image', 
            prompt: '',
            pins: [],
            outputs: { text: '', image: base64, video: '', prompt: '' },
            outputVersions: { text: 0, image: 1, video: 0, prompt: 0 },
            activeOutputMode: 'image'
          },
        });
      };
      
      reader.readAsDataURL(file);
    }
  }, [screenToFlowPosition, addNode]);

  const smoothZoom = useCallback((factor: number, center?: { x: number, y: number }) => {
    const { x, y, zoom } = getViewport();
    
    // If no active target, start from current zoom
    if (targetZoomRef.current === null) {
      targetZoomRef.current = zoom;
    }
    
    targetZoomRef.current *= factor;
    
    // Clamp zoom levels
    targetZoomRef.current = Math.min(Math.max(targetZoomRef.current, 0.1), 10);
    const newZoom = targetZoomRef.current;

    if (center) {
      // Zoom towards center (screen coordinates)
      // Formula: new_viewport_pos = mouse_pos - (mouse_pos - old_viewport_pos) * (new_zoom / old_zoom)
      const newX = center.x - (center.x - x) * (newZoom / zoom);
      const newY = center.y - (center.y - y) * (newZoom / zoom);
      setViewport({ x: newX, y: newY, zoom: newZoom }, { duration: 300 });
    } else {
      zoomTo(newZoom, { duration: 300 });
    }

    // Clear existing timeout
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }

    // Reset target after animation completes
    zoomTimeoutRef.current = setTimeout(() => {
      targetZoomRef.current = null;
      zoomTimeoutRef.current = null;
    }, 350);
  }, [getViewport, zoomTo]);

  const onPaste = useCallback(async (event: ClipboardEvent) => {
    // 1. Focus Protection
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable ||
      target.closest('[contenteditable="true"]') ||
      event.defaultPrevented
    ) {
      return;
    }

    const items = event.clipboardData?.items;
    if (!items) return;

    // 2. Position Calculation
    let position: { x: number; y: number };
    const mainElement = document.querySelector('main');
    const rect = mainElement?.getBoundingClientRect();
    
    if (mousePositionRef.current && rect && 
        mousePositionRef.current.x >= rect.left && 
        mousePositionRef.current.x <= rect.right && 
        mousePositionRef.current.y >= rect.top && 
        mousePositionRef.current.y <= rect.bottom) {
      position = screenToFlowPosition(mousePositionRef.current);
    } else {
      // Fallback to viewport center
      const center = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      };
      position = screenToFlowPosition(center);
    }

    // 3. Extract Data
    const itemsArray = Array.from(items);
    
    // Process images first
    const imageItems = itemsArray.filter(item => item.type.indexOf('image') !== -1);
    const textItems = itemsArray.filter(item => item.type === 'text/plain');

    imageItems.forEach((item, i) => {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const id = `node-paste-${Date.now()}-${i}`;
          addNode({
            id,
            type: 'image-node',
            position: { x: position.x + (i * 20), y: position.y + (i * 20) },
            style: { width: 360, height: 400 },
            data: { 
              type: 'image', 
              prompt: '',
              pins: [],
              outputs: { text: '', image: base64, video: '', prompt: '' },
              outputVersions: { text: 0, image: 1, video: 0, prompt: 0 },
              activeOutputMode: 'image'
            },
          });
        };
        reader.readAsDataURL(file);
      }
    });

    // Process text if no images were found OR if it's a separate text item
    // Usually, if you copy a mixed content from a browser, it has both.
    // We'll create both if they exist.
    textItems.forEach((item, i) => {
      item.getAsString((text) => {
        if (text && text.trim()) {
          // Check if it's our internal node data
          if (text.startsWith('TAP_FLOW_CLIPBOARD:')) {
            try {
              const jsonStr = text.substring('TAP_FLOW_CLIPBOARD:'.length);
              const data = JSON.parse(jsonStr);
              pasteNodes(position, data);
              return;
            } catch (err) {
              console.error('Failed to parse internal clipboard data', err);
            }
          }

          // Check if it's a URL to an image - we could handle this but let's stick to plain text for now
          const id = `node-paste-text-${Date.now()}-${i}`;
          addNode({
            id,
            type: 'text-node',
            position: { 
              x: position.x + (imageItems.length > 0 ? 40 : 0) + (i * 20), 
              y: position.y + (imageItems.length > 0 ? 40 : 0) + (i * 20) 
            },
            data: { 
              type: 'text', 
              prompt: text,
              pins: [],
              outputs: { text: '', image: '', video: '', prompt: '' },
              outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
              activeOutputMode: 'text'
            },
          });
        }
      });
    });
  }, [screenToFlowPosition, addNode]);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Global listeners for keys, mouse position, and paste
  useEffect(() => {
    const container = containerRef.current;
    
    const handleWheel = (e: WheelEvent) => {
      // Always prevent default to stop browser zoom and React Flow's default zoom
      e.preventDefault();
      
      // Sensitivity factor
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      
      if (e.ctrlKey || e.metaKey) {
        // Ctrl + Wheel: Zoom centered on mouse pointer
        smoothZoom(factor, { x: e.clientX, y: e.clientY });
      } else {
        // Normal Wheel: Zoom centered on canvas (viewport) center
        smoothZoom(factor);
      }
    };

    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleKeyDown = (e: KeyboardEvent) => { 
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) useTapStore.getState().setCtrlPressed(true);
      if (e.key === 'Shift') setShiftPressed(true); 
      if (e.key === 'Alt') setIsAltPressed(true);

      // Shortcuts
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.closest('[contenteditable="true"]');

      if (e.key === ' ' && !isInput) {
        e.preventDefault();
        if (e.repeat) return;

        const currentMode = useTapStore.getState().interactionMode;
        if (currentMode === 'pan') {
          // If in Hand mode, tapping Space switches to Arrow mode permanently
          setInteractionMode('selection');
          setIsSpacePressed(false);
        } else {
          // If in Arrow mode, holding Space enables temporary Pan mode
          setIsSpacePressed(true);
        }
      }

      if (isCtrl && !isInput) {
        // Block Ctrl+A if multi-select master is disabled
        const isMultiSelectEnabled = useTapStore.getState().isMultiSelectMasterEnabled;
        if ((e.key === 'a' || e.key === 'A') && !isMultiSelectEnabled) {
          e.preventDefault();
          return;
        }

        const currentNodes = useTapStore.getState().nodes;
        const clipboard = useTapStore.getState().clipboard;

        if (e.key === 'c' || e.key === 'C') {
          const selected = currentNodes.filter(n => n.selected);
          if (selected.length > 0) {
            e.preventDefault();
            copyNodes(selected);
            setToast({ message: `Copied ${selected.length} nodes`, type: 'info' });
          }
        }
        if (e.key === 'x' || e.key === 'X') {
          const selected = currentNodes.filter(n => n.selected);
          if (selected.length > 0) {
            e.preventDefault();
            cutNodes(selected);
            setToast({ message: `Cut ${selected.length} nodes`, type: 'info' });
          }
        }
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }

      if (!isInput) {
        if (e.key === 'v' || e.key === 'V') setInteractionMode('selection');
        if (e.key === 'h' || e.key === 'H') setInteractionMode('pan');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      if (e.key === 'Shift') setShiftPressed(false); 
      if (e.key === 'Alt') setIsAltPressed(false);
      if (e.key === ' ') setIsSpacePressed(false);
      
      // More robust Ctrl state tracking
      if (!e.ctrlKey && !e.metaKey) {
        useTapStore.getState().setCtrlPressed(false);
      }
    };

    const handleBlur = () => {
      setShiftPressed(false);
      setIsAltPressed(false);
      useTapStore.getState().setCtrlPressed(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', onPaste);
    window.addEventListener('blur', handleBlur);

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('blur', handleBlur);
    };
  }, [onPaste, smoothZoom]);

  const handleAddNode = useCallback((type: NodeType, position?: { x: number; y: number }, sourceHandle?: { nodeId: string; handleId: string | null; type: string }) => {
    const id = `node-${Date.now()}`;
    const flowPos = position || { x: Math.random() * 400, y: Math.random() * 400 };
    
    addNode({
      id,
      type,
      position: flowPos,
      style: (type === 'image-node' || type === 'video-node') ? { width: 360, height: 400 } : undefined,
      data: { 
        type: type === 'text-node' ? 'text' : type === 'image-node' ? 'image' : type === 'video-node' ? 'video' : type === 'generator-node' ? 'none' : 'none', 
        prompt: '',
        pins: [],
        outputs: { text: '', image: '', video: '', prompt: '' },
        outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
        activeOutputMode: type === 'text-node' ? 'text' : type === 'image-node' ? 'image' : 'video'
      },
    });

    if (sourceHandle) {
      onConnect({
        source: sourceHandle.nodeId,
        target: id,
        sourceHandle: sourceHandle.handleId,
        targetHandle: 'input-main'
      });
    }

    setMenu(null);
    setPendingConnection(null);
  }, [addNode, onConnect]);

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      
      // Suppress menu if dragged significantly with right click
      if (rightClickStartRef.current) {
        const dx = event.clientX - rightClickStartRef.current.x;
        const dy = event.clientY - rightClickStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        rightClickStartRef.current = null;
        
        if (distance > 5) {
          return;
        }
      }

      setMenu({
        top: event.clientY,
        left: event.clientX,
        x: event.clientX,
        y: event.clientY,
        sourceHandle: undefined
      });
    },
    [setMenu]
  );

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    // Force clear any pending states on any mouse down to prevent "stuck" UI
    if (event.button === 0) { // Left click
      setPendingConnection(null);
      setMenu(null);
      setIsConnecting(false);
    }

    if (event.button === 2) { // Right click
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__pane')) {
        rightClickStartRef.current = { x: event.clientX, y: event.clientY };
      }
    }
  }, [setPendingConnection, setMenu]);

  const menuLastOpenedAt = React.useRef<number>(0);

  const onPaneClick = useCallback(() => {
    // If the menu was opened less than 200ms ago, don't close it.
    // This prevents the click event that follows mouseup from closing the menu immediately.
    if (Date.now() - menuLastOpenedAt.current < 200) return;

    // TEXT SELECTION GUARD: If user is selecting text, don't deselect nodes
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }
    
    setMenu(null);
    setPendingConnection(null);
    setIsConnecting(false);
    
    // Hardcore reset using store API
    const { getState } = store;
    getState().unselectNodesAndEdges();
    
    // Explicitly clear selection on pane click
    const clearedNodes = nodes.map((node) => ({ ...node, selected: false }));
    setNodes(clearedNodes);
  }, [setMenu, setNodes, nodes, store]);

  const onConnectStart = useCallback((event: any, { nodeId, handleId, handleType }: any) => {
    // Only handle source handles (outputs)
    if (handleType === 'source') {
      setPendingConnection({ nodeId, handleId, type: handleId || 'text' });
      setIsConnecting(true);
    }
  }, [isShiftPressed]);

  const onConnectEnd = useCallback((event: any) => {
    if (!pendingConnection) return;

    const target = event.target as HTMLElement;
    // Check if we dropped on the pane or background
    const isPane = target.closest('.react-flow__pane');
    const isHandle = target.closest('.react-flow__handle');
    const isNode = target.closest('.react-flow__node');
    
    if (isPane && !isHandle && !isNode) {
      // Prevent the click event from firing on the pane
      event.preventDefault();
      event.stopPropagation();

      const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
      
      menuLastOpenedAt.current = Date.now();
      setMenu({
        top: clientY,
        left: clientX,
        x: clientX,
        y: clientY,
        sourceHandle: pendingConnection
      });
      setPendingConnection(null);
    } else {
      setPendingConnection(null);
    }
    setIsConnecting(false);
  }, [pendingConnection]);

  const onNodeDragStart = useCallback((event: React.MouseEvent, node: TapNode) => {
    if (isAltPressed) {
      const selectedNodes = nodes.filter(n => n.selected);
      if (selectedNodes.length > 0) {
        cloneNodes(selectedNodes);
      }
    }
  }, [isAltPressed, nodes, cloneNodes]);

  const onSelectionEnd = useCallback(() => {
    // Hardcore reset of the selection state machine
    const { getState } = store;
    // In @xyflow/react (v12), some methods might have different names or availability
    // resetSelectedElements is common in older versions, let's use what's available
    if (typeof (getState() as any).resetSelectedElements === 'function') {
      (getState() as any).resetSelectedElements();
    }
    getState().triggerNodeChanges([]); 
    
    // Force a state refresh
    setNodes([...nodes]);
  }, [setNodes, nodes, store]);

  const onNodeDragStop = useCallback(() => {
    // Clear isCloning flag and swap selection if needed
    const resetNodes = nodes.map(n => {
      if (n.data.isCloning) {
        return { ...n, selected: false, zIndex: undefined, data: { ...n.data, isCloning: false, activeCloneId: undefined } };
      }
      if (n.data.isDraggedClone) {
        return { ...n, selected: true, zIndex: undefined, data: { ...n.data, isDraggedClone: false, clonedFrom: undefined } };
      }
      return n;
    });
    setNodes(resetNodes);
    pushHistory();
    setIsConnecting(false);
  }, [pushHistory, setNodes, nodes]);

  return (
    <div className="w-full h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-sans overflow-hidden flex flex-col">
      {/* Selection Helper Visibility Control */}
      <style>
        {`
          .react-flow__nodesselection {
            display: ${isSelectionHelperVisible && isMultiSelectMasterEnabled ? 'block' : 'none'} !important;
          }
        `}
      </style>

      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[var(--app-border)] glass-panel flex items-center justify-between px-4 sm:px-6 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--brand-red)] rounded-lg flex items-center justify-center hud-border">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <span className="font-display text-xl font-bold tracking-tighter uppercase italic">PARTTA</span>
          </div>
          
          <nav className="hidden sm:flex items-center gap-1 bg-[var(--app-bg)] p-1 rounded-lg border border-[var(--app-border)]">
            <button className="px-3 py-1.5 rounded-md bg-[var(--app-border)] text-xs font-medium flex items-center gap-2">
              <Layers size={14} /> Canvas
            </button>
            <button 
              onClick={() => setIsModelsModalOpen(true)}
              className="px-3 py-1.5 rounded-md hover:bg-[var(--app-border)] text-xs font-medium text-[var(--app-text-muted)] hover:text-white transition-all flex items-center gap-2"
            >
              <Cpu size={14} /> Models
            </button>
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="px-3 py-1.5 rounded-md hover:bg-[var(--app-border)] text-xs font-medium text-[var(--app-text-muted)] hover:text-white transition-all flex items-center gap-2"
            >
              <Settings size={14} /> Setting
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 mr-2">
            <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", isDemoMode ? "text-emerald-400" : "text-white/20")}>
              Demo Mode
            </span>
            <button 
              onClick={() => setDemoMode(!isDemoMode)}
              className={cn(
                "w-10 h-5 rounded-full relative transition-all duration-300 border",
                isDemoMode ? "bg-emerald-500/20 border-emerald-500/50" : "bg-white/5 border-white/10"
              )}
            >
              <motion.div 
                animate={{ x: isDemoMode ? 20 : 2 }}
                className={cn(
                  "absolute top-1 w-3 h-3 rounded-full shadow-sm",
                  isDemoMode ? "bg-emerald-400" : "bg-white/20"
                )}
              />
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--app-border)] hover:bg-[var(--app-border)] transition-all text-xs font-bold uppercase tracking-widest">
            <Share2 size={14} /> Share
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-red)] text-white hover:opacity-90 transition-all text-xs font-bold uppercase tracking-widest hud-border">
            <Download size={14} /> Export
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main 
        ref={containerRef}
        className={cn("flex-1 relative", isShiftPressed && "shift-pressed", isConnecting && "connection-active", isSpacePressed && "space-pressed")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <MobileModifierPanel />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onSelectionEnd={onSelectionEnd}
          onNodesDelete={deleteNodes}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onPaneContextMenu={onPaneContextMenu}
          onMouseDown={onMouseDown}
          onPaneClick={onPaneClick}
          onEdgesDelete={(edges) => {
            console.log('Edges deleted:', edges);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionLineComponent={ConnectionLine}
          deleteKeyCode={['Delete']}
          selectionKeyCode={isMultiSelectMasterEnabled && isBoxSelectionEnabled ? 'Shift' : null}
          multiSelectionKeyCode={isMultiSelectMasterEnabled && isShiftClickSelectionEnabled ? 'Shift' : null}
          panOnDrag={interactionMode === 'pan' || isSpacePressed ? [0, 1, 2] : [1, 2]}
          selectionOnDrag={isMultiSelectMasterEnabled && isBoxSelectionEnabled && interactionMode === 'selection' && !isSpacePressed}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          preventScrolling={true}
          selectionMode={SelectionMode.Partial}
          nodesDraggable={!isSpacePressed}
          nodesConnectable={interactionMode === 'selection' && !isSpacePressed}
          elementsSelectable={!isSpacePressed}
          className={cn(
            interactionMode === 'pan' || isSpacePressed ? "mode-pan" : "mode-selection",
            isRecognitionMode && "mode-recognition"
          )}
          onNodeClick={(event, node) => {
            // If Master or Shift-Click is disabled, don't allow multi-selection via click
            if (!isMultiSelectMasterEnabled || !isShiftClickSelectionEnabled) {
              // Force single selection
              const otherSelected = nodes.filter(n => n.selected && n.id !== node.id);
              if (otherSelected.length > 0) {
                onNodesChange([
                  ...otherSelected.map(n => ({ id: n.id, type: 'select' as const, selected: false })),
                  { id: node.id, type: 'select', selected: true }
                ]);
              }
              return;
            }

            // If Shift/Ctrl/Meta is pressed, let React Flow handle multi-selection
            if (event.shiftKey || event.ctrlKey || event.metaKey) return;

            // Custom selection logic for parent-child linking
            const nodeData = node.data as any;
            if (nodeData.parentId) {
              const parentNode = nodes.find(n => n.id === nodeData.parentId);
              if (parentNode) {
                const isParentSelected = parentNode.selected;
                
                // If parent is not selected, select both, deselect others
                if (!isParentSelected) {
                  const otherSelected = nodes.filter(n => n.selected && n.id !== node.id && n.id !== parentNode.id);
                  onNodesChange([
                    ...otherSelected.map(n => ({ id: n.id, type: 'select' as const, selected: false })),
                    { id: parentNode.id, type: 'select', selected: true },
                    { id: node.id, type: 'select', selected: true }
                  ]);
                } else {
                  // If parent is already selected, this second click on B deselects A
                  const otherSelected = nodes.filter(n => n.selected && n.id !== node.id && n.id !== parentNode.id);
                  onNodesChange([
                    ...otherSelected.map(n => ({ id: n.id, type: 'select' as const, selected: false })),
                    { id: parentNode.id, type: 'select', selected: false },
                    { id: node.id, type: 'select', selected: true }
                  ]);
                }
              }
            } else {
              // If clicking a parent node directly, ensure only it is selected
              const otherSelected = nodes.filter(n => n.selected && n.id !== node.id);
              if (otherSelected.length > 0) {
                onNodesChange([
                  ...otherSelected.map(n => ({ id: n.id, type: 'select' as const, selected: false })),
                  { id: node.id, type: 'select', selected: true }
                ]);
              }
            }
          }}
          fitView
          fitViewOptions={{ duration: 1200 }}
          colorMode="dark"
          snapToGrid={isSnapToGrid}
          snapGrid={[15, 15]}
          connectionRadius={20}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ 
            stroke: '#3b82f6', 
            strokeWidth: 3, 
            opacity: 0.9
          }}
          defaultEdgeOptions={{
            type: 'default',
            animated: false,
            selectable: true,
            reconnectable: true
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="#262626" />
          <MiniMap 
            className="bg-[var(--app-panel)] border-[var(--app-border)] rounded-xl overflow-hidden" 
            nodeColor="#991b1b"
            maskColor="rgba(0,0,0,0.5)"
          />
          
          {/* Context Menu */}
          {menu && (
            <div 
              className="fixed bg-[var(--app-panel)] border border-[var(--app-border)] rounded-xl shadow-2xl z-[100] overflow-hidden min-w-[160px] hud-border"
              style={{ top: menu.top, left: menu.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)] font-bold">Add Node</div>
      <button 
        onClick={() => handleAddNode('text-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
        className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
      >
        <Type size={14} className="text-emerald-400" />
        <span>Text Node</span>
      </button>
      <button 
        onClick={() => handleAddNode('image-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
        className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
      >
        <ImageIcon size={14} className="text-blue-400" />
        <span>Image Node</span>
      </button>
      <button 
        onClick={() => handleAddNode('video-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
        className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
      >
        <Video size={14} className="text-purple-400" />
        <span>Video Node</span>
      </button>
    </div>
  )}

          {/* Specialized UI Overlays */}
          <AnimatePresence>
            {/* Drag-to-create pending line */}
            {menu?.sourceHandle && (
              <svg className="fixed inset-0 w-full h-full pointer-events-none z-[999]">
                {(() => {
                  const sourceNode = nodes.find(n => n.id === menu.sourceHandle?.nodeId);
                  if (!sourceNode) return null;
                  
                  // Match handle position exactly by finding the DOM element
                  const handleEl = document.querySelector(`[data-id="${sourceNode.id}"] [data-handleid="${menu.sourceHandle?.handleId}"]`);
                  let start;
                  
                  if (handleEl) {
                    const rect = handleEl.getBoundingClientRect();
                    start = {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2
                    };
                  } else {
                    // Fallback to approximate position if DOM element not found
                    start = flowToScreenPosition({
                      x: sourceNode.position.x + (sourceNode.measured?.width || 360),
                      y: sourceNode.position.y + (sourceNode.measured?.height || 220) / 2
                    });
                  }
                  
                  const end = { x: menu.left, y: menu.top };
                  
                  // Calculate Bezier curve points to match React Flow's default look
                  const dx = end.x - start.x;
                  const absDx = Math.abs(dx);
                  
                  // Curvature logic similar to React Flow's getBezierPath
                  const controlOffset = Math.max(absDx / 2, 50);
                  
                  const path = `M ${start.x},${start.y} C ${start.x + controlOffset},${start.y} ${end.x - controlOffset},${end.y} ${end.x},${end.y}`;
                  
                  // Match colors from store.ts onConnect
                  let strokeColor = '#3b82f6'; // Default Blue
                  const hId = menu.sourceHandle?.handleId || '';
                  if (hId.includes('image')) strokeColor = '#ef4444'; // Red
                  if (hId.includes('video')) strokeColor = '#a855f7'; // Purple
                  
                  return (
                    <motion.path
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: 0.8,
                        strokeDashoffset: [0, -10]
                      }}
                      transition={{
                        strokeDashoffset: {
                          duration: 0.5,
                          repeat: Infinity,
                          ease: "linear"
                        }
                      }}
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  );
                })()}
              </svg>
            )}

          </AnimatePresence>

          {/* Floating Controls Panel */}
          <Panel position="bottom-center" className="mb-8">
            <div className="flex items-center gap-1.5 p-1 glass-panel rounded-xl hud-border">
              <button 
                onClick={() => handleAddNode('image-node')}
                className="w-8 h-8 rounded-lg bg-[var(--brand-red)] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-red-900/20"
              >
                <Plus size={18} />
              </button>
              <div className="h-5 w-px bg-[var(--app-border)] mx-1" />
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={() => setInteractionMode('selection')}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                    (interactionMode === 'selection' && !isSpacePressed) ? "bg-[var(--app-border)] text-white shadow-inner" : "text-[var(--app-text-muted)] hover:text-white hover:bg-white/5"
                  )}
                  title="Selection Tool (V)"
                >
                  <MousePointer2 size={16} />
                </button>
                <button 
                  onClick={() => setInteractionMode('pan')}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                    (interactionMode === 'pan' || isSpacePressed) ? "bg-[var(--app-border)] text-white shadow-inner" : "text-[var(--app-text-muted)] hover:text-white hover:bg-white/5"
                  )}
                  title="Pan Tool (H)"
                >
                  <Hand size={16} />
                </button>
                <button 
                  onClick={() => setIsSnapToGrid(!isSnapToGrid)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] transition-all group"
                  title={isSnapToGrid ? "Disable Grid Snapping" : "Enable Grid Snapping"}
                >
                  <Grid 
                    size={16} 
                    className={cn(
                      "transition-colors",
                      isSnapToGrid ? "text-[var(--brand-red)]" : "text-[var(--app-text-muted)] group-hover:text-white"
                    )} 
                  />
                </button>
              </div>
              <div className="h-5 w-px bg-[var(--app-border)] mx-1" />
              <div className="flex items-center gap-0.5">
                <button 
                  onClick={() => smoothZoom(1 / 1.2)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  onClick={() => smoothZoom(1.2)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  onClick={() => fitView({ duration: 1000 })}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all"
                  title="Fit View"
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
          </Panel>

          {/* HUD Info Panel */}
          <Panel position="top-right" className="mt-4 mr-4">
            <div className="w-48 glass-panel rounded-xl p-4 border-l-4 border-l-[var(--brand-red)]">
              <h3 className="text-[10px] font-display uppercase tracking-widest text-[var(--app-text-muted)] mb-2">System Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono">NODES</span>
                  <span className="text-[10px] font-mono text-[var(--brand-red)] font-bold">{nodes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono">EDGES</span>
                  <span className="text-[10px] font-mono text-[var(--brand-red)] font-bold">{edges.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-mono">LATENCY</span>
                  <span className="text-[10px] font-mono text-emerald-500">24MS</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--app-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-mono uppercase">Engine Ready</span>
                </div>
              </div>
            </div>
          </Panel>

          {/* Global Dropzone Overlay */}
          <AnimatePresence>
            {isDraggingOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "absolute inset-0 z-[200] flex items-center justify-center p-8 transition-colors duration-300",
                  isInvalidFormat ? "bg-orange-500/10" : "bg-black/30 backdrop-blur-[2px]"
                )}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={cn(
                    "w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors duration-300",
                    isInvalidFormat ? "border-orange-500/40" : "border-[var(--brand-red)]/40"
                  )}
                >
                  <div className="glass-panel p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-4 shadow-2xl">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-300",
                      isInvalidFormat ? "bg-orange-500/20 text-orange-400" : "bg-[var(--brand-red)]/20 text-[var(--brand-red)]"
                    )}>
                      {isInvalidFormat ? <Box size={24} /> : <ImageIcon size={24} />}
                    </div>
                    
                    <div className="text-center space-y-1">
                      <h2 className={cn(
                        "text-xl font-display uppercase tracking-widest transition-colors duration-300",
                        isInvalidFormat ? "text-orange-400" : "text-white"
                      )}>
                        {isInvalidFormat ? "Unsupported Format" : "Drop to Upload"}
                      </h2>
                      <p className="text-[var(--app-text-muted)] font-mono text-[10px] uppercase tracking-[0.2em]">
                        {isInvalidFormat ? "JPG, PNG, WEBP ONLY" : "Creating new node at cursor"}
                      </p>
                    </div>

                    {isInvalidFormat && (
                      <motion.div 
                        initial={{ y: 5, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded text-[9px] text-orange-400 font-bold uppercase tracking-widest"
                      >
                        Invalid File Type
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </ReactFlow>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-[var(--app-border)] glass-panel flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">PARTTA v1.0.0</span>
          <div className="h-3 w-px bg-[var(--app-border)]" />
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">Project: Untitled_Creative_01</span>
          <div className="h-3 w-px bg-[var(--app-border)]" />
          <span className="text-[9px] font-mono text-emerald-500/60 uppercase">
            Shift + Drag to Select | Middle Click to Pan
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">Memory: 1.2GB / 16GB</span>
          <div className="h-3 w-px bg-[var(--app-border)]" />
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">GPU: Active</span>
        </div>
      </footer>

      <ModelsModal 
        isOpen={isModelsModalOpen} 
        onClose={() => setIsModelsModalOpen(false)} 
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />
      
      {/* Toast */}
      <Toast 
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
