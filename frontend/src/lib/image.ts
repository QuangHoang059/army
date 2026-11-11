/**
 * Thu nhỏ ảnh trước khi upload (ảnh điện thoại thường 3–10MB) → JPEG, cạnh dài tối đa `max` px.
 * Trình duyệt hiện đại tự xoay ảnh theo EXIF khi vẽ lên canvas.
 */
export async function shrinkImage(file: File, max = 1280, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('File được chọn không phải ảnh.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => fail(new Error('Không đọc được ảnh này (thử ảnh JPG/PNG khác).'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    ctx.fillStyle = '#fff'; // nền trắng cho ảnh PNG trong suốt
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error('Không nén được ảnh.'))), 'image/jpeg', quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
