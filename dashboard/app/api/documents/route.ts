import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getClinicTenantId } from "@/lib/clinic-tenant";
import { getDocuments, saveDocumentWithChunks } from "@/lib/db";
import {
  chunkDocumentText,
  extractDocumentText,
  isSupportedDocument,
  supportedDocumentMessage,
} from "@/lib/document-processing";

const MAX_FILE_SIZE_BYTES = 3_000_000;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = getClinicTenantId();
  const documents = await getDocuments(tenantId);
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Please choose a file to upload." }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large for this prototype. Keep uploads under 3 MB." },
      { status: 400 }
    );
  }

  if (!isSupportedDocument(file)) {
    return NextResponse.json({ error: supportedDocumentMessage() }, { status: 400 });
  }

  const normalized = await extractDocumentText(file);
  if (!normalized) {
    return NextResponse.json({ error: "Could not extract readable text from that file." }, { status: 400 });
  }

  const chunks = chunkDocumentText(normalized);
  if (chunks.length === 0) {
    return NextResponse.json({ error: "The document did not contain enough text to save." }, { status: 400 });
  }

  const tenantId = getClinicTenantId();
  const saved = await saveDocumentWithChunks(tenantId, {
    filename: file.name,
    mimeType: file.type || null,
    rawText: normalized,
    chunks,
  });

  if (!saved) {
    return NextResponse.json({ error: "Document upload failed." }, { status: 500 });
  }

  return NextResponse.json({
    document: saved,
    chunkCount: chunks.length,
    message: "Document uploaded and indexed successfully.",
  });
}
