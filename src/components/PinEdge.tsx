import React from 'react';
import { BaseEdge, EdgeProps, getBezierPath, Position } from '@xyflow/react';
import { motion } from 'motion/react';

export const PinEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
  data
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Right,
    targetX,
    targetY,
    targetPosition: Position.Left,
  });

  const isHighlighted = selected || data?.isHovered;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: isHighlighted ? '#ef4444' : 'rgba(255, 255, 255, 0.35)',
          strokeWidth: isHighlighted ? 3.5 : 2.5,
          transition: 'stroke 0.3s, stroke-width 0.3s',
        }}
      />
      {isHighlighted && (
        <motion.path
          d={edgePath}
          fill="none"
          stroke="#ef4444"
          strokeWidth={3.5}
          strokeDasharray="5,5"
          animate={{ strokeDashoffset: [0, -10] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          opacity={0.6}
        />
      )}
    </>
  );
};
