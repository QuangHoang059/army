'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Pencil,
  Printer,
  QrCode as QrIcon,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useData } from '@/components/DataProvider';
import { useAuth } from '@/components/AuthProvider';
import { CameraScanner } from '@/components/CameraScanner';
import { PhotoPicker } from '@/components/PhotoPicker';
import { WeaponEditDialog } from '@/components/WeaponEditDialog';
import { PageTitle, QrCode, StatusBadge, card } from '@/components/ui';
import { api } from '@/lib/api';
import { daysUntil, fmtDate, fmtDateTime } from '@/lib/date';
import { RETURN_WEAPON_STATUSES, type WeaponDetail, type WeaponStatus } from '@/lib/types';

const QUICK = ['QRCB-001', 'QRCB-004', 'QRCB-021', 'QRCB-033'];

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <Scan />
    </Suspense>
  );
}

function Scan() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get('code') || '';
  const { weapons, setFlash, run, busy } = useData();
  const [input, setInput] = useState(code);
  const [detail, setDetail] = useState<WeaponDetail | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Điện thoại: thẻ thông tin nằm dưới khung camera → tự cuộn xuống khi quét ra vũ khí
  useEffect(() => {
    if (detail?.id && window.innerWidth < 1024)
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [detail?.id]);

  const select = useCallback(
    // scroll: false → không kéo trang về đầu (để còn cuộn xuống thẻ thông tin)
    (c: string) => router.replace(c ? `/scan?code=${encodeURIComponent(c)}` : '/scan', { scroll: false }),
    [router],
  );

  // Tải thẻ chi tiết mỗi khi mã thay đổi hoặc dữ liệu được cập nhật
  useEffect(() => {
    if (!code) {
      setDetail(null);
      return;
    }
    let alive = true;
    api
      .weapon(code)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        // Quét tem có link /w/<mã bí mật> → hiện lại mã QRCB-xxx trên ô nhập / thanh địa chỉ
        if (/^[0-9a-f]{24}$/.test(code)) {
          setInput(d.code);
          select(d.code);
        }
      })
      .catch((e) => {
        if (!alive) return;
        setDetail(null);
        setFlash({ kind: 'error', text: e.message });
      });
    return () => {
      alive = false;
    };
  }, [code, weapons, setFlash, select]);

  const scan = (raw: string) => {
    // Mã QR chứa nhiều dòng thông tin → lấy mã QRCB-xxx (hoặc số hiệu VN-xxx) trong đó
    const t = raw.trim().toUpperCase();
    // Tem mới: link .../w/<mã bí mật 24 ký tự> — máy chủ tra được theo mã này
    const c =
      t.match(/\/W\/([0-9A-F]{24})\b/)?.[1].toLowerCase() || t.match(/QRCB-\d+/)?.[0] || t.match(/VN-\d+/)?.[0] || t;
    if (!c) return;
    setInput(c);
    setFlash(null);
    select(c);
  };

  return (
    <section>
      <PageTitle
        title="Quét QR"
        sub="Dùng camera điện thoại hoặc nhập mã QRCB-xxx / số hiệu VN-xxx, hoặc chọn vũ khí trong danh sách."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="rounded-2xl border-4 border-dashed border-[var(--green)] bg-black p-4 text-center text-white">
          <CameraScanner onResult={scan} />
          <div className="mx-auto mt-4 max-w-[300px] rounded-xl bg-white p-3 text-black">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && scan(input)}
                placeholder="Ví dụ: QRCB-001"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-2.5 font-mono uppercase text-black"
              />
              <button onClick={() => scan(input)} className="rounded-lg bg-[var(--red)] px-4 py-2 font-bold text-white">
                Quét
              </button>
            </div>
            <label className="mt-3 block text-left text-xs font-bold">
              Hoặc chọn nhanh 1 vũ khí
              <select
                value={detail?.code || ''}
                onChange={(e) => {
                  setInput(e.target.value);
                  select(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-black"
              >
                <option value="">— Chọn vũ khí —</option>
                {weapons.map((w) => (
                  <option key={w.id} value={w.code}>
                    {w.code} • {w.name} • {w.serial}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {QUICK.map((c) => (
              <button key={c} onClick={() => scan(c)} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                {c}
              </button>
            ))}
          </div>
        </div>

        <div ref={resultRef} className="min-w-0 scroll-mt-[150px] lg:scroll-mt-28">
          {detail ? (
            <WeaponCard
              w={detail}
              busy={busy}
              onStatus={(s) =>
                run(() => api.updateWeapon(detail.id, { status: s }), `Đã cập nhật tình trạng ${detail.serial}: ${s}.`)
              }
              onPhoto={(img) => run(() => api.uploadPhoto(detail.id, img), `Đã cập nhật ảnh ${detail.code}.`)}
              onRetire={() => {
                const reason = prompt(
                  `Thanh lý / ngừng sử dụng ${detail.name} — ${detail.serial}.\nVũ khí sẽ ẩn khỏi danh sách nhưng GIỮ lịch sử (khôi phục lại được).\n\nLý do (bắt buộc):`,
                )?.trim();
                if (reason === undefined) return;
                if (!reason)
                  return setFlash({
                    kind: 'error',
                    text: 'Cần nhập lý do thanh lý.',
                  });
                run(() => api.retireWeapon(detail.id, reason), `Đã thanh lý ${detail.serial}.`);
              }}
              onNewLink={() => {
                if (
                  confirm(
                    `Cấp link tem QR mới cho ${detail.code}?\nTem đang dán sẽ KHÔNG mở được nữa — dùng khi tem bị mất / bị chụp lộ. Cần in và dán tem mới.`,
                  )
                )
                  run(
                    () => api.rotatePublicToken(detail.id),
                    `Đã cấp link tem mới cho ${detail.code} — hãy in lại tem.`,
                  );
              }}
              onRestore={() => {
                if (confirm(`Khôi phục ${detail.name} — ${detail.serial} trở lại sử dụng?`))
                  run(() => api.restoreWeapon(detail.id), `Đã khôi phục ${detail.serial}.`);
              }}
              onDelete={async () => {
                if (
                  !confirm(
                    `Xoá hẳn ${detail.name} — ${detail.serial}? (Vũ khí chưa có lịch sử nào — dùng khi nhập nhầm.)`,
                  )
                )
                  return;
                const ok = await run(() => api.deleteWeapon(detail.id).then(() => true), `Đã xoá ${detail.serial}.`);
                if (ok) {
                  setInput('');
                  select('');
                }
              }}
            />
          ) : (
            <div className={`${card} flex items-center justify-center p-8 text-center`}>
              <div>
                <QrIcon className="mx-auto text-[var(--muted)]" size={42} />
                <p className="mt-2 font-bold">Chưa có vũ khí được quét</p>
                <p className="text-sm text-[var(--muted)]">Nhập mã hoặc chọn vũ khí để hiện thẻ thông tin chi tiết.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function WeaponCard({
  w,
  busy,
  onStatus,
  onRetire,
  onRestore,
  onNewLink,
  onDelete,
  onPhoto,
}: {
  w: WeaponDetail;
  busy: boolean;
  onStatus: (s: WeaponStatus) => void;
  onRetire: () => void;
  onRestore: () => void;
  onNewLink: () => void;
  onDelete: () => void;
  onPhoto: (img: Blob) => Promise<unknown>;
}) {
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const active = !w.retired;
  const d = daysUntil(w.next);
  const info: [string, React.ReactNode][] = [
    ['Số hiệu súng', w.serial],
    ['Mã QR', w.code],
    ['Loại', w.type],
    ['Đơn vị quản lý', w.unit],
    ['Người chịu trách nhiệm', w.responsible],
    [
      'Bảo dưỡng tiếp theo',
      <span key="n" className={d < 0 ? 'text-[var(--red)]' : ''}>
        {fmtDate(w.next)} {d < 0 ? `(quá ${Math.abs(d)} ngày)` : `(còn ${d} ngày)`}
      </span>,
    ],
  ];

  return (
    <div className={`${card} p-4`}>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-3">
          <QrCode w={w} size={150} />
          {isAdmin && active ? (
            <PhotoPicker src={w.photo} width={150} disabled={busy} onPick={onPhoto} />
          ) : (
            w.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={w.photo}
                alt="Ảnh vũ khí"
                width={150}
                className="rounded-xl border object-cover"
                style={{ aspectRatio: '4 / 3' }}
              />
            )
          )}
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold uppercase">{w.name}</h2>
            <StatusBadge s={w.retired ? 'Đã thanh lý' : w.status} />
          </div>
          {w.retired && (
            <div className="mt-2 rounded-lg border border-gray-400 bg-gray-100 p-2 text-sm text-gray-800">
              <b>Đã thanh lý / ngừng sử dụng</b> từ {fmtDate(w.retiredAt || '')}
              {w.retiredReason && <> — Lý do: {w.retiredReason}</>}
              <div className="text-xs">Không ghi bảo dưỡng / mượn được. Lịch sử bên dưới vẫn được giữ.</div>
              {isAdmin && (
                <button
                  disabled={busy}
                  onClick={onRestore}
                  className="no-print mt-2 flex items-center gap-1 rounded-lg bg-[var(--green)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  <ArchiveRestore size={14} /> Khôi phục sử dụng
                </button>
              )}
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-[var(--muted)]">{k}</dt>
                <dd className="font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="no-print mt-3 flex flex-wrap gap-2">
            {active && (
              <Link
                href={`/maintenance?weapon=${w.code}`}
                className="rounded-lg bg-[var(--green)] px-3 py-2 text-sm font-bold text-white"
              >
                Ghi bảo dưỡng
              </Link>
            )}
            {active && w.status !== 'Đang mượn' && (
              <Link
                href={`/loans?weapon=${w.code}`}
                className="rounded-lg bg-[var(--red)] px-3 py-2 text-sm font-bold text-white"
              >
                Ghi mượn / bàn giao
              </Link>
            )}
            {w.status === 'Đang mượn' && (
              <Link
                href={`/loans?return=${w.code}`}
                className="rounded-lg bg-[var(--green)] px-3 py-2 text-sm font-bold text-white"
              >
                Ghi trả
              </Link>
            )}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"
            >
              <Printer size={15} /> In tem QR
            </button>
            {isAdmin && active && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold"
              >
                <Pencil size={15} /> Sửa thông tin
              </button>
            )}
            {isAdmin && (
              <button
                onClick={onNewLink}
                disabled={busy}
                title="Tem bị mất / lộ: đổi link, tem cũ hết hiệu lực"
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
              >
                <RefreshCw size={15} /> Cấp link tem mới
              </button>
            )}
          </div>
          {editing && <WeaponEditDialog w={w} onClose={() => setEditing(false)} />}
          {isAdmin && active && w.status !== 'Đang mượn' && (
            <div className="no-print mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xs font-bold text-[var(--muted)]">Cập nhật tình trạng:</span>
              {RETURN_WEAPON_STATUSES
                .filter((s) => s !== w.status)
                .map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() => onStatus(s)}
                    className="rounded-full border px-3 py-1 text-xs font-bold hover:border-[var(--green)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              <span className="ml-auto flex gap-2">
                <button
                  disabled={busy}
                  onClick={onRetire}
                  title="Ẩn khỏi danh sách, giữ lịch sử"
                  className="flex items-center gap-1 rounded-full border border-red-300 px-3 py-1 text-xs font-bold text-[var(--red)] disabled:opacity-50"
                >
                  <Archive size={13} /> Thanh lý
                </button>
                {w.deletable && (
                  <button
                    disabled={busy}
                    onClick={onDelete}
                    title="Chỉ khi nhập nhầm — vũ khí chưa có lịch sử"
                    className="flex items-center gap-1 rounded-full border border-red-300 px-3 py-1 text-xs font-bold text-[var(--red)] disabled:opacity-50"
                  >
                    <Trash2 size={13} /> Xoá hẳn
                  </button>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-3">
          <h3 className="font-bold">Lịch sử bảo dưỡng</h3>
          {w.maintenance.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Chưa có phiếu bảo dưỡng.</p>
          ) : (
            w.maintenance.map((m) => (
              <div key={m.id} className="mt-2 border-t pt-2 text-sm">
                <b>{fmtDate(m.date)}</b> • {m.worker}
                <div>{m.content}</div>
                <span className="text-xs">
                  Kết quả: {m.result} • Hạn tiếp theo: {fmtDate(m.nextDate)}
                </span>
                {m.recordedBy && <div className="text-xs text-[var(--muted)]">Ghi bởi: {m.recordedBy}</div>}
              </div>
            ))
          )}
        </div>
        <div className="rounded-xl border p-3">
          <h3 className="font-bold">Lịch sử mượn — trả</h3>
          {w.loans.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">Chưa có phiếu mượn — trả.</p>
          ) : (
            w.loans.map((l) => (
              <div key={l.id} className="mt-2 border-t pt-2 text-sm">
                <b>{l.borrower}</b> • {l.purpose}
                <div>
                  Mượn: {fmtDateTime(l.borrowAt)} {l.returnAt ? `• Trả: ${fmtDateTime(l.returnAt)}` : '• Chưa trả'}
                </div>
                {l.returnStatus && <div>Tình trạng khi trả: {l.returnStatus}</div>}
                {(l.recordedBy || l.returnedBy) && (
                  <div className="text-xs text-[var(--muted)]">
                    {l.recordedBy && `Ghi mượn: ${l.recordedBy}`}
                    {l.recordedBy && l.returnedBy && ' • '}
                    {l.returnedBy && `Ghi trả: ${l.returnedBy}`}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
