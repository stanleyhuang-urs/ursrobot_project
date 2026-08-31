import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { requireBoardAccess } from "@/lib/boardAccess";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

/**
 * Streams an uploaded attachment from disk. Uploaded files are written to
 * public/uploads/ at runtime (see attachment.ts), but Next.js's production
 * static-file serving only recognizes files present in public/ at build
 * time — anything written after the server starts 404s if linked directly.
 * Routing through here instead also lets us check board access before
 * serving the file, rather than relying on the blanket login check in
 * proxy.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const session = await requireSession();
  const { attachmentId } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { item: { select: { boardId: true } } },
  });
  if (!attachment) {
    return NextResponse.json({ error: "找不到檔案" }, { status: 404 });
  }

  try {
    await requireBoardAccess(attachment.item.boardId, session);
  } catch {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(process.cwd(), "public", attachment.url));
  } catch {
    return NextResponse.json({ error: "檔案不存在" }, { status: 404 });
  }

  const contentType = MIME_TYPES[path.extname(attachment.fileName).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    },
  });
}
