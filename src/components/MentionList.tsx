import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { TapNode } from '../store';
import { cn } from '../lib/utils';
import { Image as ImageIcon, Type, Video } from 'lucide-react';

interface MentionListProps {
  items: TapNode[];
  command: (props: { id: string; label: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.data.shortId, label: item.data.label });
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
      <div className="p-2 border-b border-white/10 text-[8px] uppercase tracking-widest text-white/40">Reference Node</div>
      <div className="max-h-48 overflow-y-auto">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              className={cn(
                "w-full px-3 py-2 text-left flex items-center justify-between group transition-colors",
                index === selectedIndex ? "bg-white/10" : "hover:bg-white/5"
              )}
              key={item.id}
              onClick={() => selectItem(index)}
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white/90">{item.data.label}</span>
                <span className="text-[8px] text-white/30 font-mono">{item.data.shortId}</span>
              </div>
              <div className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/40 group-hover:bg-[var(--brand-red)] group-hover:text-white uppercase">
                {item.type === 'image-node' ? 'IMG' : item.type === 'video-node' ? 'VID' : 'TEXT'}
              </div>
            </button>
          ))
        ) : (
          <div className="p-2 text-xs text-white/30 text-center">No result</div>
        )}
      </div>
    </div>
  );
});

MentionList.displayName = 'MentionList';
