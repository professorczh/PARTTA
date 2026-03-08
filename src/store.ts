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

export type NodeType = 'none' | 'text' | 'image' | 'video' | 'text-node' | 'image-node' | 'video-node' | 'generator-node';

export type ProviderType = 'gemini' | 'openai-compatible' | 'mock';

export type ModelProtocol = 'gemini' | 'openai-compatible' | 'mix';

export interface ModelCapability {
  text: boolean;
  image: boolean;
  video: boolean;
}

export interface ModelConfig {
  id: string;
  name: string;
  capabilities: ModelCapability;
  protocol?: ModelProtocol;
  enabled: boolean;
  isCustom?: boolean;
  supportedRatios?: string[];
  supportedResolutions?: string[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  defaultProtocol: ModelProtocol;
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

export interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  config: any;
  timestamp: number;
}

export interface NodeData extends Record<string, unknown> {
  label?: string;
  type: NodeType;
  prompt: string;
  outputs: {
    text?: string;
    image?: string;
    video?: string;
    prompt?: string;
  };
  outputVersions: {
    text: number;
    image: number;
    video: number;
    prompt: number;
  };
  lastRunVersions?: {
    [sourceNodeId: string]: {
      text?: number;
      image?: number;
      video?: number;
      prompt?: number;
    };
  };
  activeOutputMode: 'text' | 'image' | 'video';
  viewMode?: 'edit' | 'prev' | 'raw';
  shortId?: string; // e.g. IMG_1
  isLoading?: boolean;
  pins?: Pin[];
  uploadedImages?: UploadedImage[]; // We'll use this as a single image for ImageNode
  history?: HistoryItem[];
  selectedHistoryId?: string;
  parentId?: string; // For tracing origin
  isLocked?: boolean; // Fully solidified after first run/upload
  includeTitleInOutput?: boolean; // Whether to include label in output string
  config?: {
    mask?: string;
    model?: string;
    aspectRatio?: string;
    [key: string]: any;
  };
}

export type TapNode = Node<NodeData>;

interface TapState {
  nodes: TapNode[];
  edges: Edge[];
  onNodesChange: OnNodesChange<TapNode>;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: TapNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: TapNode) => void;
  updateNode: (id: string, node: Partial<TapNode>) => void;
  updateNodeData: (id: string, data: Partial<NodeData>) => void;
  addPin: (nodeId: string, pin: Pin) => void;
  updatePin: (nodeId: string, pinId: string, updates: Partial<Pin>) => void;
  removePin: (nodeId: string, pinId: string) => void;
  // Uploaded Images
  addUploadedImage: (nodeId: string, image: UploadedImage) => void;
  removeUploadedImage: (nodeId: string, imageId: string) => void;
  // History
  addHistoryItem: (nodeId: string, item: HistoryItem) => void;
  removeHistoryItem: (nodeId: string, itemId: string) => void;
  selectHistoryItem: (nodeId: string, itemId: string) => void;
  // Models & Providers
  providers: ProviderConfig[];
  globalDefaults: {
    text: string; // providerId:modelId
    image: string;
    video: string;
  };
  isDemoMode: boolean;
  isCtrlPressed: boolean;
  setDemoMode: (enabled: boolean) => void;
  setCtrlPressed: (enabled: boolean) => void;
  addProvider: (provider: ProviderConfig) => void;
  updateProvider: (id: string, provider: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  toggleProvider: (id: string) => void;
  setGlobalDefault: (type: 'text' | 'image' | 'video', modelKey: string) => void;
  setGlobalMock: (enabled: boolean) => void;
  deleteNodes: (nodes: TapNode[]) => void;
  // User Preferences
  skipDeleteConfirm: boolean;
  setSkipDeleteConfirm: (skip: boolean) => void;
  rememberPinTargetChoice: boolean;
  setRememberPinTargetChoice: (remember: boolean) => void;
  lastPinTargetId: string | null;
  setLastPinTargetId: (id: string | null) => void;
}

export const useTapStore = create<TapState>()(
  persist(
    (set, get) => ({
      nodes: [
        {
          id: 'node-1',
          type: 'text-node',
          position: { x: 100, y: 100 },
          data: { 
            label: 'Node 1', 
            type: 'text', 
            prompt: 'A futuristic city with red neon lights',
            shortId: 'TXT_1',
            outputs: {},
            outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
            activeOutputMode: 'text'
          },
        },
      ],
      edges: [],
      providers: [
        {
          id: 'google-gemini',
          name: 'Google Gemini',
          type: 'gemini',
          defaultProtocol: 'gemini',
          apiKey: '',
          enabled: false,
          models: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', capabilities: { text: true, image: false, video: false }, protocol: 'gemini', enabled: true },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', capabilities: { text: true, image: false, video: false }, protocol: 'gemini', enabled: true },
            { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Image', capabilities: { text: false, image: true, video: false }, protocol: 'gemini', enabled: true, supportedRatios: ['1:1', '16:9', '9:16', '3:4', '4:3'], supportedResolutions: ['1K'] },
            { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image', capabilities: { text: false, image: true, video: false }, protocol: 'gemini', enabled: true, supportedRatios: ['1:1', '16:9', '9:16', '3:4', '4:3'], supportedResolutions: ['1K', '2K', '4K'] },
            { id: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast', capabilities: { text: false, image: false, video: true }, protocol: 'gemini', enabled: true, supportedRatios: ['16:9', '9:16'], supportedResolutions: ['720p', '1080p'] },
          ]
        }
      ],
      globalDefaults: {
        text: 'google-gemini:gemini-3-flash-preview',
        image: 'google-gemini:gemini-2.5-flash-image',
        video: 'google-gemini:veo-3.1-fast-generate-preview',
      },
      isDemoMode: true, // Default to true as per user's preference for easy demo
      isCtrlPressed: false,
      setDemoMode: (enabled: boolean) => set({ isDemoMode: enabled }),
      setCtrlPressed: (enabled: boolean) => set({ isCtrlPressed: enabled }),
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
        const sourceHandle = connection.sourceHandle || '';
        let color = '#ef4444'; // Default Red
        
        if (sourceHandle.includes('text')) color = '#3b82f6'; // Blue for text
        if (sourceHandle.includes('image')) color = '#ef4444'; // Red for image
        if (sourceHandle.includes('video')) color = '#a855f7'; // Purple for video
        if (sourceHandle.includes('prompt')) color = '#3b82f6'; // Blue for prompt

        const edge = {
          ...connection,
          style: { stroke: color, strokeWidth: 2, strokeDasharray: '5,5' },
          animated: true,
        };
        set({
          edges: addEdge(edge, get().edges),
        });

        // Add @ mention to target node prompt if not already present
        if (connection.target && connection.source) {
          const nodes = get().nodes;
          const targetNode = nodes.find(n => n.id === connection.target);
          const sourceNode = nodes.find(n => n.id === connection.source);
          
          if (targetNode && sourceNode) {
            const typePrefix = sourceNode.type === 'image-node' ? 'IMG' : sourceNode.type === 'video-node' ? 'VID' : 'TEXT';
            const mentionText = `[@ ${typePrefix}_${sourceNode.data.label} (${sourceNode.data.shortId})]`;
            
            if (!targetNode.data.prompt.includes(`(${sourceNode.data.shortId})`)) {
              const newPrompt = targetNode.data.prompt.trim() 
                ? `${targetNode.data.prompt.trim()} ${mentionText}` 
                : mentionText;
              
              get().updateNodeData(targetNode.id, { prompt: newPrompt });
            }
          }
        }
      },
      setNodes: (nodes) => set({ nodes }),
      setEdges: (edges) => set({ edges }),
      addNode: (node) => {
        const nodes = get().nodes;
        const type = node.type || 'text-node';
        let prefix = 'TXT';
        if (type === 'image-node') prefix = 'IMG';
        else if (type === 'video-node') prefix = 'VID';
        else if (type === 'generator-node') prefix = 'GEN';

        // Find the maximum existing number for this prefix
        const existingNumbers = nodes
          .map(n => {
            const sId = n.data.shortId || '';
            if (sId.startsWith(`${prefix}_`)) {
              const num = parseInt(sId.split('_')[1]);
              return isNaN(num) ? 0 : num;
            }
            return 0;
          });
        
        const maxNum = Math.max(0, ...existingNumbers);
        const shortId = `${prefix}_${maxNum + 1}`;
        
        const newNode = {
          ...node,
          data: {
            ...node.data,
            label: node.data.label || `Node ${nodes.length + 1}`,
            shortId,
            includeTitleInOutput: node.data.includeTitleInOutput ?? true,
            outputs: node.data.outputs || {},
            outputVersions: node.data.outputVersions || { text: 0, image: 0, video: 0, prompt: 0 },
            activeOutputMode: node.data.activeOutputMode || 'text',
            config: {
              ...node.data.config,
              model: node.data.config?.model
            }
          }
        };
        set({ nodes: [...nodes, newNode] });
      },
      updateNode: (id, updatedNode) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === id ? { ...node, ...updatedNode } : node
          ),
        });
      },
      updateNodeData: (id, data) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id !== id) return node;
            
            const newData = { 
              ...node.data, 
              ...data
            };

            // Ensure outputs and outputVersions are initialized
            if (!newData.outputs) newData.outputs = {};
            if (!newData.outputVersions) newData.outputVersions = { text: 0, image: 0, video: 0, prompt: 0 };
            
            // If prompt changed, increment prompt version
            if (data.prompt !== undefined && data.prompt !== node.data.prompt) {
              newData.outputVersions = {
                ...newData.outputVersions,
                prompt: (newData.outputVersions?.prompt || 0) + 1
              };
              newData.outputs = {
                ...newData.outputs,
                prompt: data.prompt
              };
            }

            return { ...node, data: newData };
          }),
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
      updatePin: (nodeId, pinId, updates) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { 
                  ...node, 
                  data: { 
                    ...node.data, 
                    pins: (node.data.pins || []).map(p => p.id === pinId ? { ...p, ...updates } : p) 
                  } 
                } 
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
      addUploadedImage: (nodeId, image) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, uploadedImages: [image] } } 
              : node
          ),
        });
      },
      removeUploadedImage: (nodeId, imageId) => {
        set({
          nodes: get().nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, uploadedImages: [] } } 
              : node
          ),
        });
      },
      addHistoryItem: (nodeId, item) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id !== nodeId) return node;
            const history = [...(node.data.history || []), item];
            return {
              ...node,
              data: {
                ...node.data,
                history,
                selectedHistoryId: item.id,
                outputs: {
                  ...node.data.outputs,
                  image: item.url
                }
              }
            };
          })
        });
      },
      removeHistoryItem: (nodeId, itemId) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id !== nodeId) return node;
            const history = (node.data.history || []).filter(h => h.id !== itemId);
            let selectedHistoryId = node.data.selectedHistoryId;
            let currentImage = node.data.outputs.image;

            if (selectedHistoryId === itemId) {
              const lastItem = history[history.length - 1];
              selectedHistoryId = lastItem?.id;
              currentImage = lastItem?.url;
            }

            return {
              ...node,
              data: {
                ...node.data,
                history,
                selectedHistoryId,
                outputs: {
                  ...node.data.outputs,
                  image: currentImage
                }
              }
            };
          })
        });
      },
      selectHistoryItem: (nodeId, itemId) => {
        set({
          nodes: get().nodes.map((node) => {
            if (node.id !== nodeId) return node;
            const history = node.data.history || [];
            const itemIndex = history.findIndex(h => h.id === itemId);
            if (itemIndex === -1) return node;
            
            const item = history[itemIndex];
            // Move selected item to the front (index 0)
            const newHistory = [
              item,
              ...history.filter(h => h.id !== itemId)
            ];

            return {
              ...node,
              data: {
                ...node.data,
                history: newHistory,
                selectedHistoryId: itemId,
                prompt: item.prompt,
                config: {
                  ...node.data.config,
                  ...item.config
                },
                outputs: {
                  ...node.data.outputs,
                  image: item.url
                }
              }
            };
          })
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
        isDemoMode: enabled
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
      skipDeleteConfirm: false,
      setSkipDeleteConfirm: (skip) => set({ skipDeleteConfirm: skip }),
      rememberPinTargetChoice: false,
      setRememberPinTargetChoice: (remember) => set({ rememberPinTargetChoice: remember }),
      lastPinTargetId: null,
      setLastPinTargetId: (id) => set({ lastPinTargetId: id }),
    }),
    {
      name: 'tap-storage',
      partialize: (state) => ({ 
        nodes: state.nodes.map(node => ({
          ...node,
          data: {
            ...node.data,
            // Strip large base64 data to prevent localStorage quota exceeded errors
            uploadedImages: [], 
            history: [],
            outputs: {
              ...node.data.outputs,
              image: undefined,
              video: undefined
            }
          }
        })), 
        edges: state.edges,
        providers: state.providers,
        globalDefaults: state.globalDefaults,
        isDemoMode: state.isDemoMode,
        isCtrlPressed: false, // Don't persist key state
        skipDeleteConfirm: state.skipDeleteConfirm,
        rememberPinTargetChoice: state.rememberPinTargetChoice,
        lastPinTargetId: state.lastPinTargetId
      }),
    }
  )
);
