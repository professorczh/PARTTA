import React, { useState, useEffect, useRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface EditableTitleProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
}

export const EditableTitle = ({ value, onSave, className }: EditableTitleProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (tempValue.trim() !== '' && tempValue.trim() !== value) {
      onSave(tempValue.trim());
    } else {
      setTempValue(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setTempValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "nodrag bg-white/10 border-none focus:outline-none text-[10px] font-display uppercase tracking-widest font-bold px-1 rounded w-full min-w-[60px]",
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={cn(
        "text-[10px] font-display uppercase tracking-widest font-bold cursor-text hover:bg-white/5 px-1 rounded transition-colors min-w-[60px] inline-block",
        className
      )}
    >
      {value || 'Untitled'}
    </span>
  );
};
