import { TapNode, NodeData } from '../store';

export interface PromptSegment {
  type: 'text' | 'reference';
  content: string;
  nodeId?: string;
}

export interface ResolvedPrompt {
  prompt: string;
  segments: PromptSegment[];
  images: { data: string; mimeType: string }[];
  referencedNodeIds: string[];
}

export const resolvePrompt = (
  prompt: string,
  nodes: TapNode[],
  edges: any[],
  currentNodeId: string,
  visited: Set<string> = new Set()
): ResolvedPrompt => {
  const images: { data: string; mimeType: string }[] = [];
  const referencedNodeIds: string[] = [];
  const segments: PromptSegment[] = [];

  // Prevent infinite loops
  if (visited.has(currentNodeId)) {
    return {
      prompt: '[Circular Reference]',
      segments: [{ type: 'text', content: '[Circular Reference]' }],
      images: [],
      referencedNodeIds: []
    };
  }
  
  const newVisited = new Set(visited);
  newVisited.add(currentNodeId);

  // Regex to match [@ Label (ID)]
  const mentionRegex = /\[@ (.*?) \((.*?)\)\]/g;

  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(prompt)) !== null) {
    const [fullMatch, label, id] = match;
    const startIndex = match.index;

    const targetNode = nodes.find(n => n.data.shortId === id);
    const isConnected = targetNode && edges.some(e => e.source === targetNode.id && e.target === currentNodeId);

    // If node doesn't exist or is not connected, skip this mention entirely in PREV/RAW
    if (!targetNode || !isConnected) {
      // Add preceding text segment
      if (startIndex > lastIndex) {
        segments.push({
          type: 'text',
          content: prompt.substring(lastIndex, startIndex)
        });
      }
      lastIndex = mentionRegex.lastIndex;
      continue;
    }

    // Add preceding text segment
    if (startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: prompt.substring(lastIndex, startIndex)
      });
    }

    referencedNodeIds.push(targetNode.id);
    
    // Determine port type based on label or node type
    let portType = 'text';
    if (label.startsWith('IMG_') || targetNode.type === 'image-node') portType = 'image';
    if (label.startsWith('VID_') || targetNode.type === 'video-node') portType = 'video';
    
    // Check if it's a PIN mention
    const isPinMention = label.startsWith('Pin_');

    // If target node has generated content, use it directly and skip recursion
    if (targetNode.data.isGenerated && targetNode.data.outputs?.text) {
      let finalValue = targetNode.data.outputs.text;
      if (targetNode.data.includeTitleInOutput) {
        finalValue = `\n${targetNode.data.label || 'Text'}:\n${finalValue}\n`;
      }
      segments.push({
        type: 'reference',
        content: finalValue,
        nodeId: targetNode.id
      });
      lastIndex = mentionRegex.lastIndex;
      continue;
    }
    
    // Recursively resolve the target node's content
    const targetPrompt = targetNode.data.prompt || '';
    const resolvedTarget = resolvePrompt(targetPrompt, nodes, edges, targetNode.id, newVisited);
    
    // Collect images from nested resolutions
    images.push(...resolvedTarget.images);
    
    // Use output if available, otherwise use resolved prompt
    let rawContent = targetNode.data.outputs?.[portType as keyof NodeData['outputs']] || resolvedTarget.prompt;
    
    // Fallback for images: check uploadedImages or history
    if ((portType === 'image' || isPinMention) && (!rawContent || !rawContent.startsWith('data:'))) {
      const uploaded = targetNode.data.uploadedImages?.[0]?.url;
      const history = targetNode.data.history?.[0]?.url;
      if (uploaded && uploaded.startsWith('data:')) rawContent = uploaded;
      else if (history && history.startsWith('data:')) rawContent = history;
    }

    if ((portType === 'image' || isPinMention) && rawContent && rawContent.startsWith('data:')) {
      // Extract mimeType from data URL
      const mimeMatch = rawContent.match(/^data:(.*?);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      // Avoid duplicates
      if (!images.some(img => img.data === rawContent)) {
        images.push({ data: rawContent, mimeType });
      }

      if (isPinMention) {
        const pinIndex = parseInt(label.split('_')[1]) - 1;
        const pin = targetNode.data.pins?.[pinIndex];
        if (pin) {
          const x = Math.round(pin.x * 1000);
          const y = Math.round(pin.y * 1000);
          segments.push({
            type: 'reference',
            content: `[PIN_${pinIndex + 1} on ${targetNode.data.label} at coordinate: [${x}, ${y}]]`,
            nodeId: targetNode.id
          });
        } else {
          segments.push({
            type: 'reference',
            content: `[Invalid Pin on ${targetNode.data.label}]`,
            nodeId: targetNode.id
          });
        }
      } else {
        segments.push({
          type: 'reference',
          content: `[IMAGE_DATA: ${rawContent.substring(0, 40)}...]`,
          nodeId: targetNode.id
        });
      }
    } else {
      let finalValue = rawContent;
      if (targetNode.data.includeTitleInOutput) {
        finalValue = `\n${targetNode.data.label || 'Text'}:\n${rawContent}\n`;
      }
      segments.push({
        type: 'reference',
        content: finalValue,
        nodeId: targetNode.id
      });
    }

    lastIndex = mentionRegex.lastIndex;
  }

  // Add remaining text segment
  if (lastIndex < prompt.length) {
    segments.push({
      type: 'text',
      content: prompt.substring(lastIndex)
    });
  }

  // Construct final prompt string for AI
  const finalPrompt = segments.map(s => s.content).join('');

  return {
    prompt: finalPrompt,
    segments,
    images,
    referencedNodeIds
  };
};
