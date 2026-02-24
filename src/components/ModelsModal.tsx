import React, { useState } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { useTapStore, ProviderConfig, ModelConfig, ProviderType } from '../store';
import { aiService } from '../services/aiService';
import { clsx } from 'clsx';

interface ModelsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModelsModal = ({ isOpen, onClose }: ModelsModalProps) => {
  const { providers, addProvider, updateProvider, removeProvider, globalDefaults, setGlobalDefault, setGlobalMock } = useTapStore();
  const [selectedProviderId, setSelectedProviderId] = useState<string | 'global-settings'>(providers[0]?.id || 'global-settings');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  const handleAddProvider = () => {
    const id = `provider-${Date.now()}`;
    const newProvider: ProviderConfig = {
      id,
      name: 'New Provider',
      type: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      enabled: true,
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', capabilities: { text: true, vision: true, image: false, video: false } }
      ]
    };
    addProvider(newProvider);
    setSelectedProviderId(id);
  };

  const handleAdd12AI = () => {
    const id = `12ai-${Date.now()}`;
    const newProvider: ProviderConfig = {
      id,
      name: '12AI Aggregator',
      type: 'openai-compatible',
      baseUrl: 'https://cdn.12ai.org',
      apiKey: '',
      enabled: true,
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', capabilities: { text: true, vision: true, image: false, video: false } },
        { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', capabilities: { text: true, vision: true, image: false, video: false } },
        { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Image', capabilities: { text: false, vision: false, image: true, video: false } },
        { id: 'seedance2-5s', name: 'Seedance 5s (Video)', capabilities: { text: false, vision: false, image: false, video: true } },
      ]
    };
    addProvider(newProvider);
    setSelectedProviderId(id);
  };

  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});

  const handleTestProvider = async (provider: ProviderConfig) => {
    setTestStatus(prev => ({ ...prev, [provider.id]: 'loading' }));
    try {
      const modelId = provider.models[0]?.id || 'gpt-4o';
      const response = await aiService.generate({
        prompt: 'Hi',
        modelId,
        provider
      });

      if (response.error) throw new Error(response.error);
      setTestStatus(prev => ({ ...prev, [provider.id]: 'success' }));
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [provider.id]: 'error' }));
    }
  };
  const handleAddModel = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    const newModel: ModelConfig = {
      id: 'new-model-id',
      name: 'New Model',
      capabilities: { text: true, vision: false, image: false, video: false },
      isCustom: true
    };

    updateProvider(providerId, {
      models: [...provider.models, newModel]
    });
  };

  const toggleKeyVisibility = (id: string) => {
    setShowKey(prev => ({ ...prev, [id]: !prev[id] }));
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
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />

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
                onClick={onClose}
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
                    <Zap size={14} className="text-yellow-500" fill="currentColor" />
                    <div className="text-[11px] font-bold uppercase tracking-widest">Global Defaults</div>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  <div className="px-3 py-2 text-[8px] uppercase tracking-[0.2em] text-[var(--app-text-muted)] font-bold">Providers</div>
                  {providers.map(p => (
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
                        p.id === 'system-mock' ? "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" :
                        p.enabled ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-600"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold truncate">{p.name}</div>
                        <div className="text-[9px] text-[var(--app-text-muted)] uppercase tracking-tighter truncate">
                          {p.id === 'system-mock' ? 'System' : p.type}
                        </div>
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
                      <div className="flex items-center gap-3 border-b border-white/10 pb-4 justify-between">
                        <div className="flex items-center gap-3">
                          <Zap size={20} className="text-yellow-500" fill="currentColor" />
                          <h3 className="text-sm font-display font-bold uppercase tracking-widest">Global Default Models</h3>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Global System Mock</span>
                          <button 
                            onClick={() => setGlobalMock(!globalDefaults.isGlobalMock)}
                            className={clsx(
                              "w-10 h-5 rounded-full relative transition-all",
                              globalDefaults.isGlobalMock ? "bg-blue-500" : "bg-zinc-700"
                            )}
                          >
                            <div className={clsx(
                              "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                              globalDefaults.isGlobalMock ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid gap-6">
                        {(['text', 'image', 'video'] as const).map(type => (
                          <div key={type} className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">
                              {type === 'text' ? 'Text / Vision Model' : type === 'image' ? 'Image Generation' : 'Video Generation'}
                            </label>
                            <div className="relative group">
                              <select
                                value={globalDefaults[type]}
                                onChange={(e) => setGlobalDefault(type, e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-[var(--app-border)] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[var(--brand-red)] transition-all appearance-none"
                              >
                                <option value="" className="bg-[#1a1a1a]">Not Set</option>
                                {providers.filter(p => p.enabled).map(p => (
                                  <optgroup key={p.id} label={p.name} className="bg-[#1a1a1a] text-[var(--app-text-muted)]">
                                    {p.models.filter(m => m.capabilities[type === 'text' ? 'text' : type]).map(m => (
                                      <option key={`${p.id}:${m.id}`} value={`${p.id}:${m.id}`} className="bg-[#1a1a1a] text-white">
                                        {m.name} ({m.id})
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
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-[var(--app-text-muted)] flex items-center gap-2">
                          <Globe size={12} /> Provider Configuration
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-[var(--app-text-muted)] uppercase">Status:</span>
                          <button 
                            onClick={() => handleTestProvider(selectedProvider)}
                            disabled={testStatus[selectedProvider.id] === 'loading'}
                            className={clsx(
                              "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all flex items-center gap-2",
                              testStatus[selectedProvider.id] === 'success' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                              testStatus[selectedProvider.id] === 'error' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                              "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                            )}
                          >
                            {testStatus[selectedProvider.id] === 'loading' ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
                            {testStatus[selectedProvider.id] === 'success' ? 'Connected' : 
                             testStatus[selectedProvider.id] === 'error' ? 'Failed' : 'Test Connection'}
                          </button>
                          <div className="h-4 w-px bg-white/10 mx-1" />
                          <button 
                            onClick={() => updateProvider(selectedProvider.id, { enabled: !selectedProvider.enabled })}
                            className={clsx(
                              "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all",
                              selectedProvider.enabled ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                            )}
                          >
                            {selectedProvider.enabled ? 'Active' : 'Disabled'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Display Name</label>
                          <input 
                            type="text"
                            value={selectedProvider.name}
                            onChange={(e) => updateProvider(selectedProvider.id, { name: e.target.value })}
                            disabled={selectedProvider.id === 'system-mock'}
                            className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[var(--brand-red)] transition-all disabled:opacity-50"
                            placeholder="e.g. 12AI Aggregator"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Protocol Type</label>
                          {selectedProvider.id === 'system-mock' ? (
                            <div className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs text-[var(--app-text-muted)] italic">
                              Internal System Protocol
                            </div>
                          ) : (
                            <select 
                              value={selectedProvider.type}
                              onChange={(e) => updateProvider(selectedProvider.id, { type: e.target.value as ProviderType })}
                              className="w-full bg-[#1a1a1a] border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[var(--brand-red)] transition-all appearance-none"
                            >
                              <option value="gemini" className="bg-[#1a1a1a] text-white">Google Gemini (Native)</option>
                              <option value="openai-compatible" className="bg-[#1a1a1a] text-white">OpenAI Compatible (Aggregator)</option>
                            </select>
                          )}
                        </div>
                      </div>

                      {selectedProvider.type === 'openai-compatible' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">Base URL</label>
                          <input 
                            type="text"
                            value={selectedProvider.baseUrl}
                            onChange={(e) => updateProvider(selectedProvider.id, { baseUrl: e.target.value })}
                            className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[var(--brand-red)] transition-all"
                            placeholder="https://api.example.com/v1"
                          />
                        </div>
                      )}

                      {selectedProvider.type !== 'mock' && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-bold uppercase tracking-widest text-[var(--app-text-muted)] ml-1">API Secret Key</label>
                          <div className="relative">
                            <input 
                              type={showKey[selectedProvider.id] ? "text" : "password"}
                              value={selectedProvider.apiKey}
                              onChange={(e) => updateProvider(selectedProvider.id, { apiKey: e.target.value })}
                              className="w-full bg-white/5 border border-[var(--app-border)] rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-[var(--brand-red)] transition-all pr-12"
                              placeholder="sk-••••••••••••••••••••••••"
                            />
                            <button 
                              onClick={() => toggleKeyVisibility(selectedProvider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-lg text-[var(--app-text-muted)] transition-colors"
                            >
                              {showKey[selectedProvider.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          <p className="text-[9px] text-[var(--app-text-muted)] ml-1 flex items-center gap-1">
                            <ShieldCheck size={10} /> Keys are stored locally in your browser's LocalStorage.
                          </p>
                        </div>
                      )}
                    </section>

                    {/* Models Section */}
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-[var(--app-text-muted)] flex items-center gap-2">
                          <Zap size={12} /> Available Models
                        </h3>
                        <button 
                          onClick={() => handleAddModel(selectedProvider.id)}
                          className="text-[9px] font-bold uppercase tracking-widest text-[var(--brand-red)] hover:underline flex items-center gap-1"
                        >
                          <Plus size={12} /> Custom Model
                        </button>
                      </div>

                      <div className="space-y-2">
                        {selectedProvider.models.map((model, mIdx) => (
                          <div 
                            key={`${selectedProvider.id}-${model.id}-${mIdx}`}
                            className="bg-white/5 border border-[var(--app-border)] rounded-2xl p-4 flex items-center gap-6 group hover:border-white/20 transition-all"
                          >
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-4">
                                <input 
                                  type="text"
                                  value={model.name}
                                  onChange={(e) => {
                                    const newModels = [...selectedProvider.models];
                                    newModels[mIdx] = { ...model, name: e.target.value };
                                    updateProvider(selectedProvider.id, { models: newModels });
                                  }}
                                  className="bg-transparent border-none p-0 text-xs font-bold focus:outline-none focus:ring-0 w-32"
                                  placeholder="Model Name"
                                />
                                <div className="h-4 w-px bg-white/10" />
                                <input 
                                  type="text"
                                  value={model.id}
                                  onChange={(e) => {
                                    const newModels = [...selectedProvider.models];
                                    newModels[mIdx] = { ...model, id: e.target.value };
                                    updateProvider(selectedProvider.id, { models: newModels });
                                  }}
                                  className="bg-transparent border-none p-0 text-[10px] font-mono text-[var(--app-text-muted)] focus:outline-none focus:ring-0 flex-1"
                                  placeholder="model-id-v1"
                                />
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="text-[8px] font-bold uppercase tracking-widest text-[var(--app-text-muted)]">Capabilities:</span>
                                <div className="flex items-center gap-2">
                                  {(['text', 'vision', 'image', 'video'] as const).map(cap => (
                                    <button
                                      key={cap}
                                      onClick={() => {
                                        const newModels = [...selectedProvider.models];
                                        newModels[mIdx] = { 
                                          ...model, 
                                          capabilities: { ...model.capabilities, [cap]: !model.capabilities[cap] } 
                                        };
                                        updateProvider(selectedProvider.id, { models: newModels });
                                      }}
                                      className={clsx(
                                        "px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-tighter transition-all border",
                                        model.capabilities[cap] 
                                          ? "bg-[var(--brand-red)]/20 border-[var(--brand-red)]/40 text-[var(--brand-red)]" 
                                          : "bg-white/5 border-white/10 text-[var(--app-text-muted)]"
                                      )}
                                    >
                                      {cap}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                const newModels = selectedProvider.models.filter((_, i) => i !== mIdx);
                                updateProvider(selectedProvider.id, { models: newModels });
                              }}
                              className="p-2 text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Danger Zone */}
                    {selectedProvider.id !== 'system-mock' && (
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
                              if (window.confirm('Are you sure you want to remove this provider? This action cannot be undone.')) {
                                removeProvider(selectedProvider.id);
                                setSelectedProviderId('global-settings');
                              }
                            }}
                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <Trash2 size={14} /> Remove Provider
                          </button>
                        </div>
                      </section>
                    )}
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
              <button 
                onClick={onClose}
                className="flex items-center gap-2 px-6 py-2 rounded-xl bg-[var(--brand-red)] text-white text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <Save size={14} /> Save Changes
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
