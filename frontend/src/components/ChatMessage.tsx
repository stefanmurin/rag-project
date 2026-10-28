import { Sparkles } from "lucide-react";
import type { Message } from "../types";

interface ChatMessageProps {
  message: Message;
  isStreamingLast?: boolean;
}

function ThinkingDots() {
  return (
    <div className="flex gap-1 items-center h-5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

export function ChatMessage({ message, isStreamingLast }: ChatMessageProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[78%] text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  const citations = message.citations ?? [];
  const isThinking = isStreamingLast && !message.content;

  return (
    <div className="flex gap-3 max-w-[92%]">
      <div className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
        <Sparkles className="w-3 h-3 text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        {isThinking ? (
          <ThinkingDots />
        ) : (
          <p className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap">
            {message.content || "No answer."}
          </p>
        )}
        {citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {citations.map((c) => (
              <span
                key={c.n}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-400"
                title={c.content.slice(0, 160)}
              >
                <span className="text-indigo-400 font-mono font-medium">[{c.n}]</span>
                <span className="truncate max-w-[130px] text-zinc-400">{c.title}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
