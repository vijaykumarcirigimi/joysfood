"use client";

/**
 * Downscale a photo in the browser before it is uploaded.
 *
 * Two reasons, and the second is the one that was actually breaking:
 *
 *   1. Dish photos render at 144px wide on desktop and 38vw on mobile. Sending
 *      a 5 MB original to store, serve and re-download is waste at every step.
 *
 *   2. Server Actions have a body limit — 1 MB by default in Next.js, and a
 *      hard ~4.5 MB ceiling on Vercel's serverless functions regardless of
 *      config. A modern phone photo is 2–8 MB, so uploads failed with a 413
 *      *before* the action ran, which meant the "Photo must be under 5 MB"
 *      check inside it could never fire. Resizing here keeps a typical upload
 *      near 200 KB, comfortably under any of those limits.
 */

/** Long edge, in pixels. Generous for a menu thumbnail viewed on a phone. */
const MAX_EDGE = 1400;
const QUALITY = 0.82;

/** Below this, re-encoding costs quality and saves nothing worth having. */
const PASSTHROUGH_BYTES = 400 * 1024;

export type ResizeResult = {
  file: File;
  /** True when the original was returned untouched. */
  skipped: boolean;
  originalBytes: number;
};

export async function downscaleImage(file: File): Promise<ResizeResult> {
  const originalBytes = file.size;

  // Small files, and anything we cannot decode as a bitmap (AVIF support is
  // uneven), go through as they are. The server still validates type and size.
  if (file.size <= PASSTHROUGH_BYTES) {
    return { file, skipped: true, originalBytes };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Undecodable here does not mean unusable — let the server decide.
    return { file, skipped: true, originalBytes };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return { file, skipped: true, originalBytes };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );

  // If encoding failed, or somehow produced something larger, keep the original
  // rather than shipping a worse file.
  if (!blob || blob.size >= file.size) {
    return { file, skipped: true, originalBytes };
  }

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], name, { type: "image/jpeg" }),
    skipped: false,
    originalBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
