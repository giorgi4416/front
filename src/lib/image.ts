const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Center-crops and downsizes an avatar to a small square so uploads stay fast and storage stays small. */
export async function prepareAvatar(file: File, size = 256): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('That image is larger than 8 MB. Choose a smaller one.');

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('That file could not be read as an image.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
  const blob = (await toBlob('image/webp')) ?? (await toBlob('image/jpeg'));
  if (!blob) throw new Error('The image could not be processed.');
  return blob;
}
