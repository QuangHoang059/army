'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine } from 'lucide-react';

/* ---------- Camera QR scanner ----------
 * Dùng BarcodeDetector nếu trình duyệt có (Chrome Android), còn lại (iPhone Safari, Firefox, Chrome Windows…)
 * giải mã bằng thư viện jsQR → chạy được trên mọi trình duyệt có camera.
 * Lưu ý: trình duyệt chỉ cho mở camera trên trang https:// (hoặc localhost).
 */

type Detector = {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};
type DetectorCtor = (new (o: { formats: string[] }) => Detector) & {
  getSupportedFormats?: () => Promise<string[]>;
};

function camError(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Trình duyệt đang chặn camera. Bấm biểu tượng ổ khoá / “Aa” cạnh thanh địa chỉ → Cho phép Camera, rồi tải lại trang.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Không tìm thấy camera trên thiết bị này.';
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'Camera đang bị ứng dụng khác dùng (Zalo, Camera…). Tắt ứng dụng đó rồi bấm “Bật camera” lại.';
  return 'Không mở được camera' + (e instanceof Error && e.message ? `: ${e.message}` : '.');
}

/** continuous: quét liên tục (kiểm đếm) — không tắt camera sau mỗi mã, bỏ qua mã vừa đọc trong 2,5 giây. */
export function CameraScanner({ onResult, continuous = false }: { onResult: (code: string) => void; continuous?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [problem, setProblem] = useState<string | null>(null); // trình duyệt không dùng được camera
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!window.isSecureContext)
      setProblem('Camera chỉ hoạt động khi mở app bằng địa chỉ https:// — hãy mở bằng tên miền https của đơn vị.');
    else if (!navigator.mediaDevices?.getUserMedia)
      setProblem(
        'Trình duyệt này không cho dùng camera (thường gặp khi mở link trong Zalo / Facebook). Hãy mở bằng Chrome hoặc Safari.',
      );
  }, []);

  const stop = useCallback(() => {
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop());
      return null;
    });
  }, []);

  // Tắt camera khi rời trang
  useEffect(() => () => stop(), [stop]);

  // Gắn hình camera vào khung video SAU KHI khung đã hiện, rồi quét liên tục
  useEffect(() => {
    const v = videoRef.current;
    if (!stream || !v) return;
    let alive = true;
    let timer = 0;
    v.srcObject = stream;
    v.play().catch(() => {});

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let detector: Detector | null = null;
    let jsQR: typeof import('jsqr').default | null = null;

    (async () => {
      const BD = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
      try {
        if (BD && (!BD.getSupportedFormats || (await BD.getSupportedFormats()).includes('qr_code')))
          detector = new BD({ formats: ['qr_code'] });
      } catch {
        detector = null;
      }
      if (!detector) jsQR = (await import('jsqr')).default;
    })();

    const started = Date.now();
    let last = { text: '', at: 0 };
    const tick = async () => {
      if (!alive) return;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        let text = '';
        try {
          if (detector) {
            text = (await detector.detect(v))[0]?.rawValue || '';
          } else if (jsQR && ctx) {
            // thu nhỏ khung hình cho nhanh
            const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text =
              jsQR(img.data, img.width, img.height, {
                inversionAttempts: 'attemptBoth',
              })?.data || '';
          }
        } catch {
          /* bỏ qua khung hình lỗi */
        }
        if (text && alive) {
          if (!continuous) {
            navigator.vibrate?.(80);
            onResult(text);
            stop();
            return;
          }
          const now = Date.now();
          if (text !== last.text || now - last.at > 2500) {
            navigator.vibrate?.(80);
            onResult(text);
          }
          last = { text, at: now };
        }
      } else if (Date.now() - started > 4000 && v.paused) {
        // iPhone đôi khi không tự phát → thử phát lại
        v.play().catch(() => {});
      }
      timer = window.setTimeout(tick, 200);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
      v.srcObject = null;
    };
  }, [stream, onResult, stop, continuous]);

  const start = async () => {
    setErr(null);
    setStarting(true);
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (e) {
        if (e instanceof Error && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
        s = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        }); // máy không có camera sau
      }
      setStream(s);
    } catch (e) {
      setErr(camError(e));
    } finally {
      setStarting(false);
    }
  };

  const on = !!stream;
  return (
    <div>
      <div className={on ? 'relative mx-auto w-full max-w-[300px]' : 'hidden'}>
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          className="aspect-square w-full rounded-xl bg-black object-cover"
        />
        {/* khung ngắm */}
        <div className="pointer-events-none absolute inset-[14%] rounded-xl border-4 border-[var(--gold)]/80" />
      </div>
      {!on && (
        <>
          <ScanLine className="mx-auto" size={44} />
          <p className="mt-2 font-bold">KHUNG CAMERA</p>
          <p className="text-xs text-gray-300">{problem || 'Bấm “Bật camera” rồi đưa mã QR vào khung vàng'}</p>
        </>
      )}
      {!problem && (
        <button
          onClick={on ? stop : start}
          disabled={starting}
          className="mx-auto mt-3 flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {on ? <CameraOff size={16} /> : <Camera size={16} />}{' '}
          {on ? 'Tắt camera' : starting ? 'Đang mở camera…' : 'Bật camera'}
        </button>
      )}
      {on && <p className="mt-2 text-xs text-gray-300">Giữ máy cách tem 10–20 cm, đủ sáng.</p>}
      {err && <p className="mx-auto mt-2 max-w-[300px] text-xs font-semibold text-red-300">{err}</p>}
    </div>
  );
}
