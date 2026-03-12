import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  Check, 
  Eye, 
  EyeOff, 
  Globe, 
  Cpu, 
  Zap, 
  ShieldCheck,
  AlertCircle,
  Save,
  Loader2,
  ChevronDown,
  RotateCcw,
  GripVertical,
  Power
} from 'lucide-react';
import { useTapStore, ProviderConfig, ModelConfig, ProviderType } from '../store';
import { aiService } from '../services/aiService';
import { clsx } from 'clsx';
import { ConfirmDialog, Toast } from './UI';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SortableModelItemProps {
  model: ModelConfig;
  globalIdx: number;
  type: 'text' | 'image' | 'video';
  selectedProvider: ProviderConfig;
  handleUpdateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
}

const SortableModelItem = ({ 
  model, 
  globalIdx, 
  type, 
  selectedProvider, 
  handleUpdateProvider 
}: SortableModelItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: `${selectedProvider.id}-${type}-${model.id}-${globalIdx}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={clsx(
        "bg-white/5 border rounded-xl group relative transition-all flex overflow-hidden",
        model.enabled ? "border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-white/10 opacity-60 grayscale-[0.2]"
      )}
    >
      {/* Power Strip on the left (Status Ribbon) */}
      <div 
        className={clsx(
          "w-8 flex items-center justify-center border-r transition-all duration-300",
          model.enabled ? "bg-emerald-500/20 border-emerald-500/30" : "bg-black/40 border-white/5"
        )}
      >
        <button
          onClick={() => {
            const newModels = [...selectedProvider.models];
            newModels[globalIdx] = { ...model, enabled: !model.enabled };
            handleUpdateProvider(selectedProvider.id, { models: newModels });
          }}
          className={clsx(
            "w-full h-full flex items-center justify-center transition-all duration-300",
            model.enabled ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "text-white/10 hover:text-white/30"
          )}
          title={model.enabled ? "Disable Model" : "Enable Model"}
        >
          <Power size={14} className={clsx(model.enabled && "animate-pulse-subtle")} />
        </button>
      </div>

      <div className="flex-1 p-2 space-y-2">
        <div className="flex items-center gap-1.5">
          <select
            disabled={selectedProvider.defaultProtocol !== 'mix'}
            value={selectedProvider.defaultProtocol === 'mix' ? (model.protocol || 'openai-compatible') : selectedProvider.defaultProtocol}
            onChange={(e) => {
              const newModels = [...selectedProvider.models];
              newModels[globalIdx] = { ...model, protocol: e.target.value as any };
              handleUpdateProvider(selectedProvider.id, { models: newModels });
            }}
            className={clsx(
              "bg-black/40 border border-white/10 rounded-md px-1 py-0.5 text-[9px] font-bold focus:outline-none transition-all",
              selectedProvider.defaultProtocol === 'mix' ? "text-[var(--brand-red)] cursor-pointer" : "text-zinc-600 cursor-not-allowed opacity-50"
            )}
          >
            <option value="openai-compatible">O</option>
            <option value="gemini">G</option>
          </select>
          <input 
            type="text"
            value={model.id}
            onChange={(e) => {
              const newModels = [...selectedProvider.models];
              newModels[globalIdx] = { ...model, id: e.target.value };
              handleUpdateProvider(selectedProvider.id, { models: newModels });
            }}
            className="bg-transparent border-none p-0 text-[10px] font-mono text-white focus:outline-none focus:ring-0 flex-1 min-w-0"
            placeholder="Model ID"
          />
          <button 
            onClick={() => {
              const newModels = selectedProvider.models.filter((_, i) => i !== globalIdx);
              handleUpdateProvider(selectedProvider.id, { models: newModels });
            }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-red-500 transition-all"
          >
            <X size={10} />
          </button>
        </div>
        <input 
          type="text"
          value={model.name}
          onChange={(e) => {
            const newModels = [...selectedProvider.models];
            newModels[globalIdx] = { ...model, name: e.target.value };
            handleUpdateProvider(selectedProvider.id, { models: newModels });
          }}
          className="w-full bg-transparent border-none p-0 text-[9px] text-[var(--app-text-muted)] italic focus:outline-none focus:ring-0 px-1"
          placeholder="Display Name (Optional)"
        />
      </div>

      {/* Drag Handle on the right */}
      <button 
        {...attributes} 
        {...listeners}
        className="w-8 flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-white/5 border-l border-white/5 transition-all text-white/10 hover:text-white/30 group-hover:text-white/20"
      >
        <GripVertical size={14} />
      </button>
    </div>
  );
};

export const ModelsModal = ({ isOpen, onClose }: ModelsModalProps) => {
  const { 
    providers: storeProviders, 
    addProvider: storeAddProvider, 
    updateProvider: storeUpdateProvider, 
    removeProvider: storeRemoveProvider, 
    globalDefaults: storeGlobalDefaults, 
    setGlobalDefault: storeSetGlobalDefault
  } = useTapStore();

  // Local state for editing
  const [localProviders, setLocalProviders] = useState<ProviderConfig[]>([]);
  const [localGlobalDefaults, setLocalGlobalDefaults] = useState(storeGlobalDefaults);
  
  const [selectedProviderId, setSelectedProviderId] = useState<string | 'global-settings'>('global-settings');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleKeyVisibility = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Dialog states
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalProviders(JSON.parse(JSON.stringify(storeProviders)));
      setLocalGlobalDefaults({ ...storeGlobalDefaults });
      setSelectedProviderId('global-settings');
      // Reset UI states
      setShowUnsavedConfirm(false);
      setShowSaveToast(false);
      setConfirmRemoveId(null);
      setIsSaving(false);
    }
  }, [isOpen, storeProviders, storeGlobalDefaults]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(localProviders) !== JSON.stringify(storeProviders) ||
           JSON.stringify(localGlobalDefaults) !== JSON.stringify(storeGlobalDefaults);
  }, [localProviders, storeProviders, localGlobalDefaults, storeGlobalDefaults]);

  const selectedProvider = localProviders.find(p => p.id === selectedProviderId);

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider: ProviderConfig = {
      id,
      name: 'New Provider',
      type: 'openai-compatible',
      defaultProtocol: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      enabled: true,
      models: []
    };
    setLocalProviders([...localProviders, newProvider]);
    setSelectedProviderId(id);
  };

  const handleUpdateProvider = (id: string, updates: Partial<ProviderConfig>) => {
    setLocalProviders(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleRemoveProvider = (id: string) => {
    setLocalProviders(prev => prev.filter(p => p.id !== id));
    if (selectedProviderId === id) {
      setSelectedProviderId('global-settings');
    }
    setConfirmRemoveId(null);
  };

  const handleSetGlobalDefault = (type: 'text' | 'image' | 'video', value: string) => {
    setLocalGlobalDefaults(prev => ({ ...prev, [type]: value }));
  };

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);

    // Commit all local changes to store
    // 1. Update providers
    // First remove ones that are gone
    const currentStoreIds = storeProviders.map(p => p.id);
    const localIds = localProviders.map(p => p.id);
    currentStoreIds.forEach(id => {
      if (!localIds.includes(id)) storeRemoveProvider(id);
    });

    // Then update/add
    localProviders.forEach(p => {
      const existing = storeProviders.find(sp => sp.id === p.id);
      if (existing) {
        storeUpdateProvider(p.id, p);
      } else {
        storeAddProvider(p);
      }
    });

    // 2. Update defaults
    storeSetGlobalDefault('text', localGlobalDefaults.text);
    storeSetGlobalDefault('image', localGlobalDefaults.image);
    storeSetGlobalDefault('video', localGlobalDefaults.video);

    setShowSaveToast(true);
    
    // Use a ref or a flag to prevent the "unsaved changes" dialog from showing during the close timeout
    // Actually, setting isSaving to true and checking it in handleCloseAttempt is better
    
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleCloseAttempt = () => {
    if (isSaving) return; // Don't allow closing while saving
    if (hasChanges) {
      setShowUnsavedConfirm(true);
    } else {
      onClose();
    }
  };

  const handleTestProvider = async (provider: ProviderConfig) => {
    setTestStatus(prev => ({ ...prev, [provider.id]: 'loading' }));
    try {
      const success = await aiService.testConnection(provider);
      setTestStatus(prev => ({ ...prev, [provider.id]: success ? 'success' : 'error' }));
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [provider.id]: 'error' }));
    }
  };
  const handleAddModel = (providerId: string, type: 'text' | 'image' | 'video') => {
    const provider = localProviders.find(p => p.id === providerId);
    if (!provider) return;

    const newModel: ModelConfig = {
      id: '',
      name: '',
      capabilities: { 
        text: type === 'text', 
        image: type === 'image', 
        video: type === 'video' 
      },
      protocol: provider.defaultProtocol,
      enabled: true,
      isCustom: true
    };

    handleUpdateProvider(providerId, {
      models: [...provider.models, newModel]
    });
  };

  const handleDragEnd = (event: DragEndEvent, type: 'text' | 'image' | 'video') => {
    const { active, over } = event;
    if (!over || !selectedProvider) return;

    if (active.id !== over.id) {
      const typeModels = selectedProvider.models.filter(m => m.capabilities[type]);
      const oldIndex = typeModels.findIndex(m => {
        const globalIdx = selectedProvider.models.indexOf(m);
        return `${selectedProvider.id}-${type}-${m.id}-${globalIdx}` === active.id;
      });
      const newIndex = typeModels.findIndex(m => {
        const globalIdx = selectedProvider.models.indexOf(m);
        return `${selectedProvider.id}-${type}-${m.id}-${globalIdx}` === over.id;
      });

      if (oldIndex !== -1 && newIndex !== -1) {
        const movedModel = typeModels[oldIndex];
        const otherModels = selectedProvider.models.filter(m => !m.capabilities[type]);
        
        // Reconstruct the models array
        const newTypeModels = arrayMove(typeModels, oldIndex, newIndex);
        
        // This is tricky because we want to maintain relative order but they are mixed in the global array
        // For simplicity, we'll group them by capability for now or just update the global array
        const newGlobalModels = [...selectedProvider.models];
        
        // Find all indices of models of this type in the global array
        const globalIndices = selectedProvider.models
          .map((m, i) => m.capabilities[type] ? i : -1)
          .filter(i => i !== -1);
          
        // Replace them with the new ordered models
        newTypeModels.forEach((m, i) => {
          newGlobalModels[globalIndices[i]] = m;
        });

        handleUpdateProvider(selectedProvider.id, { models: newGlobalModels });
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-12"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={handleCloseAttempt} />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl h-full max-h-[800px] bg-[#0a0a0a] border border-[var(--app-border)] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="h-16 border-b border-[var(--app-border)] flex items-center justify-between px-8 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--brand-red)] rounded-lg flex items-center justify-center">
                  <Cpu size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-bold uppercase tracking-widest">Model Management</h2>
                  <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-tight">Configure your AI providers and custom models</p>
                </div>
              </div>
              <button 
                onClick={handleCloseAttempt}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar: Provider List */}
              <aside className="w-64 border-r border-[var(--app-border)] bg-black/20 flex flex-col">
                <div className="p-2 border-b border-[var(--app-border)]">
                  <button
                    onClick={() => setSelectedProviderId('global-settings')}
                    className={clsx(
                      "w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-all text-left",
                      selectedProviderId === 'global-settings' 
                        ? "bg-white/10 border border-white/20" 
                        : "hover:bg-white/5 border border-transparent"
                    )}
                  >
                    <Zap size={14} className="text-[var(--brand-red)]" fill="currentColor" />
                    <div className="text-[11px] font-bold uppercase tracking-widest">Global Defaults</div>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  <div className="px-3 py-2 text-[8px] uppercase tracking-[0.2em] text-[var(--app-text-muted)] font-bold">Providers</div>
                  {localProviders.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProviderId(p.id)}
                      className={clsx(
                        "w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-all text-left group",
                        selectedProviderId === p.id 
                          ? "bg-[var(--brand-red)]/10 border border-[var(--brand-red)]/30" 
                          : "hover:bg-white/5 border border-transparent"
                      )}
                    >
                      <div className={clsx(
                        "w-2 h-2 rounded-full",
                        p.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold truncate">{p.name}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="p-4 border-t border-[var(--app-border)]">
                  <button 
                    onClick={handleAddProvider}
                    className="w-full py-2 px-4 rounded-xl bg-white/5 border border-dashed border-white/20 hover:border-[var(--brand-red)] hover:bg-[var(--brand-red)]/10 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Plus size={14} /> Add Provider
                  </button>
                </div>
              </aside>

              {/* Main Content: Provider Settings */}
              <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-black to-[#0d0d0d]">
                {selectedProviderId === 'global-settings' ? (
                  <div className="max-w-3xl mx-auto space-y-8">
                    <section className="space-y-6">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Zap size={14} className="text-[var(--brand-red)]" />
                        <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-white">
                          Global Default Models
                        </h3>
                      </div>
                      
                      <div className="grid gap-6">
                        {(['text', 'image', 'video'] as const).map(type => (
                          <div key={type} className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">
                              {type === 'text' ? 'Text / Vision Model' : type === 'image' ? 'Image Generation' : 'Video Generation'}
                            </label>
                            <div className="relative group">
                              <select
                                value={localGlobalDefaults[type]}
                                onChange={(e) => handleSetGlobalDefault(type, e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-[var(--app-border)] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[var(--brand-red)] transition-all appearance-none"
                              >
                                <option value="" className="bg-[#1a1a1a]">Not Set</option>
                                {localProviders.filter(p => p.enabled).map(p => (
                                  <optgroup key={p.id} label={p.name} className="bg-[#1a1a1a] text-[var(--app-text-muted)]">
                                    {p.models.filter(m => m.enabled && m.capabilities[type === 'text' ? 'text' : type]).map(m => (
                                      <option key={`${p.id}:${m.id}`} value={`${p.id}:${m.id}`} className="bg-[#1a1a1a] text-white">
                                        {m.name || m.id} ({m.id})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
                        <p className="text-[10px] text-blue-400/80 leading-relaxed">
                          New nodes will automatically use these defaults. Nodes that have been manually configured will retain their settings.
                        </p>
                      </div>
                    </section>
                  </div>
                ) : selectedProvider ? (
                  <div className="max-w-3xl mx-auto space-y-8">
                    {/* Basic Info Section */}
                    <section className="space-y-6">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <Globe size={14} className="text-[var(--brand-red)]" />
                          <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-white">
                            Provider Configuration
                          </h3>
                        </div>
                        <button 
                          onClick={() => handleUpdateProvider(selectedProvider.id, { enabled: !selectedProvider.enabled })}
                          className={clsx(
                            "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                            selectedProvider.enabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                          )}
                        >
                          {selectedProvider.enabled ? 'Active' : 'Disabled'}
                        </button>
                      </div>

                      {/* Row 1: Name, URL, Protocol */}
                      <div className="flex gap-4 items-end">
                        <div className="flex-[1.5] space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Display Name</label>
                          <input 
                            type="text"
                            value={selectedProvider.name}
                            onChange={(e) => handleUpdateProvider(selectedProvider.id, { name: e.target.value })}
                            className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--brand-red)] transition-all disabled:opacity-50"
                            placeholder="e.g. 12AI Aggregator"
                          />
                        </div>
                        <div className="flex-[5.5] space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Base URL</label>
                          <input 
                            type="text"
                            value={selectedProvider.baseUrl}
                            onChange={(e) => handleUpdateProvider(selectedProvider.id, { baseUrl: e.target.value })}
                            className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[var(--brand-red)] transition-all"
                            placeholder={selectedProvider.type === 'gemini' ? "https://generativelanguage.googleapis.com" : "https://api.openai.com/v1"}
                          />
                        </div>
                        <div className="flex-[3] space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Default Protocol</label>
                          <div className="flex bg-white/5 border border-[var(--app-border)] rounded-xl p-1">
                            {(['openai-compatible', 'gemini', 'mix'] as const).map(p => (
                              <button
                                key={p}
                                onClick={() => handleUpdateProvider(selectedProvider.id, { defaultProtocol: p })}
                                className={clsx(
                                  "flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                                  selectedProvider.defaultProtocol === p 
                                    ? "bg-[var(--brand-red)] text-white shadow-lg" 
                                    : "text-[var(--app-text-muted)] hover:text-white"
                                )}
                              >
                                {p === 'openai-compatible' ? 'OpenAI' : p === 'gemini' ? 'Gemini' : 'Mix'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Row 2: API Key & Unified Connection Hub */}
                      <div className="flex gap-4 items-end">
                        <div className="flex-[7] space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">API Secret Key</label>
                          <div className="relative">
                            <input 
                              type={showKey[selectedProvider.id] ? "text" : "password"}
                              value={selectedProvider.apiKey}
                              onChange={(e) => handleUpdateProvider(selectedProvider.id, { apiKey: e.target.value })}
                              className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 h-[38px] text-xs font-mono focus:outline-none focus:border-[var(--brand-red)] transition-all pr-12"
                              placeholder="sk-••••••••••••••••••••••••"
                            />
                            <button 
                              onClick={() => toggleKeyVisibility(selectedProvider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-[var(--app-text-muted)] transition-colors"
                            >
                              {showKey[selectedProvider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-[3] pb-0.5">
                          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl h-[38px] overflow-hidden w-full">
                            {/* Status Section */}
                            <div className="flex-1 flex items-center gap-3 px-4 border-r border-white/10 h-full">
                              <span className="text-[11px] font-bold text-white/60 uppercase tracking-tight">Status:</span>
                              <div className={clsx(
                                "transition-all duration-500",
                                testStatus[selectedProvider.id] === 'success' ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                                testStatus[selectedProvider.id] === 'error' ? "text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]" :
                                testStatus[selectedProvider.id] === 'loading' ? "text-blue-400" :
                                "text-white/20"
                              )}>
                                {testStatus[selectedProvider.id] === 'loading' ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Zap size={14} fill={testStatus[selectedProvider.id] === 'success' ? "currentColor" : "none"} />
                                )}
                              </div>
                            </div>

                            {/* Test Button Section */}
                            <div className="px-1.5 py-1.5 h-full flex items-center">
                              <button 
                                onClick={() => handleTestProvider(selectedProvider)}
                                disabled={testStatus[selectedProvider.id] === 'loading'}
                                className={clsx(
                                  "h-full px-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.1em] transition-all disabled:opacity-50 flex items-center justify-center",
                                  "bg-white/10 border border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.2)] hover:bg-white/20 hover:border-white/20 active:scale-95 active:bg-white/5",
                                  testStatus[selectedProvider.id] === 'success' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                                  testStatus[selectedProvider.id] === 'error' ? "text-red-400 border-red-500/30 bg-red-500/10" :
                                  "text-white"
                                )}
                              >
                                {testStatus[selectedProvider.id] === 'loading' ? 'Testing' : 'Test'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-[9px] text-[var(--app-text-muted)] ml-1 flex items-center gap-1 -mt-4">
                        <ShieldCheck size={10} /> Keys are stored locally in your browser's LocalStorage.
                      </p>
                    </section>

                    {/* Models Section - Three Columns */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Zap size={14} className="text-[var(--brand-red)]" />
                        <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-white">Model Configuration</h3>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        {(['text', 'image', 'video'] as const).map(type => {
                          const typeModels = selectedProvider.models.filter(m => m.capabilities[type]);
                          const modelIds = typeModels.map((m, i) => {
                            const globalIdx = selectedProvider.models.indexOf(m);
                            return `${selectedProvider.id}-${type}-${m.id}-${globalIdx}`;
                          });

                          return (
                            <div key={type} className="space-y-3">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">
                                  {type === 'text' ? 'Text / Vision' : type === 'image' ? 'Image' : 'Video'}
                                </span>
                              </div>

                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={(event) => handleDragEnd(event, type)}
                              >
                                <SortableContext
                                  items={modelIds}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div className="space-y-2">
                                    {typeModels.map((model) => {
                                      const globalIdx = selectedProvider.models.indexOf(model);
                                      return (
                                        <SortableModelItem
                                          key={`${selectedProvider.id}-${type}-${model.id}-${globalIdx}`}
                                          model={model}
                                          globalIdx={globalIdx}
                                          type={type}
                                          selectedProvider={selectedProvider}
                                          handleUpdateProvider={handleUpdateProvider}
                                        />
                                      );
                                    })}
                                    
                                    {/* Ghost Card: Add Model Button */}
                                    <button
                                      onClick={() => handleAddModel(selectedProvider.id, type)}
                                      className="w-full h-[54px] border border-dashed border-white/10 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] hover:border-[var(--brand-red)]/30 transition-all group/ghost flex items-center justify-center gap-2.5"
                                    >
                                      <Plus size={12} className="text-white/10 group-hover/ghost:text-[var(--brand-red)] transition-all" />
                                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/10 group-hover/ghost:text-white/40 transition-all">
                                        Add {type === 'text' ? 'Text' : type === 'image' ? 'Image' : 'Video'} Model
                                      </span>
                                    </button>

                                    {typeModels.length === 0 && (
                                      <div className="py-4 flex items-center justify-center">
                                        <span className="text-[8px] uppercase tracking-widest text-white/5 italic">No models configured</span>
                                      </div>
                                    )}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                      <section className="pt-8 border-t border-white/10">
                        <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Danger Zone</h4>
                            <p className="text-[10px] text-red-500/60">Removing this provider will delete all its configurations and keys.</p>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmRemoveId(selectedProvider.id);
                            }}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Remove Provider
                          </button>
                        </div>
                      </section>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-[var(--app-text-muted)]">
                      <Cpu size={32} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">No Provider Selected</h3>
                      <p className="text-xs text-[var(--app-text-muted)]">Select a provider from the sidebar or add a new one.</p>
                    </div>
                  </div>
                )}
              </main>
            </div>

            {/* Footer */}
            <footer className="h-16 border-t border-[var(--app-border)] flex items-center justify-between px-8 bg-black/40">
              <div className="flex items-center gap-2 text-[9px] text-[var(--app-text-muted)] uppercase font-mono">
                <ShieldCheck size={12} className="text-emerald-500" /> End-to-end local encryption active
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleCloseAttempt}
                  className="px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all flex items-center gap-2"
                >
                  <RotateCcw size={14} /> Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className={clsx(
                    "flex items-center gap-2 px-6 py-2 rounded-xl text-white text-[10px] font-bold uppercase tracking-widest transition-all",
                    hasChanges ? "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20" : "bg-zinc-800 text-zinc-500 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Save size={14} /> Save Changes
                </button>
              </div>
            </footer>
          </motion.div>

          {/* Dialogs & Toasts */}
          <ConfirmDialog
            isOpen={!!confirmRemoveId}
            title="Remove Provider"
            message="Are you sure you want to remove this provider? This action cannot be undone and all associated configurations will be lost."
            confirmLabel="Remove"
            onConfirm={() => confirmRemoveId && handleRemoveProvider(confirmRemoveId)}
            onCancel={() => setConfirmRemoveId(null)}
            variant="danger"
          />

          <ConfirmDialog
            isOpen={showUnsavedConfirm}
            title="Unsaved Changes"
            message="You have unsaved changes. Are you sure you want to leave without saving?"
            confirmLabel="Discard Changes"
            cancelLabel="Keep Editing"
            onConfirm={onClose}
            onCancel={() => setShowUnsavedConfirm(false)}
            variant="warning"
          />

          <Toast
            isVisible={showSaveToast}
            message="Settings saved successfully"
            onClose={() => setShowSaveToast(false)}
            type="success"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
