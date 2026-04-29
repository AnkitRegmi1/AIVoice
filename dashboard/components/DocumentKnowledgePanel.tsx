"use client";

import { useState } from "react";
import type { DocumentRow } from "@/lib/db";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function DocumentKnowledgePanel({ initialDocuments }: { initialDocuments: DocumentRow[] }) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(formData: FormData) {
    setUploading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
        document?: DocumentRow;
      };

      if (!response.ok || !payload.document) {
        setError(payload.error ?? "Upload failed.");
        return;
      }

      setDocuments((current) => [payload.document!, ...current.filter((doc) => doc.id !== payload.document!.id)]);
      setMessage(payload.message ?? "Document uploaded.");
    } catch {
      setError("Could not upload the document. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="app-panel mt-6 p-6 sm:p-8">
      <div className="mb-5 space-y-3">
        <p className="app-label">Knowledge retrieval</p>
        <h3 className="app-card-title text-slate-900">Uploaded documents</h3>
        <p className="text-sm leading-7 text-slate-600">
          Upload PDFs or text documents so the receptionist can answer policy, service, and FAQ
          questions with retrieved business context.
        </p>
      </div>

      <form
        className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const formData = new FormData(form);
          await handleUpload(formData);
          form.reset();
        }}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="file"
            name="file"
            required
            accept=".txt,.md,.csv,.json,.html,.xml,.pdf,text/plain,text/markdown,text/csv,application/json,text/html,text/xml,application/xml,application/pdf"
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-600 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:uppercase file:tracking-[0.2em] file:text-white hover:file:bg-indigo-500"
          />
          <button type="submit" disabled={uploading} className="app-button-primary disabled:opacity-60">
            {uploading ? "Uploading" : "Upload document"}
          </button>
        </div>

        <p className="mt-3 text-xs leading-6 text-slate-500">
          Supported prototype formats: .txt, .md, .csv, .json, .html, .xml, and .pdf.
        </p>
      </form>

      {message ? <p className="mt-4 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}

      <div className="mt-6">
        <h4 className="app-label mb-3">Indexed documents</h4>
        {documents.length === 0 ? (
          <p className="app-panel-soft p-4 text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {documents.map((doc) => (
              <li key={doc.id} className="app-panel-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{doc.filename}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                      {doc.chunk_count} chunks indexed
                    </p>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{formatDate(doc.uploaded_at)}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {doc.raw_text_length} characters are available for retrieval during calls.
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
