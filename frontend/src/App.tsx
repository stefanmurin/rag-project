import { useRef, useEffect } from "react";
import { useChatStream } from "./hooks/useChatStream";
import { ChatMessage } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { DocumentUpload } from "./components/DocumentUpload";

export default function App() {
  const { messages, isStreaming, sendMessage } = useChatStream();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    // Reset databázy pri načítaní / refreshi stránky
    fetch("http://localhost:3000/api/reset", { method: "POST" })
      .then((res) => {
        if (res.ok) console.log("Databáza bola úspešne resetovaná.");
      })
      .catch((err) => console.error("Chyba pri resete DB:", err));
  }, []);
  return (
    <div className="flex flex-col h-screen mx-auto p-4 bg-gray-950 text-white">
      {/* Hlavička s flexboxom pre názov vľavo a tlačidlo vpravo */}
      <header className="py-3 border-b border-gray-800 flex items-center justify-between">
        <h1 className="font-bold text-lg text-gray-200">RAG Assistant</h1>
        <DocumentUpload />
      </header>

      <div className="flex-1 overflow-y-auto space-y-4 my-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            Polož otázku k nahraným dokumentom...
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
  );
}
