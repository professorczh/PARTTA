import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Mention from '@tiptap/extension-mention';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { TapNode } from '../store';
import { MentionList } from './MentionList';
import { cn } from '../lib/utils';
import './MentionEditor.css'; // We'll create this for custom styles

interface MentionEditorProps {
  initialContent: string;
  onChange: (content: string) => void;
  mentions: TapNode[];
  currentNodeId: string;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

import { useTapStore } from '../store';

export const MentionEditor: React.FC<MentionEditorProps> = ({
  initialContent,
  onChange,
  mentions,
  currentNodeId,
  placeholder,
  className,
  onEnter,
  autoFocus,
  onFocus,
  onBlur
}) => {
  const { nodes, edges, setEdges } = useTapStore();
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({}),
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            connected: {
              default: true,
              parseHTML: element => element.getAttribute('data-connected') !== 'false',
              renderHTML: attributes => {
                return {
                  'data-connected': attributes.connected,
                }
              },
            },
          }
        },
      }).configure({
        HTMLAttributes: {
          class: 'mention-chip',
          onmouseenter: 'this.dispatchEvent(new CustomEvent("mention-hover", { bubbles: true, detail: { id: this.getAttribute("data-id"), label: this.getAttribute("data-label") } }))',
          onmouseleave: 'this.dispatchEvent(new CustomEvent("mention-leave", { bubbles: true }))',
        },
        suggestion: {
          items: ({ query }) => {
            return mentions
              .filter(item => 
                item.data.label.toLowerCase().includes(query.toLowerCase()) || 
                item.data.shortId?.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: TippyInstance[];

            return {
              onStart: props => {
                component = new ReactRenderer(MentionList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                  return;
                }

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                // Cast component.ref to any to access onKeyDown
                return (component.ref as any)?.onKeyDown(props);
              },
              onExit() {
                popup[0].destroy();
                component.destroy();
              },
            };
          },
        },
      }),
    ],
    content: parseMentions(initialContent),
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const text = serializeMentions(json);
      onChange(text);
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class: cn(
          'nodrag focus:outline-none w-full h-full text-white/90 font-mono text-sm cursor-text',
          className
        ),
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onEnter?.();
          return true;
        }
        return false;
      }
    },
  });

  // Focus when autoFocus changes to true
  useEffect(() => {
    if (autoFocus && editor) {
      editor.commands.focus('end');
    }
  }, [autoFocus, editor]);

  // Sync connected state of mentions
  useEffect(() => {
    if (!editor) return;

    let hasChanges = false;
    const { tr } = editor.state;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'mention') {
        const targetShortId = node.attrs.id;
        const targetNode = nodes.find(n => n.data.shortId === targetShortId);
        const isConnected = !!(targetNode && edges.some(e => e.source === targetNode.id && e.target === currentNodeId));
        
        if (node.attrs.connected !== isConnected) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            connected: isConnected,
          });
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      editor.view.dispatch(tr);
    }
  }, [edges, nodes, editor, currentNodeId]);

  // Sync initial content if it changes externally
  useEffect(() => {
    if (!editor) return;
    
    const currentSerialized = serializeMentions(editor.getJSON()).trim();
    if (initialContent.trim() !== currentSerialized) {
      editor.commands.setContent(parseMentions(initialContent));
    }
  }, [initialContent, editor]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHover = (e: any) => {
      const { id, label } = e.detail;
      // If it's a Pin mention, highlight the edge
      if (label.startsWith('Pin_')) {
        const pinIndex = label.split('_')[1];
        const sourceEdges = edges.filter(edge => 
          edge.source === id && 
          edge.data && 
          typeof (edge.data as any).pinId === 'string' && 
          (edge.data as any).pinId.includes(pinIndex)
        );
        if (sourceEdges.length > 0) {
          setEdges(edges.map(edge => sourceEdges.some(se => se.id === edge.id) ? { ...edge, data: { ...edge.data, isHovered: true } } : edge));
        }
      } else {
        // Normal node mention, highlight the edge
        const targetEdge = edges.find(edge => edge.source === id);
        if (targetEdge) {
          setEdges(edges.map(edge => edge.id === targetEdge.id ? { ...edge, data: { ...edge.data, isHovered: true } } : edge));
        }
      }
    };

    const handleLeave = () => {
      setEdges(edges.map(edge => ({ ...edge, data: { ...edge.data, isHovered: false } })));
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('mention-hover', handleHover);
      el.addEventListener('mention-leave', handleLeave);
    }
    return () => {
      if (el) {
        el.removeEventListener('mention-hover', handleHover);
        el.removeEventListener('mention-leave', handleLeave);
      }
    };
  }, [edges, setEdges]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      <EditorContent editor={editor} className="w-full h-full" />
    </div>
  );
};

// Helper: Parse string "Hello [@ Node A (ID)]" to TipTap JSON/HTML
function parseMentions(text: string): string {
  if (!text) return '';
  // Replace [@ Label (ID)] with <span data-type="mention" data-id="ID" data-label="Label">@Label</span>
  return text.replace(
    /\[@ (.*?) \((.*?)\)\]/g,
    (match, label, id) => `<span data-type="mention" data-id="${id}" data-label="${label}">@${label}</span>`
  ).replace(/\n/g, '<br>'); // Handle newlines
}

// Helper: Serialize TipTap JSON to string "Hello [@ Node A (ID)]"
function serializeMentions(doc: any): string {
  if (!doc) return '';
  
  // If it's the root doc or a paragraph, process its content
  if (doc.content && Array.isArray(doc.content)) {
    return doc.content.map((node: any) => serializeMentions(node)).join('');
  }

  if (doc.type === 'text') {
    return doc.text || '';
  }

  if (doc.type === 'mention') {
    const label = doc.attrs.label || doc.attrs.id;
    return `[@ ${label} (${doc.attrs.id})]`;
  }

  if (doc.type === 'paragraph') {
    // Paragraphs usually end with a newline, unless it's the last one?
    // TipTap doesn't store newlines explicitly. Paragraphs imply blocks.
    // We can join paragraph contents and append a newline.
    // But wait, serializeMentions is recursive.
    // Let's handle paragraph content here.
    const content = doc.content ? doc.content.map((n: any) => serializeMentions(n)).join('') : '';
    return content + '\n';
  }

  return '';
}
