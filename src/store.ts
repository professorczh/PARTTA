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
  isRecognizing?: boolean;
  isVirtual?: boolean;
}

export interface UploadedImage {
  id: string;
  url: string;
  name: string;
}

export interface HistoryItem {
  id: string;
  url?: string;
  text?: string;
  prompt: string;
  config: any;
  timestamp: number;
  thoughtSignature?: string;
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
  promptViewMode?: 'edit' | 'prev' | 'raw';
  shortId?: string; // e.g. IMG_1
  isLoading?: boolean;
  pins?: Pin[];
  uploadedImages?: UploadedImage[]; // We'll use this as a single image for ImageNode
  history?: HistoryItem[];
  selectedHistoryId?: string;
  parentId?: string; // For tracing origin
  isLocked?: boolean; // Fully solidified after first run/upload
  isGenerated?: boolean; // Whether the output is AI generated (intercepts pass-through)
  includeTitleInOutput?: boolean; // Whether to include label in output string
  thoughtSignature?: string; // For Gemini 3 multi-turn reasoning
  metadata?: {
    duration?: number;
    resolution?: string;
    modelName?: string;
    startTime?: number;
  };
  config?: {
    mask?: string;
    model?: string;
    aspectRatio?: string;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | 'off';
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
  isRecognitionMode: boolean;
  // Multi-selection settings
  isMultiSelectMasterEnabled: boolean;
  isBoxSelectionEnabled: boolean;
  isShiftClickSelectionEnabled: boolean;
  isSelectionHelperVisible: boolean;
  
  isSelectionBoxEnabled: boolean; // Deprecated, but keeping for compatibility if needed
  isCtrlPressed: boolean;
  isShiftPressed: boolean;
  isAltPressed: boolean;
  showMetadata: boolean;
  setDemoMode: (enabled: boolean) => void;
  setRecognitionMode: (enabled: boolean) => void;
  setMultiSelectMasterEnabled: (enabled: boolean) => void;
  setBoxSelectionEnabled: (enabled: boolean) => void;
  setShiftClickSelectionEnabled: (enabled: boolean) => void;
  setSelectionHelperVisible: (visible: boolean) => void;
  
  setSelectionBoxEnabled: (enabled: boolean) => void;
  setCtrlPressed: (enabled: boolean) => void;
  setShiftPressed: (enabled: boolean) => void;
  setAltPressed: (enabled: boolean) => void;
  setShowMetadata: (enabled: boolean) => void;
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
  skipOverwriteConfirm: boolean;
  setSkipOverwriteConfirm: (skip: boolean) => void;
  // Pin Targeting
  pinTargetNodeId: string | null;
  setPinTargetNodeId: (id: string | null) => void;
  addPinWithTarget: (sourceNodeId: string, pin: Pin, targetNodeId: string) => void;
  createLinkedNode: (sourceNodeId: string, pin: Pin, pinLabel: number, position: { x: number, y: number }) => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  // Interaction Mode
  interactionMode: 'selection' | 'pan';
  setInteractionMode: (mode: 'selection' | 'pan') => void;
  // Clipboard
  clipboard: { nodes: TapNode[], edges: Edge[] } | null;
  copyNodes: (nodes: TapNode[]) => void;
  pasteNodes: (position?: { x: number, y: number }, data?: { nodes: TapNode[], edges: Edge[] }) => void;
  cutNodes: (nodes: TapNode[]) => void;
  cloneNodes: (nodes: TapNode[]) => void;
}

interface HistoryState {
  nodes: TapNode[];
  edges: Edge[];
}

export const useTapStore = create<TapState>()(
  persist(
    (set, get) => {
      const undoStack: HistoryState[] = [];
      const redoStack: HistoryState[] = [];

      const pushHistory = () => {
        const { nodes, edges } = get();
        undoStack.push({ 
          nodes: JSON.parse(JSON.stringify(nodes)), 
          edges: JSON.parse(JSON.stringify(edges)) 
        });
        if (undoStack.length > 100) undoStack.shift();
        redoStack.length = 0; // Clear redo stack on new action
      };

      return {
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
            includeTitleInOutput: false,
            outputs: {},
            outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
            activeOutputMode: 'text'
          },
        },
      ],
      edges: [],
      interactionMode: 'selection',
      setInteractionMode: (mode) => set({ interactionMode: mode }),
      providers: [
        {
          id: 'google-gemini',
          name: 'Google Gemini',
          type: 'gemini',
          defaultProtocol: 'gemini',
          apiKey: '',
          enabled: false,
          models: [
            { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite', capabilities: { text: true, image: false, video: false }, protocol: 'gemini', enabled: true },
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', capabilities: { text: true, image: false, video: false }, protocol: 'gemini', enabled: true },
            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', capabilities: { text: true, image: false, video: false }, protocol: 'gemini', enabled: true },
            { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Image', capabilities: { text: false, image: true, video: false }, protocol: 'gemini', enabled: true, supportedRatios: ['1:1', '16:9', '9:16', '3:4', '4:3'], supportedResolutions: ['1K'] },
            { id: 'gemini-3.1-flash-image-preview', name: 'Gemini 3.1 Flash Image', capabilities: { text: false, image: true, video: false }, protocol: 'gemini', enabled: true, supportedRatios: ['1:1', '16:9', '9:16', '3:4', '4:3', '1:4', '1:8', '4:1', '8:1'], supportedResolutions: ['512px', '1K', '2K', '4K'] },
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
      isRecognitionMode: false,
      isMultiSelectMasterEnabled: true,
      isBoxSelectionEnabled: false,
      isShiftClickSelectionEnabled: true,
      isSelectionHelperVisible: true,
      isSelectionBoxEnabled: false,
      isCtrlPressed: false,
      isShiftPressed: false,
      isAltPressed: false,
      showMetadata: true,
      setDemoMode: (enabled: boolean) => set({ isDemoMode: enabled }),
      setRecognitionMode: (enabled: boolean) => set({ isRecognitionMode: enabled }),
      setMultiSelectMasterEnabled: (enabled: boolean) => set({ isMultiSelectMasterEnabled: enabled }),
      setBoxSelectionEnabled: (enabled: boolean) => set({ isBoxSelectionEnabled: enabled }),
      setShiftClickSelectionEnabled: (enabled: boolean) => set({ isShiftClickSelectionEnabled: enabled }),
      setSelectionHelperVisible: (visible: boolean) => set({ isSelectionHelperVisible: visible }),
      setSelectionBoxEnabled: (enabled: boolean) => set({ isSelectionBoxEnabled: enabled, isBoxSelectionEnabled: enabled }),
      setCtrlPressed: (enabled: boolean) => {
        if (get().isCtrlPressed === enabled) return;
        set({ isCtrlPressed: enabled });
      },
      setShiftPressed: (enabled: boolean) => {
        if (get().isShiftPressed === enabled) return;
        set({ isShiftPressed: enabled });
      },
      setAltPressed: (enabled: boolean) => {
        if (get().isAltPressed === enabled) return;
        set({ isAltPressed: enabled });
      },
      setShowMetadata: (enabled: boolean) => set({ showMetadata: enabled }),
      onNodesChange: (changes: NodeChange<TapNode>[]) => {
        const currentNodes = get().nodes;
        
        // Redirect position changes from original nodes to their clones during Alt-drag
        const redirectedChanges = changes.map(change => {
          if (change.type === 'position' && change.dragging) {
            const node = currentNodes.find(n => n.id === change.id);
            if (node?.data?.isCloning && node.data.activeCloneId) {
              return {
                ...change,
                id: node.data.activeCloneId as string
              };
            }
          }
          return change;
        });

        set({
          nodes: applyNodeChanges(redirectedChanges, currentNodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        pushHistory();
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
          
          if (targetNode && sourceNode && targetNode.id !== sourceNode.id) {
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
        pushHistory();
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
            includeTitleInOutput: node.data.includeTitleInOutput ?? false,
            outputs: node.data.outputs || {},
            outputVersions: node.data.outputVersions || { text: 0, image: 0, video: 0, prompt: 0 },
            activeOutputMode: node.data.activeOutputMode || 'text',
            metadata: node.data.metadata || {},
            config: {
              ...node.data.config,
              model: node.data.config?.model
            }
          }
        };
        set({ nodes: [...nodes, newNode] });
      },
      updateNode: (id, updatedNode) => {
        pushHistory();
        set({
          nodes: get().nodes.map((node) => 
            node.id === id ? { ...node, ...updatedNode } : node
          ),
        });
      },
      updateNodeData: (id, data) => {
        // Only push history for significant data changes (like prompt)
        if (data.prompt !== undefined) pushHistory();
        set({
          nodes: get().nodes.map((node) => {
            if (node.id !== id) return node;
            
            const newData = { 
              ...node.data, 
              ...data,
              metadata: {
                ...(node.data.metadata || {}),
                ...(data.metadata || {})
              }
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
        const state = get();
        const isRecognitionMode = state.isRecognitionMode;
        const isDemoMode = state.isDemoMode;

        // Add the pin immediately
        set({
          nodes: state.nodes.map((node) => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, pins: [...(node.data.pins || []), pin] } } 
              : node
          ),
        });

        // If it's a virtual pin, we don't trigger recognition yet
        if (pin.isVirtual) return;

        // If recognition mode is on, trigger recognition
        if (isRecognitionMode) {
          state.updatePin(nodeId, pin.id, { isRecognizing: true });
          
          // Mock recognition for demo mode
          if (isDemoMode) {
            setTimeout(() => {
              const mockLabels = ['Apple', 'Banana', 'Carrot', 'Laptop', 'Coffee Cup', 'Tree', 'Building', 'Cat', 'Dog'];
              const randomLabel = mockLabels[Math.floor(Math.random() * mockLabels.length)];
              state.updatePin(nodeId, pin.id, { 
                label: randomLabel, 
                isRecognizing: false 
              });
            }, 1500);
          } else {
            // Real mode logic would go here (calling Gemini)
            // For now, we'll just keep it recognizing or add a placeholder
          }
        }
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
        pushHistory();
        const idsToDelete = nodesToDelete.map(n => n.id);
        const currentNodes = get().nodes;
        const currentEdges = get().edges;
        
        set({
          nodes: currentNodes.filter(n => !idsToDelete.includes(n.id)),
          edges: currentEdges.filter(e => !idsToDelete.includes(e.source) && !idsToDelete.includes(e.target))
        });
      },
      skipOverwriteConfirm: false,
      setSkipOverwriteConfirm: (skip) => set({ skipOverwriteConfirm: skip }),
      
      pinTargetNodeId: null,
      setPinTargetNodeId: (id) => set({ pinTargetNodeId: id }),

      addPinWithTarget: (sourceNodeId, pin, targetNodeId) => {
        const state = get();
        const nodes = state.nodes;
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        const targetNode = nodes.find(n => n.id === targetNodeId);

        if (!sourceNode || !targetNode) return;

        pushHistory();

        const pinLabel = (sourceNode.data.pins?.length || 0) + 1;
        const mentionText = `[@ Pin_${pinLabel} (${sourceNode.data.shortId})]`;

        // 1. Update Source Node (Add Pin)
        const updatedNodes = nodes.map(node => {
          if (node.id === sourceNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                pins: [...(node.data.pins || []), { ...pin, label: pin.label || `Pin ${pinLabel}` }]
              }
            };
          }
          if (node.id === targetNodeId) {
            // 2. Update Target Node (Add Mention)
            // Smart Substitution: Remove parent image mention if it exists
            const parentMentionRegex = new RegExp(`\\[@ IMG_[^\\]]*? \\(${sourceNode.data.shortId}\\)\\]`, 'g');
            let newPrompt = (node.data.prompt || '').replace(parentMentionRegex, '').trim();
            
            newPrompt = newPrompt 
              ? `${newPrompt} ${mentionText}` 
              : mentionText;

            return {
              ...node,
              data: {
                ...node.data,
                prompt: newPrompt,
                outputVersions: {
                  ...node.data.outputVersions,
                  prompt: (node.data.outputVersions?.prompt || 0) + 1
                },
                outputs: {
                  ...node.data.outputs,
                  prompt: newPrompt
                }
              }
            };
          }
          return node;
        });

        set({ nodes: updatedNodes });

        // 3. Create Connection
        state.onConnect({
          source: sourceNodeId,
          target: targetNodeId,
          sourceHandle: 'output-image',
          targetHandle: 'input-main',
          data: { pinId: pin.id }
        } as any);
      },

      createLinkedNode: (sourceNodeId, pin, pinLabel, position) => {
        const state = get();
        const nodes = state.nodes;
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        pushHistory();

        // 1. Solidify the pin on source node
        const updatedSourceNodes = nodes.map(node => {
          if (node.id === sourceNodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                pins: (node.data.pins || []).map(p => p.id === pin.id ? { ...p, isVirtual: false, label: p.label || `Pin ${pinLabel}` } : p)
              }
            };
          }
          return node;
        });

        // 2. Create the new node
        const newNodeId = `node-${Date.now()}`;
        const type = 'image-node';
        const prefix = 'IMG';
        
        const existingNumbers = updatedSourceNodes
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
        const mentionText = `[@ Pin_${pinLabel} (${sourceNode.data.shortId})]`;

        const newNode: TapNode = {
          id: newNodeId,
          type: 'image-node',
          position,
          selected: true,
          style: { width: 360, height: 400 },
          data: {
            type: 'image',
            label: `Image`,
            shortId,
            prompt: mentionText,
            outputs: {
              prompt: mentionText
            },
            outputVersions: { text: 0, image: 0, video: 0, prompt: 1 },
            activeOutputMode: 'image',
            config: {}
          }
        };

        // 3. Update state: Unselect others, add new node, update source node
        set({
          nodes: [...updatedSourceNodes.map(n => ({ ...n, selected: false })), newNode],
          pinTargetNodeId: newNodeId // Update target for continuous flow
        });

        // 4. Create connection
        state.onConnect({
          source: sourceNodeId,
          target: newNodeId,
          sourceHandle: 'output-image',
          targetHandle: 'input-main',
          data: { pinId: pin.id }
        } as any);
      },

      undo: () => {
        if (undoStack.length === 0) return;
        const currentState = { 
          nodes: JSON.parse(JSON.stringify(get().nodes)), 
          edges: JSON.parse(JSON.stringify(get().edges)) 
        };
        redoStack.push(currentState);
        
        const prevState = undoStack.pop()!;
        set({ nodes: prevState.nodes, edges: prevState.edges });
      },

      redo: () => {
        if (redoStack.length === 0) return;
        const currentState = { 
          nodes: JSON.parse(JSON.stringify(get().nodes)), 
          edges: JSON.parse(JSON.stringify(get().edges)) 
        };
        undoStack.push(currentState);
        
        const nextState = redoStack.pop()!;
        set({ nodes: nextState.nodes, edges: nextState.edges });
      },

      pushHistory,

      clipboard: null,

      copyNodes: (nodesToCopy) => {
        const ids = nodesToCopy.map(n => n.id);
        const edgesToCopy = get().edges.filter(e => ids.includes(e.source) && ids.includes(e.target));
        
        const clipboardData = { 
          nodes: JSON.parse(JSON.stringify(nodesToCopy)), 
          edges: JSON.parse(JSON.stringify(edgesToCopy)) 
        };

        // Always write the JSON to system clipboard for robust cross-tab/session pasting
        const serialized = `TAP_FLOW_CLIPBOARD:${JSON.stringify(clipboardData)}`;
        navigator.clipboard.writeText(serialized).catch(() => {});

        set({ clipboard: clipboardData });
      },

      pasteNodes: (position, data) => {
        const { clipboard: internalClipboard, nodes: currentNodes, edges: currentEdges } = get();
        const clipboard = data || internalClipboard;
        if (!clipboard) return;

        pushHistory();

        const newNodes: TapNode[] = [];
        const newEdges: Edge[] = [];
        const idMap: Record<string, string> = {};
        const shortIdMap: Record<string, string> = {};

        // 1. Calculate offset
        let offsetX = 20;
        let offsetY = 20;

        if (position) {
          const minX = Math.min(...clipboard.nodes.map(n => n.position.x));
          const minY = Math.min(...clipboard.nodes.map(n => n.position.y));
          offsetX = position.x - minX;
          offsetY = position.y - minY;
        }

        // 2. Clone Nodes
        clipboard.nodes.forEach(node => {
          const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          idMap[node.id] = newId;

          // Generate new ShortId
          const type = node.type || 'text-node';
          let prefix = 'TXT';
          if (type === 'image-node') prefix = 'IMG';
          else if (type === 'video-node') prefix = 'VID';
          else if (type === 'generator-node') prefix = 'GEN';

          const existingNumbers = [...currentNodes, ...newNodes]
            .map(n => {
              const sId = n.data.shortId || '';
              if (sId.startsWith(`${prefix}_`)) {
                const num = parseInt(sId.split('_')[1]);
                return isNaN(num) ? 0 : num;
              }
              return 0;
            });
          const maxNum = Math.max(0, ...existingNumbers);
          const newShortId = `${prefix}_${maxNum + 1}`;
          shortIdMap[node.data.shortId || ''] = newShortId;

          const newNode: TapNode = {
            ...JSON.parse(JSON.stringify(node)),
            id: newId,
            position: {
              x: node.position.x + offsetX,
              y: node.position.y + offsetY
            },
            selected: true,
            data: {
              ...node.data,
              shortId: newShortId,
              isLoading: false,
              isLocked: false,
              history: [],
              selectedHistoryId: undefined
            }
          };
          newNodes.push(newNode);
        });

        // 3. Clone Edges (Internal only)
        clipboard.edges.forEach(edge => {
          const newEdge: Edge = {
            ...JSON.parse(JSON.stringify(edge)),
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: idMap[edge.source],
            target: idMap[edge.target]
          };
          newEdges.push(newEdge);
        });

        // 4. Smart Reference Remapping
        newNodes.forEach(node => {
          if (node.data.prompt) {
            let newPrompt = node.data.prompt;
            Object.entries(shortIdMap).forEach(([oldShortId, newShortId]) => {
              // Replace mentions like [@ Label (OLD_ID)] with [@ Label (NEW_ID)]
              // We need to be careful to only replace the ID part
              const regex = new RegExp(`\\(( ${oldShortId} )\\)`, 'g');
              newPrompt = newPrompt.replace(regex, `(${newShortId})`);
            });
            node.data.prompt = newPrompt;
          }
        });

        // Deselect current nodes
        const updatedCurrentNodes = currentNodes.map(n => ({ ...n, selected: false }));

        set({
          nodes: [...updatedCurrentNodes, ...newNodes],
          edges: [...currentEdges, ...newEdges]
        });
      },

      cutNodes: (nodesToCut) => {
        get().copyNodes(nodesToCut);
        pushHistory();
        get().deleteNodes(nodesToCut);
      },

      cloneNodes: (nodesToClone) => {
        const { nodes: currentNodes, edges: currentEdges } = get();
        
        const newNodes: TapNode[] = [];
        const newEdges: Edge[] = [];
        const idMap: Record<string, string> = {};
        const shortIdMap: Record<string, string> = {};

        nodesToClone.forEach(node => {
          const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          idMap[node.id] = newId;

          const type = node.type || 'text-node';
          let prefix = 'TXT';
          if (type === 'image-node') prefix = 'IMG';
          else if (type === 'video-node') prefix = 'VID';
          else if (type === 'generator-node') prefix = 'GEN';

          const existingNumbers = [...currentNodes, ...newNodes]
            .map(n => {
              const sId = n.data.shortId || '';
              if (sId.startsWith(`${prefix}_`)) {
                const num = parseInt(sId.split('_')[1]);
                return isNaN(num) ? 0 : num;
              }
              return 0;
            });
          const maxNum = Math.max(0, ...existingNumbers);
          const newShortId = `${prefix}_${maxNum + 1}`;
          shortIdMap[node.data.shortId || ''] = newShortId;

          const newNode: TapNode = {
            ...JSON.parse(JSON.stringify(node)),
            id: newId,
            selected: true, // Take over selection immediately
            zIndex: 1001, // Ensure clone is on top
            data: {
              ...node.data,
              shortId: newShortId,
              isCloning: false,
              isDraggedClone: true,
              clonedFrom: node.id,
              isLoading: false,
              isLocked: false,
              history: [],
              selectedHistoryId: undefined
            }
          };
          newNodes.push(newNode);
        });

        // Clone internal edges
        const ids = nodesToClone.map(n => n.id);
        const internalEdges = currentEdges.filter(e => ids.includes(e.source) && ids.includes(e.target));
        internalEdges.forEach(edge => {
          newEdges.push({
            ...JSON.parse(JSON.stringify(edge)),
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: idMap[edge.source],
            target: idMap[edge.target]
          });
        });

        // Clone external edges
        const externalEdges = currentEdges.filter(e => 
          (ids.includes(e.source) && !ids.includes(e.target)) || 
          (!ids.includes(e.source) && ids.includes(e.target))
        );
        externalEdges.forEach(edge => {
          newEdges.push({
            ...JSON.parse(JSON.stringify(edge)),
            id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            source: ids.includes(edge.source) ? idMap[edge.source] : edge.source,
            target: ids.includes(edge.target) ? idMap[edge.target] : edge.target
          });
        });

        // Smart Reference Remapping
        newNodes.forEach(node => {
          if (node.data.prompt) {
            let newPrompt = node.data.prompt;
            Object.entries(shortIdMap).forEach(([oldShortId, newShortId]) => {
              const regex = new RegExp(`\\( ${oldShortId} \\)`, 'g');
              newPrompt = newPrompt.replace(regex, `(${newShortId})`);
            });
            node.data.prompt = newPrompt;
          }
        });

        set({
          nodes: [
            ...currentNodes.map(n => 
              nodesToClone.some(ntc => ntc.id === n.id) 
                ? { ...n, selected: false, zIndex: 1, data: { ...n.data, isCloning: true, activeCloneId: idMap[n.id] } } 
                : n
            ),
            ...newNodes
          ],
          edges: [...currentEdges, ...newEdges]
        });
      },
      skipDeleteConfirm: false,
      setSkipDeleteConfirm: (skip) => set({ skipDeleteConfirm: skip }),
      rememberPinTargetChoice: false,
      setRememberPinTargetChoice: (remember) => set({ rememberPinTargetChoice: remember }),
      lastPinTargetId: null,
      setLastPinTargetId: (id) => set({ lastPinTargetId: id }),
    }},
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
        isRecognitionMode: state.isRecognitionMode,
        isCtrlPressed: false, // Don't persist key state
        isShiftPressed: false,
        isAltPressed: false,
        skipDeleteConfirm: state.skipDeleteConfirm,
        skipOverwriteConfirm: state.skipOverwriteConfirm,
        rememberPinTargetChoice: state.rememberPinTargetChoice,
        lastPinTargetId: state.lastPinTargetId,
        showMetadata: state.showMetadata
      }),
    }
  )
);
