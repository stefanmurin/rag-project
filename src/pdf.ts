import pdf from "pdf-parse";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer);
  
  // Základné vyčistenie: zjednotenie viacnásobných prázdnych riadkov
  const cleanedText = data.text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleanedText;
}
