export interface Citation {
  n: number;
  chunkId: number;
  title: string;
  content: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}