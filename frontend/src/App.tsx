import { useRef, useEffect } from "react";
import { BookOpen } from "lucide-react";
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
    <div className="flex h-screen bg-zinc-950 text-zinc-100">
      <DocumentSidebar onClearAll={clearMessages} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="px-6 py-4 border-b border-zinc-800/60">
          <h1 className="text-sm font-semibold text-zinc-300 tracking-wide">RAG Assistant</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-zinc-300 text-sm font-medium">No documents yet</p>
                <p className="text-zinc-600 text-xs mt-1">Upload a document in the sidebar, then ask a question.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
              {messages.map((msg, idx) => (
                <ChatMessage
                  key={idx}
                  message={msg}
                  isStreamingLast={isStreaming && idx === messages.length - 1}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 pb-5 pt-3 border-t border-zinc-800/60">
          <div className="max-w-2xl mx-auto w-full">
            <ChatInput onSend={sendMessage} disabled={isStreaming} />
          </div>
        </div>
      </div>
    </div>
  );
}
