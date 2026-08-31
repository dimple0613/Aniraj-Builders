import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function convertPdfToImages(
  pdfFilePath: string,
  outputDir: string,
  baseName: string,
): Promise<string[]> {
  const { createCanvas, Image } = await import('canvas');

  const DOMMatrix = (await import('./dom-matrix')).default;
  (globalThis as any).DOMMatrix = DOMMatrix;

  const pdfjs = await import('pdfjs-dist');
  (pdfjs as any).GlobalWorkerOptions.workerSrc = '';

  const buf = await readFile(pdfFilePath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await (pdfjs as any).getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    const pageFilename = `${baseName}_page_${i - 1}.png`;
    const buf = canvas.toBuffer('image/png');
    await writeFile(join(outputDir, pageFilename), buf);
    pages.push(pageFilename);
  }

  return pages;
}
