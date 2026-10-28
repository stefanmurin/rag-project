import { useState, useRef } from "react";
import type { Message } from "../types";

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearMessages = () => setMessages([]);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timeoutSignal = AbortSignal.timeout(120_000);
    const combinedSignal = AbortSignal.any([
      abortControllerRef.current.signal,
      timeoutSignal,
    ]);

    setIsStreaming(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: query },
      { role: "assistant", content: "", citations: [] },
    ]);

    try {
      const res = await fetch("http://localhost:3000/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
        signal: combinedSignal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split(/\r?\n/);
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;

            const jsonStr = line.replace(/^data:\s*/, "").trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "token" && typeof data.text === "string") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + data.text,
                    };
                  }
                  return updated;
                });
              }

              if (data.type === "done") {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content.trim()
                        ? last.content
                        : data.answer || "No answer found in the documents.",
                      citations: data.citations ?? [],
                    };
                  }
                  return updated;
                });
              }
            } catch (err) {
              console.warn("Failed to parse SSE JSON:", err);
            }
          }
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string };

      let errorMessage = "Could not connect to the server.";

      if (errorObj?.name === "TimeoutError") {
        errorMessage = "Response took too long (>2min). The model may still be loading — try again.";
      } else if (errorObj?.name === "AbortError") {
        return;
      }

      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: errorMessage,
          };
          return updated;
        }
        return [...prev, { role: "assistant", content: errorMessage }];
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return { messages, isStreaming, sendMessage, clearMessages };
}
