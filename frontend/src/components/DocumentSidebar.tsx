import { useState, useRef, useEffect, type ChangeEvent } from "react";
import type { Document } from "../types";

const API = "http://localhost:3000";

interface Props {
  onClearAll: () => void;
}

export function DocumentSidebar({ onClearAll }: Props) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDocs() {
    try {
      const res = await fetch(`${API}/api/documents`);
      if (res.ok) setDocs(await res.json());
    } catch {
      // silently ignore — backend may not be ready yet
    }
  }

  useEffect(() => {
    fetchDocs();
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null);
    setUploadStatus(null);
  }

  async function handleUpload() {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const content = await selectedFile.text();
      const res = await fetch(`${API}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: selectedFile.name, content }),
      });
      if (!res.ok) throw new Error();
      setUploadStatus("Indexed successfully!");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocs();
      setTimeout(() => setUploadStatus(null), 2500);
    } catch {
      setUploadStatus("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetch(`${API}/api/documents/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleClearAll() {
    try {
      await fetch(`${API}/api/reset`, { method: "POST" });
      setDocs([]);
      onClearAll();
    } catch {
      // ignore
    }
  }

  return (
    <aside className="flex flex-col w-60 shrink-0 h-screen border-r border-gray-800 bg-gray-900">
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-200">Documents</h2>
      </div>

      {/* Upload form */}
      <div className="px-3 py-3 border-b border-gray-800 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          onChange={handleFileChange}
          disabled={isUploading}
          className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer"
        />
        {selectedFile && (
          <p className="text-xs text-gray-400 truncate">
            {selectedFile.name}{" "}
            <span className="text-gray-600">
              ({(selectedFile.size / 1024).toFixed(1)} KB)
            </span>
          </p>
        )}
        {uploadStatus && (
          <p
            className={`text-xs font-medium ${
              uploadStatus.includes("success") ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {uploadStatus}
          </p>
        )}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-semibold rounded text-white transition"
        >
          {isUploading ? "Indexing..." : "Upload & index"}
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto py-2">
        {docs.length === 0 ? (
          <p className="px-4 py-3 text-xs text-gray-600">No documents yet.</p>
        ) : (
          <ul className="space-y-0.5 px-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start justify-between gap-1 rounded px-2 py-1.5 hover:bg-gray-800 group"
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-200 truncate">{doc.title}</p>
                  <p className="text-xs text-gray-600">{doc.chunkCount} chunks</p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="shrink-0 text-gray-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition text-xs mt-0.5"
                  title="Delete"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clear all */}
      {docs.length > 0 && (
        <div className="px-3 py-3 border-t border-gray-800">
          <button
            onClick={handleClearAll}
            className="w-full py-1.5 text-xs font-medium text-rose-400 border border-rose-400/30 hover:bg-rose-400/10 rounded transition"
          >
            Clear all
          </button>
        </div>
      )}
    </aside>
  );
}
