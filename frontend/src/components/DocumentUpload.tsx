import { useState, useRef, useEffect, type ChangeEvent } from "react";

export function DocumentUpload() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStatusMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || isLoading) return;

    setIsLoading(true);
    setStatusMessage(null);

    try {
      // Prečítame obsah priamo pred odoslaním bez ukladania celého textu do React state
      const content = await selectedFile.text();

      const res = await fetch("http://localhost:3000/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedFile.name, // Zachováme .md príponu pre správny chunker
          content,
        }),
      });

      if (!res.ok) throw new Error("Chyba servera");

      setStatusMessage("Dokument úspešne zaindexovaný!");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setTimeout(() => {
        setIsOpen(false);
        setStatusMessage(null);
      }, 1500);
    } catch {
      setStatusMessage("Nepodarilo sa nahrať dokument.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 rounded-lg transition"
      >
        {isOpen ? "Zavrieť" : "+ Pridať dokument"}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 p-4 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 text-left">
          <h3 className="text-sm font-semibold text-gray-200 mb-3">
            Nahrať nový dokument
          </h3>

          <div className="space-y-3">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md"
                onChange={handleFileChange}
                disabled={isLoading}
                className="w-full text-xs text-gray-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-800 file:text-gray-200 hover:file:bg-gray-700 cursor-pointer"
              />
            </div>

            {selectedFile && (
              <div className="p-2 bg-gray-950 border border-gray-800 rounded text-xs text-gray-300 truncate">
                📄{" "}
                <span className="font-medium text-white">
                  {selectedFile.name}
                </span>{" "}
                <span className="text-gray-500">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            {statusMessage && (
              <div
                className={`text-xs text-center py-1 font-medium ${
                  statusMessage.includes("úspešne")
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              >
                {statusMessage}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={isLoading || !selectedFile}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold rounded-lg text-white transition"
            >
              {isLoading ? "Indexujem..." : "Nahrať a indexovať"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
