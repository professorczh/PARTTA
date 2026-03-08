import React from 'react';

interface RatioIconProps {
  ratio: string;
  size?: number;
  className?: string;
}

export const RatioIcon: React.FC<RatioIconProps> = ({ ratio, size = 16, className }) => {
  // Map ratio string to SVG dimensions
  const getDimensions = () => {
    switch (ratio) {
      case '1:1': return { width: 12, height: 12, x: 2, y: 2 };
      case '9:16': return { width: 8, height: 14, x: 4, y: 1 };
      case '16:9': return { width: 14, height: 8, x: 1, y: 4 };
      case '3:4': return { width: 10, height: 13, x: 3, y: 1.5 };
      case '4:3': return { width: 13, height: 10, x: 1.5, y: 3 };
      case '3:2': return { width: 13.5, height: 9, x: 1.25, y: 3.5 };
      case '2:3': return { width: 9, height: 13.5, x: 3.5, y: 1.25 };
      case '5:4': return { width: 12, height: 9.6, x: 2, y: 3.2 };
      case '4:5': return { width: 9.6, height: 12, x: 3.2, y: 2 };
      case '21:9': return { width: 15, height: 6.4, x: 0.5, y: 4.8 };
      default: return { width: 12, height: 12, x: 2, y: 2 }; // Default 1:1
    }
  };

  const { width, height, x, y } = getDimensions();

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect 
        x={x} 
        y={y} 
        width={width} 
        height={height} 
        rx={1} 
        stroke="currentColor" 
        strokeWidth="1.5"
      />
    </svg>
  );
};
