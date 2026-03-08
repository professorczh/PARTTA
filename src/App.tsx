import React, { useCallback, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
  ConnectionLineType,
  ConnectionLineComponentProps,
  getBezierPath,
  Position
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

  return (
    <g>
      <motion.path
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
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
        opacity={0.8}
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
import { ShellNode } from './ShellNode';
import { GhostNode } from './GhostNode';
import { ParticleEffect } from './ParticleEffect';
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
  Box,
  ZoomIn,
  ZoomOut,
  Maximize
} from 'lucide-react';

import { PinEdge } from './components/PinEdge';

const nodeTypes = {
  'text-node': TextNode,
  'image-node': ImageNode,
  'video-node': VideoNode,
  'generator-node': ShellNode,
  none: ShellNode,
};

const edgeTypes = {
  default: PinEdge,
};

import { PinTargetModal } from './components/PinTargetModal';

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
    setNodes,
    setEdges
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
    getViewport
  } = useReactFlow();
  const [isModelsModalOpen, setIsModelsModalOpen] = React.useState(false);
  const [menu, setMenu] = React.useState<{ top: number; left: number; x: number; y: number; sourceHandle?: { nodeId: string; handleId: string | null; type: string } } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = React.useState(false);
  const [pendingConnection, setPendingConnection] = React.useState<{ nodeId: string; handleId: string | null; type: string } | null>(null);
  const [particles, setParticles] = React.useState<{ id: string; x: number; y: number }[]>([]);
  const [isSnapToGrid, setIsSnapToGrid] = React.useState(false);
  const targetZoomRef = React.useRef<number | null>(null);
  const zoomTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const smoothZoom = useCallback((factor: number) => {
    const { zoom } = getViewport();
    
    // If no active target, start from current zoom
    if (targetZoomRef.current === null) {
      targetZoomRef.current = zoom;
    }
    
    // Accumulate target
    targetZoomRef.current *= factor;
    
    // Clamp zoom levels
    targetZoomRef.current = Math.min(Math.max(targetZoomRef.current, 0.1), 10);

    zoomTo(targetZoomRef.current, { duration: 300 });

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

  // Listen for shift and ctrl keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      if (e.key === 'Shift') setIsShiftPressed(true); 
      if (e.key === 'Control' || e.key === 'Meta') useTapStore.getState().setCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      if (e.key === 'Shift') setIsShiftPressed(false); 
      if (e.key === 'Control' || e.key === 'Meta') useTapStore.getState().setCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
  }, [nodes.length, addNode, onConnect]);

  // Ghost Node Logic
  const selectedNodes = nodes.filter(n => n.selected);
  const showGhost = isShiftPressed && selectedNodes.length >= 2;
  
  const ghostPosition = React.useMemo(() => {
    if (!showGhost) return null;
    const maxX = Math.max(...selectedNodes.map(n => n.position.x + (n.measured?.width || 320)));
    const minY = Math.min(...selectedNodes.map(n => n.position.y));
    const maxY = Math.max(...selectedNodes.map(n => n.position.y + (n.measured?.height || 200)));
    
    return {
      x: maxX + 100,
      y: minY + (maxY - minY) / 2
    };
  }, [showGhost, selectedNodes]);

  const handleMerge = useCallback(() => {
    if (!ghostPosition) return;
    
    const id = `node-${Date.now()}`;
    const screenPos = flowToScreenPosition(ghostPosition);
    
    // Add particles
    setParticles(prev => [...prev, { id: `p-${Date.now()}`, x: screenPos.x, y: screenPos.y }]);
    
    // Generate initial prompt with pills
    const pills = selectedNodes.map(n => `[${n.data.shortId || 'REF'}]`).join(' ');

    // Create the shell node
    addNode({
      id,
      type: 'none',
      position: ghostPosition,
      data: { 
        label: 'Shell', 
        type: 'none', 
        prompt: pills,
        pins: [],
        outputs: { text: '', image: '', video: '', prompt: '' },
        outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
        activeOutputMode: 'text'
      },
    });

    // Create edges from selected nodes to new node
    selectedNodes.forEach(sourceNode => {
      onConnect({
        source: sourceNode.id,
        target: id,
        sourceHandle: null,
        targetHandle: 'input-main'
      });
    });
  }, [ghostPosition, addNode, selectedNodes, onConnect, flowToScreenPosition]);

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
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

  const menuLastOpenedAt = React.useRef<number>(0);

  const onPaneClick = useCallback(() => {
    // If the menu was opened less than 200ms ago, don't close it.
    // This prevents the click event that follows mouseup from closing the menu immediately.
    if (Date.now() - menuLastOpenedAt.current < 200) return;
    
    setMenu(null);
    setPendingConnection(null);
  }, [setMenu]);

  const onConnectStart = useCallback((event: any, { nodeId, handleId, handleType }: any) => {
    // Only handle source handles (outputs)
    if (handleType === 'source') {
      setPendingConnection({ nodeId, handleId, type: handleId || 'text' });
    }
  }, []);

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
    } else {
      setTimeout(() => setPendingConnection(null), 100);
    }
  }, [pendingConnection]);

  return (
    <div className="w-full h-screen bg-[var(--app-bg)] text-[var(--app-text)] font-sans overflow-hidden flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[var(--app-border)] glass-panel flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[var(--brand-red)] rounded-lg flex items-center justify-center hud-border">
              <Zap size={18} className="text-white" fill="currentColor" />
            </div>
            <span className="font-display text-xl font-bold tracking-tighter uppercase italic">PARTTA</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-1 bg-[var(--app-bg)] p-1 rounded-lg border border-[var(--app-border)]">
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
              onClick={handleResetApp}
              className="px-3 py-1.5 rounded-md hover:bg-[var(--app-border)] text-xs font-medium text-[var(--app-text-muted)] hover:text-white transition-all flex items-center gap-2"
            >
              <Settings size={14} /> Reset
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
      <main className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodesDelete={deleteNodes}
          onPaneContextMenu={onPaneContextMenu}
          onPaneClick={onPaneClick}
          onEdgesDelete={(edges) => {
            console.log('Edges deleted:', edges);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          selectionKeyCode={['Shift']}
          multiSelectionKeyCode={['Control', 'Meta']}
          onNodeClick={(event, node) => {
            // Custom selection logic for parent-child linking
            const nodeData = node.data as any;
            if (nodeData.parentId) {
              const parentNode = nodes.find(n => n.id === nodeData.parentId);
              if (parentNode) {
                const isParentSelected = parentNode.selected;
                
                // If parent is not selected, select both
                if (!isParentSelected) {
                  onNodesChange([
                    { id: parentNode.id, type: 'select', selected: true },
                    { id: node.id, type: 'select', selected: true }
                  ]);
                } else {
                  // If parent is already selected, this second click on B deselects A
                  onNodesChange([
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
          connectionRadius={80}
          zoomOnScroll={false}
          onPaneScroll={(event) => {
            if (event) {
              const delta = (event as any).deltaY;
              if (delta > 0) {
                smoothZoom(1 / 1.2);
              } else {
                smoothZoom(1.2);
              }
            }
          }}
          connectionLineType={ConnectionLineType.Bezier}
          connectionLineStyle={{ 
            stroke: '#3b82f6', 
            strokeWidth: 2, 
            opacity: 0.8
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
            >
              <div className="p-2 border-b border-[var(--app-border)] text-[8px] uppercase tracking-widest text-[var(--app-text-muted)] font-bold">Add Node</div>
              <button 
                onClick={() => handleAddNode('text-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
                className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Type size={14} className="text-emerald-400" />
                <span>文字节点</span>
              </button>
              <button 
                onClick={() => handleAddNode('image-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
                className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <ImageIcon size={14} className="text-blue-400" />
                <span>图片节点</span>
              </button>
              <button 
                onClick={() => handleAddNode('generator-node', screenToFlowPosition({ x: menu.x, y: menu.y }), menu.sourceHandle)}
                className="w-full px-4 py-2.5 text-left text-xs hover:bg-white/5 transition-colors flex items-center gap-2"
              >
                <Box size={14} className="text-white/40" />
                <span>生成器节点 (空壳)</span>
              </button>
            </div>
          )}

          {/* Specialized UI Overlays */}
          <AnimatePresence>
            {/* Ghost Node Intent Lines */}
            {showGhost && ghostPosition && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[99]">
                {selectedNodes.map(sn => {
                  const start = flowToScreenPosition({ 
                    x: sn.position.x + (sn.measured?.width || 320) / 2, 
                    y: sn.position.y + (sn.measured?.height || 200) / 2 
                  });
                  const end = flowToScreenPosition(ghostPosition);
                  return (
                    <motion.line
                      key={`intent-${sn.id}`}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="rgba(255, 255, 255, 0.2)"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            )}

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

            {/* Ghost Node */}
            {showGhost && ghostPosition && (
              <GhostNode 
                position={flowToScreenPosition(ghostPosition)} 
                onMerge={handleMerge}
              />
            )}

            {/* Particles */}
            {particles.map(p => (
              <ParticleEffect 
                key={p.id} 
                position={p} 
                onComplete={() => setParticles(prev => prev.filter(item => item.id !== p.id))} 
              />
            ))}
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
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all">
                  <MousePointer2 size={16} />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all">
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
        </ReactFlow>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-[var(--app-border)] glass-panel flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">PARTTA v1.0.0</span>
          <div className="h-3 w-px bg-[var(--app-border)]" />
          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">Project: Untitled_Creative_01</span>
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
      <PinTargetModal />
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
