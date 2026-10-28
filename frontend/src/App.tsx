import { useRef, useEffect, useState } from "react";
import { useChatStream } from "./hooks/useChatStream";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { DocumentSidebar } from "./components/DocumentSidebar";

export default function App() {
  const { messages, isStreaming, sendMessage, clearMessages } = useChatStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      <DocumentSidebar onClearAll={clearMessages} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="px-4 py-3 border-b border-gray-800 flex items-center">
          <h1 className="font-bold text-lg text-gray-200">RAG Assistant</h1>
        </header>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 pr-2">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              Upload a document, then ask a question...
            </div>
          )}
          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              message={msg}
              isStreamingLast={isStreaming && idx === messages.length - 1}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput onSend={sendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
