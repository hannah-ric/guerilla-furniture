import React, { useState } from 'react';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Message } from '@/lib/types';

interface Props {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  suggestions?: string[];
}

export function DesignChatInterface({ messages, onSendMessage, isLoading, suggestions }: Props) {
  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} isLoading={isLoading} />
      <MessageInput 
        onSend={onSendMessage} 
        disabled={isLoading}
        suggestions={suggestions}
      />
    </div>
  );
}