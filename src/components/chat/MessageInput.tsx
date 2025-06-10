import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  suggestions?: string[];
}

export function MessageInput({ onSend, disabled, suggestions }: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="border-t p-4">
      {suggestions && suggestions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {suggestions.slice(0, 3).map((suggestion, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => setInput(suggestion)}
              disabled={disabled}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the furniture you want to build..."
          disabled={disabled}
          className="flex-1"
        />
        <Button type="submit" disabled={disabled || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
} 