import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Upload, FileText, FileCode2, File, Trash2 } from "lucide-react";
import type { Document } from "../types";

function FileIcon({ title }: { title: string }) {
  const ext = title.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />;
  if (ext === "md")  return <FileCode2 className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />;
  return <File className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />;
}

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
      // backend may not be ready yet
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
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${API}/api/ingest/file`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      setUploadStatus("success");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchDocs();
      setTimeout(() => setUploadStatus(null), 2500);
    } catch {
      setUploadStatus("error");
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
    <aside className="flex flex-col w-56 shrink-0 h-screen border-r border-zinc-800 bg-zinc-900">
      {/* Title */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Documents</h2>
      </div>

      {/* Upload section */}
      <div className="px-3 py-3 border-b border-zinc-800 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-lg border border-zinc-700 transition-colors text-left"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-xs text-zinc-300 truncate">
            {selectedFile ? selectedFile.name : "Choose file…"}
          </span>
          {selectedFile && (
            <span className="text-xs text-zinc-600 ml-auto shrink-0">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </span>
          )}
        </button>

        {uploadStatus && (
          <p className={`text-xs font-medium pl-0.5 ${uploadStatus === "success" ? "text-emerald-400" : "text-rose-400"}`}>
            {uploadStatus === "success" ? "Indexed!" : "Upload failed."}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold rounded-lg text-white transition-colors"
        >
          {isUploading ? "Indexing..." : "Upload & index"}
        </button>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto py-2">
        {docs.length === 0 ? (
          <p className="px-4 py-3 text-xs text-zinc-600">No documents yet.</p>
        ) : (
          <ul className="space-y-px px-2">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-zinc-800/60 group transition-colors"
              >
                <FileIcon title={doc.title} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300 truncate leading-snug">{doc.title}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{doc.chunkCount} chunks</p>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="shrink-0 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clear all */}
      {docs.length > 0 && (
        <div className="px-3 py-3 border-t border-zinc-800">
          <button
            onClick={handleClearAll}
            className="w-full py-1.5 text-xs font-medium text-rose-400/80 border border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </aside>
  );
}
