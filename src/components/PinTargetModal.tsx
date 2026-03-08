import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTapStore } from '../store';
import { X, Plus, Check } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

export const PinTargetModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [rememberChoice, setRememberChoice] = useState(false);
  
  const { addPin, addNode, updateNodeData, onConnect, setRememberPinTargetChoice, removePin } = useTapStore();
  const { setNodes } = useReactFlow();

  useEffect(() => {
    const handleShowModal = (e: any) => {
      setModalData(e.detail);
      setIsOpen(true);
    };

    window.addEventListener('show-pin-modal', handleShowModal);
    return () => window.removeEventListener('show-pin-modal', handleShowModal);
  }, []);

  const handleCreateNew = () => {
    const { nodeId, x, y, pinLabel, shortId, xPos, yPos, pinId } = modalData;
    const newNodeId = `node-${Date.now()}`;
    const spacing = 400;
    const newPos = { x: xPos + spacing, y: yPos };
    
    const mentionText = `[@ Pin_${pinLabel} (${shortId})]`;
    
    addNode({
      id: newNodeId,
      type: 'image-node',
      position: newPos,
      style: { width: 360, height: 400 },
      data: {
        type: 'image',
        label: `Image`,
        prompt: mentionText,
        outputs: {},
        outputVersions: { text: 0, image: 0, video: 0, prompt: 0 },
        activeOutputMode: 'image'
      }
    });

    // Select the new node
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === newNodeId })));

    // Create connection
    onConnect({
      source: nodeId,
      target: newNodeId,
      sourceHandle: 'output-image',
      targetHandle: 'input-main',
      data: { pinId }
    } as any);

    if (rememberChoice) {
      setRememberPinTargetChoice(true);
    }

    setIsOpen(false);
  };

  const handleCancel = () => {
    const { nodeId, pinId } = modalData || {};
    if (nodeId && pinId) {
      removePin(nodeId, pinId);
    }
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-[var(--app-panel)] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">未选择插入目标</h3>
                <button onClick={handleCancel} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <p className="text-sm text-white/60 mb-6 leading-relaxed">
                您当前没有选中任何可接收标记的节点。是否在右侧创建一个新节点并自动关联？
              </p>

              <div className="flex items-center gap-2 mb-8 cursor-pointer group" onClick={() => setRememberChoice(!rememberChoice)}>
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberChoice ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'}`}>
                  {rememberChoice && <Check size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">记住我的选择</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-bold text-sm transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateNew}
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  立即创建
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
