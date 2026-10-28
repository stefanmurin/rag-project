import type { Message } from "../types";

interface ChatMessageProps {
  message: Message;
  isStreamingLast?: boolean;
}

export function ChatMessage({ message, isStreamingLast }: ChatMessageProps) {
  const isUser = message.role === "user";

  let displayText = message.content;
  if (!displayText) {
    displayText = isStreamingLast ? "Thinking..." : "No answer.";
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`p-3 rounded-lg max-w-[85%] whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-900 border border-gray-800 text-gray-100"
        }`}
      >
        {displayText}
      </div>
    </div>
  );
}
