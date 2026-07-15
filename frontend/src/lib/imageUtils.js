/**
 * True for HEIC/HEIF by MIME type or extension.
 * iOS Photos often reports an empty type, so the extension matters.
 */
function isHeicFile(file) {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

/**
 * Convert HEIC/HEIF to a JPEG Blob so Chrome/Edge/Firefox can decode it.
 * heic2any is loaded on demand to keep the main bundle small.
 */
async function heicToJpegBlob(file, quality) {
  try {
    const { default: heic2any } = await import('heic2any');
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!(blob instanceof Blob)) {
      throw new Error('HEIC conversion returned no image');
    }
    return blob;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to convert HEIC image: ${message}`);
  }
}

/**
 * Reads a File/Blob as a data-URL, optionally downscaling so the payload
 * stays within Groq vision limits. Runs in the browser; OCR itself is
 * performed by the Django backend.
 *
 * HEIC/HEIF files are converted to JPEG first (most desktop browsers cannot
 * decode them natively).
 */
export async function fileToDataUrl(file, { maxEdge = 1536, quality = 0.85 } = {}) {
  let source = file;
  if (isHeicFile(file)) {
    source = await heicToJpegBlob(file, quality);
  }

  const rawUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(source);
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
  if (scale >= 1 && source.size < 3_500_000) return rawUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}
