import { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Textarea } from '@/components/ui/textarea';

export type ChatInputHandle = {
  clear: () => void;
  focus: () => void;
  getValue: () => string;
};

type Props = {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
};

export const ChatInput = forwardRef<ChatInputHandle, Props>(
  ({ onSubmit, disabled, placeholder = 'Ask a follow-up...', onChange: onChangeProp }, ref) => {
    const [value, setValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        setValue('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      },
      focus: () => textareaRef.current?.focus(),
      getValue: () => value,
    }), [value]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      onChangeProp?.(e.target.value);
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }, [onChangeProp]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (trimmed) onSubmit(trimmed);
      }
    }, [value, onSubmit]);

    return (
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="min-h-[44px] max-h-[160px] resize-none text-base leading-relaxed border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:ring-0 focus:border-0 px-0 bg-transparent overflow-y-auto"
        rows={1}
        disabled={disabled}
      />
    );
  }
);

ChatInput.displayName = 'ChatInput';
