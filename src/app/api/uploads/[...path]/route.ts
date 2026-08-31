import { NextRequest } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join, normalize } from "path";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePathParts } = await context.params;

    if (!filePathParts || filePathParts.length === 0) {
      return new Response("No path provided", { status: 400 });
    }

    const filePath = normalize(
      join(process.cwd(), "public", "uploads", ...filePathParts)
    );

    if (!existsSync(filePath)) {
      console.error("[api/uploads] File not found:", filePath);
      return new Response("File not found", { status: 404 });
    }

    const fileBuffer = readFileSync(filePath);

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      pdf: 'application/pdf',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[api/uploads] Error serving file:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
