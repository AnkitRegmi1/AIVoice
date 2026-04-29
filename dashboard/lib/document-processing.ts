import { PDFParse } from "pdf-parse";

const SUPPORTED_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "text/html",
  "text/xml",
  "application/xml",
  "application/pdf",
]);

const SUPPORTED_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".html", ".xml", ".pdf"];

export function isSupportedDocument(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return SUPPORTED_TYPES.has(file.type) || SUPPORTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function supportedDocumentMessage(): string {
  return "Supported formats: .txt, .md, .csv, .json, .html, .xml, and .pdf.";
}

export function normalizeDocumentText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkDocumentText(text: string, maxLength = 700): string[] {
  const normalized = normalizeDocumentText(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        if (!sentence.trim()) continue;
        if ((current + " " + sentence).trim().length <= maxLength) {
          current = current ? `${current} ${sentence}` : sentence;
        } else {
          flush();
          if (sentence.length <= maxLength) {
            current = sentence;
          } else {
            for (let i = 0; i < sentence.length; i += maxLength) {
              chunks.push(sentence.slice(i, i + maxLength).trim());
            }
          }
        }
      }
      flush();
      continue;
    }

    if ((current + "\n\n" + paragraph).trim().length <= maxLength) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      flush();
      current = paragraph;
    }
  }

  flush();
  return chunks.filter(Boolean);
}

export async function extractDocumentText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeDocumentText(result.text ?? "");
    } finally {
      await parser.destroy();
    }
  }

  const raw = await file.text();
  return normalizeDocumentText(raw);
}
