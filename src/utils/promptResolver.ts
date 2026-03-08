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

  // Regex to match [@ TYPE_Name (ID)]
  const mentionRegex = /\[@ (TEXT|IMG|VID)_(.*?) \((.*?)\)\]/g;

  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(prompt)) !== null) {
    const [fullMatch, type, name, id] = match;
    const startIndex = match.index;

    // Add preceding text segment
    if (startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: prompt.substring(lastIndex, startIndex)
      });
    }

    const targetNode = nodes.find(n => n.data.shortId === id);
    if (targetNode) {
      referencedNodeIds.push(targetNode.id);
      
      // Recursively resolve the target node's content
      const targetPrompt = targetNode.data.prompt || '';
      const resolvedTarget = resolvePrompt(targetPrompt, nodes, targetNode.id, newVisited);
      
      // Collect images from nested resolutions
      images.push(...resolvedTarget.images);
      
      const portType = type === 'IMG' ? 'image' : type === 'VID' ? 'video' : 'text';
      // Use output if available, otherwise use resolved prompt
      const rawContent = targetNode.data.outputs?.[portType as keyof NodeData['outputs']] || resolvedTarget.prompt;

      if (type === 'IMG' && rawContent && rawContent.startsWith('data:')) {
        images.push({ data: rawContent, mimeType: 'image/png' });
        segments.push({
          type: 'reference',
          content: `[Image: ${targetNode.data.label}]`,
          nodeId: targetNode.id
        });
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
    } else {
      segments.push({
        type: 'text',
        content: fullMatch
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
