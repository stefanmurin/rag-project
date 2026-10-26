// src/hooks/useChatStream.ts
import { useState, useRef } from "react";
import type { Message } from "../types";

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (query: string) => {
    if (!query.trim() || isStreaming) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Vytvoríme signál na 30 sekúnd
    const timeoutSignal = AbortSignal.timeout(30_000);
    // Skombinujeme manuálny abort s 30s timeoutom
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
        throw new Error(`Chyba servera: ${res.status}`);
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
                      // Ak je obsah prázdny, použi data.answer (kde je fallback text z backendu)
                      content: last.content.trim()
                        ? last.content
                        : data.answer || "V dokumentoch sa nenašla odpoveď.",
                      citations: data.citations ?? [],
                    };
                  }
                  return updated;
                });
              }
            } catch (err) {
              console.warn("Chyba pri parsovaní SSE JSON:", err);
            }
          }
        }
      }
    } catch (err: unknown) {
      const errorObj = err as { name?: string };

      let errorMessage = "Chyba pripojenia k serveru.";

      // Špecifická správa pri vypršaní 30s limitu
      if (errorObj?.name === "TimeoutError") {
        errorMessage =
          "Odpoveď trvala príliš dlho (viac ako 30 s). Model sa pravdepodobne načítaval do pamäte, skús otázku položiť znova.";
      } else if (errorObj?.name === "AbortError") {
        return; // Požiadavku zrušil používateľ novým dotazom
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

  return { messages, isStreaming, sendMessage };
}
