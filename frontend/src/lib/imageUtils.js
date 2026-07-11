/**
 * Reads a File/Blob as a data-URL, optionally downscaling so the payload
 * stays within Groq vision limits. Runs in the browser; OCR itself is
 * performed by the Django backend.
 */
export async function fileToDataUrl(file, { maxEdge = 1536, quality = 0.85 } = {}) {
  const rawUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

  if (!String(rawUrl).startsWith('data:image/')) {
    throw new Error('Selected file is not an image');
  }

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = rawUrl;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  if (scale >= 1 && file.size < 3_500_000) return rawUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
