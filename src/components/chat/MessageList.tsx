import React from 'react';
import { Message } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
            {message.metadata?.suggestions && (
              <div className="mt-2 pt-2 border-t border-current/20">
                <p className="text-sm opacity-80">Suggestions:</p>
                <ul className="text-sm list-disc list-inside opacity-80">
                  {message.metadata.suggestions.map((suggestion, idx) => (
                    <li key={idx}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-lg p-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
} 