import React, { useCallback } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  Panel,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useTapStore } from './store';
import { CreativeNode } from './CreativeNode';
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
  Hand
} from 'lucide-react';

const nodeTypes = {
  creative: CreativeNode,
};

export default function App() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect, 
    addNode,
    deleteNodes
  } = useTapStore();

  const [isModelsModalOpen, setIsModelsModalOpen] = React.useState(false);

  const handleAddNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    addNode({
      id,
      type: 'creative',
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        label: `Node ${nodes.length + 1}`, 
        type: 'image', 
        prompt: '',
        pins: [],
        outputs: { text: '', image: '', video: '', prompt: '' },
        outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
        activeOutputMode: 'image'
      },
    });
  }, [nodes.length, addNode]);

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
            <button className="px-3 py-1.5 rounded-md hover:bg-[var(--app-border)] text-xs font-medium text-[var(--app-text-muted)] hover:text-white transition-all flex items-center gap-2">
              <Settings size={14} /> Settings
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
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
          onNodesDelete={deleteNodes}
          nodeTypes={nodeTypes}
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
          colorMode="dark"
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            type: 'default',
            animated: true,
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="#262626" />
          <Controls className="bg-[var(--app-panel)] border-[var(--app-border)] fill-white" />
          <MiniMap 
            className="bg-[var(--app-panel)] border-[var(--app-border)] rounded-xl overflow-hidden" 
            nodeColor="#991b1b"
            maskColor="rgba(0,0,0,0.5)"
          />
          
          {/* Floating Controls Panel */}
          <Panel position="bottom-center" className="mb-8">
            <div className="flex items-center gap-2 p-2 glass-panel rounded-2xl hud-border">
              <button 
                onClick={handleAddNode}
                className="w-12 h-12 rounded-xl bg-[var(--brand-red)] text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-red-900/20"
              >
                <Plus size={24} />
              </button>
              <div className="h-8 w-px bg-[var(--app-border)] mx-2" />
              <div className="flex items-center gap-1">
                <button className="p-3 rounded-xl hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all">
                  <MousePointer2 size={20} />
                </button>
                <button className="p-3 rounded-xl hover:bg-[var(--app-border)] text-[var(--app-text-muted)] hover:text-white transition-all">
                  <Hand size={20} />
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
    </div>
  );
}
