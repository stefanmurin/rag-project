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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[78%] text-sm leading-relaxed">
          {displayText}
        </div>
      </div>
    );
  }

  const citations = message.citations ?? [];

  return (
    <div className="flex gap-3 max-w-[92%]">
      <div className="flex-shrink-0 w-6 h-6 mt-0.5 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-indigo-400">
          <path d="M10 1a6 6 0 00-3.815 10.631C7.237 12.5 8 13.443 8 14.456v.644a.75.75 0 00.572.729 6.016 6.016 0 002.856 0A.75.75 0 0012 15.1v-.644c0-1.013.763-1.957 1.815-2.825A6 6 0 0010 1zM8.863 17.414a.75.75 0 00-.226 1.483 9.066 9.066 0 002.726 0 .75.75 0 00-.226-1.483 7.553 7.553 0 01-2.274 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-zinc-100 text-sm leading-relaxed whitespace-pre-wrap">
          {displayText}
        </p>
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
