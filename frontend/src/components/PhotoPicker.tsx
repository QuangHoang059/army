'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { shrinkImage } from '@/lib/image';

/**
 * Ô ảnh minh hoạ: bấm vào để chọn ảnh mới.
 * accept="image/*" → trên điện thoại hiện lựa chọn "Chụp ảnh" hoặc "Thư viện ảnh"; trên máy tính mở hộp chọn file.
 */
export function PhotoPicker({
  src,
  onPick,
  width = 150,
  disabled = false,
  label = 'Thêm ảnh minh hoạ',
}: {
  src: string | null | undefined;
  onPick: (img: Blob, previewUrl: string) => void | Promise<unknown>;
  width?: number;
  disabled?: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setWorking(true);
    try {
      const blob = await shrinkImage(file);
      await onPick(blob, URL.createObjectURL(blob));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
      if (input.current) input.current.value = ''; // cho phép chọn lại cùng 1 file
    }
  };

  const busy = working || disabled;

  return (
    <div style={{ width }}>
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        title={src ? 'Bấm để đổi ảnh' : label}
        className="group relative block w-full overflow-hidden rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--surface)] hover:border-[var(--green)] disabled:opacity-60"
        style={{ aspectRatio: '4 / 3' }}
      >
        {src ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Ảnh vũ khí" className="h-full w-full object-cover" />
            <span className="no-print absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1 text-[11px] font-bold text-white opacity-90 group-hover:opacity-100">
              <Camera size={12} /> Đổi ảnh
            </span>
          </>
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] font-bold text-[var(--muted)]">
            <ImagePlus size={22} />
            {label}
          </span>
        )}
        {working && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="animate-spin" />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
      {err && <p className="mt-1 text-[11px] text-[var(--red)]">{err}</p>}
    </div>
  );
}
