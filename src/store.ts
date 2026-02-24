import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges 
} from '@xyflow/react';

export type NodeType = 'text' | 'image' | 'video' | 'creative';

export type ProviderType = 'gemini' | 'openai-compatible' | 'mock';

export interface ModelCapability {
  text: boolean;
  vision: boolean;
  image: boolean;
  video: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  capabilities: ModelCapability;
  isCustom?: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiKey: string;
  enabled: boolean;
  models: ModelConfig[];
}

export interface Pin {
  id: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
  label?: string;
}

export interface NodeData extends Record<string, unknown> {
  label: string;
  type: NodeType;
  prompt: string;
  output?: string; // URL or text
  shortId?: string; // e.g. IMG_1
  isLoading?: boolean;
  pins?: Pin[];
  referencedPins?: string[]; // IDs of pins from parent node
  parentId?: string; // For tracing origin
  config?: {
    mask?: string;
    model?: string;
    aspectRatio?: string;
    [key: string]: any;
  };
}

export type TapNode = Node<NodeData, 'creative'>;

interface TapState {
  nodes: TapNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<TapNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: TapNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: TapNode) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  addPin: (nodeId: string, pin: Pin) => void;
  removePin: (nodeId: string, pinId: string) => void;
  addReferencedPin: (nodeId: string, pinId: string) => void;
  removeReferencedPin: (nodeId: string, pinId: string) => void;
  // Models & Providers
  providers: ProviderConfig[];
  globalDefaults: {
    text: string; // providerId:modelId
    image: string;
    video: string;
    isGlobalMock: boolean;
  };
  addProvider: (provider: ProviderConfig) => void;
  updateProvider: (id: string, provider: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  toggleProvider: (id: string) => void;
  setGlobalDefault: (type: 'text' | 'image' | 'video', modelKey: string) => void;
  setGlobalMock: (enabled: boolean) => void;
  deleteNodes: (nodes: TapNode[]) => void;
}

export const useTapStore = create<TapState>()(
  persist(
    (set, get) => ({
      nodes: [
        {
          id: 'node-1',
          type: 'creative',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Start Here', 
            type: 'text', 
            prompt: 'A futuristic city with red neon lights',
            shortId: 'IMG_1',
            pins: []
          },
        },
      ],
      edges: [],
      providers: [
        {
          id: 'system-mock',
          name: 'System Mock',
          type: 'mock',
          apiKey: 'mock-key',
          enabled: true,
          models: [
            { id: 'mock-text', name: 'Mock Text Generator', capabilities: { text: true, vision: false, image: false, video: false } },
            { id: 'mock-image', name: 'Mock Image Generator', capabilities: { text: false, vision: false, image: true, video: false } },
          ]
        },
        {
          id: 'google-gemini',
          name: 'Google Gemini',
          type: 'gemini',
          apiKey: '',
          enabled: false,
          models: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', capabilities: { text: true, vision: true, image: false, video: false } },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', capabilities: { text: true, vision: true, image: false, video: false } },
            { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Image', capabilities: { text: false, vision: false, image: true, video: false } },
          ]
        }
      ],
      globalDefaults: {
        text: 'system-mock:mock-text',
        image: 'system-mock:mock-image',
        video: '',
        isGlobalMock: false
      },
      onNodesChange: (changes: NodeChange<TapNode>[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        set({
          edges: addEdge(connection, get().edges),
        });
      },
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => {
        const nodes = get().nodes;
        const nextId = nodes.length + 1;
        const shortId = `IMG_${nextId}`;
        
        const newNode = {
          ...node,
          data: {
            ...node.data,
            shortId,
            config: {
              ...node.data.config,
              // We don't force a model here, let the component resolve it from globalDefaults
              model: node.data.config?.model
            }
          }
        };
        set({ nodes: [...nodes, newNode] });
      },
      updateNodeData: (id, data) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === id ? { ...node, data: { ...node.data, ...data } } : node
          ),
        });
      },
      addPin: (nodeId, pin) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, pins: [...(node.data.pins || []), pin] } } 
              : node
          ),
        });
      },
      removePin: (nodeId, pinId) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, pins: (node.data.pins || []).filter(p => p.id !== pinId) } } 
              : node
          ),
        });
      },
      addReferencedPin: (nodeId, pinId) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, referencedPins: [...(node.data.referencedPins || []), pinId] } } 
              : node
          ),
        });
      },
      removeReferencedPin: (nodeId, pinId) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, referencedPins: (node.data.referencedPins || []).filter(id => id !== pinId) } } 
              : node
          ),
        });
      },
      addProvider: (provider) => set({ providers: [...get().providers, provider] }),
      updateProvider: (id, provider) => set({
        providers: get().providers.map(p => p.id === id ? { ...p, ...provider } : p)
      }),
      removeProvider: (id) => set({
        providers: get().providers.filter(p => p.id !== id)
      }),
      toggleProvider: (id) => set({
        providers: get().providers.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p)
      }),
      setGlobalDefault: (type, modelKey) => set({
        globalDefaults: { ...get().globalDefaults, [type]: modelKey }
      }),
      setGlobalMock: (enabled: boolean) => set({
        globalDefaults: { ...get().globalDefaults, isGlobalMock: enabled }
      }),
      deleteNodes: (nodesToDelete) => {
        const idsToDelete = nodesToDelete.map(n => n.id);
        const currentNodes = get().nodes;
        const currentEdges = get().edges;
        
        set({
          nodes: currentNodes.filter(n => !idsToDelete.includes(n.id)),
          edges: currentEdges.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
        });
      },
    }),
    {
      name: 'tap-storage',
      partialize: (state) => ({ 
        nodes: state.nodes, 
        edges: state.edges,
        providers: state.providers,
        globalDefaults: state.globalDefaults
      }),
    }
  )
);
